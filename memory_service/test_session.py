import asyncio
from google.adk.sessions import InMemorySessionService
async def test():
    service = InMemorySessionService()
    await service.create_session(app_name="test", user_id="user1", session_id="sess1")
    try:
        await service.get_session(app_name="test", user_id="user2", session_id="sess1")
        print("Success user2")
    except Exception as e:
        print(f"Error user2: {e}")
asyncio.run(test())
