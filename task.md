# Multi-turn Agent Wizard Tasks

## Backend
- [x] Create POST `/agents/wizard/refine` endpoint
- [x] Implement Gemini prompt for generating skeleton, ontology, and follow-up questions
- [x] Add Pydantic model for AgentWizardPayload

## Frontend
- [x] Update `AgentBuilder.jsx` to manage `wizardDomain`, `wizardComplexity`, and `wizardAnswers` state
- [x] Refactor onboarding UI to a multi-step experience (Initial phase -> Refinement phase)
- [x] Wire up the `handleWizardRefine` loop to update configuration and ontology dynamically

- [ ] Verification
  - [ ] Verify endpoint response
  - [ ] Verify UI flow
