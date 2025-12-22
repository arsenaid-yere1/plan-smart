# Scope Document — Story 2: Visualize Assets Over Time

## Epic Goal
Calculate and visualize a user’s retirement trajectory (accumulation + drawdown) using transparent, explainable, and deterministic assumptions that can be recomputed quickly for AI-driven “what-if” analysis.

---

## User Story
As a user, I want to see a simple chart of my assets over time so I can understand trends at a glance.

---

## Goal
Provide a clear, intuitive visual representation of a user’s total asset balance over time to support quick understanding of growth, stability, or depletion throughout accumulation and retirement phases.

---

## Functional Requirements
- Render a **line chart** representing total asset balance over time.
- Chart data is derived directly from the core retirement projection output.
- X-axis supports:
  - Age (default)
  - Calendar year (optional / configurable)
- Y-axis displays:
  - Total asset balance (inflation-adjusted or nominal based on system settings)

---

## Visual Requirements
- Clearly distinguish lifecycle phases:
  - **Accumulation phase** (pre-retirement)
  - **Retirement drawdown phase** (post-retirement)
- Visual differentiation may include:
  - Color changes
  - Background shading
  - Vertical retirement marker
- Negative balances (if any) must be visually emphasized:
  - Distinct color (e.g., red)
  - Clear zero-balance baseline

---

## UX Requirements
- Chart updates automatically when:
  - User inputs change (age, savings, retirement age, etc.)
  - Assumptions change (growth rate, inflation, lifespan)
- Transitions should feel responsive and near real-time.
- Chart must be readable and usable on:
  - Desktop
  - Mobile devices
- Tooltips or hover states should:
  - Display exact values (age/year + balance)
  - Remain simple and non-cluttered

---

## Constraints / Non-Goals
- No Monte Carlo or probabilistic bands in MVP.
- No portfolio-level breakdowns (single total balance only).
- No advanced chart customization controls in initial release.

---

## Dependencies
- Requires output from **Story 1: Core Retirement Projection**.
- Depends on consistent projection schema (age/year + balance).

---

## Acceptance Criteria
- User can visually identify whether assets grow, plateau, or decline over time.
- User can clearly see when retirement begins and how drawdown progresses.
- Chart reflects updated inputs or assumptions without manual refresh.
- Chart remains legible on small screens.
