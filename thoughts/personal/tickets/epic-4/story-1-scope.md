# EPIC A — AI Retirement Storytelling (Guarded)

## Goal
Generate a clear, empathetic retirement narrative that is explainable, reproducible, and legally safe.

## A1. AI Plan Summary with Embedded Assumptions & Disclaimer

As a user, I want a plain-English explanation of my retirement outlook so I understand where I stand.

### Built-in Guardrails

AI must:
- Reference explicit assumptions (growth %, inflation %, lifespan)
- Include planning-only disclaimer language
- Use deterministic projection inputs (no recomputation)

### Acceptance Criteria

- Input to AI = frozen projection JSON (versioned)
- Output sections:
  - Where you stand
  - What assumptions this depends on
  - What this means for your lifestyle
  - Planning disclaimer
- Reading level ≤ 9th grade
- Identical input → identical output (cached)