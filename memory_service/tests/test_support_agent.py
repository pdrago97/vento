import sys, os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import sys
from adk_agents import get_agent

agent = get_agent("support", force_reload=True)
print("\nSending message to agent...")
response = agent.chat("Check tickets for user pedro_reichow")
print("Response:", response)
