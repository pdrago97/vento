import sys, os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import asyncio
from adk_agents import get_agent
from google.adk import Runner
from google.adk.sessions import InMemorySessionService
from google.genai import types

async def main():
    agent = get_agent("support")
    session_service = InMemorySessionService()
    
    runner = Runner(agent=agent, app_name="test", session_service=session_service)
    
    msg = types.Content(role="user", parts=[types.Part.from_text(text="Sou Anna Luisa! Minha cor favorita é azul! Poderia salvar isso? E também quero abrir um ticket com prioridade alta porque meu monitor quebrou.")])
    print("Sending message...")
    
    session = await session_service.get_session(app_name="test", user_id="user1", session_id="sess1")
    if session is None:
        await session_service.create_session(app_name="test", user_id="user1", session_id="sess1")
    
    async for event in runner.run_async(user_id="user1", session_id="sess1", new_message=msg):
        # We can inspect the events
        if hasattr(event, "content") and event.content:
            for p in getattr(event.content, "parts", []):
                if p.text:
                    print(f"Model: {p.text}")
                elif getattr(p, "function_call", None):
                    print(f"Tool Call: {p.function_call.name} with {p.function_call.args}")
        elif hasattr(event, "text") and event.text:
            print(f"Text Event: {event.text}")

if __name__ == "__main__":
    asyncio.run(main())
