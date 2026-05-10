import asyncio
import aiohttp
import time
import uuid

API_BASE = "http://localhost:8000"
AGENT_ID = "stress_agent"

# We'll pull a few wikipedia articles as text sources
SOURCES = [
    "https://en.wikipedia.org/api/rest_v1/page/html/Space_exploration",
    "https://en.wikipedia.org/api/rest_v1/page/html/Artificial_intelligence",
    "https://en.wikipedia.org/api/rest_v1/page/html/Quantum_computing",
    "https://en.wikipedia.org/api/rest_v1/page/html/Machine_learning",
    "https://en.wikipedia.org/api/rest_v1/page/html/Data_science"
]

async def create_agent(session):
    print("Creating stress test agent...")
    payload = {
        "agent_id": AGENT_ID,
        "name": "Stress Test Analyst",
        "instruction": "You are a senior analyst. Answer queries thoroughly based on the knowledge graph facts.",
        "tools": ["search_knowledge_graph"],
        "ontology": {
            "nodes": ["Concept", "Technology", "Field", "Person", "Entity"],
            "predicates": ["RELATES_TO", "INCLUDES", "DEVELOPED_BY", "DEFINES"],
            "properties": {
                "Concept": ["name", "description"],
                "Technology": ["name", "application"]
            }
        }
    }
    async with session.post(f"{API_BASE}/agents", json=payload) as resp:
        return await resp.json()

async def fetch_and_ingest(session, url, idx):
    print(f"[Ingest {idx}] Fetching {url.split('/')[-1]}...")
    try:
        # Fetch content
        async with session.get(url) as resp:
            text = await resp.text()
            
        # Create a mock file in memory to upload
        data = aiohttp.FormData()
        data.add_field('file', 
                       text.encode('utf-8'),
                       filename=f"doc_{idx}.html",
                       content_type='text/html')
                       
        print(f"[Ingest {idx}] Uploading to /agent/{AGENT_ID}/ingest_document...")
        start_time = time.time()
        
        # This is where the backend will choke if synchronous
        async with session.post(f"{API_BASE}/agent/{AGENT_ID}/ingest_document", data=data) as resp:
            status = resp.status
            res_json = await resp.json()
            elapsed = time.time() - start_time
            print(f"[Ingest {idx}] Completed in {elapsed:.2f}s with status {status}")
            return status, elapsed
    except Exception as e:
        print(f"[Ingest {idx}] Failed: {str(e)}")
        return 500, 0

async def chat_query(session, query, idx):
    print(f"[Chat {idx}] Sending query: {query[:30]}...")
    payload = {"message": query}
    start_time = time.time()
    try:
        async with session.post(f"{API_BASE}/agent/{AGENT_ID}/chat", json=payload) as resp:
            status = resp.status
            res_json = await resp.json()
            elapsed = time.time() - start_time
            print(f"[Chat {idx}] Completed in {elapsed:.2f}s with status {status}")
            return status, elapsed
    except Exception as e:
        print(f"[Chat {idx}] Failed: {str(e)}")
        return 500, 0

async def main():
    async with aiohttp.ClientSession() as session:
        # 1. Setup
        res = await create_agent(session)
        print("Agent creation:", res)
        
        # 2. Ingestion Stress
        print("\n--- Starting Ingestion Stress Test ---")
        # Let's fire 10 concurrent ingestions (some duplicated sources just to cause load)
        ingest_tasks = []
        for i in range(10):
            url = SOURCES[i % len(SOURCES)]
            ingest_tasks.append(fetch_and_ingest(session, url, i))
            
        ingest_results = await asyncio.gather(*ingest_tasks)
        
        # 3. Chat Stress
        print("\n--- Starting Chat Stress Test ---")
        queries = [
            "What is Space Exploration?",
            "Explain Quantum Computing concepts.",
            "How does Machine Learning relate to AI?",
            "Summarize the Data Science article facts.",
            "List all known concepts in the graph."
        ]
        
        # Fire 20 concurrent chat requests
        chat_tasks = []
        for i in range(20):
            q = queries[i % len(queries)] + f" (Random ID: {uuid.uuid4()})"
            chat_tasks.append(chat_query(session, q, i))
            
        chat_results = await asyncio.gather(*chat_tasks)
        
        # 4. Report
        print("\n--- Stress Test Report ---")
        ingest_success = len([r for r in ingest_results if r[0] == 200])
        chat_success = len([r for r in chat_results if r[0] == 200])
        
        print(f"Ingestion Success Rate: {ingest_success}/10")
        print(f"Chat Success Rate: {chat_success}/20")
        
        if ingest_success > 0:
            avg_ingest = sum(r[1] for r in ingest_results if r[0] == 200) / ingest_success
            print(f"Avg Ingest Time (success): {avg_ingest:.2f}s")
            
        if chat_success > 0:
            avg_chat = sum(r[1] for r in chat_results if r[0] == 200) / chat_success
            print(f"Avg Chat Time (success): {avg_chat:.2f}s")

if __name__ == "__main__":
    asyncio.run(main())
