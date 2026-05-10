import asyncio
from google.adk import Runner
from google.adk.sessions import InMemorySessionService
from google.genai import types
from adk_agents import get_agent
import os

async def main():
    agent = get_agent("support")
    if not agent:
        from google.adk.agents.llm_agent import Agent
        agent = Agent(name="test", model="gemini-2.0-flash")
    session_service = InMemorySessionService()
    await session_service.create_session(app_name="test", user_id="default", session_id="test")
    runner = Runner(agent=agent, app_name="test", session_service=session_service)
    msg = types.Content(role="user", parts=[types.Part.from_text(text="What is the support email?")])
    
    events = []
    async for event in runner.run_async(user_id="default", session_id="test", new_message=msg):
        events.append(event)
        
    for idx, e in enumerate(events):
        print(f"Event {idx}: {type(e)}")
        for attr in dir(e):
            if not attr.startswith("_"):
                try:
                    val = getattr(e, attr)
                    print(f"  {attr}: {val}")
                except Exception as ex:
                    print(f"  {attr}: Error - {ex}")

if __name__ == "__main__":
    asyncio.run(main())
