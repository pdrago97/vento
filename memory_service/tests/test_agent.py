import sys, os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import asyncio
import os
import sys
from dotenv import load_dotenv

load_dotenv()

from adk_agents import get_agent
from google.adk import Runner
from google.adk.sessions import InMemorySessionService
from google.genai import types

async def main():
    agent_id = "demo_restaurant"
    agent = get_agent(agent_id)
    global_session_service = InMemorySessionService()
    runner = Runner(agent=agent, app_name="vento", session_service=global_session_service)
    
    session_id = f"session_{agent_id}"
    await global_session_service.create_session(app_name="vento", user_id="default", session_id=session_id)
    msg = types.Content(role="user", parts=[types.Part.from_text(text="Hello")])
    
    async for event in runner.run_async(user_id="default", session_id=session_id, new_message=msg):
        print("EVENT TYPE:", type(event))
        print("EVENT DICT:", getattr(event, "__dict__", dir(event)))
        if hasattr(event, "message") and event.message:
            print("HAS MESSAGE")
            if hasattr(event.message, "parts"):
                for p in event.message.parts:
                    print("PART TEXT:", p.text)
            if hasattr(event.message, "text"):
                print("MESSAGE TEXT:", event.message.text)
        elif hasattr(event, "text"):
             print("HAS TEXT:", event.text)

if __name__ == "__main__":
    asyncio.run(main())
