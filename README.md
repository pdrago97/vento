# OpenClaw Memory Service Plugin

This repository implements a cross-session memory synchronization service for OpenClaw using **FalkorDB** and **Google Vertex AI (Gemini Embeddings)**. It addresses the technical challenge of securely and cost-effectively sharing memories across isolated channels without polluting a unified context window.

## Architecture

1. **Selective Extraction**: Uses a gatekeeper (mocked LLM logic) to separate conversational noise from actionable facts.
2. **Semantic Knowledge Graph**: Stores facts as triples in FalkorDB using an ontology schema.
3. **Multimodal Embeddings**: Uses Google Vertex AI `text-embedding-004` to generate vector representations of facts for semantic search.
4. **Context Injection**: Hooks into OpenClaw's message loop to dynamically inject only the top-K relevant facts into the prompt based on the user's current query.
5. **Conflict Resolution**: Resolves conflicting statements by deprecating old edge relationships.

## Prerequisites

- Docker and Docker Compose
- Python 3.9+
- (Optional) `gcloud` CLI authenticated with a Google Cloud Project that has Vertex AI enabled.
  - If Vertex AI is not configured, the service gracefully falls back to mock embeddings.

## Setup & Running

1. **Start FalkorDB:**
   ```bash
   docker-compose up -d
   ```

2. **Install Python dependencies:**
   ```bash
   python3 -m venv venv
   source venv/bin/activate
   pip install -r requirements.txt
   ```

3. **Set Environment Variables (Optional):**
   ```bash
   export GCP_PROJECT_ID="your-project-id"
   export GCP_LOCATION="us-central1"
   ```

4. **Start the Memory Service API:**
   ```bash
   uvicorn memory_service.app:app --host 0.0.0.0 --port 8000
   ```

5. **Run the Integration Mock:**
   In a new terminal window (with the venv activated), run the mock script to see the cross-session synchronization in action:
   ```bash
   python openclaw_plugin/memory_hook.py
   ```

## Artifacts included

- `openclaw_plugin/memory_hook.py`: The simulated hook demonstrating OpenClaw integration.
- `memory_service/`: The FastAPI standalone service handling ontology, Graph DB, and embeddings.
- Discussion Answers: See the included `walkthrough.md` for answers to the architecture and maintenance questions.
