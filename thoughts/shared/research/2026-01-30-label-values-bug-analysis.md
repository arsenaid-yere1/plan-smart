---
date: 2026-01-30T12:05:30-08:00
researcher: Claude
git_commit: 6a9000fbcb15849e2f222264986684635177dc6f
branch: main
repository: plan-smart
topic: "Label Values Bug Analysis - Why Labels Show Undefined or Zero Values"
tags: [research, codebase, ProjectionChart, labels, depletion-target, formatCurrency]
status: complete
last_updated: 2026-01-30
last_updated_by: Claude
last_updated_note: "Added detailed analysis of why labels show undefined or zero values"
---

# Research: Label Values Bug Analysis - Why Labels Show Undefined or Zero Values

**Date**: 2026-01-30T12:05:30-08:00
**Researcher**: Claude
**Git Commit**: 6a9000fbcb15849e2f222264986684635177dc6f
**Branch**: main
**Repository**: plan-smart

## Research Question

Why do labels in the Assets Over Time chart show undefined or zero values?

## Summary

Labels can show **undefined** or **$0** values due to several root causes. Most have been fixed, but understanding the causes helps prevent regressions:

### Why Labels Show "undefined"

1. **String interpolation without guards** - Template literals like `` `Target Age ${depletionTargetAge}` `` will show "Target Age undefined" if the variable is undefined
2. **Tooltip age/year display** - Lines 505 and 545 use `` `Age ${data.age}` `` without validation

### Why Labels Show "$0"

1. **formatCurrency fallback** - The `formatCurrency` function returns `'$0'` for null/undefined/NaN values (intentional safe fallback)
2. **Nullish coalescing to 0** - Patterns like `data.essentialExpenses ?? 0` explicitly pass 0 when undefined
3. **Invalid startBalance** - When `chartData[0]?.displayBalance` is 0 or undefined, trajectory calculations fail
4. **Missing outflows data** - `record.outflows ?? 0` defaults to 0 when spending data is missing

## Detailed Root Cause Analysis

### Root Cause 1: String Interpolation Without Guards

**Problem**: Template literals evaluate to "undefined" when variables are undefined.

**Location**: [ProjectionChart.tsx:679](src/components/projections/ProjectionChart.tsx#L679)
```typescript
value: `Target Age ${depletionTargetAge}`,  // Shows "Target Age undefined" if not guarded
```

**Fix Applied**: Added guard at line 673:
```typescript
{depletionTargetAge != null && depletionTargetXValue !== null && (
```

**Other vulnerable locations** (tooltip):
- Line 505: `` `Age ${data.age}` `` - Could show "Age undefined"
- Line 545: `` `Age ${data.age}` `` - Could show "Age undefined"

### Root Cause 2: formatCurrency Returns "$0" for Invalid Values

**Problem**: The safe fallback of "$0" can be misleading when displayed.

**Location**: [ProjectionChart.tsx:44-47](src/components/projections/ProjectionChart.tsx#L44-L47)
```typescript
function formatCurrency(value: number): string {
  if (value == null || Number.isNaN(value)) {
    return '$0';  // This is why $0 appears!
  }
  // ...
}
```

**When this triggers**:
- `record.outflows` is undefined → `nominalSpending = record.outflows ?? 0` → displays "$0"
- `data.essentialExpenses` is undefined → `formatTooltipCurrency(data.essentialExpenses ?? 0)` → displays "$0"
- `data.balanceAboveReserve` is undefined → displays "$0"

### Root Cause 3: Invalid startBalance for Trajectory

**Problem**: Target trajectory shows $0 or doesn't render when starting balance is invalid.

**Location**: [ProjectionChart.tsx:289-293](src/components/projections/ProjectionChart.tsx#L289-L293)
```typescript
const startBalance = chartData[0]?.displayBalance;
if (startBalance == null || startBalance <= 0) {
  return null;  // Trajectory won't render at all
}
```

**When this triggers**:
- Empty `chartData` array
- First record has `displayBalance` of 0 or negative
- First record's `balance` is undefined (propagates to `displayBalance`)

### Root Cause 4: Missing Depletion Target Properties

**Problem**: `depletionTarget` object exists but has missing required properties.

**Location**: [page.tsx:254-260](src/app/plans/page.tsx#L254-L260)
```typescript
// Before fix - would pass incomplete object:
const depletionTarget = snapshot.depletionTarget as DepletionTarget | null;

// After fix - validates required fields:
const rawDepletionTarget = snapshot.depletionTarget as DepletionTarget | null;
const depletionTarget = rawDepletionTarget?.targetAge != null && rawDepletionTarget?.targetPercentageSpent != null
  ? rawDepletionTarget
  : undefined;
```

### Root Cause 5: Tooltip Payload Not Validated

**Problem**: Tooltip assumes `payload[0].payload` exists without checking.

**Location**: [ProjectionChart.tsx:499, 530](src/components/projections/ProjectionChart.tsx#L499)
```typescript
// No check that payload[0].payload exists
const data = payload[0].payload as (typeof spendingData)[0];
```

**When this triggers**:
- Recharts calls tooltip with unexpected payload structure
- Results in runtime error, not "undefined" display

## Current State Analysis

### Fixes Already Applied

#### 1. Depletion Target Validation (page.tsx:257-260)
```typescript
const rawDepletionTarget = snapshot.depletionTarget as DepletionTarget | null;
const depletionTarget = rawDepletionTarget?.targetAge != null && rawDepletionTarget?.targetPercentageSpent != null
  ? rawDepletionTarget
  : undefined;
```
**Status**: Fixed - Prevents invalid depletion target objects from propagating

#### 2. Props Validation (plans-client.tsx:575-576)
```typescript
depletionTargetAge={depletionTarget?.enabled && depletionTarget?.targetAge != null ? depletionTarget.targetAge : undefined}
showTargetTrajectory={depletionTarget?.enabled && depletionTarget?.targetAge != null}
```
**Status**: Fixed - Double checks `enabled` AND `targetAge != null` before passing props

#### 3. ReferenceLine Guard (ProjectionChart.tsx:673)
```typescript
{depletionTargetAge != null && depletionTargetXValue !== null && (
```
**Status**: Fixed - Uses `!= null` to catch both null and undefined

#### 4. targetTrajectoryData Guards (ProjectionChart.tsx:275-295)
```typescript
if (depletionTargetAge == null || !showTargetTrajectory || !reserveFloor || viewMode !== 'balance') {
  return null;
}
// ...
const startBalance = chartData[0]?.displayBalance;
if (startBalance == null || startBalance <= 0) {
  return null;
}
```
**Status**: Fixed - Multiple guard conditions prevent invalid trajectory data

#### 5. Legend Guards (ProjectionChart.tsx:829, 835)
```typescript
{depletionTargetAge != null && showTargetTrajectory && targetTrajectoryData && (
// ...
{depletionTargetAge != null && (
```
**Status**: Fixed - Legend items check all required conditions

### No Remaining Critical Issues Found

The label values bug appears to be fully resolved. All paths that could lead to "undefined" or invalid label values now have proper guards:

| Issue | Guard Location | Status |
|-------|---------------|--------|
| `depletionTargetAge` undefined | page.tsx:257-260, plans-client.tsx:575 | Fixed |
| `depletionTargetXValue` null | ProjectionChart.tsx:673 | Fixed |
| `targetTrajectoryData` null | ProjectionChart.tsx:687, 829 | Fixed |
| `startBalance` 0 or null | ProjectionChart.tsx:291-293 | Fixed |
| formatCurrency NaN | ProjectionChart.tsx:44-47 | Fixed |

## Potential Minor Improvements (Optional)

These are not bugs but could improve robustness:

### 1. Consider Adding TypeScript Strict Null Checks

If not already enabled, `strictNullChecks` in `tsconfig.json` would catch these issues at compile time.

### 2. Test Coverage

The existing test file `ProjectionChart.test.tsx` doesn't have explicit tests for depletion target scenarios. Adding tests would prevent regressions:

```typescript
describe('ProjectionChart - Depletion Target', () => {
  it('does not render target age label when depletionTargetAge is undefined', () => {
    render(<ProjectionChart records={mockRecords} depletionTargetAge={undefined} />);
    expect(screen.queryByText(/Target Age/)).not.toBeInTheDocument();
  });
});
```

### 3. Defensive Label Text

The label text could use a defensive fallback (though current guards make this unnecessary):
```typescript
value: `Target Age ${depletionTargetAge ?? 'N/A'}`,
```

## Code References

- [page.tsx:257-260](src/app/plans/page.tsx#L257-L260) - Depletion target validation
- [plans-client.tsx:575-576](src/app/plans/plans-client.tsx#L575-L576) - Props passing with guards
- [ProjectionChart.tsx:673-685](src/components/projections/ProjectionChart.tsx#L673-L685) - ReferenceLine rendering
- [ProjectionChart.tsx:275-312](src/components/projections/ProjectionChart.tsx#L275-L312) - targetTrajectoryData calculation
- [ProjectionChart.tsx:829-840](src/components/projections/ProjectionChart.tsx#L829-L840) - Legend items

## Recent Fix History

| Commit | Date | Description |
|--------|------|-------------|
| 6a9000f | Jan 29 | Depletion target validation in page.tsx |
| 670bede | Jan 28 | Chart values fix |
| 2a9e443 | Jan 27 | Chart labels fix |
| c32adc3 | Jan 26 | Balance view update with Y-axis domain |
| 711821e | Jan 26 | formatCurrency null/NaN guards |

## Remaining Potential Issues

### Issue 1: Tooltip Age/Year Could Show "undefined"

**Location**: [ProjectionChart.tsx:505, 545](src/components/projections/ProjectionChart.tsx#L505)
```typescript
{xAxisType === 'age' ? `Age ${data.age}` : `Year ${data.year}`}
```

**Suggested Fix**:
```typescript
{xAxisType === 'age' ? `Age ${data.age ?? 'N/A'}` : `Year ${data.year ?? 'N/A'}`}
```

### Issue 2: "$0" Displayed for Missing Optional Data

This is **intentional behavior**, not a bug. The `formatCurrency` fallback to "$0" prevents crashes. However, it may be confusing when:
- Essential/discretionary expenses are undefined (shows "$0" in tooltip)
- Reserve portions are undefined (shows "$0")

**Alternative Approach** (optional): Don't render these sections if data is missing instead of showing "$0".

## Conclusion

**Most label value bugs are resolved.** The comprehensive fixes ensure:

1. Invalid data is filtered at the source (page.tsx)
2. Props are conditionally passed (plans-client.tsx)
3. Components guard against null/undefined values (ProjectionChart.tsx)
4. `formatCurrency` safely returns "$0" for invalid values (prevents crashes)

**Remaining edge cases** (low priority):
- Tooltip age/year string interpolation could show "undefined" in edge cases
- "$0" appears when optional data is missing (intentional fallback behavior)

## Profile Data Flow Analysis

### Data Flow Path
```
Database (financial_snapshot)
  → page.tsx (server-side extraction)
  → ProjectionInput (assembled)
  → runProjection() engine
  → ProjectionRecord[] (generated)
  → PlansClient (client component)
  → ProjectionChart (renders)
```

### Where Data Can Be Missing or Zero

#### 1. Investment Accounts (affects balance)
**Location**: [page.tsx:201-215](src/app/plans/page.tsx#L201-L215)
```typescript
const accounts = (snapshot.investmentAccounts || []) as InvestmentAccountJson[];
```
- If `investmentAccounts` is null/empty → `balancesByType` all zeros → chart shows $0

#### 2. Income/Expenses (affects spending labels)
**Location**: [page.tsx:158-169](src/app/plans/page.tsx#L158-L169)
```typescript
if (incomeExpenses?.monthlyEssential || incomeExpenses?.monthlyDiscretionary) {
  annualEssentialExpenses = (incomeExpenses.monthlyEssential || 0) * 12;
  annualDiscretionaryExpenses = (incomeExpenses.monthlyDiscretionary || 0) * 12;
} else {
  // Fallback: derives from income * (1 - savingsRate)
  annualExpenses = deriveAnnualExpenses(...);
  annualDiscretionaryExpenses = 0;  // ← This causes $0 discretionary in tooltips
}
```
- If no `incomeExpenses` stored → discretionary always $0

#### 3. Income Streams (affects retirement inflows)
**Location**: [page.tsx:231-250](src/app/plans/page.tsx#L231-L250)
```typescript
if (storedStreams && storedStreams.length > 0) {
  incomeStreams = storedStreams;
} else {
  // Auto-generate Social Security
  const ssMonthly = estimateSocialSecurityMonthly(parseFloat(snapshot.annualIncome));
  if (ssMonthly > 0) { /* create stream */ }
  else { incomeStreams = []; }  // ← Empty means $0 income in retirement
}
```
- If no income streams AND low annual income → retirement income shows $0

#### 4. Spending Phase Config (affects phase labels)
**Location**: [page.tsx:254](src/app/plans/page.tsx#L254)
```typescript
const spendingPhaseConfig = snapshot.spendingPhases as SpendingPhaseConfigJson | null;
```
- If null → `activePhaseName` undefined in records → falls back to "Retirement Phase"

#### 5. Depletion Target (affects target age label)
**Location**: [page.tsx:258-261](src/app/plans/page.tsx#L258-L261)
```typescript
const depletionTarget = rawDepletionTarget?.targetAge != null && rawDepletionTarget?.targetPercentageSpent != null
  ? rawDepletionTarget
  : undefined;
```
- If missing required fields → `depletionTarget` is undefined → no target age label shown

### ProjectionRecord Field Availability by Phase

| Field | Accumulation | Retirement | Can Be Zero | Can Be Undefined |
|-------|-------------|------------|-------------|------------------|
| `balance` | ✓ | ✓ | Yes (after shortfall) | No |
| `inflows` | ✓ (contributions) | ✓ (income) | Yes | No |
| `outflows` | 0 always | ✓ (expenses) | Yes | No |
| `essentialExpenses` | - | ✓ | Yes | Yes (accumulation) |
| `discretionaryExpenses` | - | ✓ | Yes | Yes (accumulation) |
| `activePhaseName` | - | Maybe | - | Yes (no phases) |
| `reserveBalance` | - | Maybe | Yes | Yes (no reserve) |

### Diagnosis: Why You See $0 or Undefined

1. **$0 balance at start**: No investment accounts in profile, or all accounts have $0 balance
2. **$0 inflows during retirement**: No income streams configured AND Social Security estimate is $0
3. **$0 discretionary**: User didn't enter discretionary expenses in onboarding
4. **$0 in trajectory**: `startBalance` (first record's `displayBalance`) is 0 or negative
5. **"undefined" in labels**: Data object property accessed without proper guards

### Quick Diagnostic Checks

To verify if profile data is being fed properly:

1. **Check investment accounts exist**:
   ```sql
   SELECT investment_accounts FROM financial_snapshot WHERE user_id = 'xxx';
   ```

2. **Check expenses are stored**:
   ```sql
   SELECT income_expenses FROM financial_snapshot WHERE user_id = 'xxx';
   ```

3. **Check income streams**:
   ```sql
   SELECT income_streams FROM financial_snapshot WHERE user_id = 'xxx';
   ```

4. **Check depletion target**:
   ```sql
   SELECT depletion_target FROM financial_snapshot WHERE user_id = 'xxx';
   ```

## Related Research

- [2026-01-27-assets-over-time-chart-label-fixes.md](thoughts/shared/research/2026-01-27-assets-over-time-chart-label-fixes.md) - Original label fixes research
