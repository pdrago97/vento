import os
import json
from typing import Optional, Tuple
from google import genai
from google.genai import types
from dotenv import load_dotenv
from ontology_manager import ontology_manager

load_dotenv()
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY")

client = None
if GEMINI_API_KEY:
    client = genai.Client(api_key=GEMINI_API_KEY)

def extract_fact(message: str) -> Optional[Tuple[str, str, str]]:
    """
    Analyzes a message to determine if it contains a fact to memorize.
    Returns (Subject, Predicate, Object) if a fact is found, else None.
    """
    if not client:
        # Fallback to simple noise filtering if no API key
        msg = message.lower().strip()
        if len(msg.split()) < 3:
            return None
        return None

    valid_predicates = ontology_manager.schema.get("predicates", [])
    
    prompt = f"""
    You are a knowledge extraction gatekeeper. Your job is to extract important facts from the user's message.
    If the message contains a fact worth remembering, extract it as a triple: subject, predicate, and object.
    
    The subject is usually "User" if the user is talking about themselves.
    Try to use one of the following valid predicates if they fit: {', '.join(valid_predicates)}.
    If none fit, you may invent a new predicate in UPPER_SNAKE_CASE (e.g., HAS_MEETING_WITH_ACME).
    
    If the message is conversational noise (e.g., "ok", "lol", "brb", "thanks", "hello") or does not contain a factual statement, return an empty JSON object.
    
    Format your response STRICTLY as JSON:
    {{
        "subject": "string",
        "predicate": "string",
        "object": "string"
    }}
    
    User message: "{message}"
    """
    
    try:
        response = client.models.generate_content(
            model="gemini-1.5-flash",
            contents=prompt,
            config=types.GenerateContentConfig(
                response_mime_type="application/json"
            )
        )
        
        data = json.loads(response.text)
        if "subject" in data and "predicate" in data and "object" in data:
            return (data["subject"], data["predicate"], data["object"])
    except Exception as e:
        print(f"Gatekeeper error: {e}")
        
    return None
