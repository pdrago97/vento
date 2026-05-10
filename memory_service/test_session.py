import asyncio
from google.adk import Runner
from google.adk.sessions import InMemorySessionService
from google.genai import types
from adk_agents import get_agent

async def test():
    agent = get_agent("support")
    session_service = InMemorySessionService()
    runner = Runner(agent=agent, app_name="vento", session_service=session_service)
    
    session_id = "test_session_1"
    await session_service.create_session("vento", "user1", session_id)
    
    msg1 = types.Content(role="user", parts=[types.Part.from_text(text="Hi, my favorite color is blue.")])
    print("User: Hi, my favorite color is blue.")
    resp1 = ""
    async for event in runner.run_async(user_id="user1", session_id=session_id, new_message=msg1):
        if hasattr(event, "content") and event.content:
            if hasattr(event.content, "text") and event.content.text:
                resp1 += event.content.text
            elif hasattr(event.content, "parts"):
                for p in event.content.parts:
                    if getattr(p, "text", None): resp1 += p.text
    print("Bot:", resp1)

    msg2 = types.Content(role="user", parts=[types.Part.from_text(text="What is my favorite color?")])
    print("User: What is my favorite color?")
    resp2 = ""
    async for event in runner.run_async(user_id="user1", session_id=session_id, new_message=msg2):
        if hasattr(event, "content") and event.content:
            if hasattr(event.content, "text") and event.content.text:
                resp2 += event.content.text
            elif hasattr(event.content, "parts"):
                for p in event.content.parts:
                    if getattr(p, "text", None): resp2 += p.text
    print("Bot:", resp2)

asyncio.run(test())
