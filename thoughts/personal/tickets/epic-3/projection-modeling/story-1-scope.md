# 🧮 EPIC 3 — Projection & Modeling Engine
# scope.md

---

## Epic Goal
Calculate and visualize a user’s retirement trajectory (accumulation + drawdown) using transparent, explainable, and deterministic assumptions that can be recomputed quickly for AI-driven “what-if” analysis.

## Non-Goals (MVP)
- Monte Carlo simulations  
- Detailed tax optimization  
- Portfolio-level asset allocation modeling  

---

# Story 3.1 — Run Core Retirement Projection

## User Story
As a user, I want the system to project my asset balance over time so I can see whether my money lasts through retirement.

## Functional Requirements
- Generate annual projections from **current age** to **maximum lifespan** (default: 90).
- Projection must include:
  - Pre-retirement accumulation phase
  - Post-retirement drawdown phase
- Use configurable assumptions:
  - Expected annual return
  - Annual inflation rate
- Projection logic must be:
  - Deterministic
  - Reproducible
  - Explainable

## Output Requirements
- Output must be an array of annual records:
  ```json
  {
    "age": number,
    "year": number,
    "balance": number,
    "inflows": number,
    "outflows": number
  }
  ```

- One record per year.

## Performance Requirements
- Projection completes in < 1 second for typical input sizes.