import json
from pydantic import BaseModel
from typing import Optional, List, Dict
import copy

def generate_openclaw_manifest(agent_config: dict, agent_id: str, backend_url: str = "http://localhost:8000"):
    """
    Translates a Vento agent configuration into an OpenClaw-compatible manifest format.
    Injects custom tools that allow the OpenClaw agent to interact with Vento's Memory Service.
    """
    
    instruction = agent_config.get("instruction", "")
    name = agent_config.get("name", agent_id)
    
    # We add instructions telling the OpenClaw agent to use the Vento memory tools.
    manifest_instruction = f"""{instruction}

[Vento Memory Integration]
You have access to Vento's Knowledge Graph via external API tools. 
Always use 'save_memory_to_graph' to persist important information you learn from the user.
Use 'search_knowledge_graph' to retrieve your structured facts.
When using these tools, you MUST pass your assigned agent_id: '{agent_id}'.
"""

    manifest = {
        "id": agent_id,
        "name": name,
        "description": f"Vento-managed agent: {name}",
        "system_prompt": manifest_instruction.strip(),
        "model": "gemini-2.0-flash",
        "channels": agent_config.get("channels", {}),
        "tools": []
    }
    
    # Standard Vento tools mapped to OpenClaw HTTP API Tool definitions
    vento_tools = [
        {
            "name": "save_memory_to_graph",
            "description": "Stores a memory fragment into the agent's knowledge graph.",
            "type": "http_request",
            "config": {
                "method": "POST",
                "url": f"{backend_url}/openclaw/tools/save_memory_to_graph",
                "headers": {"Content-Type": "application/json"}
            },
            "parameters": {
                "type": "object",
                "properties": {
                    "agent_id": {"type": "string", "description": "The ID of the agent."},
                    "subject": {"type": "string", "description": "The subject of the relationship (e.g. 'João')."},
                    "predicate": {"type": "string", "description": "The relationship (e.g. 'quer comprar')."},
                    "object_val": {"type": "string", "description": "The object of the relationship."},
                    "properties_json": {"type": "string", "description": "Additional properties as JSON string."}
                },
                "required": ["agent_id", "subject", "predicate", "object_val"]
            }
        },
        {
            "name": "search_knowledge_graph",
            "description": "Search the structured knowledge graph for entities and their relationships.",
            "type": "http_request",
            "config": {
                "method": "POST",
                "url": f"{backend_url}/openclaw/tools/search_knowledge_graph",
                "headers": {"Content-Type": "application/json"}
            },
            "parameters": {
                "type": "object",
                "properties": {
                    "agent_id": {"type": "string", "description": "The ID of the agent."},
                    "query": {"type": "string", "description": "The name of the entity or subject to search for."}
                },
                "required": ["agent_id", "query"]
            }
        }
    ]
    
    # Check which tools the agent actually uses in its config
    agent_tool_names = agent_config.get("tools", [])
    for vt in vento_tools:
        if vt["name"] in agent_tool_names:
            manifest["tools"].append(vt)
            
    # Include Dynamic Tools (Action Templates)
    action_templates = agent_config.get("action_templates", [])
    for template in action_templates:
        dyn_tool = {
            "name": template["tool_name"],
            "description": template.get("description", ""),
            "type": "http_request",
            "config": {
                "method": "POST",
                "url": f"{backend_url}/openclaw/tools/dynamic/{agent_id}/{template['tool_name']}",
                "headers": {"Content-Type": "application/json"}
            },
            "parameters": {
                "type": "object",
                "properties": {},
                "required": []
            }
        }
        for param_name, param_desc in template.get("parameters", {}).items():
            dyn_tool["parameters"]["properties"][param_name] = {
                "type": "string",
                "description": param_desc
            }
            dyn_tool["parameters"]["required"].append(param_name)
            
        manifest["tools"].append(dyn_tool)

    return manifest
