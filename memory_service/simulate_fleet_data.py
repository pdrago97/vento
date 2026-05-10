import os
import time
import requests
from google import genai
from dotenv import load_dotenv

load_dotenv()

# Setup Gemini
api_key = os.environ.get("GEMINI_API_KEY")
if not api_key:
    print("Error: GEMINI_API_KEY environment variable not set. Please set it before running.")
    exit(1)

client = genai.Client(api_key=api_key)

# Define Scenarios
SCENARIOS = [
    {
        "id": "demo_restaurant",
        "title": "Restaurant Operations Incident",
        "description": "Simulate a busy Friday night at a high-end restaurant where a supply shortage causes a delay for VIP guests.",
        "personas": [
            "Chef: Focused on the kitchen, stressed about supply.",
            "Waiter (Table 12): Anxious, trying to keep the VIP guests happy.",
            "Manager: Trying to coordinate and find a solution."
        ],
        "turns": 6,
        "filename": "usecases/simulated_demo_restaurant.md"
    },
    {
        "id": "demo_factory",
        "title": "Factory Extruder Downtime",
        "description": "Simulate an unexpected downtime on Extrusora 03 on the assembly line, causing a batch of pieces to be discarded.",
        "personas": [
            "Machine Operator: Hands-on, noticing the error codes.",
            "Maintenance Tech: Diagnosing the hardware failure.",
            "Shift Supervisor: Tracking production metrics and discard rates."
        ],
        "turns": 6,
        "filename": "usecases/simulated_demo_factory.md"
    },
    {
        "id": "demo_hr",
        "title": "HR Feedback and Burnout Analysis",
        "description": "Simulate an HR cycle discussing Ana from Marketing, who is feeling burnt out due to Q3 campaign pressure.",
        "personas": [
            "Ana (Marketing): Expressing her feelings and workload.",
            "HR Business Partner: Analyzing gaps and suggesting solutions.",
            "Marketing Director: Discussing team capacity and Q3 goals."
        ],
        "turns": 6,
        "filename": "usecases/simulated_demo_hr.md"
    },
    {
        "id": "demo_software",
        "title": "Software Project Sprint Blocker",
        "description": "Simulate an agile software team dealing with a critical bug caused by a mock OAuth authentication that is blocking Pedro.",
        "personas": [
            "Pedro (Frontend Developer): Blocked by the API.",
            "Backend Engineer: Investigating the OAuth mock issue.",
            "Project Manager: Tracking dependencies and sprint goals."
        ],
        "turns": 6,
        "filename": "usecases/simulated_demo_software.md"
    }
]

def simulate_scenario(scenario):
    print(f"--- Simulating Scenario: {scenario['title']} ---")
    timeline = []
    
    # Initialize Context
    system_prompt = f"We are simulating a scenario: {scenario['title']}. {scenario['description']}\n\nPersonas involved:\n" + "\n".join(f"- {p}" for p in scenario['personas'])
    
    for turn in range(scenario['turns']):
        current_persona = scenario['personas'][turn % len(scenario['personas'])]
        persona_name = current_persona.split(':')[0]
        
        prompt = system_prompt + "\n\nTimeline of events so far:\n"
        for entry in timeline:
            prompt += f"[{entry['persona']}]: {entry['action']}\n"
            
        prompt += f"\nNow, as {persona_name}, what do you say or do next? Provide only your action/dialogue in 1-3 sentences. Focus on specific metrics, identifiers (like 'Mesa 12', 'Extrusora 03', 'Lote 8990', 'Ana'), and realistic operational details."
        
        try:
            response = client.models.generate_content(
                model="gemini-2.0-flash",
                contents=prompt
            )
            text = response.text.strip()
        except Exception as e:
            text = f"[Error calling Gemini: {e}]"
            
        print(f"[{persona_name}]: {text}")
        timeline.append({"persona": persona_name, "action": text})
        time.sleep(2) # rate limiting
        
    # Write to file
    filepath = os.path.join(os.path.dirname(__file__), scenario['filename'])
    os.makedirs(os.path.dirname(filepath), exist_ok=True)
    
    with open(filepath, "w") as f:
        f.write(f"# Scenario: {scenario['title']}\n\n")
        f.write(f"**Description:** {scenario['description']}\n\n")
        f.write("## Event Log\n\n")
        for entry in timeline:
            f.write(f"**[{entry['persona']}]**:\n{entry['action']}\n\n")
            
    print(f"Saved to {filepath}\n")

if __name__ == '__main__':
    for scenario in SCENARIOS:
        simulate_scenario(scenario)
