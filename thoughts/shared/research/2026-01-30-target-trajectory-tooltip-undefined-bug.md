---
date: 2026-01-30T12:20:00-08:00
researcher: Claude
git_commit: 372795c8079cc53a6deafb5e7250b6bafd07dd3d
branch: main
repository: plan-smart
topic: "Target Trajectory Tooltip Shows Undefined and Zero Values"
tags: [research, codebase, ProjectionChart, recharts, tooltip, bug]
status: complete
last_updated: 2026-01-30
last_updated_by: Claude
---

# Research: Target Trajectory Tooltip Shows Undefined and Zero Values

**Date**: 2026-01-30T12:20:00-08:00
**Researcher**: Claude
**Git Commit**: 372795c8079cc53a6deafb5e7250b6bafd07dd3d
**Branch**: main
**Repository**: plan-smart

## Research Question

Debug why the Recharts tooltip in the Assets Over Time chart shows "Age: undefined" and "Today's $: $0" when hovering.

## Summary

The bug occurs when hovering over the **Target Trajectory dashed line** in the ProjectionChart. The Target Trajectory line has its own data array (`targetTrajectoryData`) that only contains `xValue` and `targetBalance` fields. When Recharts triggers a tooltip for this line, the tooltip content component tries to access `data.age`, `data.year`, and `data.displayBalance` - all of which are `undefined` on the trajectory data points.

### Root Cause

The Target Trajectory `<Line>` component at [ProjectionChart.tsx:706-717](src/components/projections/ProjectionChart.tsx#L706-L717) uses a separate data array:

```typescript
<Line
  type="monotone"
  data={targetTrajectoryData}
  dataKey="targetBalance"
  // ...
/>
```

The `targetTrajectoryData` is generated at [lines 304-315](src/components/projections/ProjectionChart.tsx#L304-L315):

```typescript
return chartData
  .filter(r => r.age >= currentAge && r.age <= depletionTargetAge)
  .map(r => {
    const progress = (r.age - currentAge) / yearsToTarget;
    const targetBalance = startBalance - (startBalance - endBalance) * progress;

    return {
      xValue: r.xValue,
      targetBalance,  // Only these two fields!
    };
  });
```

The tooltip content component expects:
- `data.age` - undefined on trajectory points
- `data.year` - undefined on trajectory points
- `data.displayBalance` - undefined on trajectory points (formatted as `$0`)

## Detailed Findings

### Tooltip Code Analysis

The tooltip at [lines 512-614](src/components/projections/ProjectionChart.tsx#L512-L614) handles the balance view:

```typescript
const data = payload[0].payload as ProjectionRecord & {
  xValue: number;
  isRetirement: boolean;
  displayBalance: number;
  nominalBalance: number;
  realBalance: number;
  // ...
};

// Line 564 - accesses data.age which is undefined
{xAxisType === 'age' ? `Age ${data.age}` : `Year ${data.year}`}

// Line 570 - accesses data.displayBalance which is undefined → formatted as $0
{formatTooltipCurrency(data.displayBalance)}
```

### Why This Happens

1. The `ComposedChart` contains multiple data series
2. The main chart data (balance view) uses `chartDataWithReserve ?? chartData`
3. The Target Trajectory line uses its own `targetTrajectoryData`
4. When hovering over the trajectory line, Recharts passes the trajectory data point to the tooltip
5. The tooltip assumes all data points have the same shape as main chart data

### Reproduction Steps

1. Navigate to a plan with depletion target enabled and reserve floor configured
2. View the "Assets Over Time" tab in balance view
3. Hover over the dashed "Target Trajectory" line (not the main green area)
4. Observe tooltip shows "Age: undefined" and "$0"

## Recommended Fixes

### Fix Option 1: Include Missing Fields in Trajectory Data (Recommended)

Update the trajectory data generation to include the fields needed by tooltip:

**Location**: [ProjectionChart.tsx:304-315](src/components/projections/ProjectionChart.tsx#L304-L315)

**Current Code**:
```typescript
return {
  xValue: r.xValue,
  targetBalance,
};
```

**Fixed Code**:
```typescript
return {
  xValue: r.xValue,
  targetBalance,
  age: r.age,
  year: r.year,
  displayBalance: targetBalance,  // Use target balance as display value
  nominalBalance: targetBalance,
  realBalance: targetBalance,
  isRetirement: r.isRetirement,
};
```

### Fix Option 2: Add Guard in Tooltip for Missing Fields

**Location**: [ProjectionChart.tsx:564](src/components/projections/ProjectionChart.tsx#L564)

**Current Code**:
```typescript
<p className="text-sm font-medium text-foreground">
  {xAxisType === 'age' ? `Age ${data.age}` : `Year ${data.year}`}
</p>
```

**Fixed Code**:
```typescript
<p className="text-sm font-medium text-foreground">
  {xAxisType === 'age'
    ? `Age ${data.age ?? data.xValue}`
    : `Year ${data.year ?? data.xValue}`}
</p>
```

Also update line 570 to handle missing `displayBalance`:
```typescript
{formatTooltipCurrency(data.displayBalance ?? data.targetBalance ?? 0)}
```

### Fix Option 3: Suppress Tooltip for Trajectory Line

Add a custom tooltip trigger check to skip the trajectory line:

**Location**: [ProjectionChart.tsx:512-514](src/components/projections/ProjectionChart.tsx#L512-L514)

**Current Code**:
```typescript
content={({ active, payload }) => {
  if (!active || !payload || !payload[0]) return null;
```

**Fixed Code**:
```typescript
content={({ active, payload }) => {
  if (!active || !payload || !payload[0]) return null;

  // Skip tooltip for target trajectory line (no age field)
  const data = payload[0].payload;
  if (data.targetBalance !== undefined && data.age === undefined) {
    return null;
  }
```

### Recommended Approach

**Fix Option 1** is recommended because:
1. It provides useful information when hovering the trajectory line
2. Shows "Target: $X at Age Y" which helps users understand the goal
3. Consistent with how other data points work

However, if the trajectory tooltip should show different content than the main chart tooltip, **Fix Option 3** is cleaner - suppress the default tooltip and potentially add a custom tooltip for the trajectory.

## Code References

- [ProjectionChart.tsx:279-316](src/components/projections/ProjectionChart.tsx#L279-L316) - `targetTrajectoryData` calculation
- [ProjectionChart.tsx:512-614](src/components/projections/ProjectionChart.tsx#L512-L614) - Tooltip content component
- [ProjectionChart.tsx:564](src/components/projections/ProjectionChart.tsx#L564) - Age/Year display (shows "undefined")
- [ProjectionChart.tsx:570](src/components/projections/ProjectionChart.tsx#L570) - Balance display (shows "$0")
- [ProjectionChart.tsx:706-717](src/components/projections/ProjectionChart.tsx#L706-L717) - Target Trajectory Line component

## Architecture Insights

1. **Recharts Tooltip Behavior**: When multiple data series exist in a ComposedChart, the tooltip receives the data point from whichever series is being hovered. Each series can have different data shapes, but the tooltip content component must handle all of them.

2. **Data Shape Mismatch**: The main chart data has ~20 fields including `age`, `year`, `displayBalance`, etc. The trajectory data only has 2 fields. This violates the implicit contract expected by the tooltip.

3. **Pattern Recommendation**: When adding new data series to a ComposedChart with a custom tooltip, either:
   - Match the data shape of the primary series
   - Add type guards in the tooltip to handle different shapes
   - Use `isAnimationActive={false}` and custom tooltip logic per series

## Related Research

- [2026-01-27-assets-over-time-chart-label-fixes.md](thoughts/shared/research/2026-01-27-assets-over-time-chart-label-fixes.md) - Previous chart label fixes (identified related issues but not this specific tooltip bug)

## Open Questions

1. Should the trajectory line have its own tooltip content (e.g., "Target Balance: $X at Age Y")?
2. Should the trajectory line be non-interactive (no tooltip at all)?
3. Is this bug visible to all users with depletion target enabled, or only specific configurations?
