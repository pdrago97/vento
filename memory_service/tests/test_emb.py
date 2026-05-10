import sys, os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import asyncio
import os
from embedding import get_embedding

async def main():
    emb = await get_embedding('hello')
    print("Embedding length:", len(emb))

if __name__ == "__main__":
    asyncio.run(main())
