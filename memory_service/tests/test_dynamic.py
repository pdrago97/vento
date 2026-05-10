import sys, os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import json
from adk_agents import get_agent, load_agents_config

agent = get_agent('support', force_reload=True)

print("Agent tools loaded:")
for tool in agent.tools:
    print(f"- {tool.__name__}")

print("\nTesting dynamic create_ticket...")
try:
    res = agent.tools[-2](agent_id="support", title="Login issue", description="Cannot login", user_id="pedro", priority="high")
    print(res)
except Exception as e:
    print(f"Error: {e}")

print("\nTesting dynamic query_tickets...")
try:
    res2 = agent.tools[-1](agent_id="support", status="", user_id="pedro")
    print(res2)
except Exception as e:
    print(f"Error: {e}")
