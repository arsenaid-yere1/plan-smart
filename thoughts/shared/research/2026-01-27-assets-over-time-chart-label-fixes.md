---
date: 2026-01-27T18:30:00-08:00
researcher: Claude
git_commit: c32adc37368435d63456d38a6c2ad4c355c72daa
branch: main
repository: plan-smart
topic: "Assets Over Time Chart Labels - Depletion Target Issues and Fixes"
tags: [research, codebase, ProjectionChart, depletion-target, labels, recharts]
status: complete
last_updated: 2026-01-27
last_updated_by: Claude
last_updated_note: "Converted applied fixes to suggested fixes"
---

# Research: Assets Over Time Chart Labels When Depletion Target is Enabled

**Date**: 2026-01-27T18:30:00-08:00
**Researcher**: Claude
**Git Commit**: c32adc37368435d63456d38a6c2ad4c355c72daa
**Branch**: main
**Repository**: plan-smart

## Research Question

Recommend fixes for Assets Over Time chart labels when depletion target is on.

## Summary

The Assets Over Time chart in `ProjectionChart.tsx` has undergone several recent label fixes (5 commits in the last day). When depletion target is enabled, three specific label-related elements are rendered:

1. **"Target Age X"** reference line label (vertical dashed blue line)
2. **Target trajectory dashed line** (linear interpolation to reserve floor)
3. **Legend items** for both trajectory and target age

Several issues have been identified and fixes recommended:

### Key Findings

1. **Recent fixes addressed NaN/undefined issues** - The last commits added null checks to `formatCurrency`, inflation rate calculations, and trajectory computation to prevent NaN labels
2. **CSS variable resolution issue was fixed** - Replaced `hsl(var(--color))` with hardcoded HSL values for SVG text labels since CSS variables don't resolve in all SVG contexts
3. **Y-axis domain calculation was added** - Fixed stacked area charts not auto-scaling correctly when reserve visualization is active
4. **Remaining potential issues exist** - Label overlap, edge cases with same-age markers, and missing test coverage for depletion target scenarios

## Detailed Findings

### Current Label Implementation (ProjectionChart.tsx)

#### Label Colors (lines 68-73)
```typescript
const LABEL_COLORS = {
  muted: '#737373',      // For retirement, phase boundaries
  destructive: '#ef4444', // For shortfall
  primary: '#3b82f6',    // For depletion target age
} as const;
```

#### Depletion Target Age Label (lines 667-680)
```typescript
{depletionTargetXValue !== null && (
  <ReferenceLine
    x={depletionTargetXValue}
    stroke="hsl(var(--primary))"
    strokeDasharray="5 5"
    label={{
      value: `Target Age ${depletionTargetAge}`,
      position: 'top',
      fill: LABEL_COLORS.primary,
      fontSize: 12,
    }}
  />
)}
```

#### Target Trajectory Line (lines 681-693)
```typescript
{targetTrajectoryData && (
  <Line
    type="monotone"
    data={targetTrajectoryData}
    dataKey="targetBalance"
    stroke="hsl(var(--muted-foreground))"
    strokeDasharray="8 4"
    strokeWidth={1}
    dot={false}
    name="Target Trajectory"
  />
)}
```

### Recent Fixes Applied

| Commit | Description | Changes |
|--------|-------------|---------|
| `c32adc3` | balance view update | Added `yAxisDomain` calculation for proper axis scaling with stacked areas |
| `711821e` | label fix | Added null/NaN guards to formatCurrency, safe inflation rate defaults |
| `c63670d` | chart label when spending is enabled | Added division-by-zero check for trajectory calculation |
| `7b6dc89` | chart labels | Replaced CSS variable-based ReferenceLineLabel with hardcoded LABEL_COLORS |
| `225a78a` | chart labels | Earlier label improvements |

### Identified Issues Requiring Fixes

#### Issue 1: Label Overlap When Multiple Markers Are Close

**Problem**: When shortfallAge, retirementAge, and depletionTargetAge are close together (within a few years), the reference line labels can overlap and become unreadable.

**Current Code** (lines 641-680):
- All three markers use `position: 'top'` with same fontSize (12)
- No collision detection or offset logic

**Recommended Fix**:
```typescript
// Calculate label positions to avoid overlap
const labelPositions = useMemo(() => {
  const markers = [
    { age: retirementAge, label: 'Retirement', priority: 1 },
    shortfallAge && { age: shortfallAge, label: 'Shortfall', priority: 2 },
    depletionTargetAge && { age: depletionTargetAge, label: `Target Age ${depletionTargetAge}`, priority: 3 },
  ].filter(Boolean);

  // Sort by age and assign vertical offsets to overlapping labels
  const sorted = markers.sort((a, b) => a.age - b.age);
  const threshold = xAxisType === 'age' ? 3 : 3; // Years of proximity threshold

  let lastAge = -Infinity;
  let offset = 0;

  return sorted.map(marker => {
    if (marker.age - lastAge < threshold) {
      offset += 15; // Stack labels vertically
    } else {
      offset = 0;
    }
    lastAge = marker.age;
    return { ...marker, yOffset: offset };
  });
}, [retirementAge, shortfallAge, depletionTargetAge, xAxisType]);
```

**Implementation Location**: Add after line 272, before the return statement.

#### Issue 2: Target Age Label Shows "Target Age undefined" Edge Case

**Problem**: If `depletionTargetAge` is passed but is `undefined` or `null` from parent, the label could show "Target Age undefined".

**Current Code** (line 674):
```typescript
value: `Target Age ${depletionTargetAge}`,
```

**Recommended Fix**:
```typescript
value: depletionTargetAge ? `Target Age ${depletionTargetAge}` : 'Target',
```

Or better, ensure the guard at line 668 catches this:
```typescript
{depletionTargetAge != null && depletionTargetXValue !== null && (
```

#### Issue 3: Missing Legend Entry When Only Target Age (No Trajectory)

**Problem**: When `showTargetTrajectory` is false but `depletionTargetAge` is set, the legend doesn't show the "Target Trajectory" item, but the separate logic at lines 830-835 handles the target age separately. However, if trajectory is shown, the legend has both items, which could be confusing.

**Current Code** (lines 824-835):
```typescript
{depletionTargetAge && showTargetTrajectory && (
  <div className="flex items-center gap-2">
    <div className="h-0.5 w-4 border-b-2 border-dashed border-muted-foreground" />
    <span>Target Trajectory</span>
  </div>
)}
{depletionTargetAge && (
  <div className="flex items-center gap-2">
    <div className="h-4 w-0.5 border-l-2 border-dashed border-primary" />
    <span>Target Age</span>
  </div>
)}
```

**Recommended Fix**: This is actually correct, but the legend text could be more descriptive:
```typescript
<span>Target Age ({depletionTargetAge})</span>
```

#### Issue 4: Trajectory Line Data Key Mismatch

**Problem**: The trajectory line uses its own data array but renders within the same ComposedChart. If the data arrays have different lengths or x-values, Recharts might not render the line correctly.

**Current Code** (lines 682-693):
```typescript
<Line
  type="monotone"
  data={targetTrajectoryData}  // Separate data array
  dataKey="targetBalance"
  ...
/>
```

**Analysis**: This is actually handled correctly - Recharts allows passing a separate `data` prop to individual chart elements. However, if `targetTrajectoryData` has x-values not present in the main chart data, interpolation might look jagged.

**Recommended Fix** (optional optimization):
Ensure trajectory data uses the same x-values as chartData by changing line 295:
```typescript
return chartData
  .filter(r => r.age >= currentAge && r.age <= depletionTargetAge)
```
This is already correct - the trajectory is derived from `chartData`, ensuring consistent x-values.

#### Issue 5: Missing Test Coverage for Depletion Target Labels

**Problem**: The test file `ProjectionChart.test.tsx` has no tests for depletion target scenarios.

**Recommended Fix**: Add test cases:
```typescript
describe('ProjectionChart - Depletion Target', () => {
  const mockRecordsWithDepletion: ProjectionRecord[] = [
    // Add mock data spanning current age to target age
  ];

  it('shows target age reference line when depletionTargetAge is provided', () => {
    render(
      <ProjectionChart
        records={mockRecordsWithDepletion}
        retirementAge={65}
        currentAge={30}
        depletionTargetAge={85}
        reserveFloor={100000}
      />
    );

    expect(screen.getByText(/Target Age 85/)).toBeInTheDocument();
  });

  it('shows target trajectory in legend when showTargetTrajectory is true', () => {
    render(
      <ProjectionChart
        records={mockRecordsWithDepletion}
        retirementAge={65}
        currentAge={30}
        depletionTargetAge={85}
        reserveFloor={100000}
        showTargetTrajectory={true}
      />
    );

    expect(screen.getByText('Target Trajectory')).toBeInTheDocument();
    expect(screen.getByText('Target Age')).toBeInTheDocument();
  });

  it('hides target trajectory when showTargetTrajectory is false', () => {
    render(
      <ProjectionChart
        records={mockRecordsWithDepletion}
        retirementAge={65}
        currentAge={30}
        depletionTargetAge={85}
        reserveFloor={100000}
        showTargetTrajectory={false}
      />
    );

    expect(screen.queryByText('Target Trajectory')).not.toBeInTheDocument();
    expect(screen.getByText('Target Age')).toBeInTheDocument();
  });
});
```

#### Issue 6: Hardcoded Font Sizes Don't Scale

**Problem**: All labels use `fontSize: 12` or `fontSize: 10`, which may be too small on mobile or too large on very wide screens.

**Recommended Fix** (low priority): Consider using rem units or responsive font sizes based on chart container width.

## Code References

- [ProjectionChart.tsx:667-680](src/components/projections/ProjectionChart.tsx#L667-L680) - Depletion Target Age ReferenceLine
- [ProjectionChart.tsx:681-693](src/components/projections/ProjectionChart.tsx#L681-L693) - Target Trajectory Line
- [ProjectionChart.tsx:68-73](src/components/projections/ProjectionChart.tsx#L68-L73) - LABEL_COLORS constant
- [ProjectionChart.tsx:264-307](src/components/projections/ProjectionChart.tsx#L264-L307) - targetTrajectoryData calculation
- [ProjectionChart.tsx:824-835](src/components/projections/ProjectionChart.tsx#L824-L835) - Depletion target legend items
- [plans-client.tsx:566-577](src/app/plans/plans-client.tsx#L566-L577) - ProjectionChart usage with depletion target props

## Architecture Insights

1. **Label Color Strategy**: The codebase moved from CSS variable-based colors to hardcoded HSL values specifically for SVG text labels because Recharts renders labels as SVG `<text>` elements that don't properly resolve CSS custom properties in all browsers/contexts.

2. **Data Flow**: Depletion target configuration flows from:
   - User profile (`depletionTarget` in financial snapshot)
   - → plans-client.tsx (extracts `depletionTarget?.enabled ? depletionTarget.targetAge : undefined`)
   - → ProjectionChart props (`depletionTargetAge`, `showTargetTrajectory`)
   - → Internal calculations (`depletionTargetXValue`, `targetTrajectoryData`)
   - → ReferenceLine and Line components

3. **Conditional Rendering Pattern**: The chart uses null checks on calculated values rather than prop values:
   - `depletionTargetXValue !== null` (not `depletionTargetAge`)
   - This ensures the reference line only renders when the x-value is actually computable

## Recommended Fix Priority

| Priority | Issue | Effort | Impact |
|----------|-------|--------|--------|
| High | Add test coverage for depletion target | Medium | Prevents regressions |
| Medium | Label overlap prevention | High | Better UX when markers are close |
| Medium | Null guard for label text | Low | Prevents "undefined" in UI |
| Low | Legend text enhancement | Low | Minor UX improvement |
| Low | Responsive font sizes | Medium | Accessibility improvement |

## Suggested Fixes

### Suggested Fix 1: "Target Age undefined" Label
**Problem**: The label shows "Target Age undefined" when `depletionTargetAge` is not properly set.

**Location**: [ProjectionChart.tsx:667-680](src/components/projections/ProjectionChart.tsx#L667-L680)

**Current Code**:
```typescript
{depletionTargetXValue !== null && (
  <ReferenceLine
    x={depletionTargetXValue}
    stroke="hsl(var(--primary))"
    strokeDasharray="5 5"
    label={{
      value: `Target Age ${depletionTargetAge}`,
      position: 'top',
      fill: LABEL_COLORS.primary,
      fontSize: 12,
    }}
  />
)}
```

**Suggested Change**:
```typescript
{depletionTargetAge != null && depletionTargetXValue !== null && (
  <ReferenceLine
    x={depletionTargetXValue}
    stroke="hsl(var(--primary))"
    strokeDasharray="5 5"
    label={{
      value: `Target Age ${depletionTargetAge}`,
      position: 'top',
      fill: LABEL_COLORS.primary,
      fontSize: 12,
    }}
  />
)}
```

**Rationale**: Adding `depletionTargetAge != null` ensures the label only renders when `depletionTargetAge` has a valid value, preventing "Target Age undefined" from appearing.

### Suggested Fix 2: $0 Values in Target Trajectory
**Problem**: Trajectory shows $0 values when `startBalance` is 0 or undefined.

**Location**: [ProjectionChart.tsx:289](src/components/projections/ProjectionChart.tsx#L289)

**Current Code**:
```typescript
const startBalance = chartData[0]?.displayBalance ?? 0;
const endBalance = adjustForInflation
  ? reserveFloor / Math.pow(1 + safeInflationRate, yearsToTarget)
  : reserveFloor;
```

**Suggested Change**:
```typescript
const startBalance = chartData[0]?.displayBalance;
// Don't show trajectory if we don't have valid balance data
if (startBalance == null || startBalance <= 0) {
  return null;
}

const endBalance = adjustForInflation
  ? reserveFloor / Math.pow(1 + safeInflationRate, yearsToTarget)
  : reserveFloor;
```

**Rationale**: Instead of defaulting to 0, return null to prevent the trajectory line from rendering when there's no valid starting balance. This avoids showing a trajectory starting from $0 which is misleading.

### Suggested Fix 3: Legend Shows When No Trajectory Data
**Problem**: Legend shows "Target Trajectory" even when trajectory data is null (e.g., when startBalance is 0).

**Location**: [ProjectionChart.tsx:824-835](src/components/projections/ProjectionChart.tsx#L824-L835)

**Current Code**:
```typescript
{depletionTargetAge && showTargetTrajectory && (
  <div className="flex items-center gap-2">
    <div className="h-0.5 w-4 border-b-2 border-dashed border-muted-foreground" />
    <span>Target Trajectory</span>
  </div>
)}
{depletionTargetAge && (
  <div className="flex items-center gap-2">
    <div className="h-4 w-0.5 border-l-2 border-dashed border-primary" />
    <span>Target Age</span>
  </div>
)}
```

**Suggested Change**:
```typescript
{depletionTargetAge != null && showTargetTrajectory && targetTrajectoryData && (
  <div className="flex items-center gap-2">
    <div className="h-0.5 w-4 border-b-2 border-dashed border-muted-foreground" />
    <span>Target Trajectory</span>
  </div>
)}
{depletionTargetAge != null && (
  <div className="flex items-center gap-2">
    <div className="h-4 w-0.5 border-l-2 border-dashed border-primary" />
    <span>Target Age</span>
  </div>
)}
```

**Rationale**:
1. Use `!= null` instead of truthy check to handle edge case where age might be 0
2. Add `targetTrajectoryData &&` check so the trajectory legend only shows when the trajectory line actually renders

## Open Questions

1. Should the target trajectory line be interactive (show tooltip on hover)?
2. Should there be a visual distinction when the current trajectory is above vs below the target trajectory?
3. Is the label overlap issue actually occurring in production, or is it theoretical?

## Related Research

- [2026-01-22-ENG-10.1-implementation-recommendation.md](thoughts/shared/research/2026-01-22-ENG-10.1-implementation-recommendation.md) - Original depletion target input implementation
- [2026-01-25-ENG-10.3-depletion-feedback-implementation.md](thoughts/shared/research/2026-01-25-ENG-10.3-depletion-feedback-implementation.md) - Depletion feedback feature research
