import time
import uuid
import os
from pydantic import BaseModel
from typing import Optional, Dict, Any, List

# import graph_client
from graph_client import get_schema_client

# import ADK
from google.adk.agents.llm_agent import Agent

import json
from history_db import search_history

# Define the tool
def save_memory_to_graph(agent_id: str, subject: str, predicate: str, object_val: str, properties_json: str = "{}"):
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
        
    # Generate simple IDs
    sub_id = subject.replace(" ", "_").lower()
    obj_id = object_val.replace(" ", "_").lower()
    
    # Save Subject Node
    client.upsert_node(
        node_id=sub_id,
        label="Entity",
        properties={"name": subject}
    )
    
    # Save Object Node
    client.upsert_node(
        node_id=obj_id,
        label="Entity",
        properties={"name": object_val}
    )
    
    # Save Edge
    client.create_edge(
        source_id=sub_id,
        target_id=obj_id,
        relation=predicate,
        properties=properties
    )
    return f"Successfully saved memory: {subject} {predicate} {object_val}"

def update_node_properties(agent_id: str, node_id: str, properties_json: str = "{}"):
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
    client.upsert_node(
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

def create_ticket(agent_id: str, title: str, description: str, user_id: str = "anonymous", priority: str = "normal"):
    """
    Creates a new support ticket in the dynamic operational inventory.
    Use this tool when a user wants to open a support ticket or report an issue.
    
    Args:
        agent_id: The ID of the agent (e.g. "support").
        title: Short summary of the issue.
        description: Detailed description of the issue.
        user_id: The ID or name of the user opening the ticket.
        priority: Priority of the ticket (e.g. "low", "normal", "high").
    """
    print(f"[Tool] create_ticket called with: {agent_id}, {title}")
    client = get_schema_client(agent_id)
    ticket_id = f"ticket_{uuid.uuid4().hex[:8]}"
    
    properties = {
        "id": ticket_id,
        "title": title,
        "description": description,
        "status": "open",
        "priority": priority,
        "created_at": time.time(),
        "user_id": user_id
    }
    
    client.upsert_node(
        node_id=ticket_id,
        label="Ticket",
        properties=properties
    )
    
    # Link user to ticket
    safe_user_id = user_id.replace(" ", "_").lower()
    client.upsert_node(node_id=safe_user_id, label="User", properties={"name": user_id})
    client.create_edge(source_id=safe_user_id, target_id=ticket_id, relation="OPENED_TICKET")
    
    return f"Ticket created successfully with ID: {ticket_id}"

def query_tickets(agent_id: str, status: str = None, user_id: str = None):
    """
    Query the dynamic inventory for support tickets based on status or user_id.
    
    Args:
        agent_id: The ID of the agent.
        status: (Optional) The status to filter by (e.g., 'open', 'closed').
        user_id: (Optional) The user ID to filter by.
    """
    print(f"[Tool] query_tickets called with: {agent_id}, status={status}, user={user_id}")
    client = get_schema_client(agent_id)
    
    conditions = []
    params = {}
    
    if status:
        conditions.append("t.status = $status")
        params['status'] = status
    if user_id:
        conditions.append("t.user_id = $user_id")
        params['user_id'] = user_id
        
    where_clause = "WHERE " + " AND ".join(conditions) if conditions else ""
    
    q = f"""
    MATCH (t:Ticket)
    {where_clause}
    RETURN t.id, t.title, t.status, t.priority, t.user_id
    LIMIT 20
    """
    
    try:
        res = client.graph.query(q, params)
        tickets = []
        for record in res.result_set:
            tickets.append(f"Ticket ID: {record[0]} | Title: {record[1]} | Status: {record[2]} | Priority: {record[3]} | User: {record[4]}")
            
        if not tickets:
            return "No tickets found matching the criteria."
        return "\\n".join(tickets)
    except Exception as e:
        return f"Error querying tickets: {e}"

import os

# Define available tools map
AVAILABLE_TOOLS = {
    "save_memory_to_graph": save_memory_to_graph,
    "update_node_properties": update_node_properties,
    "search_raw_history": search_raw_history,
    "search_knowledge_graph": search_knowledge_graph,
    "create_ticket": create_ticket,
    "query_tickets": query_tickets
}

agents_config_path = os.path.join(os.path.dirname(__file__), "agents_config.json")

def load_agents_config() -> dict:
    if not os.path.exists(agents_config_path):
        default_config = {
            "commercial": {
                "name": "commercial",
                "instruction": "You are an intelligent Commercial Agent. Your mission is to interact with users and understand their commercial needs, product interests, and company details. Automatically index this knowledge into your knowledge graph. Whenever you learn something new, use the 'save_memory_to_graph' tool to save it. If you need to update properties of an existing entity, use the 'update_node_properties' tool. Use the 'search_raw_history' tool to search through old documents or verbatim conversations. Use 'search_knowledge_graph' to retrieve your structured facts. The agent_id you must use for the tools is 'commercial'. Be concise, polite, and persuasive but helpful.",
                "tools": ["save_memory_to_graph", "update_node_properties", "search_raw_history", "search_knowledge_graph"]
            },
            "support": {
                "name": "support",
                "instruction": "You are an intelligent Support Agent. Your mission is to interact with users and understand their technical issues, bug reports, and feature requests. Automatically index this knowledge into your knowledge graph. Whenever you learn something new, use the 'save_memory_to_graph' tool to save it. If you need to update properties of an existing entity, use the 'update_node_properties' tool. Use the 'search_raw_history' tool to search through old documents or verbatim conversations. Use 'search_knowledge_graph' to retrieve your structured facts. The agent_id you must use for the tools is 'support'. Be concise, polite, and technical.",
                "tools": ["save_memory_to_graph", "update_node_properties", "search_raw_history", "search_knowledge_graph"]
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
            for new_tool in ["search_raw_history", "search_knowledge_graph"]:
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

def create_or_update_agent(agent_id: str, name: str, instruction: str, tools: list) -> Agent:
    """Create a new agent or update an existing one in the configuration."""
    config = load_agents_config()
    config[agent_id] = {
        "name": name,
        "instruction": instruction,
        "tools": tools
    }
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
        Whenever you learn something new and relevant to your mission, use the 'save_memory_to_graph' tool to save it.
        If you need to update properties of an existing entity, use the 'update_node_properties' tool.
        Use the 'search_raw_history' tool to search through old documents or verbatim conversations.
        Use 'search_knowledge_graph' to retrieve your structured facts.
        The agent_id you must use for the tools is '{agent_id}'.
        Be concise, polite, and helpful.
        """
        config[agent_id] = {
            "name": agent_id,
            "instruction": system_instruction.strip(),
            "tools": ["save_memory_to_graph", "update_node_properties", "search_raw_history", "search_knowledge_graph"]
        }
        save_agents_config(config)
        
    agent_info = config[agent_id]
    
    tools_to_inject = []
    for t_name in agent_info.get("tools", []):
        if t_name in AVAILABLE_TOOLS:
            tools_to_inject.append(AVAILABLE_TOOLS[t_name])
            
    agent = Agent(
        name=f"{agent_id}_agent",
        model="gemini-2.0-flash",
        instruction=agent_info.get("instruction", ""),
        tools=tools_to_inject
    )
    
    agents[agent_id] = agent
    return agent
