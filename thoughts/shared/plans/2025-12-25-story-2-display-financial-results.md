# Story 2.0 — Display Financial Results After Onboarding Implementation Plan

## Overview

Enhance the `/plans` page to deliver the "Core Aha Moment" experience after onboarding completion. The page currently shows projection data but needs restructuring to display key metrics **above the fold** with a prominent three-tier retirement status, improved snapshot cards, and a shortfall visual marker on the chart.

## Current State Analysis

### What Exists
- **Projection Engine**: Fully functional at [engine.ts](src/lib/projections/engine.ts) - calculates year-by-year retirement projections
- **ProjectionChart**: Complete at [ProjectionChart.tsx](src/components/projections/ProjectionChart.tsx) with phase visualization
- **Plans Page**: Working at [page.tsx](src/app/plans/page.tsx) with 3 summary cards below the chart
- **Post-Onboarding Redirect**: Already implemented at [onboarding/page.tsx:111](src/app/onboarding/page.tsx#L111)
- **UI Components**: Card, Alert, and badge patterns exist

### Current Layout Issues
1. Summary cards are **below the chart** (require scrolling)
2. Status is **binary only** (Sustainable/Depletes) - no intermediate state
3. No "Monthly Spending Supported" card
4. No shortfall year marker on chart
5. Chart wrapped in Card adds unnecessary padding
6. No error handling for projection calculation failures

### Key Discoveries
- **Status Data**: `projection.summary.yearsUntilDepletion` is `null` when sustainable, otherwise a number
- **Monthly Spending**: Available via `incomeExpenses.monthlyEssential + incomeExpenses.monthlyDiscretionary`
- **Chart Height**: Currently `h-64 sm:h-80 lg:h-96` (256px-384px)
- **Reference Lines**: Already implemented for retirement age and zero baseline

## Desired End State

After completing this plan:

1. **Above the Fold Layout**: Status badge, 4 snapshot cards, and chart visible without scrolling
2. **Three-Tier Status**: "On Track", "Needs Adjustment", or "At Risk" with icons
3. **Four Snapshot Cards**: Assets at Retirement, Monthly Spending, Retirement Age, Shortfall Year
4. **Shortfall Marker**: Visual reference line on chart when funds deplete
5. **Error Handling**: Friendly error state with "Edit Inputs" button
6. **Accessibility**: Screen reader summary and icon+color status indicators
7. **Page Metadata**: SEO-optimized title and description

### Verification
- Page loads in <2 seconds (verify with Chrome DevTools)
- All 4 cards render with correct values
- Status badge shows correct tier based on `yearsUntilDepletion`
- Shortfall reference line appears when applicable
- Error state displays when projection fails
- Screen reader announces projection summary

## What We're NOT Doing

- **No framer-motion animations**: Keeping existing CSS transitions (avoids new dependency)
- **No confetti celebrations**: Out of scope for MVP
- **No number count-up animations**: Out of scope
- **No route changes**: `/plans` route remains as-is
- **No analytics tracking**: Deferred to future story
- **No skeleton loading**: Server-side rendering already handles this

## Implementation Approach

Restructure the `/plans` page in phases:
1. Add utility function for three-tier status logic
2. Restructure layout: status → cards → chart (above fold)
3. Add shortfall reference line to chart
4. Add error boundary and friendly error state
5. Add accessibility improvements
6. Add page metadata

---

## Phase 1: Three-Tier Status Logic

### Overview
Add a utility function to determine retirement status based on `yearsUntilDepletion`.

### Changes Required

#### 1. Create Status Utility Function
**File**: `src/lib/projections/status.ts` (new file)

```typescript
import type { ProjectionSummary } from './types';

export type RetirementStatus = 'on-track' | 'needs-adjustment' | 'at-risk';

export interface RetirementStatusResult {
  status: RetirementStatus;
  label: string;
  description: string;
}

/**
 * Determines retirement status based on projection summary.
 *
 * Thresholds:
 * - On Track: Funds last through max age (yearsUntilDepletion === null)
 * - Needs Adjustment: Depletes but >20 years runway
 * - At Risk: Depletes within ≤20 years
 */
export function getRetirementStatus(
  summary: ProjectionSummary,
  currentAge: number
): RetirementStatusResult {
  const { yearsUntilDepletion } = summary;

  // Sustainable through max age
  if (yearsUntilDepletion === null) {
    return {
      status: 'on-track',
      label: 'On Track',
      description: 'Your retirement savings are projected to last through age 90.',
    };
  }

  // Depletes but not urgent (>20 years runway)
  if (yearsUntilDepletion > 20) {
    return {
      status: 'needs-adjustment',
      label: 'Needs Adjustment',
      description: `Funds may run out at age ${currentAge + yearsUntilDepletion}. Consider increasing savings.`,
    };
  }

  // Urgent action needed (≤20 years runway)
  return {
    status: 'at-risk',
    label: 'At Risk of Shortfall',
    description: `Funds projected to run out at age ${currentAge + yearsUntilDepletion}. Action recommended.`,
  };
}
```

#### 2. Export from Index
**File**: `src/lib/projections/index.ts`

Add export:
```typescript
export { getRetirementStatus, type RetirementStatus, type RetirementStatusResult } from './status';
```

### Success Criteria

#### Automated Verification
- [x] TypeScript compiles: `npm run typecheck`
- [x] Unit test passes: `npm test -- --run src/lib/projections/__tests__/status.test.ts`

#### Manual Verification
- [x] Function returns correct status for each scenario (verify via test)

---

## Phase 2: Restructure Plans Page Layout

### Overview
Reorganize the page to show status → cards → chart (above the fold).

### Changes Required

#### 1. Update Plans Page
**File**: `src/app/plans/page.tsx`

**Import additions** (after line 16):
```typescript
import { CheckCircle2, AlertTriangle, XCircle } from 'lucide-react';
import { getRetirementStatus, type RetirementStatus } from '@/lib/projections';
import { cn } from '@/lib/utils';
```

**Replace the entire return statement** (lines 194-276) with new layout:

```tsx
// Get retirement status
const statusResult = getRetirementStatus(projection.summary, currentAge);

// Calculate monthly spending (inflation-adjusted to retirement)
const monthlySpending = incomeExpenses
  ? (incomeExpenses.monthlyEssential || 0) + (incomeExpenses.monthlyDiscretionary || 0)
  : annualExpenses / 12;
const yearsToRetirement = retirementAge - currentAge;
const inflationFactor = Math.pow(1 + DEFAULT_INFLATION_RATE, yearsToRetirement);
const monthlySpendingAtRetirement = Math.round(monthlySpending * inflationFactor);

// Format currency helper
const formatCurrency = (value: number) => {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${Math.round(value / 1_000)}K`;
  return `$${Math.round(value)}`;
};

const formatFullCurrency = (value: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value);

// Status icon component
const StatusIcon = ({ status }: { status: RetirementStatus }) => {
  switch (status) {
    case 'on-track':
      return <CheckCircle2 className="h-6 w-6" />;
    case 'needs-adjustment':
      return <AlertTriangle className="h-6 w-6" />;
    case 'at-risk':
      return <XCircle className="h-6 w-6" />;
  }
};

return (
  <PageContainer>
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Your Retirement Projection
        </h1>
        <p className="text-muted-foreground">
          Based on your financial information, here&apos;s where you stand.
        </p>
      </div>

      {/* Screen Reader Summary */}
      <div className="sr-only" role="status" aria-live="polite">
        Your retirement projection shows {statusResult.label}.
        Estimated assets at retirement: {formatFullCurrency(projection.summary.projectedRetirementBalance)}.
        {projection.summary.yearsUntilDepletion
          ? `Funds may run out at age ${currentAge + projection.summary.yearsUntilDepletion}.`
          : 'Funds are projected to last through age 90.'}
      </div>

      {/* Status Badge - Most Important Info First */}
      <div
        className={cn(
          'inline-flex items-center gap-2 rounded-full px-4 py-2 text-lg font-semibold',
          statusResult.status === 'on-track' && 'bg-success/10 text-success',
          statusResult.status === 'needs-adjustment' && 'bg-warning/10 text-warning',
          statusResult.status === 'at-risk' && 'bg-destructive/10 text-destructive'
        )}
      >
        <StatusIcon status={statusResult.status} />
        {statusResult.label}
      </div>

      {/* Snapshot Cards - 4 Column Grid */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        {/* Assets at Retirement */}
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>At Retirement (Age {retirementAge})</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-foreground">
              {formatCurrency(projection.summary.projectedRetirementBalance)}
            </p>
          </CardContent>
        </Card>

        {/* Monthly Spending Supported */}
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Monthly Spending</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-foreground">
              {formatCurrency(monthlySpendingAtRetirement)}
              <span className="text-sm font-normal text-muted-foreground">/mo</span>
            </p>
          </CardContent>
        </Card>

        {/* Retirement Age */}
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Retirement Age</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-foreground">
              {retirementAge}
            </p>
          </CardContent>
        </Card>

        {/* Shortfall Year */}
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Funds Last Until</CardDescription>
          </CardHeader>
          <CardContent>
            {projection.summary.yearsUntilDepletion === null ? (
              <p className="text-2xl font-bold text-success">Age 90+</p>
            ) : (
              <p className="text-2xl font-bold text-destructive">
                Age {currentAge + projection.summary.yearsUntilDepletion}
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Chart - No Card Wrapper, Reduced Height */}
      <div>
        <h2 className="text-lg font-semibold mb-2">Assets Over Time</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Your projected balance from age {currentAge} to {DEFAULT_MAX_AGE}
        </p>
        <ProjectionChart
          records={projection.records}
          retirementAge={retirementAge}
          currentAge={currentAge}
          inflationRate={DEFAULT_INFLATION_RATE}
          shortfallAge={
            projection.summary.yearsUntilDepletion !== null
              ? currentAge + projection.summary.yearsUntilDepletion
              : undefined
          }
        />
      </div>

      {/* Collapsible Table */}
      <ProjectionTable
        records={projection.records}
        retirementAge={retirementAge}
      />
    </div>
  </PageContainer>
);
```

### Success Criteria

#### Automated Verification
- [x] TypeScript compiles: `npm run typecheck`
- [x] Build succeeds: `npm run build`
- [x] Linting passes: `npm run lint`

#### Manual Verification
- [x] Status badge displays at top with correct color and icon
- [x] All 4 snapshot cards visible on desktop without scrolling
- [x] Cards show correct values
- [x] Chart renders below cards
- [x] Table collapses properly

---

## Phase 3: Add Shortfall Reference Line to Chart

### Overview
Add a visual marker on the chart when funds are projected to run out.

### Changes Required

#### 1. Update ProjectionChart Props
**File**: `src/components/projections/ProjectionChart.tsx`

**Update interface** (lines 19-24):
```typescript
interface ProjectionChartProps {
  records: ProjectionRecord[];
  retirementAge: number;
  currentAge: number;
  inflationRate?: number;
  shortfallAge?: number;  // NEW: Age when funds run out
}
```

**Update function signature** (line 44):
```typescript
export function ProjectionChart({
  records,
  retirementAge,
  currentAge,
  inflationRate = 0.025,
  shortfallAge,  // NEW
}: ProjectionChartProps) {
```

**Add shortfall x-value calculation** (after line 131):
```typescript
const shortfallXValue = useMemo(() => {
  if (!shortfallAge) return null;
  if (xAxisType === 'age') {
    return shortfallAge;
  }
  // Calculate shortfall year from current age
  const currentYear = new Date().getFullYear();
  return currentYear + (shortfallAge - currentAge);
}, [xAxisType, shortfallAge, currentAge]);
```

**Add shortfall ReferenceLine** (after line 308, after retirement ReferenceLine):
```typescript
{/* Shortfall marker */}
{shortfallXValue !== null && (
  <ReferenceLine
    x={shortfallXValue}
    stroke="hsl(var(--destructive))"
    strokeDasharray="5 5"
    label={{
      value: 'Shortfall',
      position: 'top',
      fill: 'hsl(var(--destructive))',
      fontSize: 12,
    }}
  />
)}
```

**Add to legend** (after line 384, within the legend div):
```typescript
{shortfallAge && (
  <div className="flex items-center gap-2">
    <div className="h-4 w-0.5 border-l-2 border-dashed border-destructive" />
    <span>Funds Depleted</span>
  </div>
)}
```

### Success Criteria

#### Automated Verification
- [x] TypeScript compiles: `npm run typecheck`
- [x] Chart tests pass: `npm test -- --run src/components/projections/__tests__/ProjectionChart.test.ts`

#### Manual Verification
- [x] Shortfall line appears on chart when funds deplete
- [x] Shortfall line does NOT appear when funds are sustainable
- [x] Legend shows "Funds Depleted" entry when applicable

---

## Phase 4: Error Handling

### Overview
Add try-catch around projection calculation and display friendly error state.

### Changes Required

#### 1. Update Plans Page Error Handling
**File**: `src/app/plans/page.tsx`

**Add Button import** (update imports):
```typescript
import { Button } from '@/components/ui/button';
```

**Wrap projection calculation in try-catch** (replace line 192):
```typescript
// Run projection with error handling
let projection: ReturnType<typeof runProjection>;
let projectionError = false;

try {
  projection = runProjection(projectionInput);
} catch {
  projectionError = true;
}

// Handle projection error
if (projectionError) {
  return (
    <PageContainer>
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <AlertCircle className="h-12 w-12 text-destructive mb-4" />
        <h2 className="text-xl font-semibold mb-2">
          We couldn&apos;t generate your plan yet
        </h2>
        <p className="text-muted-foreground mb-6 max-w-md">
          Something went wrong while calculating your projection.
          Please try editing your inputs or contact support if the issue persists.
        </p>
        <Button asChild>
          <a href="/onboarding">Edit Inputs</a>
        </Button>
      </div>
    </PageContainer>
  );
}
```

### Success Criteria

#### Automated Verification
- [x] TypeScript compiles: `npm run typecheck`
- [x] Build succeeds: `npm run build`

#### Manual Verification
- [x] When projection fails, error UI displays with "Edit Inputs" button
- [x] Clicking "Edit Inputs" navigates to `/onboarding`
- [x] No blank or partially rendered states

---

## Phase 5: Unit Tests

### Overview
Add tests for the new status utility function.

### Changes Required

#### 1. Create Status Tests
**File**: `src/lib/projections/__tests__/status.test.ts` (new file)

```typescript
import { describe, it, expect } from 'vitest';
import { getRetirementStatus } from '../status';
import type { ProjectionSummary } from '../types';

describe('getRetirementStatus', () => {
  const baseSummary: ProjectionSummary = {
    startingBalance: 100000,
    endingBalance: 500000,
    totalContributions: 200000,
    totalWithdrawals: 0,
    yearsUntilDepletion: null,
    projectedRetirementBalance: 400000,
  };

  describe('On Track status', () => {
    it('returns on-track when funds last through max age', () => {
      const result = getRetirementStatus(
        { ...baseSummary, yearsUntilDepletion: null },
        30
      );

      expect(result.status).toBe('on-track');
      expect(result.label).toBe('On Track');
      expect(result.description).toContain('projected to last through age 90');
    });
  });

  describe('Needs Adjustment status', () => {
    it('returns needs-adjustment when depletes after 20+ years', () => {
      const result = getRetirementStatus(
        { ...baseSummary, yearsUntilDepletion: 25 },
        35
      );

      expect(result.status).toBe('needs-adjustment');
      expect(result.label).toBe('Needs Adjustment');
      expect(result.description).toContain('age 60'); // 35 + 25
      expect(result.description).toContain('Consider increasing savings');
    });

    it('returns needs-adjustment at exactly 21 years', () => {
      const result = getRetirementStatus(
        { ...baseSummary, yearsUntilDepletion: 21 },
        40
      );

      expect(result.status).toBe('needs-adjustment');
    });
  });

  describe('At Risk status', () => {
    it('returns at-risk when depletes within 20 years', () => {
      const result = getRetirementStatus(
        { ...baseSummary, yearsUntilDepletion: 15 },
        50
      );

      expect(result.status).toBe('at-risk');
      expect(result.label).toBe('At Risk of Shortfall');
      expect(result.description).toContain('age 65'); // 50 + 15
      expect(result.description).toContain('Action recommended');
    });

    it('returns at-risk at exactly 20 years', () => {
      const result = getRetirementStatus(
        { ...baseSummary, yearsUntilDepletion: 20 },
        45
      );

      expect(result.status).toBe('at-risk');
    });

    it('returns at-risk when depletes very soon', () => {
      const result = getRetirementStatus(
        { ...baseSummary, yearsUntilDepletion: 5 },
        60
      );

      expect(result.status).toBe('at-risk');
      expect(result.description).toContain('age 65'); // 60 + 5
    });
  });
});
```

### Success Criteria

#### Automated Verification
- [x] Tests pass: `npm test -- --run src/lib/projections/__tests__/status.test.ts`
- [x] All test cases cover edge cases (exactly 20 years, exactly 21 years)

#### Manual Verification
- [x] Test file follows existing patterns in codebase

---

## Phase 6: Page Metadata

### Overview
Add SEO-optimized metadata for the plans page.

### Changes Required

#### 1. Add Metadata Export
**File**: `src/app/plans/page.tsx`

**Add at the top of the file** (after imports):
```typescript
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Your Retirement Projection - Plan Smart',
  description: 'View your personalized retirement projection with asset growth visualization and key financial metrics.',
};
```

### Success Criteria

#### Automated Verification
- [x] TypeScript compiles: `npm run typecheck`

#### Manual Verification
- [x] Browser tab shows "Your Retirement Projection - Plan Smart"
- [x] View source shows correct meta description

---

## Testing Strategy

### Unit Tests
- `src/lib/projections/__tests__/status.test.ts` - Status logic with all thresholds
- Existing chart tests should still pass

### Integration Tests (Future)
- `/plans` page renders with all 4 cards
- Status badge shows correct tier
- Error state displays on projection failure

### Manual Testing Steps
1. Complete onboarding with savings that result in "On Track" status → verify green badge
2. Complete onboarding with marginal savings → verify "Needs Adjustment" yellow badge
3. Complete onboarding with insufficient savings → verify "At Risk" red badge
4. Verify all 4 snapshot cards display correct values
5. Verify chart shows shortfall line when applicable
6. Test with screen reader to verify accessibility summary

---

## Performance Considerations

- Projection calculation is <100ms (already verified)
- Server-side rendering eliminates loading states
- No new dependencies added (avoids bundle size increase)
- CSS transitions used instead of JS animations

---

## References

- Original ticket: `thoughts/personal/tickets/epic-2/onboarding/story-2-scope.md`
- Research document: `thoughts/shared/research/2025-12-25-story-2-display-financial-results-research.md`
- Current plans page: `src/app/plans/page.tsx`
- Projection engine: `src/lib/projections/engine.ts`
- Chart component: `src/components/projections/ProjectionChart.tsx`
