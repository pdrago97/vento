from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import time
import os
from google import genai
from google.genai import types
from dotenv import load_dotenv

load_dotenv()
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY")
client = None
if GEMINI_API_KEY:
    client = genai.Client(api_key=GEMINI_API_KEY)

from graph_client import graph_client, get_schema_client
from gatekeeper import extract_fact
from ontology_manager import ontology_manager
from adk_agents import get_agent

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
def ingest_message(payload: MessagePayload):
    """Called by OpenClaw whenever a new message is received."""
    fact = extract_fact(payload.message)
    if fact:
        subject, predicate, obj = fact
        if not ontology_manager.validate_triple(subject, predicate, obj):
            return {"status": "rejected", "reason": f"Predicate {predicate} not in ontology"}
        
        # Store in FalkorDB
        graph_client.store_fact(
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
def retrieve_context(payload: QueryPayload):
    """Called by OpenClaw to fetch relevant facts before calling the LLM."""
    facts = graph_client.retrieve_relevant_facts(
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

@app.get("/graph")
def get_graph(agent_id: str = "global"):
    """Returns the full knowledge graph schema for visualization."""
    return get_schema_client(agent_id).get_graph_data()

@app.post("/graph/node")
def save_node(payload: NodePayload, agent_id: str = "global"):
    """Creates or updates a node in the schema graph."""
    success = get_schema_client(agent_id).upsert_node(payload.id, payload.label, payload.properties)
    if success:
        return {"status": "success", "node_id": payload.id}
    return {"status": "error"}

@app.post("/graph/edge")
def save_edge(payload: EdgePayload, agent_id: str = "global"):
    """Creates an edge between two nodes in the schema graph."""
    success = get_schema_client(agent_id).create_edge(payload.source, payload.target, payload.relation, payload.properties)
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

class AgentGeneratePayload(BaseModel):
    description: str

@app.get("/agents")
def list_agents():
    return {"agents": get_all_agents()}

@app.get("/tools")
def list_tools():
    return {"tools": list(AVAILABLE_TOOLS.keys())}

@app.post("/agents")
def save_agent(payload: AgentPayload):
    create_or_update_agent(payload.agent_id, payload.name, payload.instruction, payload.tools)
    return {"status": "success", "agent_id": payload.agent_id}

@app.post("/agents/generate")
def generate_agent(payload: AgentGeneratePayload):
    if not client:
        return {"status": "error", "message": "GEMINI_API_KEY is not configured"}
        
    prompt = f"""You are an AI assistant helping a user build a new agent for a knowledge graph system.
The user will describe the agent they want.
Your task is to generate the configuration for this agent based on their description.

Available tools the agent can use: {list(AVAILABLE_TOOLS.keys())}

Generate a JSON object with the following fields:
- "agent_id": A short, lowercase string with underscores (no spaces) to uniquely identify the agent.
- "name": A human-readable display name for the agent.
- "instruction": The system prompt/instruction for the agent. This should be comprehensive and tell the agent its mission, its persona, and explicitly tell it when and how to use the available tools to save/update memories in its knowledge graph. The agent MUST be instructed to use the tool with its specific `agent_id`.
- "tools": An array of tool names from the available tools list that this agent should have access to.

Return ONLY the JSON object, without any markdown formatting like ```json.

User Description: {payload.description}
"""
    try:
        response = client.models.generate_content(
            model='gemini-2.0-flash',
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
            model='gemini-1.5-flash',
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

@app.post("/agent/{agent_id}/chat")
async def chat_agent(agent_id: str, payload: ChatPayload):
    if not os.environ.get("GEMINI_API_KEY"):
        return {"status": "error", "message": "GEMINI_API_KEY is not configured"}
    
    agent = get_agent(agent_id)
    try:
        from google.adk import Runner
        from google.adk.sessions import InMemorySessionService
        from google.genai import types
        from google.adk.errors.session_not_found_error import SessionNotFoundError
        
        global_session_service = getattr(app.state, "session_service", None)
        if not global_session_service:
            global_session_service = InMemorySessionService()
            app.state.session_service = global_session_service
            
        runner = Runner(agent=agent, app_name="vento", session_service=global_session_service)
        
        session_id = f"session_{agent_id}"
        session = await global_session_service.get_session(app_name="vento", user_id="default", session_id=session_id)
        if not session:
            await global_session_service.create_session(app_name="vento", user_id="default", session_id=session_id)
            
        msg = types.Content(role="user", parts=[types.Part.from_text(text=payload.message)])
        
        full_response = ""
        async for event in runner.run_async(user_id="default", session_id=session_id, new_message=msg):
            # Try to extract text from ModelResponseEvent or similar events
            if hasattr(event, "message") and event.message is not None:
                if hasattr(event.message, "parts"):
                    for part in event.message.parts:
                        if part.text:
                            full_response += part.text
                elif hasattr(event.message, "text") and event.message.text:
                    full_response += event.message.text
            elif hasattr(event, "text") and event.text:
                full_response += event.text
                
        if not full_response:
            full_response = "Agent did not return a text response."
            
        return {"status": "success", "response": full_response}
    except Exception as e:
        import traceback
        traceback.print_exc()
        return {"status": "error", "message": str(e)}
