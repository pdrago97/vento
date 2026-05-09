import os
from dotenv import load_dotenv
load_dotenv("memory_service/.env")
from google import genai

client = genai.Client()
for m in client.models.list():
    if "gemini-1.5-flash" in m.name or "gemini-2.0" in m.name:
        print(m.name)
