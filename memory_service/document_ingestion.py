import io
import os
import pypdf
import docx
import markdown
import pandas as pd
from google import genai
from dotenv import load_dotenv

load_dotenv()
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY")
client = None
if GEMINI_API_KEY:
    client = genai.Client(api_key=GEMINI_API_KEY)

def extract_text_from_file(filename: str, file_bytes: bytes) -> str:
    """Extracts text from various file formats."""
    ext = filename.split(".")[-1].lower()
    text = ""
    
    try:
        if ext == "pdf":
            reader = pypdf.PdfReader(io.BytesIO(file_bytes))
            for page in reader.pages:
                page_text = page.extract_text()
                if page_text:
                    text += page_text + "\n"
        elif ext in ["docx", "doc"]:
            doc = docx.Document(io.BytesIO(file_bytes))
            for para in doc.paragraphs:
                text += para.text + "\n"
        elif ext == "md":
            text = file_bytes.decode("utf-8")
        elif ext == "txt":
            text = file_bytes.decode("utf-8")
        elif ext == "csv":
            df = pd.read_csv(io.BytesIO(file_bytes))
            text = df.to_string()
        elif ext in ["xls", "xlsx"]:
            df = pd.read_excel(io.BytesIO(file_bytes))
            text = df.to_string()
        else:
            text = file_bytes.decode("utf-8", errors="ignore")
    except Exception as e:
        print(f"Error extracting text from {filename}: {e}")
        text = str(file_bytes) # fallback
        
    return text

def analyze_document_for_ontology(filepath: str, filename: str, text: str, current_schema: dict):
    """
    Uses Gemini to analyze the text or media and extract suggestions for the ontology,
    as well as returning concrete facts found in the document.
    """
    if not client:
        raise Exception("GEMINI_API_KEY not configured")
        
    prompt = f"""You are an expert Ontology and Knowledge Graph extractor.
I have provided a document or media file, and I want to extract information to update my knowledge graph.

The current ontology schema is:
{current_schema}

Task 1: Suggest updates to the ontology based on new concepts found in the provided content.
Task 2: Extract key facts (triples: subject, predicate, object) from the content that fit either the existing ontology or your suggested updates.

Return ONLY a JSON object in the following format:
{{
  "suggested_ontology_updates": {{
    "nodes": ["NewNode1", "NewNode2"],
    "predicates": ["NEW_PREDICATE"],
    "properties": {{
      "NewNode1": ["prop1", "prop2"]
    }}
  }},
  "extracted_facts": [
    {{
      "subject": "EntityName",
      "predicate": "RELATION",
      "object": "OtherEntityOrValue"
    }}
  ]
}}

If there are no new ontology updates needed, leave those arrays empty.
Do not wrap your response in markdown code blocks like ```json.
"""

    ext = filename.split(".")[-1].lower()
    media_extensions = ['png', 'jpg', 'jpeg', 'mp3', 'wav', 'mp4', 'mov', 'webm']
    
    contents = [prompt]
    
    uploaded_file = None
    if ext in media_extensions:
        # Upload media file to Gemini File API
        print(f"Uploading media file {filename} to Gemini...")
        uploaded_file = client.files.upload(file=filepath)
        contents.append(uploaded_file)
    else:
        # For text documents, just append the extracted text
        max_chars = 40000
        if len(text) > max_chars:
            text = text[:max_chars] + "... (truncated)"
        contents.append(f"\nDocument text:\n{text}")
        
    try:
        response = client.models.generate_content(
            model='gemini-2.0-flash',
            contents=contents
        )
        
        import json
        res_text = response.text.strip()
        if res_text.startswith("```json"):
            res_text = res_text[7:]
        if res_text.endswith("```"):
            res_text = res_text[:-3]
            
        try:
            result = json.loads(res_text.strip())
            return result
        except json.JSONDecodeError as e:
            print(f"Error parsing Gemini JSON response: {e}")
            print("Raw response:", res_text)
            return {"suggested_ontology_updates": {"nodes": [], "predicates": [], "properties": {}}, "extracted_facts": []}
    finally:
        # Clean up the file from Gemini if we uploaded it
        if uploaded_file:
            try:
                client.files.delete(name=uploaded_file.name)
                print(f"Deleted {uploaded_file.name} from Gemini")
            except Exception as e:
                print(f"Could not delete file from Gemini: {e}")

def chat_multimodal_ontology(filepath: str, filename: str, text: str, current_schema: dict, message: str):
    """
    Uses Gemini to analyze text or media along with a user's message, 
    providing a conversational response and suggested ontology updates.
    """
    if not client:
        raise Exception("GEMINI_API_KEY not configured")
        
    prompt = f"""You are an expert Ontology and Knowledge Graph assistant.
The user has provided a message and optionally a document or media file.
You should answer their message and suggest updates to the ontology based on the content or their request.

The current ontology schema is:
{current_schema}

User message: {message}

Return ONLY a JSON object in the following format:
{{
  "response": "Your conversational answer to the user's message, explaining what you found in the file or your suggestions.",
  "suggested_ontology_updates": {{
    "nodes": ["NewNode1"],
    "predicates": ["NEW_PREDICATE"],
    "properties": {{
      "NewNode1": ["prop1"]
    }}
  }}
}}

If there are no new ontology updates needed, leave those arrays empty.
Do not wrap your response in markdown code blocks like ```json.
"""

    contents = [prompt]
    
    uploaded_file = None
    if filename and filepath:
        ext = filename.split(".")[-1].lower()
        media_extensions = ['png', 'jpg', 'jpeg', 'mp3', 'wav', 'mp4', 'mov', 'webm']
        
        if ext in media_extensions:
            print(f"Uploading media file {filename} to Gemini...")
            uploaded_file = client.files.upload(file=filepath)
            contents.append(uploaded_file)
        else:
            max_chars = 40000
            if text and len(text) > max_chars:
                text = text[:max_chars] + "... (truncated)"
            if text:
                contents.append(f"\nDocument text:\n{text}")
        
    try:
        response = client.models.generate_content(
            model='gemini-2.0-flash',
            contents=contents
        )
        
        import json
        res_text = response.text.strip()
        if res_text.startswith("```json"):
            res_text = res_text[7:]
        if res_text.endswith("```"):
            res_text = res_text[:-3]
            
        try:
            result = json.loads(res_text.strip())
            return result
        except json.JSONDecodeError as e:
            print(f"Error parsing Gemini JSON response: {e}")
            print("Raw response:", res_text)
            return {"response": "I couldn't parse the suggestions correctly.", "suggested_ontology_updates": {"nodes": [], "predicates": [], "properties": {}}}
    finally:
        if uploaded_file:
            try:
                client.files.delete(name=uploaded_file.name)
                print(f"Deleted {uploaded_file.name} from Gemini")
            except Exception as e:
                print(f"Could not delete file from Gemini: {e}")
