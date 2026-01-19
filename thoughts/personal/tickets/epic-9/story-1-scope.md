# Story 9.1 – Life Phase Definition

## User Story

> As a user,
> I want to define retirement spending phases (e.g. Go-Go, Slow-Go, No-Go),
> so I can model realistic spending patterns that match how retirees actually live.

> As a user,
> I want different spending levels per phase,
> so my projections reflect that early retirement is typically more active and expensive.

## Acceptance Criteria

- [ ] User can define 1-4 spending phases with:
  - Phase name (e.g., "Go-Go Years", "Slow-Go", "No-Go")
  - Start age for each phase
  - Spending multiplier or absolute amount relative to base spending
- [ ] Default phases pre-populated:
  - Go-Go (retirement start to ~75): 100-110% of base spending
  - Slow-Go (75-85): 80-90% of base spending
  - No-Go (85+): 60-70% of base spending
- [ ] Phase boundaries are editable with validation (no gaps, no overlaps)
- [ ] Spending levels per phase clearly displayed in UI
- [ ] Changes reflect immediately in projection engine

---

## Epic Context

**Epic 9: Life-Phase–Based Spending Planning**

### Epic Goal

Replace flat withdrawal assumptions with intentional, age-based spending behavior. Real retirement spending is not a straight line — it follows a "spending smile" pattern where early years are active and expensive, middle years moderate, and late years focused on care.

### Epic Success Criteria

- Spending curves are non-flat by default
- Users can edit phase boundaries and spending intensity
- Projections reflect phase-based spending
- Users can intentionally front-load spending without generic rule penalties

### Differentiator

> ProjectionLab optimizes for smoothness.
> **PlanSmart optimizes for life reality.**

Most retirement tools assume constant inflation-adjusted spending (the 4% rule mindset). PlanSmart recognizes that:
1. Healthy retirees want to travel, pursue hobbies, and enjoy life
2. Spending naturally decreases as mobility and interests change
3. Generic flat assumptions punish intentional front-loading

---

## Technical Implementation Notes

### Data Model Changes

```typescript
// New interface for spending phases
export interface SpendingPhase {
  id: string;
  name: string;
  startAge: number;
  endAge?: number;  // Optional, inferred from next phase or life expectancy
  spendingMultiplier: number;  // 1.0 = 100% of base spending
  // OR
  absoluteAmount?: number;  // Override with specific amount
}

// Update to household or projection settings
export interface SpendingPhaseConfig {
  enabled: boolean;
  phases: SpendingPhase[];
  baseAnnualSpending: number;  // Reference point for multipliers
}
```

### Default Phase Configuration

```typescript
const DEFAULT_SPENDING_PHASES: SpendingPhase[] = [
  { id: 'go-go', name: 'Go-Go Years', startAge: 65, spendingMultiplier: 1.05 },
  { id: 'slow-go', name: 'Slow-Go', startAge: 75, spendingMultiplier: 0.85 },
  { id: 'no-go', name: 'No-Go', startAge: 85, spendingMultiplier: 0.65 },
];
```

---

## Out of Scope (for this story)

| Excluded | Notes |
|----------|-------|
| Visual timeline display | Story 9.3 |
| Healthcare cost modeling | Separate epic |
| Phase-specific expense categories | Future enhancement |
