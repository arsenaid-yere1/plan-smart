# Story 10.2 – Reserve Preservation

## User Story

> As a user,
> I want to preserve a portion of my portfolio for longevity, flexibility, or peace of mind,
> so I can balance intentional spending with a safety buffer.

> As a user,
> I want to specify a minimum reserve amount or percentage,
> so I know there's a floor that my projections won't plan below.

## Acceptance Criteria

- [ ] User can specify a reserve amount as:
  - Absolute dollar amount (e.g., $100,000)
  - OR percentage of initial portfolio (e.g., 25%)
- [ ] Reserve purpose can be tagged (optional):
  - Longevity buffer (living past life expectancy)
  - Emergency fund
  - Legacy/inheritance
  - Healthcare contingency
  - General peace of mind
- [ ] Reserve amount clearly displayed at target depletion age
- [ ] Projection engine respects reserve floor in calculations
- [ ] Warning shown if current spending trajectory would breach reserve before target age
- [ ] Reserve and depletion target are mathematically consistent:
  - If depletion target is 75%, implied reserve is 25%
  - System prevents conflicting inputs

---

## Epic Context

**Epic 10: Intentional Portfolio Depletion Controls**

### Epic Goal

Let users plan to use their money — not just preserve it. Most financial planning tools treat portfolio depletion as failure. PlanSmart recognizes that money is meant to be spent, and helps users plan intentional drawdown strategies.

### Epic Success Criteria

- Depletion targets are explicit inputs (not inferred)
- Remaining reserves are clearly shown at target age
- Warnings only trigger if reserves drop below safety thresholds
- Users feel empowered to spend, not scared into hoarding

### Differentiator

> Most planners avoid depletion.
> **PlanSmart designs for it.**

---

## Technical Implementation Notes

### Data Model Changes

```typescript
// Reserve configuration
export interface ReserveConfig {
  enabled: boolean;
  type: 'absolute' | 'percentage';
  amount: number;           // Dollar amount if absolute, percentage if percentage
  purpose?: ReservePurpose[];
  notes?: string;
}

export type ReservePurpose =
  | 'longevity'
  | 'emergency'
  | 'legacy'
  | 'healthcare'
  | 'peace_of_mind';

// Integration with depletion target
export interface DepletionSettings {
  depletionTarget: DepletionTarget;
  reserve: ReserveConfig;
}
```

### Consistency Validation

```typescript
const validateDepletionConsistency = (
  depletionTarget: DepletionTarget,
  reserve: ReserveConfig,
  initialPortfolio: number
): ValidationResult => {
  const errors: string[] = [];

  const impliedReservePercent = 100 - depletionTarget.targetPercentageSpent;
  const reservePercent = reserve.type === 'percentage'
    ? reserve.amount
    : (reserve.amount / initialPortfolio) * 100;

  // Allow small tolerance for rounding
  if (Math.abs(impliedReservePercent - reservePercent) > 1) {
    errors.push(
      `Depletion target of ${depletionTarget.targetPercentageSpent}% implies ` +
      `${impliedReservePercent}% reserve, but reserve is set to ${reservePercent.toFixed(1)}%`
    );
  }

  return { valid: errors.length === 0, errors };
};
```

### UI Considerations

- Show reserve as the "flip side" of depletion target
- When user adjusts depletion %, auto-update reserve % (and vice versa)
- Allow override for specific dollar amount reserve
- Visual indicator showing reserve floor on projection chart

---

## Out of Scope (for this story)

| Excluded | Notes |
|----------|-------|
| Depletion target input | Story 10.1 |
| Monthly spending translation | Story 10.3 |
| Dynamic reserve adjustment based on market conditions | Future enhancement |
| Multiple reserve buckets with different purposes | Future enhancement |
