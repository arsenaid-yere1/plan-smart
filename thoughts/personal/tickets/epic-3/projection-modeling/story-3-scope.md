🔄 Story 2.4 — Adjust Assumptions
Purpose (Plain English)
This story lets users ask:
“How sensitive is my retirement plan to the future not going exactly as expected?”
It gives users safe control knobs to explore outcomes without changing their real financial profile.
What “Assumptions” Mean (Definition)
Assumptions are model-level parameters applied on top of the user’s financial facts.
They are:
Hypothetical
Reversible
Non-destructive
Global to the projection
Examples
Expected annual return (e.g., 5% → 4%)
Inflation rate (e.g., 3% → 5%)
Retirement age (60 → 62)
Contribution growth or reduction
What This Story Covers
User Capability
View current assumptions
Modify assumptions via simple controls
Instantly see updated projections
Revert to defaults
System Capability
Re-run projection deterministically
Track assumption changes separately from core inputs
Provide deltas for AI explanation
What This Story Does NOT Cover
🚫 It does NOT:
Edit core financial data (assets, income, debts)
Save permanent profile changes (unless explicitly confirmed)
Create named scenarios (that’s Epic 3)
Run probabilistic simulations
User-Facing Behavior
UI Pattern (Recommended)
“Assumptions” panel or drawer
Slider / input controls with guardrails
“Reset to Default” button
Example:
Expected return: 5.0%
Inflation: 3.0%
Retirement age: 60
Acceptance Criteria (Detailed)
Display
Current assumptions are visible and clearly labeled
Default assumptions are visually distinct (e.g., “Recommended”)
Editing
User can adjust:
Expected annual return (range: 1%–10%)
Inflation rate (range: 1%–8%)
Retirement age (must be > current age)
Changes apply immediately (no save button required)
Recompute
Projection re-runs automatically after any change
Updated results appear within ≤2 seconds
Chart and summary update consistently
State Management
Assumptions are stored separately from:
Financial profile
Saved plan inputs
Leaving the page resets assumptions unless user explicitly saves
Engineering Model (Clean Separation)
Financial Profile  →  Assumptions  →  Projection  →  Results
      (facts)          (knobs)        (math)        (UI + AI)
This separation prevents:
Accidental overwrites
Confusion between “what I have” and “what might happen”
AI Integration (Why This Story Matters)
The AI narrative depends heavily on assumption changes.
Example:
“If returns average 4% instead of 5%, your savings may run out 6 years earlier. Delaying retirement by two years offsets most of that risk.”
That requires:
Baseline assumptions
Modified assumptions
Projection delta
Emotional Design Principle
Assumptions should feel empowering, not risky.
Good UX:
“Try a more conservative return”
“See what happens if inflation is higher”
Bad UX:
“Change your expected return (this affects your plan)”