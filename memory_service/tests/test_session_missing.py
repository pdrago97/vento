import sys, os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import asyncio
from google.adk.sessions import InMemorySessionService
async def test():
    service = InMemorySessionService()
    try:
        session = await service.get_session(app_name="test", user_id="user1", session_id="sess_missing")
        print(f"Returned: {session}")
    except Exception as e:
        print(f"Error: {repr(e)}")
asyncio.run(test())
