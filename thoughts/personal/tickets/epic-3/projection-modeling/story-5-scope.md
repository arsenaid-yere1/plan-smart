# Story 3.5 — Persist Projection Results

As a system, I want to store projection outputs so they can be reused by AI summaries and reloaded later.

## Acceptance Criteria

- Projection output is stored as structured JSON linked to a plan ID.
- Stored data includes:
  - Inputs
  - Assumptions
  - Annual projection results
- Stored projection can be:
  - Re-rendered without recalculation
  - Used as input for AI narrative generation
- Projection records are scoped to the authenticated user.