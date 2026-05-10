import sys, os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import os
import requests
import json
import time
from google import genai
from google.genai import types

# Constants
API_URL = "http://localhost:8000"
NUM_INTERACTIONS_PER_PERSONA = 5

# Ensure GEMINI_API_KEY is available
gemini_api_key = os.environ.get("GEMINI_API_KEY")
if not gemini_api_key:
    print("Error: GEMINI_API_KEY environment variable is not set.")
    exit(1)

# Initialize Gemini Client
client = genai.Client(api_key=gemini_api_key)
MODEL_ID = "gemini-2.5-flash"

# Define our 4 Operational Personas
PERSONAS = [
    {
        "agent_id": "restaurant_manager",
        "name": "Restaurant Shift Manager",
        "system_instruction": "You are a busy restaurant shift manager. You are interacting with an AI system that tracks your restaurant's operations. Ask questions or report things about table turnover, missing inventory (like tomatoes or wine), staff complaints, POS errors, customer feedback, and reservations.",
        "examples": [
            "We are out of tomatoes, please register an urgent restock.",
            "Table 4 complained about the soup being cold. What's our policy on comps?",
            "What was our peak hour yesterday?"
        ]
    },
    {
        "agent_id": "factory_supervisor",
        "name": "Factory Floor Supervisor",
        "system_instruction": "You are a factory floor supervisor on the assembly line. You report to an AI system about machine downtime, maintenance alerts, supply chain bottlenecks, safety incidents, and production yields.",
        "examples": [
            "Machine C3 is vibrating too much, requesting maintenance.",
            "We missed our quota for the morning shift by 15%.",
            "Did the new batch of screws arrive from the supplier?"
        ]
    },
    {
        "agent_id": "hr_partner",
        "name": "HR Business Partner",
        "system_instruction": "You are an HR Business Partner. You use this AI system to log employee feedback, check compliance, manage onboarding, track PTO (Paid Time Off), and handle workplace disputes.",
        "examples": [
            "Please log that Sarah is taking PTO next week.",
            "What is the current status of the onboarding for the new engineers?",
            "I need to file a report regarding a conflict in the marketing team."
        ]
    },
    {
        "agent_id": "software_pm",
        "name": "Software Project Manager",
        "system_instruction": "You are a Software Project Manager working with an AI assistant. You track Jira tickets, sprint velocity, bug reports, deployment schedules, and developer blockers.",
        "examples": [
            "Sprint 12 velocity was lower than expected. What were the main blockers?",
            "Can we push the release to Thursday? The QA team found a P1 bug.",
            "Which developer is currently assigned to the authentication epic?"
        ]
    }
]

def generate_messages(persona, count=NUM_INTERACTIONS_PER_PERSONA):
    """Uses Gemini to generate synthetic user messages for a given persona."""
    print(f"Generating {count} synthetic messages for {persona['name']}...")
    
    prompt = f"""
    Generate {count} distinct, realistic, and short user queries or statements.
    These are things the user would say to an AI assistant.
    
    Return the output as a valid JSON array of strings. Do not include markdown formatting or any other text.
    
    Examples:
    {json.dumps(persona['examples'])}
    """
    
    try:
        response = client.models.generate_content(
            model=MODEL_ID,
            contents=prompt,
            config=types.GenerateContentConfig(
                system_instruction=persona["system_instruction"],
                temperature=0.7,
                response_mime_type="application/json"
            )
        )
        messages = json.loads(response.text)
        return messages
    except Exception as e:
        print(f"Error generating messages for {persona['name']}: {e}")
        return persona['examples'] # Fallback to examples if generation fails

def ensure_server_running():
    try:
        r = requests.get(f"{API_URL}/health")
        if r.status_code == 200:
            return True
    except requests.exceptions.ConnectionError:
        pass
    print(f"Error: Could not connect to {API_URL}. Is the memory_service running?")
    return False

def simulate_fleet():
    if not ensure_server_running():
        return
        
    print("--- Starting Fleet Simulator ---")
    
    for persona in PERSONAS:
        agent_id = persona["agent_id"]
        
        # 1. Ensure Agent Exists (or Create it)
        agent_data = {
            "agent_id": agent_id,
            "name": persona["name"],
            "instruction": f"You are assisting a {persona['name']}. Store their reports and answer their questions using search_raw_history and save_memory_to_graph.",
            "tools": ["save_memory_to_graph", "update_node_properties", "search_raw_history", "search_knowledge_graph"]
        }
        
        r = requests.post(f"{API_URL}/agents", json=agent_data)
        if r.status_code == 200:
            print(f"\n[OK] Agent {agent_id} is ready.")
        else:
            print(f"[ERROR] Failed to prepare agent {agent_id}: {r.text}")
            continue

        # 2. Generate Synthetic Messages
        messages = generate_messages(persona)
        
        # 3. Simulate Interactions
        print(f"--- Simulating interactions for {agent_id} ---")
        for idx, message in enumerate(messages):
            print(f"\n[{idx+1}/{len(messages)}] User ({persona['name']}): {message}")
            
            try:
                r = requests.post(f"{API_URL}/agent/{agent_id}/chat", json={"message": message})
                if r.status_code == 200:
                    data = r.json()
                    print(f"Assistant: {data.get('response', 'No response')}")
                else:
                    print(f"Error from server: {r.text}")
            except Exception as e:
                print(f"Failed to send message: {e}")
                
            time.sleep(2) # Prevent overwhelming the local server

if __name__ == "__main__":
    simulate_fleet()
