# Story 10.1 – Target Depletion Input

## User Story

> As a user,
> I want to specify what percentage of my portfolio I'm comfortable spending by a certain age (e.g. 75% by age 80),
> so I can plan to intentionally use my money rather than just preserve it.

## Acceptance Criteria

- [ ] User can input a target depletion percentage (0-100%)
- [ ] User can specify the target age for reaching that depletion level
- [ ] Input validation ensures:
  - Target age is greater than current age
  - Target age is less than or equal to life expectancy setting
  - Depletion percentage is within valid range
- [ ] Default suggestion provided (e.g., 50% by age 85) with explanation
- [ ] Clear labeling that distinguishes "depletion target" from "failure scenario"
- [ ] Depletion target persists in user's plan settings
- [ ] Changes trigger projection recalculation

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

Traditional retirement planning focuses on "not running out of money" — creating anxiety around spending. PlanSmart flips this by asking: "How much do you WANT to spend?" This reframes the conversation from fear-based preservation to intentional enjoyment.

---

## Technical Implementation Notes

### Data Model Changes

```typescript
// New interface for depletion targets
export interface DepletionTarget {
  enabled: boolean;
  targetPercentageSpent: number;  // 0-100, e.g., 75 means spend 75% by target age
  targetAge: number;              // Age by which to reach depletion target
  createdAt: Date;
  updatedAt: Date;
}

// Update to projection settings or household
export interface ProjectionSettings {
  // ... existing fields
  depletionTarget?: DepletionTarget;
}
```

### UI Components

```typescript
// Depletion target input component
interface DepletionTargetInputProps {
  currentAge: number;
  lifeExpectancy: number;
  portfolioValue: number;
  onTargetChange: (target: DepletionTarget) => void;
}
```

### Validation Rules

```typescript
const validateDepletionTarget = (
  target: DepletionTarget,
  currentAge: number,
  lifeExpectancy: number
): ValidationResult => {
  const errors: string[] = [];

  if (target.targetPercentageSpent < 0 || target.targetPercentageSpent > 100) {
    errors.push('Depletion percentage must be between 0% and 100%');
  }

  if (target.targetAge <= currentAge) {
    errors.push('Target age must be greater than your current age');
  }

  if (target.targetAge > lifeExpectancy) {
    errors.push('Target age cannot exceed life expectancy setting');
  }

  return { valid: errors.length === 0, errors };
};
```

---

## Out of Scope (for this story)

| Excluded | Notes |
|----------|-------|
| Reserve preservation logic | Story 10.2 |
| Spending translation feedback | Story 10.3 |
| Multiple depletion milestones | Future enhancement |
| Depletion visualization on chart | Story 10.3 |
