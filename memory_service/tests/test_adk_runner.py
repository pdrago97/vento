import sys, os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import sys
import asyncio
from google.adk import Runner
from google.adk.sessions import InMemorySessionService
from google.genai import types
from google.adk.agents.llm_agent import Agent

async def test():
    service = InMemorySessionService()
    agent = Agent(name="test", model="gemini-2.5-flash", instruction="You are a helper")
    runner = Runner(agent=agent, app_name="test", session_service=service)
    
    session_id = "test_session"
    msg = types.Content(role="user", parts=[types.Part.from_text(text="Hi")])
    try:
        async for event in runner.run_async(user_id="default", session_id=session_id, new_message=msg):
            print(event)
        print("Success")
    except Exception as e:
        print(f"Error: {e}")
        try:
            service.create_session_sync(app_name="test", user_id="default", session_id=session_id)
            async for event in runner.run_async(user_id="default", session_id=session_id, new_message=msg):
                print(event)
            print("Success after create_session_sync")
        except Exception as e2:
            print(f"Error 2: {e2}")

asyncio.run(test())
