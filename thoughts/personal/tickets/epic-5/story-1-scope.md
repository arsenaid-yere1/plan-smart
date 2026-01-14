# EPIC 5 — Conversational "What-If" Engine (Safe by Design)

## Goal
Allow natural-language scenarios without corrupting base plans or producing hidden logic jumps.

## Story 5.1: Natural-Language Scenario Parsing with Confirmation

**As a user**, I want to ask "what if" questions in plain English.

### Built-in Guardrails
- AI parses intent → system confirms parameters
- No projection runs without user confirmation

### Acceptance
- Example:
  - AI: "I'll model retiring at 65 instead of 60 — OK?"
  - User must approve
- Parsed scenario stored as structured diff