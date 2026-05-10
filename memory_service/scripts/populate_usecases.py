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
        "agent_id": "commercial",
        "name": "Commercial Agent",
        "instruction": "You are a Commercial Agent. You answer questions about Vento pricing and features. Use tools to save user info. You must use search_raw_history to lookup document content.",
        "tools": ["save_memory_to_graph", "update_node_properties", "search_raw_history", "search_knowledge_graph"]
    },
    {
        "agent_id": "support",
        "name": "Support Agent",
        "instruction": "You are a Support Agent. You help users with technical issues. Use tools to check error docs. You must use search_raw_history to lookup document content.",
        "tools": ["save_memory_to_graph", "update_node_properties", "search_raw_history", "search_knowledge_graph"]
    },
    {
        "agent_id": "legal_assistant",
        "name": "Legal Assistant",
        "instruction": "You are a Legal Assistant. You help users understand NDAs and legal documents. Use your search tools to find exact clauses. You must use search_raw_history to lookup document content.",
        "tools": ["save_memory_to_graph", "update_node_properties", "search_raw_history", "search_knowledge_graph"]
    },
    {
        "agent_id": "cv_analyzer",
        "name": "Resume Analyzer",
        "instruction": "You are a Resume Analyzer. You visually inspect and analyze resumes and job descriptions. Match candidates against open job requisitions. Use your search tools to find exact skills and experience. You must use search_raw_history to lookup document content.",
        "tools": ["save_memory_to_graph", "update_node_properties", "search_raw_history", "search_knowledge_graph"]
    },
    {
        "agent_id": "career_agent",
        "name": "Career & Performance Agent",
        "instruction": "You are a Career & Performance Agent. You track employee performance, KPIs, attendance, and assertiveness. You can maintain rankings across different roles. Use your search tools to find exact metrics. You must use search_raw_history to lookup document content.",
        "tools": ["save_memory_to_graph", "update_node_properties", "search_raw_history", "search_knowledge_graph"]
    },
    {
        "agent_id": "team_support_agent",
        "name": "Internal Team Support Agent",
        "instruction": "You are an Internal Team Support Agent. You analyze historical transcripts and Slack/WhatsApp messages to help the team understand internal processes, tasks, and incident resolution protocols. Use your search tools to find exact historical conversations. You must use search_raw_history to lookup document content.",
        "tools": ["save_memory_to_graph", "update_node_properties", "search_raw_history", "search_knowledge_graph"]
    }
]

USE_CASES = [
    {
        "agent_id": "commercial",
        "filepath": "usecases/usecase_product_catalog.md",
        "chats": [
            "Hi, I'm Pedro. I run a startup and I'm interested in the Vento product.",
            "Can you tell me how much the Pro plan costs?",
            "What happens if I exceed my usage limits?"
        ]
    },
    {
        "agent_id": "support",
        "filepath": "usecases/usecase_support_errors.md",
        "chats": [
            "Hi, I'm John from IT. We're seeing an error 504 on our end.",
            "What is the typical cause of Error 504?",
            "Are there any workarounds for Error 429?"
        ]
    },
    {
        "agent_id": "legal_assistant",
        "filepath": "usecases/usecase_legal_nda.md",
        "chats": [
            "Hello, I'm Alice. I need to understand the new NDA.",
            "What is the penalty if I breach the confidentiality clause?",
            "How long does the NDA last?"
        ]
    },
    {
        "agent_id": "cv_analyzer",
        "filepath": "usecases/usecase_curriculum_analysis.md",
        "chats": [
            "Can you list the open job positions in the company?",
            "Does João Silva have the required experience for the Software Engineer position?",
            "What is Mariana Costa's current role and how long has she worked with SaaS B2B?"
        ]
    },
    {
        "agent_id": "career_agent",
        "filepath": "usecases/usecase_career_metrics.md",
        "chats": [
            "Who is currently the number one Customer Success Manager?",
            "How many bugs did Rafael Mendes have in QA this quarter? Did he hit his goal?",
            "What feedback was given to Camila Ferreira regarding her punctuality?"
        ]
    },
    {
        "agent_id": "team_support_agent",
        "filepath": "usecases/usecase_team_support.md",
        "chats": [
            "How do I deploy to production? What is the slack command?",
            "I'm opening a ticket for an RDS outage. What tags and status should I use?",
            "Is it okay to bypass the Jenkins staging validation if the e2e tests fail?"
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

def populate():
    if not ensure_server_running():
        return
        
    print("--- Creating Agents ---")
    for agent_data in AGENTS_TO_CREATE:
        r = requests.post(f"{API_URL}/agents", json=agent_data)
        if r.status_code == 200:
            print(f"Agent {agent_data['agent_id']} created or updated.")
        else:
            print(f"Failed to create {agent_data['agent_id']}: {r.text}")

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
