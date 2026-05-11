# Agent Wizard Multi-Turn Refactor

This plan addresses the requirement to vastly improve the "New Agent Wizard" into a multi-turn experience where Gemini generates intelligent forms with follow-up questions and ontology suggestions for manual refinement.

## Proposed Changes

### 1. Backend (`memory_service/app.py`)
- **[NEW] Endpoint:** `POST /agents/wizard/refine`
  - Accepts a payload containing `goal`, `domain`, `complexity`, `answers` (to follow-up questions), and `current_ontology`.
  - Prompts Gemini to return a structured JSON containing:
    - `agent_id`, `name`, `instruction` (the agent skeleton)
    - `ontology` (suggested schema)
    - `follow_up_questions`: An array of question objects (e.g., `{ "id": "q1", "question": "...", "type": "text|boolean" }`)
  - If `answers` are provided, Gemini incorporates them to refine the ontology and instructions, potentially generating new or fewer follow-up questions.

### 2. Frontend (`ui/src/components/AgentBuilder.jsx`)
- **[MODIFY] AgentBuilder.jsx**
  - **State Updates:**
    - Introduce `wizardState` to track if we are in "initial" or "refinement" step.
    - Add fields: `wizardDomain`, `wizardComplexity`, `wizardAnswers`, `wizardQuestionsList`.
  - **Step 1 (Initial):**
    - Show inputs for "Primary Goal", "Domain" (dropdown), and "Complexity" (dropdown).
    - Button: "Draft Agent" (calls `/agents/wizard/refine`).
  - **Step 2 (Refinement - "Intelligent Form"):**
    - Render the suggested `agent_id`, `name`, and `instruction`.
    - Render the `ontology` as a text area for manual edits (or a simplified view).
    - Dynamically render the `follow_up_questions` as form inputs (text boxes, checkboxes based on type).
    - Button: "Refine Suggestions" (calls `/agents/wizard/refine` again with the answers and edited ontology).
    - Button: "Accept & Finalize" (moves to the Manual Builder `config` tab).

## User Review Required
Please review the proposed flow. Does the two-step (Initial -> Refinement Loop) with dynamic form generation from Gemini meet your expectations for the multi-turn experience?
