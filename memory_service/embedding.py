import os
from google import genai
from google.genai import types
from dotenv import load_dotenv

load_dotenv()

GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY")

client = None
if GEMINI_API_KEY:
    client = genai.Client(api_key=GEMINI_API_KEY)

def get_embedding(text: str) -> list[float]:
    """Generates an embedding for the given text using Gemini."""
    if not client:
        # Mock embedding for local dev without API key
        return [0.1] * 768 

    response = client.models.embed_content(
        model="text-embedding-004",
        contents=text,
        config=types.EmbedContentConfig(
            task_type="RETRIEVAL_DOCUMENT"
        )
    )
    return response.embeddings[0].values
