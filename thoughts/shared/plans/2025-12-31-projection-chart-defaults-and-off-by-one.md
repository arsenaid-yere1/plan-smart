---
date: 2025-12-31
ticket: none
description: Fix projection chart default toggle and off-by-one retirement balance
status: complete
---

# Implementation Plan: Projection Chart Defaults & Off-by-One Fix

## Overview

Two fixes for the projections feature:
1. Change default inflation toggle from "Future $" to "Today's $"
2. Fix off-by-one error where "At Retirement" balance shows value from one year before retirement

## Current State Analysis

### Issue 1: Default Toggle
- File: `src/components/projections/ProjectionChart.tsx:53`
- Current: `const [adjustForInflation, setAdjustForInflation] = useState(false);`
- This defaults to "Future $" (nominal dollars)

### Issue 2: Off-by-One
- File: `src/lib/projections/engine.ts:161-163`
- Current code captures balance at `retirementAge - 1`:
```typescript
if (age === input.retirementAge - 1) {
  projectedRetirementBalance = totalBalance(balances);
}
```
- The card shows "At Retirement (Age 65)" but displays the balance at end of age 64
- Users expect the balance AT age 65 (before any retirement withdrawals)

## Desired End State

1. Chart defaults to "Today's $" view (inflation-adjusted)
2. "At Retirement" card shows balance at the start of retirement age (before first withdrawal)

## What We're NOT Doing

- Not changing how the inflation toggle works
- Not changing the underlying projection engine model
- Not modifying how the chart displays data

## Implementation Approach

The fix for the off-by-one is straightforward: capture the balance at retirement age, at the START of that year (before drawdown happens). Since the loop processes retirement age in the `isRetired` branch, we need to capture it at the beginning of that iteration before any withdrawals.

## Phase 1: Fix Both Issues

### Changes Required:

#### 1. Change Default Toggle
**File**: `src/components/projections/ProjectionChart.tsx`

Line 53:
```typescript
// Before
const [adjustForInflation, setAdjustForInflation] = useState(false);

// After
const [adjustForInflation, setAdjustForInflation] = useState(true);
```

#### 2. Fix Off-by-One in Engine
**File**: `src/lib/projections/engine.ts`

The current logic at lines 161-163 captures balance at `retirementAge - 1`:
```typescript
if (age === input.retirementAge - 1) {
  projectedRetirementBalance = totalBalance(balances);
}
```

Change to capture at retirement age, BEFORE any withdrawals:
```typescript
// Remove the old code at lines 161-163

// Add at the START of the drawdown phase (after line 164, before any withdrawals):
// Capture retirement balance at start of retirement (before first withdrawal)
if (age === input.retirementAge) {
  projectedRetirementBalance = totalBalance(balances);
}
```

### Success Criteria:

#### Automated Verification:
- [x] All unit tests pass: `npm test -- --run` (projection engine tests pass; 2 pre-existing test failures for Export CSV feature that doesn't exist)
- [x] Type checking passes: `npm run typecheck`
- [x] Build succeeds: `npm run build`

#### Manual Verification:
- [ ] Chart defaults to "Today's $" active on page load
- [ ] "At Retirement" card shows correct balance for retirement age

---

## Phase 2: Update Tests (if needed)

If any tests fail due to the default toggle change, update them to match new expected behavior.

### Success Criteria:

#### Automated Verification:
- [x] All tests pass: `npm test -- --run` (projection-related tests pass; pre-existing email/Export CSV failures unrelated)

---

## Testing Strategy

### Unit Tests:
- Verify `adjustForInflation` defaults to `true`
- Verify `projectedRetirementBalance` equals balance at retirement age

### Manual Testing:
1. Load dashboard or plans page
2. Verify "Today's $" button is active by default
3. Verify "At Retirement" card value matches the chart value at retirement age

## References

- Research: `thoughts/shared/research/2025-12-31-future-vs-today-projection-chart.md`
- ProjectionChart component: `src/components/projections/ProjectionChart.tsx`
- Projection engine: `src/lib/projections/engine.ts`
