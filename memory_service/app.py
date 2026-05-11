from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from collections import defaultdict, deque
import time
import os
import subprocess
import threading
import sys
from google import genai
from google.genai import types
from dotenv import load_dotenv

load_dotenv()
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY")
client = None
if GEMINI_API_KEY:
    client = genai.Client(api_key=GEMINI_API_KEY)

agent_logs = defaultdict(lambda: deque(maxlen=50))
agent_latencies = defaultdict(lambda: deque(maxlen=100))

from graph_client import graph_client, get_schema_client
from gatekeeper import extract_fact
from ontology_manager import ontology_manager
from adk_agents import get_agent
from document_ingestion import extract_text_from_file, analyze_document_for_ontology, chat_multimodal_ontology, chat_multimodal_memory, chat_multimodal_admin
from history_db import log_interaction, search_history, save_report, get_reports, delete_report
import asyncio

async def log_and_store_interaction(agent_id, session_id, role, content_type, content, **kwargs):
    log_interaction(agent_id, session_id, role, content_type, content, **kwargs)
    try:
        meta = kwargs.get("metadata") or {}
        if "file_path" in kwargs:
            meta["file_path"] = kwargs["file_path"]
        await get_schema_client(agent_id).store_interaction(session_id, role, content_type, content, metadata=meta)
    except Exception as e:
        print(f"Error storing interaction in graph: {e}")

app = FastAPI(title="OpenClaw Memory Service")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class MessagePayload(BaseModel):
    user_id: str
    channel: str
    message: str
    
class QueryPayload(BaseModel):
    user_id: str
    query: str

class SchemaPayload(BaseModel):
    nodes: list[str]
    predicates: list[str]
    properties: dict
    
class NodePayload(BaseModel):
    id: str
    label: str
    properties: dict

class EdgePayload(BaseModel):
    source: str
    target: str
    relation: str
    properties: dict = {}
    
class ChatPayload(BaseModel):
    message: str
    
@app.post("/ingest")
async def ingest_message(payload: MessagePayload):
    """Called by OpenClaw whenever a new message is received."""
    fact = extract_fact(payload.message)
    if fact:
        subject, predicate, obj = fact
        if not ontology_manager.validate_triple(subject, predicate, obj):
            return {"status": "rejected", "reason": f"Predicate {predicate} not in ontology"}
        
        # Store in FalkorDB
        await graph_client.store_fact(
            user_id=payload.user_id,
            subject=subject,
            predicate=predicate,
            object_val=obj,
            timestamp=time.time(),
            source_channel=payload.channel
        )
        return {"status": "fact_stored", "fact": fact}
    
    return {"status": "noise_ignored"}

@app.post("/retrieve")
async def retrieve_context(payload: QueryPayload):
    """Called by OpenClaw to fetch relevant facts before calling the LLM."""
    facts = await graph_client.retrieve_relevant_facts(
        user_id=payload.user_id, 
        query_text=payload.query
    )
    return {"relevant_facts": facts}

@app.get("/health")
def health():
    return {"status": "ok"}

# Protégé-lite Ontology Management Endpoints
@app.get("/ontology")
def get_ontology(agent_id: str = "global"):
    return ontology_manager.get_schema(agent_id)

@app.post("/ontology")
def update_ontology(payload: SchemaPayload, agent_id: str = "global"):
    ontology_manager.save_schema(payload.model_dump(), agent_id)
    return {"status": "ontology_updated", "schema": ontology_manager.get_schema(agent_id)}

@app.get("/ontology/{agent_id}/versions")
def get_ontology_versions(agent_id: str):
    return {"versions": ontology_manager.list_versions(agent_id)}

@app.get("/graph")
async def get_graph(agent_id: str = "global"):
    """Returns the full knowledge graph schema for visualization."""
    return await get_schema_client(agent_id).get_graph_data()

@app.post("/graph/node")
async def save_node(payload: NodePayload, agent_id: str = "global"):
    """Creates or updates a node in the schema graph."""
    success = await get_schema_client(agent_id).upsert_node(payload.id, payload.label, payload.properties)
    if success:
        return {"status": "success", "node_id": payload.id}
    return {"status": "error"}

@app.post("/graph/edge")
async def save_edge(payload: EdgePayload, agent_id: str = "global"):
    """Creates an edge between two nodes in the schema graph."""
    success = await get_schema_client(agent_id).create_edge(payload.source, payload.target, payload.relation, payload.properties)
    if success:
        return {"status": "success", "source": payload.source, "target": payload.target}
    return {"status": "error"}

@app.get("/schemas")
def list_schemas():
    return {"schemas": ontology_manager.list_schemas()}

from adk_agents import get_all_agents, create_or_update_agent, AVAILABLE_TOOLS

class AgentPayload(BaseModel):
    agent_id: str
    name: str
    instruction: str
    tools: list[str]
    ontology: dict | None = None
    action_templates: list[dict] | None = None
    channels: dict | None = None

class ChannelsPayload(BaseModel):
    channels: dict

class LogPayload(BaseModel):
    log: str

class AgentGeneratePayload(BaseModel):
    description: str
    current_config: dict | None = None

class AgentWizardPayload(BaseModel):
    goal: str
    domain: str = ""
    complexity: str = ""
    current_ontology: dict | None = None
    answers: dict | None = None

@app.get("/agents")
def list_agents():
    return {"agents": get_all_agents()}

@app.get("/tools")
def list_tools():
    return {"tools": list(AVAILABLE_TOOLS.keys())}

@app.post("/agents")
def save_agent(payload: AgentPayload):
    # Retrieve existing config to keep or update channels
    from adk_agents import load_agents_config, save_agents_config
    config = load_agents_config()
    
    create_or_update_agent(
        payload.agent_id, 
        payload.name, 
        payload.instruction, 
        payload.tools,
        action_templates=payload.action_templates
    )
    
    # Reload config to apply channels if present
    if payload.channels is not None:
        config = load_agents_config()
        if payload.agent_id in config:
            config[payload.agent_id]["channels"] = payload.channels
            save_agents_config(config)
            
    if payload.ontology:
        ontology_manager.save_schema(payload.ontology, payload.agent_id)
    return {"status": "success", "agent_id": payload.agent_id}

@app.get("/agents/{agent_id}/channels")
def get_agent_channels(agent_id: str):
    from adk_agents import load_agents_config
    config = load_agents_config()
    if agent_id in config:
        return {"channels": config[agent_id].get("channels", {})}
    return {"channels": {}}

@app.post("/agents/{agent_id}/channels")
def update_agent_channels(agent_id: str, payload: ChannelsPayload):
    from adk_agents import load_agents_config, save_agents_config
    config = load_agents_config()
    if agent_id not in config:
        return {"status": "error", "message": "Agent not found"}
    config[agent_id]["channels"] = payload.channels
    save_agents_config(config)
    return {"status": "success"}

@app.post("/agents/{agent_id}/logs")
def post_agent_log(agent_id: str, payload: LogPayload):
    agent_logs[agent_id].append(payload.log)
    return {"status": "success"}

@app.get("/agents/{agent_id}/logs")
def get_agent_logs(agent_id: str):
    return {"logs": list(agent_logs[agent_id])}

# --- Process Management for Agent Runners ---
running_agents = {} # agent_id -> subprocess.Popen

def tail_process_logs(process, agent_id):
    """Background thread to capture runner stdout/stderr and feed to agent_logs."""
    try:
        for line in iter(process.stdout.readline, b''):
            decoded_line = line.decode('utf-8', errors='replace').strip()
            if decoded_line:
                agent_logs[agent_id].append(decoded_line)
    except Exception as e:
        agent_logs[agent_id].append(f"[System] Log reader error: {str(e)}")
    finally:
        process.stdout.close()
        process.wait()
        agent_logs[agent_id].append(f"[System] Runner exited with code {process.returncode}")
        if agent_id in running_agents and running_agents[agent_id] == process:
            del running_agents[agent_id]

@app.post("/agents/{agent_id}/runner/start")
def start_agent_runner(agent_id: str):
    if agent_id in running_agents and running_agents[agent_id].poll() is None:
        return {"status": "error", "message": "Runner is already active."}
        
    script_path = os.path.join(os.path.dirname(__file__), "run_discord_agent.py")
    
    if not os.path.exists(script_path):
        return {"status": "error", "message": f"Runner script not found: {script_path}"}
        
    try:
        # Start process with unbuffered output
        env = os.environ.copy()
        env["PYTHONUNBUFFERED"] = "1"
        
        process = subprocess.Popen(
            [sys.executable, script_path, agent_id],
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            env=env,
            cwd=os.path.dirname(__file__)
        )
        
        running_agents[agent_id] = process
        
        # Start log reader thread
        thread = threading.Thread(target=tail_process_logs, args=(process, agent_id), daemon=True)
        thread.start()
        
        agent_logs[agent_id].append(f"[System] Started runner for {agent_id} (PID: {process.pid})")
        return {"status": "success", "message": "Runner started"}
    except Exception as e:
        return {"status": "error", "message": f"Failed to start runner: {str(e)}"}

@app.post("/agents/{agent_id}/runner/stop")
def stop_agent_runner(agent_id: str):
    if agent_id not in running_agents or running_agents[agent_id].poll() is not None:
        return {"status": "error", "message": "Runner is not active."}
        
    process = running_agents[agent_id]
    try:
        process.terminate() # Send SIGTERM
        # Give it a second to terminate nicely
        try:
            process.wait(timeout=2)
        except subprocess.TimeoutExpired:
            process.kill() # Force kill if stuck
            
        agent_logs[agent_id].append(f"[System] Stopped runner for {agent_id}")
        del running_agents[agent_id]
        return {"status": "success", "message": "Runner stopped"}
    except Exception as e:
        return {"status": "error", "message": f"Failed to stop runner: {str(e)}"}

@app.get("/agents/{agent_id}/runner/status")
def get_agent_runner_status(agent_id: str):
    is_active = False
    if agent_id in running_agents:
        process = running_agents[agent_id]
        if process.poll() is None:
            is_active = True
        else:
            del running_agents[agent_id]
            
    return {"status": "success", "active": is_active}


@app.post("/agents/wizard/refine")
def refine_agent_wizard(payload: AgentWizardPayload):
    if not client:
        return {"status": "error", "message": "GEMINI_API_KEY is not configured"}
        
    import json
    
    context_str = ""
    if payload.current_ontology:
        context_str += f"\nCurrent Ontology:\n{json.dumps(payload.current_ontology, indent=2)}\n"
    if payload.answers:
        context_str += f"\nUser Answers to Follow-up Questions:\n{json.dumps(payload.answers, indent=2)}\n"

    prompt = f"""You are an AI assistant helping a user build and refine a new agent for a knowledge graph system.
The user is using a multi-turn wizard.
Goal: {payload.goal}
Domain: {payload.domain}
Complexity: {payload.complexity}
{context_str}

Available standard tools the agent can use: {list(AVAILABLE_TOOLS.keys())}

Generate a JSON object with the following fields:
- "agent_id": A short, lowercase string with underscores (no spaces) to uniquely identify the agent.
- "name": A human-readable display name for the agent.
- "instruction": The system prompt/instruction for the agent.
- "tools": An array of standard tool names from the available standard tools list.
- "ontology": An ontology schema tailored for this agent. It must contain:
    - "nodes": an array of class strings
    - "predicates": an array of relation strings
    - "properties": a dictionary mapping node class names to arrays of property string names
- "follow_up_questions": An array of questions to further refine the agent's ontology or instructions. If the current ontology and instructions are already highly refined based on user answers, you can return an empty array. Each question should have:
    - "id": A unique string id for the question (e.g. "q1")
    - "question": The question text
    - "type": The expected input type (e.g. "text", "boolean")

Return ONLY the JSON object, without any markdown formatting like ```json.
"""
    try:
        response = client.models.generate_content(
            model='gemini-3.1-flash-lite',
            contents=prompt
        )
        
        text = response.text.strip()
        if text.startswith("```json"):
            text = text[7:]
        if text.endswith("```"):
            text = text[:-3]
        
        config = json.loads(text.strip())
        return {"status": "success", "config": config}
    except Exception as e:
        return {"status": "error", "message": str(e)}

@app.post("/agents/generate")
def generate_agent(payload: AgentGeneratePayload):
    if not client:
        return {"status": "error", "message": "GEMINI_API_KEY is not configured"}
        
    import json
    current_context = ""
    if payload.current_config:
        current_context = f"\nThe current agent configuration is:\n{json.dumps(payload.current_config, indent=2)}\n\nUpdate this configuration according to the user's latest request. Modify the ontology, instructions, or tools as requested, while keeping the rest intact."

    prompt = f"""You are an AI assistant helping a user build and refine a new agent for a knowledge graph system.
The user will describe the agent they want or provide instructions to refine the current setup.{current_context}

Available standard tools the agent can use: {list(AVAILABLE_TOOLS.keys())}

You can also create dynamic tools by defining "action_templates" using Cypher queries to operate on FalkorDB. 
These action templates empower the agent with custom operational tools without needing backend code changes.

Generate a JSON object with the following fields:
- "agent_id": A short, lowercase string with underscores (no spaces) to uniquely identify the agent.
- "name": A human-readable display name for the agent.
- "instruction": The system prompt/instruction for the agent. This should be comprehensive and tell the agent its mission, its persona, and explicitly tell it when and how to use the available tools to save/update memories in its knowledge graph. The agent MUST be instructed to use the tool with its specific `agent_id`.
- "tools": An array of standard tool names from the available standard tools list that this agent should have access to. Do not include dynamic tool names here.
- "action_templates": An optional array of dynamic tool definitions to empower the agent with specific operations. Each object should have:
    - "tool_name": A unique string name for the tool.
    - "description": A clear description for the LLM of what this tool does.
    - "parameters": A dictionary mapping parameter names to their descriptions (for the LLM). Use `__id` and `__timestamp` in the query to auto-generate unique IDs and current timestamps without needing to require them as parameters from the LLM.
    - "query": The raw Cypher query to execute on FalkorDB. Parameters must be referenced as `$paramName`. Example: `CREATE (t:Ticket {{id: $__id, title: $title, status: 'open', created_at: $__timestamp}})`
- "ontology": An initial graph schema tailored for this agent's domain. It must contain:
    - "nodes": an array of class strings (e.g. ["Person", "Company"])
    - "predicates": an array of relation strings (e.g. ["WORKS_AT", "OWNS"])
    - "properties": a dictionary mapping node class names to arrays of property string names (e.g. {{"Person": ["name", "age"]}})

Return ONLY the JSON object, without any markdown formatting like ```json.

User Request: {payload.description}
"""
    try:
        response = client.models.generate_content(
            model='gemini-3.1-flash-lite',
            contents=prompt
        )
        
        import json
        text = response.text.strip()
        if text.startswith("```json"):
            text = text[7:]
        if text.endswith("```"):
            text = text[:-3]
        
        config = json.loads(text.strip())
        return {"status": "success", "config": config}
    except Exception as e:
        return {"status": "error", "message": str(e)}

@app.post("/ontology/chat")
def chat_ontology(payload: ChatPayload, agent_id: str = "global"):
    if not client:
        return {"status": "error", "message": "GEMINI_API_KEY is not configured"}
        
    schema = ontology_manager.get_schema(agent_id)
    
    prompt = f"""You are an Ontology Assistant for a graph database. 
The current ontology schema for agent '{agent_id}' is:
{schema}

The user wants to expand or modify this ontology. Provide suggestions for new nodes, predicates, or properties based on their request.
Return ONLY a JSON response in the exact same format as the schema:
{{
  "nodes": ["NewNode1", "NewNode2"],
  "predicates": ["NEW_PREDICATE"],
  "properties": {{
    "NewNode1": ["prop1", "prop2"]
  }}
}}
If the user's request is not related to adding things, you can return empty arrays/objects.
Only include the newly suggested additions (do not repeat the entire schema).
Do not include any markdown formatting like ```json.
User request: {payload.message}
"""
    try:
        response = client.models.generate_content(
            model='gemini-3.1-flash-lite',
            contents=prompt
        )
        
        import json
        text = response.text.strip()
        if text.startswith("```json"):
            text = text[7:]
        if text.endswith("```"):
            text = text[:-3]
        
        suggestion = json.loads(text.strip())
        return {"status": "success", "suggestion": suggestion}
    except Exception as e:
        return {"status": "error", "message": str(e)}

class SuggestPropertiesPayload(BaseModel):
    label: str
    properties: dict
    context: str | None = None

@app.post("/ontology/suggest_properties")
def suggest_properties(payload: SuggestPropertiesPayload, agent_id: str = "global"):
    if not client:
        return {"status": "error", "message": "GEMINI_API_KEY is not configured"}
        
    schema = ontology_manager.get_schema(agent_id)
    import json
    schema_str = f"\nOntology Schema:\n{json.dumps(schema, indent=2)}\n" if schema else ""
    context_str = f"\nRelevant Context / Known Facts:\n{payload.context}\n" if payload.context else ""
        
    prompt = f"""You are a Graph Database Schema Assistant. 
The user is editing a node/entity with the label/type: '{payload.label}'
{schema_str}
The current properties of this entity are:
{payload.properties}{context_str}

Suggest 3 to 5 new relevant property keys that would be useful to add to this entity.
Crucially, if the Ontology Schema defines properties for the class '{payload.label}', prioritize suggesting those exact properties if they are not already present.
For each suggested property, provide a realistic default value or a very short description (e.g. placeholder) for what it should contain.
Do NOT suggest properties that already exist in the current properties list.

Return ONLY a JSON array of objects in this exact format:
[
  {{"key": "website", "value": "https://..."}},
  {{"key": "founded_year", "value": "2020"}}
]
Do not include any markdown formatting like ```json.
"""
    try:
        response = client.models.generate_content(
            model='gemini-3.1-flash-lite',
            contents=prompt
        )
        
        import json
        text = response.text.strip()
        if text.startswith("```json"):
            text = text[7:]
        if text.endswith("```"):
            text = text[:-3]
        
        suggestions = json.loads(text.strip())
        return {"status": "success", "suggestions": suggestions}
    except Exception as e:
        import traceback
        traceback.print_exc()
        return {"status": "error", "message": str(e)}



class ImproveNodePayload(BaseModel):
    label: str
    properties: dict
    context: str | None = None

@app.post("/ontology/improve_node")
def improve_node(payload: ImproveNodePayload, agent_id: str = "global"):
    if not client:
        return {"status": "error", "message": "GEMINI_API_KEY is not configured"}
        
    schema = ontology_manager.get_schema(agent_id)
    import json
    schema_str = f"\nOntology Schema:\n{json.dumps(schema, indent=2)}\n" if schema else ""
    context_str = f"\nRelevant Context / Known Facts:\n{payload.context}\n" if payload.context else ""

    prompt = f"""You are a Knowledge Graph Data Curator. 
The user is editing a node with the label/type: '{payload.label}'
{schema_str}
The current properties of this entity are:
{payload.properties}{context_str}

Your task is to verify, clean, and improve these properties. 
- Consolidate redundant fields.
- Fix typos or obvious errors.
- Ensure there is a good descriptive 'title' or 'name' property.
- Summarize overly long text fields if they are verbose, perhaps adding a 'summary' field.
- Keep system keys like 'timestamp', 'source_channel', 'agent_id', 'session_id' intact without modification.
- If the Ontology Schema defines properties for '{payload.label}', ensure your improved properties align well with those expected keys.

Return ONLY a JSON object containing the improved properties dictionary.
Do not include any markdown formatting like ```json.
"""
    try:
        response = client.models.generate_content(
            model='gemini-3.1-flash-lite',
            contents=prompt
        )
        
        import json
        text = response.text.strip()
        if text.startswith("```json"):
            text = text[7:]
        if text.endswith("```"):
            text = text[:-3]
        
        improved_properties = json.loads(text.strip())
        return {"status": "success", "properties": improved_properties}
    except Exception as e:
        import traceback
        traceback.print_exc()
        return {"status": "error", "message": str(e)}

class CurateInsightsPayload(BaseModel):
    interactions: list[dict]

@app.post("/agent/{agent_id}/curate_insights")
async def curate_insights(agent_id: str, payload: CurateInsightsPayload):
    if not client:
        return {"status": "error", "message": "GEMINI_API_KEY is not configured"}
        
    prompt = f"""You are a Knowledge Graph Curator for the agent '{agent_id}'. 
You are provided with a list of recent interactions. Your task is to extract meaningful insights, facts, or preferences from these interactions and suggest them as structural graph updates.

Interactions:
{json.dumps(payload.interactions, indent=2)}

Return a JSON object suggesting nodes and relationships to add or update in the knowledge graph. 
Format exactly like this (do not include markdown formatting like ```json):
{{
  "nodes": [
    {{"label": "User", "properties": {{"name": "Alice", "preference": "dark mode"}}}},
    {{"label": "Issue", "properties": {{"status": "resolved", "description": "Login error"}}}}
  ],
  "relationships": [
    {{"source_label": "User", "source_props": {{"name": "Alice"}}, "target_label": "Issue", "target_props": {{"description": "Login error"}}, "type": "REPORTED"}}
  ]
}}
"""
    try:
        response = await asyncio.to_thread(
            client.models.generate_content,
            model='gemini-3.1-flash-lite',
            contents=prompt
        )
        
        text = response.text.strip()
        if text.startswith("```json"):
            text = text[7:]
        if text.endswith("```"):
            text = text[:-3]
            
        suggestions = json.loads(text.strip())
        return {"status": "success", "suggestions": suggestions}
    except Exception as e:
        import traceback
        traceback.print_exc()
        return {"status": "error", "message": str(e)}

from fastapi import Form
@app.post("/ontology/chat_multimodal")
async def chat_multimodal(agent_id: str = Form("global"), message: str = Form(None), file: UploadFile = File(None)):
    if not client:
        return {"status": "error", "message": "GEMINI_API_KEY is not configured"}
        
    schema = ontology_manager.get_schema(agent_id)
    temp_filepath = None
    filename = None
    text = ""
    
    try:
        if file and file.filename:
            file_bytes = await file.read()
            filename = file.filename
            
            temp_dir = os.path.join(os.path.dirname(__file__), "temp_uploads")
            os.makedirs(temp_dir, exist_ok=True)
            temp_filepath = os.path.join(temp_dir, filename)
            with open(temp_filepath, "wb") as f:
                f.write(file_bytes)
                
            text = extract_text_from_file(filename, file_bytes)
            # Log document
            await log_and_store_interaction(agent_id, "multimodal_session", "user", "document", text, file_path=filename)
            
        if message:
            await log_and_store_interaction(agent_id, "multimodal_session", "user", "message", message)
            
        result = await chat_multimodal_ontology(temp_filepath, filename, text, schema, message or "")
        
        # Log assistant suggestion
        await log_and_store_interaction(agent_id, "multimodal_session", "assistant", "message", str(result))
        
        return {"status": "success", "result": result}
    except Exception as e:
        return {"status": "error", "message": str(e)}
    finally:
        if temp_filepath and os.path.exists(temp_filepath):
            os.remove(temp_filepath)

@app.post("/agent/{agent_id}/ingest_document")
async def ingest_document(agent_id: str, file: UploadFile = File(...)):
    if not client:
        return {"status": "error", "message": "GEMINI_API_KEY is not configured"}
        
    try:
        file_bytes = await file.read()
        
        # Save to temp file for Gemini API
        temp_dir = os.path.join(os.path.dirname(__file__), "temp_uploads")
        os.makedirs(temp_dir, exist_ok=True)
        temp_filepath = os.path.join(temp_dir, file.filename)
        with open(temp_filepath, "wb") as f:
            f.write(file_bytes)

        text = extract_text_from_file(file.filename, file_bytes)
        
        # Log the full document for needle-in-the-haystack search
        await log_and_store_interaction(agent_id, "ingestion_session", "user", "document", text, file_path=file.filename)

        current_schema = ontology_manager.get_schema(agent_id)
        
        try:
            analysis_result = await analyze_document_for_ontology(
                temp_filepath, 
                file.filename, 
                text, 
                current_schema, 
                agent_id=agent_id, 
                session_id="ingestion_session", 
                source_channel=f"document_{file.filename}"
            )
        finally:
            if os.path.exists(temp_filepath):
                os.remove(temp_filepath)
        
        suggested_updates = analysis_result.get("suggested_ontology_updates", {})
        extracted_facts = analysis_result.get("extracted_facts", [])
        
        # Optionally, save facts immediately:
        for fact in extracted_facts:
            subj = fact.get("subject")
            pred = fact.get("predicate")
            obj = fact.get("object")
            if subj and pred and obj:
                await graph_client.store_fact(
                    user_id="default",
                    subject=subj,
                    predicate=pred,
                    object_val=obj,
                    timestamp=time.time(),
                    source_channel=f"document_{file.filename}"
                )
        
        return {
            "status": "success",
            "filename": file.filename,
            "suggested_updates": suggested_updates,
            "extracted_facts": extracted_facts
        }
    except Exception as e:
        import traceback
        traceback.print_exc()
        return {"status": "error", "message": str(e)}

@app.post("/agent/{agent_id}/chat")
async def chat_agent(agent_id: str, message: str = Form(None), file: UploadFile = File(None)):
    start_time = time.time()
    if not os.environ.get("GEMINI_API_KEY"):
        return {"status": "error", "message": "GEMINI_API_KEY is not configured"}
    
    agent = get_agent(agent_id)
    try:
        temp_filepath = None
        filename = None
        text = ""
        
        if file and file.filename:
            file_bytes = await file.read()
            filename = file.filename
            
            temp_dir = os.path.join(os.path.dirname(__file__), "temp_uploads")
            os.makedirs(temp_dir, exist_ok=True)
            temp_filepath = os.path.join(temp_dir, filename)
            with open(temp_filepath, "wb") as f:
                f.write(file_bytes)
                
            text = extract_text_from_file(filename, file_bytes)
            await log_and_store_interaction(agent_id, "multimodal_session", "user", "document", text, file_path=filename)
            
        if message:
            await log_and_store_interaction(agent_id, "multimodal_session", "user", "message", message)
            
        # Get some current context if necessary, or pass empty dict
        current_graph_context = {}
        
        result = await chat_multimodal_memory(
            temp_filepath, 
            filename, 
            text, 
            current_graph_context, 
            message or "",
            agent_id=agent_id,
            session_id="multimodal_session",
            source_channel="internal_ui"
        )
        
        await log_and_store_interaction(agent_id, "multimodal_session", "assistant", "message", str(result))
        
        latency_ms = int((time.time() - start_time) * 1000)
        agent_latencies[agent_id].append(latency_ms)
        
        return {"status": "success", "response": result.get("response", ""), "suggested_memory_updates": result.get("suggested_memory_updates", [])}
    except Exception as e:
        import traceback
        traceback.print_exc()
        return {"status": "error", "message": str(e)}
    finally:
        if temp_filepath and os.path.exists(temp_filepath):
            os.remove(temp_filepath)

class MemoryApplyPayload(BaseModel):
    updates: list[dict]

@app.post("/agent/{agent_id}/memory/apply")
async def apply_memory_updates(agent_id: str, payload: MemoryApplyPayload):
    try:
        results = []
        for fact in payload.updates:
            subj = fact.get("subject")
            pred = fact.get("predicate")
            obj = fact.get("object")
            if subj and pred and obj:
                await graph_client.store_fact(
                    user_id="default",
                    subject=subj,
                    predicate=pred,
                    object_val=obj,
                    timestamp=time.time(),
                    source_channel="hitl_apply"
                )
                results.append(fact)
        return {"status": "success", "applied": results}
    except Exception as e:
        import traceback
        traceback.print_exc()
        return {"status": "error", "message": str(e)}

class SearchPayload(BaseModel):
    query: str
    limit: int = 50

@app.post("/agent/{agent_id}/history/search")
def search_agent_history(agent_id: str, payload: SearchPayload):
    results = search_history(agent_id, payload.query, payload.limit)
    return {"status": "success", "results": results}

@app.post("/agent/{agent_id}/unified_chat")
async def unified_chat(agent_id: str, message: str = Form(None), file: UploadFile = File(None)):
    start_time = time.time()
    if not client:
        return {"status": "error", "message": "GEMINI_API_KEY is not configured"}
        
    try:
        # Intent detection
        # If there's a file, it's likely schema or ingestion, but let's let Gemini decide.
        intent_prompt = f"""You are an Intent Router. The user sent a message to the '{agent_id}' agent.
Message: "{message}"
File attached: {"Yes" if file else "No"}

Determine the user's intent. Choose exactly ONE of the following categories:
- "schema": The user wants to modify the knowledge graph ontology/schema (add nodes, predicates, properties).
- "admin": The user wants to audit operations, search history, generate analytical reports, or inspect the inventory/tickets.
- "chat": The user wants to talk to the conversational agent, ask it to do a task, or save general memories.

Respond ONLY with the category name in lowercase (schema, admin, or chat)."""
        
        intent_response = client.models.generate_content(
            model='gemini-3.1-flash-lite',
            contents=intent_prompt
        )
        intent = intent_response.text.strip().lower()
        if intent not in ["schema", "admin", "chat"]:
            intent = "chat"
            
        ui_action = "memory"
        if intent == "schema":
            ui_action = "schema"
        elif intent == "admin":
            ui_action = "inventory"
            
        # Delegate
        result_response = ""
        suggestion = None
        
        if intent == "schema":
            # Use ontology multimodal logic
            schema = ontology_manager.get_schema(agent_id)
            temp_filepath = None
            filename = None
            text = ""
            
            if file and file.filename:
                file_bytes = await file.read()
                filename = file.filename
                temp_dir = os.path.join(os.path.dirname(__file__), "temp_uploads")
                os.makedirs(temp_dir, exist_ok=True)
                temp_filepath = os.path.join(temp_dir, filename)
                with open(temp_filepath, "wb") as f:
                    f.write(file_bytes)
                text = extract_text_from_file(filename, file_bytes)
                
            res = await chat_multimodal_ontology(temp_filepath, filename, text, schema, message or "")
            result_response = res.get("response", "Schema updated.")
            suggestion = res.get("suggested_ontology_updates")
            if temp_filepath and os.path.exists(temp_filepath):
                os.remove(temp_filepath)
                
        elif intent == "admin":
            # Admin ADK agent
            from google.adk import Runner
            from google.adk.sessions import InMemorySessionService
            from google.adk.agents.llm_agent import Agent
            from google.genai import types
            from adk_agents import AVAILABLE_TOOLS
            
            tools_to_inject = [AVAILABLE_TOOLS["search_raw_history"], AVAILABLE_TOOLS["search_knowledge_graph"]]
            admin_agent = Agent(
                name=f"admin_for_{agent_id}",
                model="gemini-2.0-flash",
                instruction=f"You are an Admin and Data Analyst for '{agent_id}'. Sweep across memories, audit operations, retrieve insights. Use 'search_raw_history' and 'search_knowledge_graph'. Do NOT save new memories. Answer administrative queries thoroughly.",
                tools=tools_to_inject
            )
            global_session_service = getattr(app.state, "session_service", None)
            if not global_session_service:
                global_session_service = InMemorySessionService()
                app.state.session_service = global_session_service
            runner = Runner(agent=admin_agent, app_name="vento", session_service=global_session_service)
            session_id = f"session_admin_{agent_id}"
            
            from adk_agents import current_session_id, current_source_channel
            current_session_id.set(session_id)
            current_source_channel.set("internal_ui")
            
            session = await global_session_service.get_session(app_name="vento", user_id="default", session_id=session_id)
            if session is None:
                await global_session_service.create_session(app_name="vento", user_id="default", session_id=session_id)
            
            await log_and_store_interaction(agent_id, session_id, "user", "message", message or "Hello", metadata={"channel": "internal_ui"})
            
            context_prefix = f"[Context: source_channel='internal_ui', session_id='{session_id}', agent_id='{agent_id}']\n"
            msg = types.Content(role="user", parts=[types.Part.from_text(text=context_prefix + (message or "Hello"))])
            metadata = {"channel": "internal_ui", "tokens": 0, "reasoning": "", "tool_calls": [], "tool_outputs": []}
            async for event in runner.run_async(user_id="default", session_id=session_id, new_message=msg):
                if getattr(event, "prompt_tokens", None):
                    metadata["tokens"] = event.prompt_tokens
                if getattr(event, "reasoning", None) and event.reasoning:
                    metadata["reasoning"] += event.reasoning + "\n"
                if getattr(event, "tool_calls", None) and event.tool_calls:
                    for tc in event.tool_calls:
                        metadata["tool_calls"].append({"name": getattr(tc, "name", str(tc)), "args": str(getattr(tc, "args", ""))})
                if getattr(event, "tool_outputs", None) and event.tool_outputs:
                    metadata["tool_outputs"].append(str(event.tool_outputs))
                    
                if hasattr(event, "content") and event.content is not None:
                    if hasattr(event.content, "parts"):
                        for part in event.content.parts:
                            if part.text: result_response += part.text
                    elif hasattr(event.content, "text") and event.content.text:
                        result_response += event.content.text
                elif hasattr(event, "text") and event.text:
                    result_response += event.text
            
            await log_and_store_interaction(agent_id, session_id, "assistant", "message", result_response, metadata=metadata)
            
        else:
            # Standard agent
            agent = get_agent(agent_id)
            from google.adk import Runner
            from google.adk.sessions import InMemorySessionService
            from google.genai import types
            global_session_service = getattr(app.state, "session_service", None)
            if not global_session_service:
                global_session_service = InMemorySessionService()
                app.state.session_service = global_session_service
            runner = Runner(agent=agent, app_name="vento", session_service=global_session_service)
            session_id = f"session_{agent_id}"
            
            from adk_agents import current_session_id, current_source_channel
            current_session_id.set(session_id)
            current_source_channel.set("internal_ui")
            
            session = await global_session_service.get_session(app_name="vento", user_id="default", session_id=session_id)
            if session is None:
                await global_session_service.create_session(app_name="vento", user_id="default", session_id=session_id)
            
            await log_and_store_interaction(agent_id, session_id, "user", "message", message or "Hello", metadata={"channel": "internal_ui"})
            
            context_prefix = f"[Context: source_channel='internal_ui', session_id='{session_id}', agent_id='{agent_id}']\n"
            msg = types.Content(role="user", parts=[types.Part.from_text(text=context_prefix + (message or "Hello"))])
            metadata = {"channel": "internal_ui", "tokens": 0, "reasoning": "", "tool_calls": [], "tool_outputs": []}
            async for event in runner.run_async(user_id="default", session_id=session_id, new_message=msg):
                if getattr(event, "prompt_tokens", None):
                    metadata["tokens"] = event.prompt_tokens
                if getattr(event, "reasoning", None) and event.reasoning:
                    metadata["reasoning"] += event.reasoning + "\n"
                if getattr(event, "tool_calls", None) and event.tool_calls:
                    for tc in event.tool_calls:
                        metadata["tool_calls"].append({"name": getattr(tc, "name", str(tc)), "args": str(getattr(tc, "args", ""))})
                if getattr(event, "tool_outputs", None) and event.tool_outputs:
                    metadata["tool_outputs"].append(str(event.tool_outputs))
                    
                if hasattr(event, "content") and event.content is not None:
                    if hasattr(event.content, "parts"):
                        for part in event.content.parts:
                            if part.text: result_response += part.text
                    elif hasattr(event.content, "text") and event.content.text:
                        result_response += event.content.text
                elif hasattr(event, "text") and event.text:
                    result_response += event.text
            
            await log_and_store_interaction(agent_id, session_id, "assistant", "message", result_response, metadata=metadata)
        latency_ms = int((time.time() - start_time) * 1000)
        agent_latencies[agent_id].append(latency_ms)

        return {
            "status": "success", 
            "response": result_response or "Done.",
            "ui_action": ui_action,
            "intent": intent,
            "suggestion": suggestion
        }
    except Exception as e:
        import traceback
        traceback.print_exc()
        return {"status": "error", "message": str(e)}

@app.post("/agent/{agent_id}/admin_chat")
async def admin_chat_agent(agent_id: str, message: str = Form(None), file: UploadFile = File(None)):
    start_time = time.time()
    if not os.environ.get("GEMINI_API_KEY"):
        return {"status": "error", "message": "GEMINI_API_KEY is not configured"}
    
    try:
        temp_filepath = None
        filename = None
        text = ""
        
        if file and file.filename:
            file_bytes = await file.read()
            filename = file.filename
            
            temp_dir = os.path.join(os.path.dirname(__file__), "temp_uploads")
            os.makedirs(temp_dir, exist_ok=True)
            temp_filepath = os.path.join(temp_dir, filename)
            with open(temp_filepath, "wb") as f:
                f.write(file_bytes)
                
            text = extract_text_from_file(filename, file_bytes)
            await log_and_store_interaction(agent_id, "multimodal_session", "user", "document", text, file_path=filename)
            
        if message:
            await log_and_store_interaction(agent_id, "multimodal_session", "user", "message", message)
            
        current_inventory_context = {}
        
        result = await chat_multimodal_admin(temp_filepath, filename, text, current_inventory_context, message or "")
        
        await log_and_store_interaction(agent_id, "multimodal_session", "assistant", "message", str(result))
        
        latency_ms = int((time.time() - start_time) * 1000)
        agent_latencies[agent_id].append(latency_ms)
        
        return {"status": "success", "response": result.get("response", ""), "suggested_inventory_updates": result.get("suggested_inventory_updates", [])}
    except Exception as e:
        import traceback
        traceback.print_exc()
        return {"status": "error", "message": str(e)}
    finally:
        if temp_filepath and os.path.exists(temp_filepath):
            os.remove(temp_filepath)

class AdminApplyPayload(BaseModel):
    updates: list[dict]

@app.post("/agent/{agent_id}/admin/apply")
async def apply_admin_updates(agent_id: str, payload: AdminApplyPayload):
    try:
        # In a real scenario, this would apply to the actual inventory/ticketing DB.
        # For now, we simulate success.
        return {"status": "success", "applied": payload.updates}
    except Exception as e:
        import traceback
        traceback.print_exc()
        return {"status": "error", "message": str(e)}

# --- OpenClaw Integration Endpoints ---
from openclaw_adapter import generate_openclaw_manifest
from adk_agents import load_agents_config, save_memory_to_graph, search_knowledge_graph
from history_db import get_total_messages, get_active_sessions
import asyncio

@app.get("/agents/{agent_id}/metrics")
async def get_agent_metrics(agent_id: str):
    total_messages = get_total_messages(agent_id)
    active_sessions = get_active_sessions(agent_id)
    
    client = get_schema_client(agent_id)
    try:
        res = await asyncio.to_thread(client.graph.query, "MATCH ()-[r]->() RETURN count(r)")
        sync_events = res.result_set[0][0] if res.result_set else 0
    except Exception:
        sync_events = 0
        
    latencies = agent_latencies.get(agent_id, [])
    avg_latency = sum(latencies) // len(latencies) if latencies else 0
    
    return {
        "active_sessions": active_sessions,
        "total_messages": total_messages,
        "sync_events": sync_events,
        "avg_latency_ms": avg_latency
    }

@app.get("/agents/{agent_id}/observability/interactions")
async def get_agent_interactions(agent_id: str):
    try:
        from history_db import get_recent_interactions
        return {"status": "success", "interactions": get_recent_interactions(agent_id)}
    except Exception as e:
        import traceback
        traceback.print_exc()
        return {"status": "error", "message": str(e)}

@app.get("/agents/{agent_id}/observability/sessions")
async def get_agent_sessions(agent_id: str):
    try:
        from history_db import get_active_sessions_list
        return {"status": "success", "sessions": get_active_sessions_list(agent_id)}
    except Exception as e:
        import traceback
        traceback.print_exc()
        return {"status": "error", "message": str(e)}

@app.get("/agents/{agent_id}/observability/syncs")
async def get_agent_syncs(agent_id: str):
    try:
        client = get_schema_client(agent_id)
        # Fetch up to 50 recent edges
        res = await asyncio.to_thread(client.graph.query, "MATCH (s)-[r]->(o) RETURN s.id, type(r), o.id LIMIT 50")
        syncs = []
        for row in res.result_set:
            syncs.append({
                "subject": row[0],
                "predicate": row[1],
                "object": row[2]
            })
        return {"status": "success", "syncs": syncs}
    except Exception as e:
        import traceback
        traceback.print_exc()
        return {"status": "error", "message": str(e)}


@app.get("/agents/{agent_id}/openclaw-manifest")
def get_openclaw_manifest(agent_id: str):
    config = load_agents_config()
    if agent_id not in config:
        return {"status": "error", "message": "Agent not found"}
    manifest = generate_openclaw_manifest(config[agent_id], agent_id, backend_url="http://localhost:8000")
    return {"status": "success", "manifest": manifest}

class OC_SaveMemoryPayload(BaseModel):
    agent_id: str
    subject: str
    predicate: str
    object_val: str
    properties_json: str = "{}"

@app.post("/openclaw/tools/save_memory_to_graph")
def oc_save_memory(payload: OC_SaveMemoryPayload):
    res = save_memory_to_graph(
        payload.agent_id, 
        payload.subject, 
        payload.predicate, 
        payload.object_val, 
        payload.properties_json
    )
    return {"status": "success", "result": res}

class OC_SearchGraphPayload(BaseModel):
    agent_id: str
    query: str

@app.post("/openclaw/tools/search_knowledge_graph")
def oc_search_graph(payload: OC_SearchGraphPayload):
    res = search_knowledge_graph(payload.agent_id, payload.query)
    return {"status": "success", "result": res}

from fastapi import Request
@app.post("/openclaw/tools/dynamic/{agent_id}/{tool_name}")
async def oc_dynamic_tool(agent_id: str, tool_name: str, request: Request):
    payload = await request.json()
    config = load_agents_config()
    if agent_id not in config:
        return {"status": "error", "message": "Agent not found"}
    
    action_templates = config[agent_id].get("action_templates", [])
    target_template = next((t for t in action_templates if t["tool_name"] == tool_name), None)
    
    if not target_template:
        return {"status": "error", "message": "Tool not found"}
        
    from adk_agents import make_dynamic_tool
    func = make_dynamic_tool(target_template)
    
    # Prepare kwargs
    kwargs = {"agent_id": agent_id}
    kwargs.update(payload)
    
    try:
        res = func(**kwargs)
        return {"status": "success", "result": res}
    except Exception as e:
        return {"status": "error", "message": str(e)}

class SuggestConnectionsPayload(BaseModel):
    label: str
    properties: dict
    context: str | None = None

@app.post("/ontology/suggest_connections")
def suggest_connections(payload: SuggestConnectionsPayload, agent_id: str = "global"):
    if not client:
        return {"status": "error", "message": "GEMINI_API_KEY is not configured"}
        
    schema = ontology_manager.get_schema(agent_id)
    import json
    schema_str = f"\nOntology Schema:\n{json.dumps(schema, indent=2)}\n" if schema else ""
    context_str = f"\nRelevant Context / Known Facts:\n{payload.context}\n" if payload.context else ""
        
    prompt = f"""You are a Graph Database Schema Assistant. 
The user is editing a node/entity with the label/type: '{payload.label}'
{schema_str}
The current properties of this entity are:
{payload.properties}{context_str}

Suggest 3 to 5 new relevant connections (relationships) that would be useful to add to this entity.
Crucially, look at the Ontology Schema predicates and suggest likely missing edges based on standard graph practices for this domain.
For each suggested connection, provide:
- "target_label": The expected label of the target node (e.g., 'User').
- "predicate": The relationship type (e.g., 'REPORTED_BY').
- "reason": A short explanation of why this connection makes sense.

Return ONLY a JSON array of objects in this exact format:
[
  {{"target_label": "User", "predicate": "ASSIGNED_TO", "reason": "Tickets usually have an assignee."}},
  {{"target_label": "Project", "predicate": "PART_OF", "reason": "Tickets are often part of a project."}}
]
Do not include any markdown formatting like ```json.
"""
    try:
        response = client.models.generate_content(
            model='gemini-3.1-flash-lite',
            contents=prompt
        )
        
        import json
        text = response.text.strip()
        if text.startswith("```json"):
            text = text[7:]
        if text.endswith("```"):
            text = text[:-3]
        
        suggestions = json.loads(text.strip())
        return {"status": "success", "suggestions": suggestions}
    except Exception as e:
        import traceback
        traceback.print_exc()
        return {"status": "error", "message": str(e)}

class ActionTemplateGeneratePayload(BaseModel):
    node_data: dict
    context: str | None = None
    intent: str | None = None

@app.post("/agent/{agent_id}/action_template/generate_from_context")
def generate_action_template(agent_id: str, payload: ActionTemplateGeneratePayload):
    if not client:
        return {"status": "error", "message": "GEMINI_API_KEY is not configured"}
        
    import json
    context_str = f"\nRelevant Context / Subgraph:\n{payload.context}\n" if payload.context else ""
    intent_str = f"\nUser Intent:\n{payload.intent}\n" if payload.intent else ""
        
    prompt = f"""You are an AI assistant helping a user operationalize a subgraph pattern into a reusable Action Template (dynamic tool).
The user selected a node and its context.
Target Node Data:
{json.dumps(payload.node_data, indent=2)}
{context_str}{intent_str}

Generate a reusable Action Template (dynamic tool) for the agent.
An Action Template allows an agent to run parameterized Cypher queries.

Generate a JSON object with the following fields:
- "tool_name": A unique string name for the tool (e.g., "create_incident_ticket").
- "description": A clear description for the LLM of what this tool does.
- "parameters": A dictionary mapping parameter names to their descriptions (for the LLM). Use `__id` and `__timestamp` in the query to auto-generate unique IDs and current timestamps without needing to require them as parameters from the LLM.
- "cypher_query": The raw Cypher query to execute on FalkorDB. Parameters must be referenced as `$paramName`. Example: `CREATE (t:Ticket {{id: $__id, title: $title, status: 'open', created_at: $__timestamp}})`
- "success_message": A message to return to the agent upon successful execution.

Return ONLY the JSON object, without any markdown formatting like ```json.
"""
    try:
        response = client.models.generate_content(
            model='gemini-3.1-flash-lite',
            contents=prompt
        )
        
        import json
        text = response.text.strip()
        if text.startswith("```json"):
            text = text[7:]
        if text.endswith("```"):
            text = text[:-3]
        
        # Parse it, then we'll map "cypher_query" to "query" to match adk_agents expectations.
        config = json.loads(text.strip())
        if "cypher_query" in config and "query" not in config:
            config["query"] = config.pop("cypher_query")
            
        return {"status": "success", "action_template": config}
    except Exception as e:
        import traceback
        traceback.print_exc()
        return {"status": "error", "message": str(e)}

class ActionTemplateSavePayload(BaseModel):
    action_template: dict

@app.post("/agents/{agent_id}/action_templates")
def save_action_template(agent_id: str, payload: ActionTemplateSavePayload):
    from adk_agents import load_agents_config, save_agents_config
    config = load_agents_config()
    if agent_id not in config:
        return {"status": "error", "message": "Agent not found"}
        
    action_templates = config[agent_id].get("action_templates", [])
    
    # check if template with same name exists, if so update it
    existing = next((t for t in action_templates if t["tool_name"] == payload.action_template["tool_name"]), None)
    if existing:
        existing.update(payload.action_template)
    else:
        action_templates.append(payload.action_template)
        
    config[agent_id]["action_templates"] = action_templates
    save_agents_config(config)
    
    # Force agent re-initialization if caching is used (in this app, `get_agent` reads from config)
    # the next call to get_agent will pick it up
    return {"status": "success", "message": "Action template saved successfully"}

# --- Custom Reports Endpoints ---

class ReportCreate(BaseModel):
    title: str
    content: str

class ReportGenerateRequest(BaseModel):
    prompt: str

@app.post("/agent/{agent_id}/reports")
async def create_report(agent_id: str, report: ReportCreate):
    try:
        import asyncio
        await asyncio.to_thread(save_report, agent_id, report.title, report.content)
        return {"status": "success"}
    except Exception as e:
        return {"status": "error", "message": str(e)}

@app.get("/agent/{agent_id}/reports")
async def list_reports(agent_id: str):
    try:
        import asyncio
        reports = await asyncio.to_thread(get_reports, agent_id)
        return {"status": "success", "reports": reports}
    except Exception as e:
        return {"status": "error", "message": str(e)}

@app.delete("/agent/{agent_id}/reports/{report_id}")
async def remove_report(agent_id: str, report_id: int):
    try:
        import asyncio
        await asyncio.to_thread(delete_report, report_id)
        return {"status": "success"}
    except Exception as e:
        return {"status": "error", "message": str(e)}

@app.post("/agent/{agent_id}/reports/generate")
async def generate_custom_report(agent_id: str, req: ReportGenerateRequest):
    # Fetch current knowledge graph as context for the report
    query = "MATCH (n) OPTIONAL MATCH (n)-[r]->(m) RETURN n, r, m LIMIT 200"
    try:
        import asyncio
        res = await asyncio.to_thread(execute_falkor_query, query, agent_id)
        
        # Format the data into text
        context_text = "Operational Inventory Data Sample:\n"
        for record in res:
            n = record[0]
            if n:
                context_text += f"- Node: {n.labels[0] if n.labels else 'Unknown'} {n.properties}\n"
            if len(record) > 2 and record[1] and record[2]:
                m = record[2]
                context_text += f"  -> [{(record[1].relation if hasattr(record[1], 'relation') else type(record[1]).__name__)}] -> {m.labels[0] if m.labels else 'Unknown'} {m.properties}\n"
        
        from google import genai
        from google.genai import types
        import os
        
        client = genai.Client(api_key=os.environ.get("GEMINI_API_KEY"))
        
        prompt = f"""
You are an operations intelligence assistant. The user wants a custom report based on the current operational inventory context.
Please compile a professional Markdown report.

User Prompt: {req.prompt}

--- Inventory Context ---
{context_text}
"""
        response = await client.aio.models.generate_content(
            model='gemini-2.5-flash',
            contents=prompt,
        )
        
        return {"status": "success", "report": response.text}
        
    except Exception as e:
        return {"status": "error", "message": str(e)}
