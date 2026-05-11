import time
import uuid
import os
from pydantic import BaseModel
from typing import Optional, Dict, Any, List

# import graph_client
from graph_client import get_schema_client

# import ADK
from google.adk.agents.llm_agent import Agent

import contextvars
import json
from history_db import search_history

current_session_id = contextvars.ContextVar("current_session_id", default="unknown_session")
current_source_channel = contextvars.ContextVar("current_source_channel", default="unknown_channel")

# Define the tool
async def save_memory_to_graph(agent_id: str, subject: str, predicate: str, object_val: str, properties_json: str = "{}"):
    """
    Stores a memory fragment into the agent's knowledge graph.

    Args:
        agent_id: The ID of the agent (e.g. "commercial", "support").
        subject: The subject of the relationship (e.g. "João").
        predicate: The relationship (e.g. "quer comprar").
        object_val: The object of the relationship (e.g. "50 licenças Vento").
        properties_json: Additional properties for the edge or nodes as a JSON string.
    """
    print(f"[Tool] save_memory_to_graph called with: {agent_id}, {subject}, {predicate}, {object_val}, {properties_json}")
    client = get_schema_client(agent_id)
    
    try:
        properties = json.loads(properties_json)
    except Exception:
        properties = {}
        
    properties["agent_id"] = agent_id
    properties["timestamp"] = time.time()
    properties["session_id"] = current_session_id.get()
    properties["source_channel"] = current_source_channel.get()
        
    # Generate simple IDs
    sub_id = subject.replace(" ", "_").lower()
    obj_id = object_val.replace(" ", "_").lower()
    
    # Save Subject Node
    await client.upsert_node(
        node_id=sub_id,
        label="Entity",
        properties={"name": subject, "agent_id": agent_id, "timestamp": properties["timestamp"]}
    )
    
    # Save Object Node
    await client.upsert_node(
        node_id=obj_id,
        label="Entity",
        properties={"name": object_val, "agent_id": agent_id, "timestamp": properties["timestamp"]}
    )
    
    # Save Edge
    await client.create_edge(
        source_id=sub_id,
        target_id=obj_id,
        relation=predicate,
        properties=properties
    )
    return f"Successfully saved memory: {subject} {predicate} {object_val}"

async def save_semantic_memory(agent_id: str, subject_name: str, subject_class: str, predicate: str, object_name: str, object_class: str, properties_json: str = "{}"):
    """
    Stores a semantic memory fragment into the agent's knowledge graph, adhering to and expanding the ontology.
    
    Args:
        agent_id: The ID of the agent (e.g. "commercial", "support").
        subject_name: The name/ID of the subject (e.g. "naluartt").
        subject_class: The ontology class of the subject (e.g. "User", "Company").
        predicate: The relationship (e.g. "WORKS_AT", "HAS_ISSUE").
        object_name: The name/ID of the object (e.g. "Vento", "Login Bug").
        object_class: The ontology class of the object (e.g. "Software", "Bug").
        properties_json: Additional properties for the edge or nodes as a JSON string.
    """
    print(f"[Tool] save_semantic_memory called with: {agent_id}, {subject_name}:{subject_class}, {predicate}, {object_name}:{object_class}")
    client = get_schema_client(agent_id)
    
    try:
        properties = json.loads(properties_json)
    except Exception:
        properties = {}
        
    properties["agent_id"] = agent_id
    properties["timestamp"] = time.time()
    properties["session_id"] = current_session_id.get()
    properties["source_channel"] = current_source_channel.get()
        
    # Check and Expand Ontology
    from ontology_manager import ontology_manager
    schema = ontology_manager.get_schema(agent_id)
    expanded = False
    
    # Safe format
    sub_class = "".join(c for c in subject_class if c.isalnum() or c == '_').capitalize()
    obj_class = "".join(c for c in object_class if c.isalnum() or c == '_').capitalize()
    pred_safe = "".join(c for c in predicate if c.isalnum() or c == '_').upper()
    
    if not sub_class: sub_class = "Entity"
    if not obj_class: obj_class = "Entity"
    if not pred_safe: pred_safe = "RELATED_TO"
    
    if sub_class not in schema.get("nodes", []):
        schema.setdefault("nodes", []).append(sub_class)
        expanded = True
    if obj_class not in schema.get("nodes", []):
        schema.setdefault("nodes", []).append(obj_class)
        expanded = True
    if pred_safe not in schema.get("predicates", []):
        schema.setdefault("predicates", []).append(pred_safe)
        expanded = True
        
    if expanded:
        ontology_manager.save_schema(schema, agent_id)
        
    # Generate simple IDs
    sub_id = subject_name.replace(" ", "_").lower()
    obj_id = object_name.replace(" ", "_").lower()
    
    # Save Subject Node
    await client.upsert_node(
        node_id=sub_id,
        label=sub_class,
        properties={"name": subject_name, "agent_id": agent_id, "timestamp": properties["timestamp"]}
    )
    
    # Save Object Node
    await client.upsert_node(
        node_id=obj_id,
        label=obj_class,
        properties={"name": object_name, "agent_id": agent_id, "timestamp": properties["timestamp"]}
    )
    
    # Save Edge
    await client.create_edge(
        source_id=sub_id,
        target_id=obj_id,
        relation=pred_safe,
        properties=properties
    )
    return f"Successfully saved semantic memory: ({subject_name}:{sub_class}) -[{pred_safe}]-> ({object_name}:{obj_class})"

async def update_node_properties(agent_id: str, node_id: str, properties_json: str = "{}"):
    """
    Updates properties for an existing node in the agent's knowledge graph.
    
    Args:
        agent_id: The ID of the agent (e.g. "commercial", "support").
        node_id: The ID of the node to update (this is typically the subject or object name lowercased, spaces replaced by underscores).
        properties_json: A JSON string containing properties to update or add.
    """
    print(f"[Tool] update_node_properties called with: {agent_id}, {node_id}, {properties_json}")
    client = get_schema_client(agent_id)
    
    try:
        properties = json.loads(properties_json)
    except Exception:
        properties = {}
        
    # upsert_node merges properties if the node exists
    await client.upsert_node(
        node_id=node_id,
        label="Entity",
        properties=properties
    )
    return f"Successfully updated properties for node {node_id}"

def search_raw_history(agent_id: str, query: str, limit: int = 5):
    """
    Search the agent's raw interaction history and ingested documents for specific text.
    Use this to find verbatim conversations, references in documents, or "needle in the haystack" information.
    
    Args:
        agent_id: The ID of the agent (e.g. "commercial", "support").
        query: The search term or phrase.
        limit: Max results to return. Default is 5.
    """
    print(f"[Tool] search_raw_history called with: {agent_id}, {query}")
    results = search_history(agent_id, query, limit)
    if not results:
        return "No results found in raw history."
    
    formatted = []
    for r in results:
        # FTS5 returns a lot of text, we'll try to truncate safely
        content_preview = r['content'][:800] + ("..." if len(r['content']) > 800 else "")
        src = f"document: {r['file_path']}" if r['file_path'] else "chat"
        formatted.append(f"[{r['type']} | {r['role']} | {src}]\n{content_preview}")
    return "\n---\n".join(formatted)

def search_knowledge_graph(agent_id: str, query: str):
    """
    Search the structured knowledge graph for entities and their relationships.
    Use this to retrieve structured facts, ontology relationships, or properties of specific subjects.
    
    Args:
        agent_id: The ID of the agent.
        query: The name of the entity or subject to search for.
    """
    print(f"[Tool] search_knowledge_graph called with: {agent_id}, {query}")
    client = get_schema_client(agent_id)
    safe_query = query.lower()
    
    q = """
    MATCH (n)-[r]->(m)
    WHERE toLower(n.name) CONTAINS $query OR toLower(m.name) CONTAINS $query
    RETURN n.name, type(r), m.name
    LIMIT 20
    """
    try:
        res = client.graph.query(q, {'query': safe_query})
        facts = []
        for record in res.result_set:
            facts.append(f"{record[0]} -[{record[1]}]-> {record[2]}")
        
        if not facts:
            return "No matching structured facts found in the graph for that query."
        return "\\n".join(facts)
    except Exception as e:
        return f"Error querying knowledge graph: {e}"

import uuid
import time
import inspect

def bind_base_tool(agent_id: str, func_name: str, func_ref):
    import inspect
    sig = inspect.signature(func_ref)
    new_params = [p for p in sig.parameters.values() if p.name != 'agent_id']
    args_str = ", ".join([f"{p.name}: {p.annotation.__name__ if hasattr(p.annotation, '__name__') else 'str'} = {repr(p.default)}" if p.default != inspect.Parameter.empty else f"{p.name}: {p.annotation.__name__ if hasattr(p.annotation, '__name__') else 'str'}" for p in new_params])
    pass_args = ", ".join([f"{p.name}={p.name}" for p in new_params])
    
    is_async = inspect.iscoroutinefunction(func_ref)
    def_type = "async def" if is_async else "def"
    await_str = "await " if is_async else ""
    
    func_code = f"""
{def_type} {func_name}({args_str}):
    '''{func_ref.__doc__}'''
    return {await_str}func_ref(agent_id={repr(agent_id)}{', ' + pass_args if pass_args else ''})
"""
    exec_globals = globals().copy()
    exec_globals['func_ref'] = func_ref
    exec(func_code, exec_globals)
    return exec_globals[func_name]

def make_dynamic_tool(agent_id: str, action_def: dict):
    tool_name = action_def["tool_name"]
    description = action_def.get("description", "")
    parameters = action_def.get("parameters", {})
    cypher_query = action_def["cypher_query"]
    success_message = action_def.get("success_message", "Success")

    args_str = ", ".join([f"{k}: str" for k in parameters.keys() if k != 'agent_id'])
    params_str = ", ".join([f"'{k}': {k}" for k in parameters.keys() if k != 'agent_id'])
    
    func_code = f"""
async def {tool_name}({args_str}):
    '''
    {description}
    '''
    from graph_client import get_schema_client
    import uuid
    import time
    import asyncio
    
    _bound_agent_id = {repr(agent_id)}
    print(f"[Dynamic Tool] {tool_name} called with agent_id={{_bound_agent_id}}")
    client = get_schema_client(_bound_agent_id)
    
    query_params = {{{params_str}}}
    
    # Inject automatic variables that can be used in cypher
    query_params['__id'] = uuid.uuid4().hex[:8]
    query_params['__timestamp'] = time.time()
    query_params['user_id'] = query_params.get('user_id', '') # safe default
    
    try:
        res = await asyncio.to_thread(client.graph.query, {repr(cypher_query)}, query_params)
        
        results = []
        if res.result_set:
            for record in res.result_set:
                results.append(" | ".join([str(val) for val in record]))
        if results:
            return {repr(success_message)} + "\\nResults:\\n" + "\\n".join(results)
        return {repr(success_message)}
    except Exception as e:
        return f"Error executing {tool_name}: {{e}}"
"""
    namespace = {}
    exec(func_code, globals(), namespace)
    return namespace[tool_name]

import os

# Define available tools map (base tools)
AVAILABLE_TOOLS = {
    "save_memory_to_graph": save_memory_to_graph,
    "save_semantic_memory": save_semantic_memory,
    "update_node_properties": update_node_properties,
    "search_raw_history": search_raw_history,
    "search_knowledge_graph": search_knowledge_graph
}

agents_config_path = os.path.join(os.path.dirname(__file__), "agents_config.json")

def load_agents_config() -> dict:
    if not os.path.exists(agents_config_path):
        default_config = {
            "commercial": {
                "name": "commercial",
                "instruction": "You are an intelligent Commercial Agent. Your mission is to interact with users and understand their commercial needs, product interests, and company details. Automatically index this knowledge into your knowledge graph. Whenever you learn something new, use the 'save_semantic_memory' tool to extract structured triplets using the provided Ontology. You may introduce new node classes and predicates if the current ontology does not fit. If you need to update properties of an existing entity, use the 'update_node_properties' tool. Use the 'search_raw_history' tool to search through old documents or verbatim conversations. Use 'search_knowledge_graph' to retrieve your structured facts. The agent_id you must use for the tools is 'commercial'. Be concise, polite, and persuasive but helpful.",
                "tools": ["save_semantic_memory", "save_memory_to_graph", "update_node_properties", "search_raw_history", "search_knowledge_graph"]
            },
            "support": {
                "name": "support",
                "instruction": "You are an intelligent Support Agent. Your mission is to interact with users and understand their technical issues, bug reports, and feature requests. Automatically index this knowledge into your knowledge graph. Whenever you learn something new, use the 'save_semantic_memory' tool to extract structured triplets using the provided Ontology. You may introduce new node classes and predicates if the current ontology does not fit. If you need to update properties of an existing entity, use the 'update_node_properties' tool. Use the 'search_raw_history' tool to search through old documents or verbatim conversations. Use 'search_knowledge_graph' to retrieve your structured facts. The agent_id you must use for the tools is 'support'. Be concise, polite, and technical.",
                "tools": ["save_semantic_memory", "save_memory_to_graph", "update_node_properties", "search_raw_history", "search_knowledge_graph"]
            }
        }
        save_agents_config(default_config)
        return default_config
        
    try:
        with open(agents_config_path, "r", encoding="utf-8") as f:
            config = json.load(f)
            
        # Migrate old agents to include new tools if they don't have them
        migrated = False
        for aid, ainfo in config.items():
            current_tools = ainfo.get("tools", [])
            for new_tool in ["search_raw_history", "search_knowledge_graph", "save_semantic_memory"]:
                if new_tool not in current_tools:
                    current_tools.append(new_tool)
                    migrated = True
            ainfo["tools"] = current_tools
            
        if migrated:
            save_agents_config(config)
            
        return config
    except Exception:
        return {}

def save_agents_config(config: dict):
    with open(agents_config_path, "w", encoding="utf-8") as f:
        json.dump(config, f, indent=2, ensure_ascii=False)

# Initialize Agents
agents: Dict[str, Agent] = {}

def get_all_agents() -> list:
    """Return a list of all configured agent IDs."""
    config = load_agents_config()
    return list(config.keys())

def create_or_update_agent(agent_id: str, name: str, instruction: str, tools: list, action_templates: list = None) -> Agent:
    """Create a new agent or update an existing one in the configuration."""
    config = load_agents_config()
    
    agent_data = {
        "name": name,
        "instruction": instruction,
        "tools": tools
    }
    
    if action_templates is not None:
        agent_data["action_templates"] = action_templates
    elif agent_id in config and "action_templates" in config[agent_id]:
        # Preserve existing action_templates if not explicitly updated
        agent_data["action_templates"] = config[agent_id]["action_templates"]

    if agent_id in config and "channels" in config[agent_id]:
        # Preserve existing channels if they exist
        agent_data["channels"] = config[agent_id]["channels"]
        
    config[agent_id] = agent_data
    save_agents_config(config)
    
    # Invalidate cached agent if it exists
    if agent_id in agents:
        del agents[agent_id]
        
    return get_agent(agent_id, force_reload=True)

def get_agent(agent_id: str, force_reload: bool = False) -> Agent:
    if agent_id in agents and not force_reload:
        return agents[agent_id]
        
    config = load_agents_config()
    
    if agent_id not in config:
        system_instruction = f"""
        You are an intelligent {agent_id} Agent.
        Your mission is to interact with users and automatically index knowledge and memory into your knowledge graph.
        Whenever you learn something new and relevant to your mission, use the 'save_semantic_memory' tool to extract structured triplets using the provided Ontology. You may introduce new node classes and predicates if the current ontology does not fit.
        If you need to update properties of an existing entity, use the 'update_node_properties' tool.
        Use the 'search_raw_history' tool to search through old documents or verbatim conversations.
        Use 'search_knowledge_graph' to retrieve your structured facts.
        Be concise, polite, and helpful.
        """
        config[agent_id] = {
            "name": agent_id,
            "instruction": system_instruction.strip(),
            "tools": ["save_semantic_memory", "save_memory_to_graph", "update_node_properties", "search_raw_history", "search_knowledge_graph"]
        }
        save_agents_config(config)
        
    agent_info = config[agent_id]
    
    tools_to_inject = []
    for t_name in agent_info.get("tools", []):
        if t_name in AVAILABLE_TOOLS:
            bound_tool = bind_base_tool(agent_id, t_name, AVAILABLE_TOOLS[t_name])
            tools_to_inject.append(bound_tool)
            
    # Inject dynamic tools from action_templates
    action_templates = agent_info.get("action_templates", [])
    for template in action_templates:
        dyn_tool = make_dynamic_tool(agent_id, template)
        tools_to_inject.append(dyn_tool)
        
    from ontology_manager import ontology_manager
    schema = ontology_manager.get_schema(agent_id)
    base_instruction = agent_info.get("instruction", "")
    injected_instruction = base_instruction + f"\n\n--- DYNAMIC CONTEXT ---\nCURRENT ONTOLOGY:\nNodes: {schema.get('nodes', [])}\nPredicates: {schema.get('predicates', [])}\n\nUse 'save_semantic_memory' to extract facts. Use the classes and predicates above, or invent new ones if they don't adequately represent the knowledge."
            
    agent = Agent(
        name=f"{agent_id}_agent",
        model="gemini-2.0-flash",
        instruction=injected_instruction,
        tools=tools_to_inject
    )
    
    agents[agent_id] = agent
    return agent
