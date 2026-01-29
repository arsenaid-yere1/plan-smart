# Assets Over Time Chart Label Fixes - Implementation Plan

## Overview

Implement three small but important fixes for the ProjectionChart component to improve label handling when depletion target is enabled. These fixes prevent edge cases where labels show "undefined", trajectory lines render with invalid data, and legend items appear when their corresponding visual elements don't render.

## Current State Analysis

The `ProjectionChart.tsx` component has undergone recent fixes for NaN/undefined issues, CSS variable resolution, and Y-axis domain calculation. However, three edge cases remain:

1. **Line 668**: Only checks `depletionTargetXValue !== null`, not `depletionTargetAge != null`
2. **Line 289**: Defaults `startBalance` to 0, which can cause trajectory lines starting from $0
3. **Lines 824, 830**: Uses truthy checks without verifying `targetTrajectoryData` exists

### Key Discoveries:
- [ProjectionChart.tsx:668](src/components/projections/ProjectionChart.tsx#L668) - Missing null check for `depletionTargetAge`
- [ProjectionChart.tsx:289](src/components/projections/ProjectionChart.tsx#L289) - `startBalance` defaults to 0 when chart data is empty
- [ProjectionChart.tsx:824-835](src/components/projections/ProjectionChart.tsx#L824-L835) - Legend shows "Target Trajectory" even when trajectory data is null

## Desired End State

After implementing these fixes:
- The "Target Age" label never shows "Target Age undefined"
- The target trajectory line only renders when there's valid balance data (startBalance > 0)
- The "Target Trajectory" legend item only appears when the trajectory line is actually rendered
- All depletion target edge cases are handled gracefully

## What We're NOT Doing

- Label overlap prevention (flagged as Medium priority in research - requires more complex logic)
- Responsive font sizes (flagged as Low priority)
- Test coverage additions (can be done in a follow-up)
- Interactive trajectory line (open question in research)

## Implementation Approach

These are three small, targeted fixes with minimal risk. Each fix is independent and can be applied in any order. We'll implement them in a single phase since they're all in the same file and affect related functionality.

---

## Phase 1: Apply Label Fixes

### Overview
Apply all three suggested fixes from the research document to prevent edge cases in depletion target visualization.

### Changes Required:

#### 1. Fix "Target Age undefined" Label
**File**: `src/components/projections/ProjectionChart.tsx`
**Lines**: 668

**Current Code:**
```typescript
{depletionTargetXValue !== null && (
```

**Change to:**
```typescript
{depletionTargetAge != null && depletionTargetXValue !== null && (
```

**Rationale**: Adding `depletionTargetAge != null` ensures the label only renders when `depletionTargetAge` has a valid value, preventing "Target Age undefined" from appearing.

---

#### 2. Fix $0 Values in Target Trajectory
**File**: `src/components/projections/ProjectionChart.tsx`
**Lines**: 289-292

**Current Code:**
```typescript
const startBalance = chartData[0]?.displayBalance ?? 0;
const endBalance = adjustForInflation
  ? reserveFloor / Math.pow(1 + safeInflationRate, yearsToTarget)
  : reserveFloor;
```

**Change to:**
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

---

#### 3. Fix Legend Shows When No Trajectory Data
**File**: `src/components/projections/ProjectionChart.tsx`
**Lines**: 824-835

**Current Code:**
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

**Change to:**
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
1. Use `!= null` instead of truthy check to handle edge case where age might be 0 (though unlikely)
2. Add `targetTrajectoryData &&` check so the trajectory legend only shows when the trajectory line actually renders

---

### Success Criteria:

#### Automated Verification:
- [x] TypeScript compiles without errors: `npm run typecheck`
- [x] Linting passes: `npm run lint`
- [x] Unit tests pass: `npm test`
- [x] Build succeeds: `npm run build`

#### Manual Verification:
- [ ] With valid depletion target: "Target Age X" label displays correctly
- [ ] With missing balance data: No trajectory line renders (no $0 starting point)
- [ ] With trajectory disabled: "Target Trajectory" legend item hidden
- [ ] With trajectory enabled but invalid data: "Target Trajectory" legend item hidden
- [ ] All existing chart functionality unchanged

---

## Testing Strategy

### Manual Testing Steps:
1. Navigate to Plans page with depletion target enabled
2. Verify "Target Age X" label shows correctly with valid target age
3. Create a scenario where chartData is empty or has 0 balance - verify no trajectory renders
4. Toggle `showTargetTrajectory` and verify legend updates appropriately
5. Verify no console errors or warnings

### Edge Cases to Verify:
- `depletionTargetAge` is `undefined`
- `depletionTargetAge` is `null`
- `depletionTargetAge` is `0` (edge case - should still work)
- `chartData[0].displayBalance` is `0`
- `chartData[0].displayBalance` is `undefined`
- `chartData` is empty array

---

## Performance Considerations

These changes add minimal conditional checks (O(1)) and don't affect rendering performance. The early return in the trajectory calculation may slightly improve performance by avoiding unnecessary computations when data is invalid.

---

## References

- Research document: [2026-01-27-assets-over-time-chart-label-fixes.md](thoughts/shared/research/2026-01-27-assets-over-time-chart-label-fixes.md)
- Source file: [ProjectionChart.tsx](src/components/projections/ProjectionChart.tsx)
