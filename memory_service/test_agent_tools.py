import asyncio
from adk_agents import get_agent
from google.adk import Runner
from google.adk.sessions import InMemorySessionService
from google.genai import types

async def main():
    agent = get_agent("commercial")
    print(f"Loaded agent: {agent.name}")
    print(f"Tools available: {[t.__name__ for t in agent.tools]}")
    
    session_service = InMemorySessionService()
    runner = Runner(agent=agent, app_name="vento", session_service=session_service)
    
    session_id = "test_memory_session"
    await session_service.create_session(app_name="vento", user_id="test_user", session_id=session_id)
    
    msg = types.Content(role="user", parts=[types.Part.from_text(text="Please search your raw history for any mentions of 'sales_plan' or 'metas' and tell me what you find. If you don't find anything, search your knowledge graph for 'João'.")])
    
    print("\n--- Sending request to agent ---")
    async for event in runner.run_async(user_id="test_user", session_id=session_id, new_message=msg):
        if hasattr(event, "message") and event.message:
            for part in event.message.parts:
                if part.text:
                    print(part.text, end="")
                elif part.function_call:
                    print(f"\n[Agent calling tool: {part.function_call.name} with args: {part.function_call.args}]")
        elif hasattr(event, "function_response") and event.function_response:
            print(f"\n[Tool returned response]")
        elif hasattr(event, "text") and event.text:
            print(event.text, end="")
    print("\n--- Done ---")

if __name__ == "__main__":
    from dotenv import load_dotenv
    load_dotenv()
    asyncio.run(main())
