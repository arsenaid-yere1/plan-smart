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

## A2. Outcome-Aware Tone (No Fear Language)

As a user, I want the explanation tone to match my situation without sounding alarmist.

### Built-in Guardrails

- Tone selection based on numeric thresholds (not LLM intuition)
- Explicit banned phrases list ("you will fail", "you must")

### Acceptance Criteria

- System passes tone flag: optimistic | neutral | cautious
- AI never uses imperative language
- If shortfall exists → framed as "adjustable gap"

## A3. "What This Means for Your Life" (Non-Advisory)

As a user, I want to understand lifestyle implications without being told what to do.

### Built-in Guardrails

- No prescriptive verbs ("should", "need to")
- Lifestyle descriptions derived from spending bands

### Acceptance Criteria

- AI maps spending → lifestyle labels (simple / moderate / flexible)
- Output framed as options, not recommendations

## A4. One-Page Narrative View (Versioned)

As a user, I want a single, shareable retirement story view.

### Built-in Guardrails

- Narrative tied to immutable plan version
- Regenerates only when inputs change

### Acceptance Criteria

- Includes plan version timestamp
- Export references assumptions + disclaimer
- No live recalculation in view layer

