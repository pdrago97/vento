import sys, os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import requests
import json
import os
import time

API_URL = "http://localhost:8000"
BASE_DIR = os.path.dirname(__file__)

AGENTS_TO_CREATE = [
    {
        "agent_id": "demo_restaurant",
        "name": "Restaurant Manager Agent",
        "instruction": "You are a Restaurant Manager Agent. You analyze shift reports and operational metrics for a restaurant. You identify shortages and incidents. Use tools to save user info. You must use search_raw_history to lookup document content.",
        "tools": ["save_memory_to_graph", "update_node_properties", "search_raw_history", "search_knowledge_graph"]
    },
    {
        "agent_id": "demo_factory",
        "name": "Factory Operations Agent",
        "instruction": "You are a Factory Operations Agent. You track assembly line bottlenecks, machine downtimes, and defect rates. You must use search_raw_history to lookup document content.",
        "tools": ["save_memory_to_graph", "update_node_properties", "search_raw_history", "search_knowledge_graph"]
    },
    {
        "agent_id": "demo_hr",
        "name": "HR Analytics Agent",
        "instruction": "You are an HR Analytics Agent. You process 1:1 meeting notes, feedback, and identify skill gaps and burnout risks. You must use search_raw_history to lookup document content.",
        "tools": ["save_memory_to_graph", "update_node_properties", "search_raw_history", "search_knowledge_graph"]
    },
    {
        "agent_id": "demo_software",
        "name": "Software Project Agent",
        "instruction": "You are a Software Project Agent. You map dependencies, blocks, and trace bugs to their root causes across agile teams. You must use search_raw_history to lookup document content.",
        "tools": ["save_memory_to_graph", "update_node_properties", "search_raw_history", "search_knowledge_graph"]
    }
]

USE_CASES = [
    {
        "agent_id": "demo_restaurant",
        "filepath": "usecases/simulated_demo_restaurant.md",
        "chats": [
            "What incident happened with Mesa 12 today?",
            "Which ingredient caused the delay?",
            "How was the customer compensated?"
        ]
    },
    {
        "agent_id": "demo_factory",
        "filepath": "usecases/simulated_demo_factory.md",
        "chats": [
            "What happened with Extrusora 03?",
            "How many pieces were discarded from Lote 8990?",
            "Who was operating the machine during the downtime?"
        ]
    },
    {
        "agent_id": "demo_hr",
        "filepath": "usecases/simulated_demo_hr.md",
        "chats": [
            "What is Ana's current feeling?",
            "What gap does the Marketing department have?",
            "What did Ana suggest to do for the Q3 campaigns?"
        ]
    },
    {
        "agent_id": "demo_software",
        "filepath": "usecases/simulated_demo_software.md",
        "chats": [
            "What is Pedro working on?",
            "Who is blocking the Autenticação OAuth feature?",
            "What bug was caused by the OAuth mock?"
        ]
    }
]

def ensure_server_running():
    try:
        r = requests.get(f"{API_URL}/health")
        if r.status_code == 200:
            print("Server is running.")
            return True
    except requests.exceptions.ConnectionError:
        pass
    print(f"Error: Could not connect to {API_URL}. Is the memory_service running?")
    return False

def load_ontology(agent_id):
    schema_file = os.path.join(BASE_DIR, f"{agent_id}_ontology_schema.json")
    if os.path.exists(schema_file):
        with open(schema_file, "r") as f:
            return json.load(f)
    return None

def populate():
    if not ensure_server_running():
        return
        
    print("--- Creating Agents ---")
    for agent_data in AGENTS_TO_CREATE:
        agent_id = agent_data["agent_id"]
        ontology = load_ontology(agent_id)
        if ontology:
            agent_data["ontology"] = ontology
            
        r = requests.post(f"{API_URL}/agents", json=agent_data)
        if r.status_code == 200:
            print(f"Agent {agent_id} created or updated.")
        else:
            print(f"Failed to create {agent_id}: {r.text}")

    print("\n--- Ingesting Documents ---")
    for uc in USE_CASES:
        agent_id = uc["agent_id"]
        filepath = os.path.join(BASE_DIR, uc["filepath"])
        
        if not os.path.exists(filepath):
            print(f"File not found: {filepath}. Skipping.")
            continue
            
        print(f"Ingesting {filepath} into {agent_id}...")
        with open(filepath, "rb") as f:
            files = {"file": (os.path.basename(filepath), f, "text/markdown")}
            r = requests.post(f"{API_URL}/agent/{agent_id}/ingest_document", files=files)
            if r.status_code == 200:
                print(f"  Ingested successfully.")
            else:
                print(f"  Failed to ingest: {r.text}")

    print("\n--- Running Simulated Dialogues ---")
    for uc in USE_CASES:
        agent_id = uc["agent_id"]
        chats = uc["chats"]
        
        print(f"\nSimulating chat for {agent_id}:")
        for message in chats:
            print(f"  User: {message}")
            r = requests.post(f"{API_URL}/agent/{agent_id}/chat", json={"message": message})
            if r.status_code == 200:
                data = r.json()
                print(f"  Assistant: {data.get('response', 'No response')}")
            else:
                print(f"  Error: {r.text}")
            time.sleep(1) # Small delay to ensure sequential processing

if __name__ == '__main__':
    populate()
