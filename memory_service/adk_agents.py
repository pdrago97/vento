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

import os

# Define available tools map
AVAILABLE_TOOLS = {
    "save_memory_to_graph": save_memory_to_graph,
    "update_node_properties": update_node_properties
}

agents_config_path = os.path.join(os.path.dirname(__file__), "agents_config.json")

def load_agents_config() -> dict:
    if not os.path.exists(agents_config_path):
        default_config = {
            "commercial": {
                "name": "commercial",
                "instruction": "You are an intelligent Commercial Agent. Your mission is to interact with users and understand their commercial needs, product interests, and company details. Automatically index this knowledge into your knowledge graph. Whenever you learn something new, use the 'save_memory_to_graph' tool to save it. If you need to update properties of an existing entity, use the 'update_node_properties' tool. The agent_id you must use for the tools is 'commercial'. Be concise, polite, and persuasive but helpful.",
                "tools": ["save_memory_to_graph", "update_node_properties"]
            },
            "support": {
                "name": "support",
                "instruction": "You are an intelligent Support Agent. Your mission is to interact with users and understand their technical issues, bug reports, and feature requests. Automatically index this knowledge into your knowledge graph. Whenever you learn something new, use the 'save_memory_to_graph' tool to save it. If you need to update properties of an existing entity, use the 'update_node_properties' tool. The agent_id you must use for the tools is 'support'. Be concise, polite, and technical.",
                "tools": ["save_memory_to_graph", "update_node_properties"]
            }
        }
        save_agents_config(default_config)
        return default_config
        
    try:
        with open(agents_config_path, "r", encoding="utf-8") as f:
            return json.load(f)
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
        The agent_id you must use for the tools is '{agent_id}'.
        Be concise, polite, and helpful.
        """
        config[agent_id] = {
            "name": agent_id,
            "instruction": system_instruction.strip(),
            "tools": ["save_memory_to_graph", "update_node_properties"]
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
