import sys, os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import os
from google.adk.agents.llm_agent import Agent
from google.adk import Runner
from google.adk.sessions import InMemorySessionService
from google.genai import types
import asyncio

a = Agent(name='test', instruction='say hello to the user')
session_service = InMemorySessionService()
runner = Runner(agent=a, app_name="test_app", session_service=session_service)

async def main():
    session = await session_service.create_session(app_name="test_app", user_id="test_user", session_id="test_session")
    msg = types.Content(role="user", parts=[types.Part.from_text(text="hi")])
    
    async for event in runner.run_async(user_id="test_user", session_id="test_session", new_message=msg):
        print(type(event))
        if getattr(event, "message", None):
            print("message part:", event.message)
            if hasattr(event.message, "parts"):
                for part in event.message.parts:
                    print("part text:", part.text)
        elif getattr(event, "text", None):
            print("text:", event.text)

asyncio.run(main())
