# Target Trajectory Tooltip Bug Fix Implementation Plan

## Overview

Fix the tooltip bug where hovering over the Target Trajectory dashed line shows "Age: undefined" and "$0" instead of meaningful values. The bug occurs because the trajectory data only contains `xValue` and `targetBalance` fields, but the tooltip expects `age`, `year`, and `displayBalance` fields.

## Current State Analysis

The Target Trajectory line uses a separate data array (`targetTrajectoryData`) that only contains two fields:
- `xValue` (number) - the x-axis coordinate
- `targetBalance` (number) - the interpolated target balance

When Recharts triggers a tooltip for this line, it passes this minimal data point to the tooltip content component. The tooltip then tries to access:
- `data.age` → `undefined` → displays "Age undefined"
- `data.year` → `undefined` → displays "Year undefined"
- `data.displayBalance` → `undefined` → formatted as `$0`

### Key Files:
- [ProjectionChart.tsx:304-315](src/components/projections/ProjectionChart.tsx#L304-L315) - `targetTrajectoryData` generation
- [ProjectionChart.tsx:512-614](src/components/projections/ProjectionChart.tsx#L512-L614) - Tooltip content component
- [ProjectionChart.tsx:564](src/components/projections/ProjectionChart.tsx#L564) - Age/Year display (shows "undefined")
- [ProjectionChart.tsx:570](src/components/projections/ProjectionChart.tsx#L570) - Balance display (shows "$0")

## Desired End State

When hovering over the Target Trajectory line, the tooltip should display meaningful information:
- The age/year at that point on the trajectory
- A label indicating this is the "Target Balance" (not the actual balance)
- The target balance value properly formatted

This provides users with useful context about where they are on the trajectory toward their reserve floor target.

## What We're NOT Doing

- Not changing the visual appearance of the trajectory line
- Not adding additional data series or overlays
- Not modifying how the main chart data tooltip works
- Not refactoring the entire tooltip component structure

## Implementation Approach

We'll use **Option 1 from the research**: Include missing fields in the trajectory data generation. This is the cleanest approach because:
1. It provides useful information when hovering the trajectory line
2. It's consistent with how other data points work in the chart
3. It requires minimal changes to the existing tooltip logic

Additionally, we'll add a type guard in the tooltip to detect trajectory data points and show them with a distinct "Target Balance" label instead of just "Today's $" or "Future $".

## Phase 1: Extend Trajectory Data Fields

### Overview
Update the `targetTrajectoryData` generation to include all fields needed by the tooltip.

### Changes Required:

#### 1. Update trajectory data mapping
**File**: `src/components/projections/ProjectionChart.tsx`
**Location**: Lines 304-315

**Current Code**:
```typescript
return chartData
  .filter(r => r.age >= currentAge && r.age <= depletionTargetAge)
  .map(r => {
    const progress = (r.age - currentAge) / yearsToTarget;
    // Linear interpolation for simple visualization
    const targetBalance = startBalance - (startBalance - endBalance) * progress;

    return {
      xValue: r.xValue,
      targetBalance,
    };
  });
```

**Updated Code**:
```typescript
return chartData
  .filter(r => r.age >= currentAge && r.age <= depletionTargetAge)
  .map(r => {
    const progress = (r.age - currentAge) / yearsToTarget;
    // Linear interpolation for simple visualization
    const targetBalance = startBalance - (startBalance - endBalance) * progress;

    return {
      xValue: r.xValue,
      targetBalance,
      // Include fields needed by tooltip
      age: r.age,
      year: r.year,
      isTargetTrajectory: true, // Flag to identify trajectory points in tooltip
    };
  });
```

### Success Criteria:

#### Automated Verification:
- [x] TypeScript compilation passes: `npm run typecheck`
- [x] Linting passes: `npm run lint`
- [x] Tests pass: `npm run test`

#### Manual Verification:
- [ ] Trajectory data now includes age, year, and isTargetTrajectory fields (verify via console.log or React DevTools)

---

## Phase 2: Update Tooltip to Handle Trajectory Points

### Overview
Add logic in the tooltip content component to detect trajectory data points and display them with appropriate labeling.

### Changes Required:

#### 1. Add trajectory detection and display
**File**: `src/components/projections/ProjectionChart.tsx`
**Location**: Lines 548-612 (balance view tooltip section)

**Insert after line 560** (after `const hasReserve = ...`):
```typescript
// Check if this is a target trajectory point
const isTargetTrajectory = 'isTargetTrajectory' in data && data.isTargetTrajectory === true;
const trajectoryData = data as typeof data & { targetBalance?: number };
```

**Replace lines 561-612** (the entire return statement for balance view) with:
```typescript
// Handle target trajectory tooltip differently
if (isTargetTrajectory && trajectoryData.targetBalance !== undefined) {
  return (
    <div className="rounded-lg border border-border bg-card p-3 shadow-md">
      <p className="text-sm font-medium text-foreground">
        {xAxisType === 'age' ? `Age ${data.age}` : `Year ${data.year}`}
      </p>
      <p className="text-sm font-medium text-muted-foreground">
        Target Balance: {formatTooltipCurrency(trajectoryData.targetBalance)}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        Goal trajectory to reserve floor
      </p>
    </div>
  );
}

return (
  <div className="rounded-lg border border-border bg-card p-3 shadow-md">
    <p className="text-sm font-medium text-foreground">
      {xAxisType === 'age' ? `Age ${data.age}` : `Year ${data.year}`}
    </p>
    <p
      className={`text-sm font-medium ${isNegative ? 'text-destructive' : 'text-foreground'}`}
    >
      {adjustForInflation ? "Today's $: " : 'Future $: '}
      {formatTooltipCurrency(data.displayBalance)}
    </p>
    <p className="text-xs text-muted-foreground">
      {adjustForInflation
        ? `(${formatTooltipCurrency(data.nominalBalance)} in future dollars)`
        : `(${formatTooltipCurrency(data.realBalance)} in today's dollars)`}
    </p>
    {/* Epic 10.2: Reserve breakdown */}
    {hasReserve && data.displayBalance > 0 && (
      <>
        <p className="text-sm text-green-600 dark:text-green-400">
          Available: {formatTooltipCurrency(data.balanceAboveReserve ?? 0)}
        </p>
        <p className="text-sm text-amber-600 dark:text-amber-400">
          Reserve: {formatTooltipCurrency(data.reservePortion ?? 0)}
        </p>
        {data.reserveConstrained && (
          <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
            Spending reduced to protect reserve
          </p>
        )}
      </>
    )}
    {isNegative && (
      <p className="text-xs font-medium text-destructive">
        ⚠ Funds depleted
      </p>
    )}
    {data.inflows > 0 && (
      <p className="text-xs text-muted-foreground">
        Income: {formatTooltipCurrency(data.inflows)}
      </p>
    )}
    {data.outflows > 0 && (
      <p className="text-xs text-muted-foreground">
        Expenses: {formatTooltipCurrency(data.outflows)}
      </p>
    )}
    <p className="mt-1 text-xs text-muted-foreground">
      {data.activePhaseName || (data.isRetirement ? 'Retirement Phase' : 'Accumulation Phase')}
    </p>
  </div>
);
```

### Success Criteria:

#### Automated Verification:
- [x] TypeScript compilation passes: `npm run typecheck`
- [x] Linting passes: `npm run lint`
- [x] Tests pass: `npm run test`
- [x] Build succeeds: `npm run build`

#### Manual Verification:
- [x] Hovering over main chart area shows normal tooltip with "Today's $" or "Future $" label
- [x] Tooltip includes "Target: $X" when hovering in trajectory range
- [x] No "undefined" or "$0" values appear in any tooltip
- [x] Reserve breakdown still works correctly on main chart hover

**Note**: Implementation deviated slightly from plan - instead of showing a separate tooltip when hovering on the trajectory line, we show "Target: $X" as an additional line in the main tooltip. This is cleaner UX since the trajectory line overlaps the main chart area.

---

## Testing Strategy

### Unit Tests:
- No new unit tests needed - this is a display-only change

### Integration Tests:
- Existing chart tests should continue to pass

### Manual Testing Steps:
1. Navigate to a plan with:
   - Depletion target age configured
   - Reserve floor configured
   - Show Target Trajectory toggle enabled
2. Switch to "Assets Over Time" tab in Balance view
3. Hover over different parts of the chart:
   - Main green/amber area → Should show normal balance tooltip
   - Dashed trajectory line → Should show "Target Balance" tooltip
4. Verify both age and year x-axis modes work correctly
5. Verify inflation-adjusted and nominal views work correctly

## Performance Considerations

Adding three additional fields (`age`, `year`, `isTargetTrajectory`) to each trajectory data point has negligible performance impact:
- Trajectory data is already filtered to a subset of chart points
- Fields are simple primitives (two numbers, one boolean)
- No additional calculations required

## References

- Original research: [2026-01-30-target-trajectory-tooltip-undefined-bug.md](thoughts/shared/research/2026-01-30-target-trajectory-tooltip-undefined-bug.md)
- Related chart work: [2026-01-27-assets-over-time-chart-label-fixes.md](thoughts/shared/research/2026-01-27-assets-over-time-chart-label-fixes.md)
