# Story 2: Visualize Assets Over Time - Implementation Plan

## Overview

Implement a line chart visualization showing total asset balance over time, with clear phase distinction between accumulation (pre-retirement) and retirement drawdown. The chart will be the centerpiece of a new `/plans` page and will include an X-axis toggle between Age and Calendar Year views.

## Current State Analysis

### What Exists:
- **Projection Engine** ([src/lib/projections/engine.ts:98](src/lib/projections/engine.ts#L98)) - Complete, returns `ProjectionResult` with year-by-year records
- **Data Types** ([src/lib/projections/types.ts:104-134](src/lib/projections/types.ts#L104-L134)) - `ProjectionRecord` with `age`, `year`, `balance`, `inflows`, `outflows`
- **API Endpoint** ([src/app/api/projections/calculate/route.ts](src/app/api/projections/calculate/route.ts)) - GET/POST for projection calculation
- **Design System** ([src/app/globals.css](src/app/globals.css)) - CSS variables for colors, dark mode support
- **Navigation** ([src/components/layout/navigation.tsx:10](src/components/layout/navigation.tsx#L10)) - `/plans` route already in nav, page doesn't exist

### What's Missing:
- Charting library (Recharts)
- Chart component (`ProjectionChart`)
- Plans page (`/app/plans/page.tsx`)
- Tooltip and legend components

### Key Discoveries:
- `ProjectionRecord[]` is already chart-ready with `age`, `year`, `balance` fields
- Retirement age available from projection inputs for phase boundary
- Dark mode CSS variables can be used directly in Recharts via `hsl(var(--primary))`
- Navigation already links to `/plans` - just need the page

## Desired End State

After implementation:
1. User navigates to `/plans` and sees a line chart of their projected assets over time
2. Chart clearly distinguishes accumulation phase (before retirement) from drawdown phase (after retirement)
3. User can toggle X-axis between Age (default) and Calendar Year
4. Tooltips show exact values on hover/tap
5. Negative balances (if any) are highlighted in red
6. Chart is responsive and readable on mobile devices
7. Chart updates when projection data changes

### Verification:
- Visual inspection of chart on desktop and mobile
- Toggle between Age/Year views
- Hover/tap tooltips work correctly
- Dark mode renders properly
- Retirement phase boundary is clearly visible

## What We're NOT Doing

- Monte Carlo / probabilistic bands (per scope constraint)
- Portfolio-level breakdowns (single total balance only)
- Advanced chart customization controls
- "What-if" parameter editing (future story)

## Implementation Approach

Use Recharts for charting (React-native, declarative, shadcn-compatible). Create a single `ProjectionChart` component that receives projection data and renders a responsive line chart with phase distinction.

---

## Phase 1: Install Recharts & Create Base Chart Component

### Overview
Set up Recharts library and create the foundational chart component with basic line chart rendering.

### Changes Required:

#### 1. Install Recharts
**Command**: `npm install recharts`

#### 2. Create Chart Component Directory
**Directory**: `src/components/projections/`

#### 3. Create ProjectionChart Component
**File**: `src/components/projections/ProjectionChart.tsx`

```typescript
'use client';

import { useMemo, useState } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import type { ProjectionRecord } from '@/lib/projections/types';

type XAxisType = 'age' | 'year';

interface ProjectionChartProps {
  records: ProjectionRecord[];
  retirementAge: number;
  currentAge: number;
}

function formatCurrency(value: number): string {
  if (value >= 1_000_000) {
    return `$${(value / 1_000_000).toFixed(1)}M`;
  }
  if (value >= 1_000) {
    return `$${(value / 1_000).toFixed(0)}K`;
  }
  return `$${value.toFixed(0)}`;
}

function formatTooltipCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value);
}

export function ProjectionChart({
  records,
  retirementAge,
  currentAge,
}: ProjectionChartProps) {
  const [xAxisType, setXAxisType] = useState<XAxisType>('age');

  const chartData = useMemo(() => {
    return records.map((record) => ({
      ...record,
      xValue: xAxisType === 'age' ? record.age : record.year,
      isRetirement: record.age >= retirementAge,
    }));
  }, [records, xAxisType, retirementAge]);

  const retirementXValue = useMemo(() => {
    if (xAxisType === 'age') {
      return retirementAge;
    }
    // Calculate retirement year from current age
    const currentYear = new Date().getFullYear();
    return currentYear + (retirementAge - currentAge);
  }, [xAxisType, retirementAge, currentAge]);

  const minBalance = Math.min(...records.map((r) => r.balance));
  const hasNegativeBalance = minBalance < 0;

  return (
    <div className="w-full">
      {/* X-Axis Toggle */}
      <div className="mb-4 flex items-center gap-2">
        <span className="text-sm text-muted-foreground">View by:</span>
        <div className="inline-flex rounded-lg border border-border p-1">
          <button
            type="button"
            onClick={() => setXAxisType('age')}
            className={`px-3 py-1 text-sm font-medium rounded-md transition-colors ${
              xAxisType === 'age'
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Age
          </button>
          <button
            type="button"
            onClick={() => setXAxisType('year')}
            className={`px-3 py-1 text-sm font-medium rounded-md transition-colors ${
              xAxisType === 'year'
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Year
          </button>
        </div>
      </div>

      {/* Chart Container */}
      <div className="h-64 sm:h-80 lg:h-96 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={chartData}
            margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="hsl(var(--border))"
              vertical={false}
            />
            <XAxis
              dataKey="xValue"
              tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
              tickLine={{ stroke: 'hsl(var(--border))' }}
              axisLine={{ stroke: 'hsl(var(--border))' }}
            />
            <YAxis
              tickFormatter={formatCurrency}
              tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
              tickLine={{ stroke: 'hsl(var(--border))' }}
              axisLine={{ stroke: 'hsl(var(--border))' }}
              width={60}
            />
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload || !payload[0]) return null;
                const data = payload[0].payload as ProjectionRecord & {
                  xValue: number;
                  isRetirement: boolean;
                };
                return (
                  <div className="rounded-lg border border-border bg-card p-3 shadow-md">
                    <p className="text-sm font-medium text-foreground">
                      {xAxisType === 'age' ? `Age ${data.age}` : `Year ${data.year}`}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Balance: {formatTooltipCurrency(data.balance)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {data.isRetirement ? 'Retirement' : 'Accumulation'}
                    </p>
                  </div>
                );
              }}
            />
            {/* Zero baseline for negative balances */}
            {hasNegativeBalance && (
              <ReferenceLine
                y={0}
                stroke="hsl(var(--muted-foreground))"
                strokeDasharray="3 3"
              />
            )}
            {/* Retirement age marker */}
            <ReferenceLine
              x={retirementXValue}
              stroke="hsl(var(--muted-foreground))"
              strokeDasharray="5 5"
              label={{
                value: 'Retirement',
                position: 'top',
                fill: 'hsl(var(--muted-foreground))',
                fontSize: 12,
              }}
            />
            {/* Main balance line */}
            <Line
              type="monotone"
              dataKey="balance"
              stroke="hsl(var(--primary))"
              strokeWidth={2}
              dot={false}
              activeDot={{
                r: 6,
                fill: 'hsl(var(--primary))',
                stroke: 'hsl(var(--background))',
                strokeWidth: 2,
              }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Legend */}
      <div className="mt-4 flex flex-wrap items-center justify-center gap-4 text-sm text-muted-foreground">
        <div className="flex items-center gap-2">
          <div className="h-0.5 w-4 bg-primary" />
          <span>Total Balance</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-4 w-0.5 border-l-2 border-dashed border-muted-foreground" />
          <span>Retirement Start</span>
        </div>
      </div>
    </div>
  );
}
```

#### 4. Create Index Export
**File**: `src/components/projections/index.ts`

```typescript
export { ProjectionChart } from './ProjectionChart';
```

### Success Criteria:

#### Automated Verification:
- [x] Package installs successfully: `npm install recharts`
- [x] Type checking passes: `npm run typecheck`
- [x] Linting passes: `npm run lint`
- [x] Build succeeds: `npm run build`

#### Manual Verification:
- [x] Component can be imported without errors
- [x] No TypeScript errors in IDE

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation before proceeding to Phase 2.

---

## Phase 2: Create Plans Page

### Overview
Create the `/plans` page that fetches projection data and renders the chart component.

### Changes Required:

#### 1. Create Plans Page
**File**: `src/app/plans/page.tsx`

```typescript
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { db } from '@/db/client';
import { userProfile, financialSnapshot } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { PageContainer } from '@/components/layout';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';
import { ProjectionChart } from '@/components/projections';
import { runProjection } from '@/lib/projections';
import type { ProjectionInput } from '@/lib/projections/types';
import {
  DEFAULT_INFLATION_RATE,
  DEFAULT_MAX_AGE,
  DEFAULT_RETURN_RATES,
  DEFAULT_SS_AGE,
  DEFAULT_CONTRIBUTION_ALLOCATION,
  DEFAULT_CONTRIBUTION_GROWTH_RATE,
  DEFAULT_HEALTHCARE_INFLATION_RATE,
  estimateHealthcareCosts,
  estimateSocialSecurityMonthly,
  deriveAnnualExpenses,
  estimateAnnualDebtPayments,
} from '@/lib/projections/assumptions';
import type { RiskTolerance } from '@/types/onboarding';
import { ACCOUNT_TAX_CATEGORY, type BalanceByType } from '@/lib/projections/types';

async function getUser() {
  const cookieStore = await cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  return user;
}

export default async function PlansPage() {
  const user = await getUser();

  if (!user) {
    redirect('/auth/login');
  }

  // Check if user has completed onboarding
  const profiles = await db
    .select({ onboardingCompleted: userProfile.onboardingCompleted })
    .from(userProfile)
    .where(eq(userProfile.id, user.id))
    .limit(1);

  const profile = profiles[0];

  if (!profile || !profile.onboardingCompleted) {
    redirect('/onboarding');
  }

  // Fetch financial snapshot
  const snapshots = await db
    .select()
    .from(financialSnapshot)
    .where(eq(financialSnapshot.userId, user.id))
    .limit(1);

  const snapshot = snapshots[0];

  if (!snapshot) {
    return (
      <PageContainer>
        <Card>
          <CardHeader>
            <CardTitle>No Financial Data</CardTitle>
            <CardDescription>
              We couldn&apos;t find your financial information.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Missing Data</AlertTitle>
              <AlertDescription>
                Please complete the onboarding process to see your retirement projection.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      </PageContainer>
    );
  }

  // Calculate balances by tax category
  const balancesByType: BalanceByType = {
    taxDeferred: 0,
    taxFree: 0,
    taxable: 0,
  };

  const accounts = snapshot.investmentAccounts as Array<{
    type: string;
    balance: number;
  }> | null;

  if (accounts) {
    for (const account of accounts) {
      const category = ACCOUNT_TAX_CATEGORY[account.type as keyof typeof ACCOUNT_TAX_CATEGORY] || 'taxable';
      balancesByType[category] += account.balance;
    }
  }

  // Build projection input
  const riskTolerance = (snapshot.riskTolerance as RiskTolerance) || 'moderate';
  const expectedReturn = DEFAULT_RETURN_RATES[riskTolerance];

  const projectionInput: ProjectionInput = {
    currentAge: snapshot.currentAge,
    retirementAge: snapshot.retirementAge,
    maxAge: DEFAULT_MAX_AGE,
    balancesByType,
    annualContribution: (snapshot.monthlyContributions || 0) * 12,
    contributionAllocation: DEFAULT_CONTRIBUTION_ALLOCATION,
    expectedReturn,
    inflationRate: DEFAULT_INFLATION_RATE,
    contributionGrowthRate: DEFAULT_CONTRIBUTION_GROWTH_RATE,
    annualExpenses: deriveAnnualExpenses(
      snapshot.annualIncome,
      (snapshot.monthlyContributions || 0) * 12
    ),
    annualHealthcareCosts: estimateHealthcareCosts(snapshot.currentAge),
    healthcareInflationRate: DEFAULT_HEALTHCARE_INFLATION_RATE,
    socialSecurityAge: DEFAULT_SS_AGE,
    socialSecurityMonthly: estimateSocialSecurityMonthly(snapshot.annualIncome),
    annualDebtPayments: estimateAnnualDebtPayments(
      snapshot.debts as Array<{ monthlyPayment: number }> | null
    ),
  };

  // Run projection
  const projection = runProjection(projectionInput);

  return (
    <PageContainer>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Retirement Projection
          </h1>
          <p className="text-muted-foreground">
            See how your assets are projected to grow over time.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Assets Over Time</CardTitle>
            <CardDescription>
              Your projected total balance from age {snapshot.currentAge} to {DEFAULT_MAX_AGE}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ProjectionChart
              records={projection.records}
              retirementAge={snapshot.retirementAge}
              currentAge={snapshot.currentAge}
            />
          </CardContent>
        </Card>

        {/* Summary Stats */}
        <div className="grid gap-4 sm:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>At Retirement (Age {snapshot.retirementAge})</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-foreground">
                {new Intl.NumberFormat('en-US', {
                  style: 'currency',
                  currency: 'USD',
                  maximumFractionDigits: 0,
                }).format(projection.summary.projectedRetirementBalance)}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>At Age {DEFAULT_MAX_AGE}</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-foreground">
                {new Intl.NumberFormat('en-US', {
                  style: 'currency',
                  currency: 'USD',
                  maximumFractionDigits: 0,
                }).format(projection.summary.endingBalance)}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Status</CardDescription>
            </CardHeader>
            <CardContent>
              {projection.summary.yearsUntilDepletion === null ? (
                <p className="text-2xl font-bold text-success">Sustainable ✓</p>
              ) : (
                <p className="text-2xl font-bold text-destructive">
                  Depletes at {snapshot.currentAge + projection.summary.yearsUntilDepletion}
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </PageContainer>
  );
}
```

### Success Criteria:

#### Automated Verification:
- [x] Type checking passes: `npm run typecheck`
- [x] Linting passes: `npm run lint`
- [x] Build succeeds: `npm run build`

#### Manual Verification:
- [ ] Navigate to `/plans` shows the chart
- [ ] Chart displays projection data correctly
- [ ] X-axis toggle switches between Age and Year
- [ ] Tooltips appear on hover/tap
- [ ] Retirement reference line is visible
- [ ] Summary cards show correct values
- [ ] Dark mode renders correctly
- [ ] Mobile view is readable (responsive sizing)

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation that the chart displays correctly before proceeding to Phase 3.

---

## Phase 3: Phase Distinction Styling

### Overview
Enhance the chart with visual distinction between accumulation and retirement phases using area fills with different colors.

### Changes Required:

#### 1. Update ProjectionChart with Phase Coloring
**File**: `src/components/projections/ProjectionChart.tsx`

Add phase-aware area fills to visually distinguish accumulation from retirement:

```typescript
// Add to imports
import { Area, ComposedChart } from 'recharts';

// Update chartData to include phase-split balances
const chartData = useMemo(() => {
  return records.map((record) => ({
    ...record,
    xValue: xAxisType === 'age' ? record.age : record.year,
    isRetirement: record.age >= retirementAge,
    accumulationBalance: record.age < retirementAge ? record.balance : null,
    retirementBalance: record.age >= retirementAge ? record.balance : null,
    // For smooth transition, include boundary point in both
    ...(record.age === retirementAge && {
      accumulationBalance: record.balance,
    }),
  }));
}, [records, xAxisType, retirementAge]);

// Replace LineChart with ComposedChart and add Area fills
<ComposedChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
  {/* ... existing CartesianGrid, XAxis, YAxis, Tooltip ... */}

  {/* Accumulation phase area (light primary fill) */}
  <Area
    type="monotone"
    dataKey="accumulationBalance"
    stroke="none"
    fill="hsl(var(--primary))"
    fillOpacity={0.1}
    connectNulls={false}
  />

  {/* Retirement phase area (light success fill) */}
  <Area
    type="monotone"
    dataKey="retirementBalance"
    stroke="none"
    fill="hsl(var(--success))"
    fillOpacity={0.1}
    connectNulls={false}
  />

  {/* Main balance line on top */}
  <Line
    type="monotone"
    dataKey="balance"
    stroke="hsl(var(--primary))"
    strokeWidth={2}
    dot={false}
    activeDot={{...}}
  />
</ComposedChart>
```

Update the legend to include phase colors.

### Success Criteria:

#### Automated Verification:
- [ ] Type checking passes: `npm run typecheck`
- [ ] Linting passes: `npm run lint`
- [ ] Build succeeds: `npm run build`

#### Manual Verification:
- [ ] Accumulation phase has light primary color background
- [ ] Retirement phase has light success/green color background
- [ ] Transition at retirement age is smooth
- [ ] Both phases visible in light and dark mode
- [ ] Legend accurately describes phase colors

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation before proceeding to Phase 4.

---

## Phase 4: Negative Balance Handling & Polish

### Overview
Add visual emphasis for negative balances and polish the overall chart experience.

### Changes Required:

#### 1. Negative Balance Styling
**File**: `src/components/projections/ProjectionChart.tsx`

Add conditional line coloring for negative balances:

```typescript
// Split balance into positive and negative segments
const chartData = useMemo(() => {
  return records.map((record) => ({
    ...record,
    xValue: xAxisType === 'age' ? record.age : record.year,
    isRetirement: record.age >= retirementAge,
    positiveBalance: record.balance >= 0 ? record.balance : 0,
    negativeBalance: record.balance < 0 ? record.balance : null,
  }));
}, [records, xAxisType, retirementAge]);

// Add negative balance line with destructive color
<Line
  type="monotone"
  dataKey="negativeBalance"
  stroke="hsl(var(--destructive))"
  strokeWidth={2}
  dot={false}
  connectNulls={false}
/>
```

#### 2. Enhanced Tooltip Styling
Update tooltip to show additional context:
- Phase indicator (Accumulation/Retirement)
- Inflows/Outflows if non-zero
- Warning for negative balances

#### 3. Accessibility Improvements
- Add proper ARIA labels to toggle buttons
- Ensure sufficient color contrast
- Add screen reader text for chart summary

### Success Criteria:

#### Automated Verification:
- [ ] Type checking passes: `npm run typecheck`
- [ ] Linting passes: `npm run lint`
- [ ] Build succeeds: `npm run build`
- [ ] All existing tests pass: `npm test -- --run`

#### Manual Verification:
- [ ] Negative balances (if any) shown in red
- [ ] Zero baseline visible when negative balances exist
- [ ] Tooltip shows phase and additional details
- [ ] Toggle buttons have proper focus states
- [ ] Chart is usable with keyboard navigation

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation before proceeding to Phase 5.

---

## Phase 5: Unit Tests

### Overview
Add unit tests for the ProjectionChart component.

### Changes Required:

#### 1. Create Test File
**File**: `src/components/projections/__tests__/ProjectionChart.test.tsx`

```typescript
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ProjectionChart } from '../ProjectionChart';
import type { ProjectionRecord } from '@/lib/projections/types';

const mockRecords: ProjectionRecord[] = [
  { age: 30, year: 2025, balance: 100000, inflows: 20000, outflows: 0, balanceByType: { taxDeferred: 50000, taxFree: 30000, taxable: 20000 } },
  { age: 40, year: 2035, balance: 300000, inflows: 25000, outflows: 0, balanceByType: { taxDeferred: 150000, taxFree: 90000, taxable: 60000 } },
  { age: 50, year: 2045, balance: 600000, inflows: 30000, outflows: 0, balanceByType: { taxDeferred: 300000, taxFree: 180000, taxable: 120000 } },
  { age: 65, year: 2060, balance: 1200000, inflows: 24000, outflows: 50000, balanceByType: { taxDeferred: 600000, taxFree: 360000, taxable: 240000 } },
  { age: 80, year: 2075, balance: 800000, inflows: 24000, outflows: 60000, balanceByType: { taxDeferred: 400000, taxFree: 240000, taxable: 160000 } },
];

describe('ProjectionChart', () => {
  it('renders chart with Age toggle active by default', () => {
    render(
      <ProjectionChart
        records={mockRecords}
        retirementAge={65}
        currentAge={30}
      />
    );

    expect(screen.getByText('Age')).toBeInTheDocument();
    expect(screen.getByText('Year')).toBeInTheDocument();
    expect(screen.getByText('View by:')).toBeInTheDocument();
  });

  it('toggles between Age and Year view', () => {
    render(
      <ProjectionChart
        records={mockRecords}
        retirementAge={65}
        currentAge={30}
      />
    );

    const yearButton = screen.getByText('Year');
    fireEvent.click(yearButton);

    // Year button should now be active (has primary styling)
    expect(yearButton).toHaveClass('bg-primary');
  });

  it('shows legend with correct labels', () => {
    render(
      <ProjectionChart
        records={mockRecords}
        retirementAge={65}
        currentAge={30}
      />
    );

    expect(screen.getByText('Total Balance')).toBeInTheDocument();
    expect(screen.getByText('Retirement Start')).toBeInTheDocument();
  });
});
```

### Success Criteria:

#### Automated Verification:
- [ ] All tests pass: `npm test -- --run src/components/projections`
- [ ] Type checking passes: `npm run typecheck`
- [ ] Linting passes: `npm run lint`

#### Manual Verification:
- [ ] Tests cover key functionality
- [ ] No flaky tests

---

## Phase 6: Inflation Adjustment Toggle

### Overview
Add a toggle to switch between nominal (future) dollars and inflation-adjusted (today's) dollars for easier comprehension of future values.

### Changes Required:

#### 1. Update ProjectionChart Props and State
**File**: `src/components/projections/ProjectionChart.tsx`

```typescript
// Add to props interface
interface ProjectionChartProps {
  records: ProjectionRecord[];
  retirementAge: number;
  currentAge: number;
  inflationRate: number; // Add this
}

// Add state for inflation adjustment
const [adjustForInflation, setAdjustForInflation] = useState(false);

// Update chartData to apply inflation adjustment
const chartData = useMemo(() => {
  return records.map((record) => {
    const yearsFromNow = record.age - currentAge;
    const inflationFactor = Math.pow(1 + inflationRate, yearsFromNow);
    const displayBalance = adjustForInflation
      ? record.balance / inflationFactor
      : record.balance;

    return {
      ...record,
      xValue: xAxisType === 'age' ? record.age : record.year,
      isRetirement: record.age >= retirementAge,
      displayBalance,
      // Keep original for tooltip comparison
      nominalBalance: record.balance,
      realBalance: record.balance / inflationFactor,
    };
  });
}, [records, xAxisType, retirementAge, currentAge, inflationRate, adjustForInflation]);
```

#### 2. Add Toggle UI
Add alongside the Age/Year toggle:

```typescript
{/* Inflation Toggle */}
<div className="mb-4 flex flex-wrap items-center gap-4">
  {/* Existing X-Axis Toggle */}
  <div className="flex items-center gap-2">
    <span className="text-sm text-muted-foreground">View by:</span>
    {/* ... existing toggle ... */}
  </div>

  {/* New Inflation Toggle */}
  <div className="flex items-center gap-2">
    <span className="text-sm text-muted-foreground">Values in:</span>
    <div className="inline-flex rounded-lg border border-border p-1">
      <button
        type="button"
        onClick={() => setAdjustForInflation(false)}
        className={`px-3 py-1 text-sm font-medium rounded-md transition-colors ${
          !adjustForInflation
            ? 'bg-primary text-primary-foreground'
            : 'text-muted-foreground hover:text-foreground'
        }`}
      >
        Future $
      </button>
      <button
        type="button"
        onClick={() => setAdjustForInflation(true)}
        className={`px-3 py-1 text-sm font-medium rounded-md transition-colors ${
          adjustForInflation
            ? 'bg-primary text-primary-foreground'
            : 'text-muted-foreground hover:text-foreground'
        }`}
      >
        Today's $
      </button>
    </div>
  </div>
</div>
```

#### 3. Update Line to Use displayBalance
```typescript
<Line
  type="monotone"
  dataKey="displayBalance"  // Changed from "balance"
  stroke="hsl(var(--primary))"
  strokeWidth={2}
  dot={false}
  activeDot={{...}}
/>
```

#### 4. Enhance Tooltip to Show Both Values
```typescript
<Tooltip
  content={({ active, payload }) => {
    if (!active || !payload || !payload[0]) return null;
    const data = payload[0].payload;
    return (
      <div className="rounded-lg border border-border bg-card p-3 shadow-md">
        <p className="text-sm font-medium text-foreground">
          {xAxisType === 'age' ? `Age ${data.age}` : `Year ${data.year}`}
        </p>
        <p className="text-sm text-foreground">
          {adjustForInflation ? "Today's $: " : "Future $: "}
          {formatTooltipCurrency(data.displayBalance)}
        </p>
        <p className="text-xs text-muted-foreground">
          {adjustForInflation
            ? `(${formatTooltipCurrency(data.nominalBalance)} in future dollars)`
            : `(${formatTooltipCurrency(data.realBalance)} in today's dollars)`
          }
        </p>
        <p className="text-xs text-muted-foreground">
          {data.isRetirement ? 'Retirement' : 'Accumulation'}
        </p>
      </div>
    );
  }}
/>
```

#### 5. Update Plans Page to Pass inflationRate
**File**: `src/app/plans/page.tsx`

```typescript
<ProjectionChart
  records={projection.records}
  retirementAge={snapshot.retirementAge}
  currentAge={snapshot.currentAge}
  inflationRate={DEFAULT_INFLATION_RATE}  // Add this
/>
```

### Success Criteria:

#### Automated Verification:
- [ ] Type checking passes: `npm run typecheck`
- [ ] Linting passes: `npm run lint`
- [ ] Build succeeds: `npm run build`
- [ ] Existing tests pass: `npm test -- --run src/components/projections`

#### Manual Verification:
- [ ] "Future $" / "Today's $" toggle appears next to Age/Year toggle
- [ ] Clicking "Today's $" reduces displayed values appropriately
- [ ] Tooltip shows both nominal and real values for context
- [ ] Y-axis scale adjusts when toggling
- [ ] Toggle state persists during Age/Year toggle changes

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation before proceeding to Phase 7.

---

## Phase 7: Year-by-Year Data Table

### Overview
Add a collapsible table below the chart showing detailed year-by-year projection data with CSV export capability.

### Changes Required:

#### 1. Create ProjectionTable Component
**File**: `src/components/projections/ProjectionTable.tsx`

```typescript
'use client';

import { useState, useMemo } from 'react';
import { ChevronDown, Download } from 'lucide-react';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { ProjectionRecord } from '@/lib/projections/types';

interface ProjectionTableProps {
  records: ProjectionRecord[];
  retirementAge: number;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value);
}

export function ProjectionTable({ records, retirementAge }: ProjectionTableProps) {
  const [open, setOpen] = useState(false);

  const tableData = useMemo(() => {
    return records.map((record, index) => ({
      ...record,
      netChange: index > 0
        ? record.balance - records[index - 1].balance
        : record.inflows - record.outflows,
      isRetirement: record.age >= retirementAge,
    }));
  }, [records, retirementAge]);

  const handleExportCSV = () => {
    const headers = ['Age', 'Year', 'Balance', 'Inflows', 'Outflows', 'Net Change', 'Phase'];
    const rows = tableData.map((row) => [
      row.age,
      row.year,
      row.balance.toFixed(2),
      row.inflows.toFixed(2),
      row.outflows.toFixed(2),
      row.netChange.toFixed(2),
      row.isRetirement ? 'Retirement' : 'Accumulation',
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map((row) => row.join(',')),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'retirement-projection.csv';
    link.click();
    URL.revokeObjectURL(link.href);
  };

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="mt-6">
      <div className="flex items-center justify-between">
        <CollapsibleTrigger className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
          <ChevronDown
            className={cn(
              'h-4 w-4 transition-transform duration-200',
              open && 'rotate-180'
            )}
          />
          View Year-by-Year Details
        </CollapsibleTrigger>
        {open && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportCSV}
            className="flex items-center gap-2"
          >
            <Download className="h-4 w-4" />
            Export CSV
          </Button>
        )}
      </div>

      <CollapsibleContent className="mt-4">
        <div className="rounded-lg border border-border overflow-hidden">
          <div className="overflow-x-auto max-h-96 overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 sticky top-0">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Age</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Year</th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">Balance</th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">Inflows</th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">Outflows</th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">Net Change</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Phase</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {tableData.map((row) => (
                  <tr
                    key={row.age}
                    className={cn(
                      'hover:bg-muted/30 transition-colors',
                      row.age === retirementAge && 'bg-primary/5 font-medium'
                    )}
                  >
                    <td className="px-4 py-2 text-foreground">{row.age}</td>
                    <td className="px-4 py-2 text-foreground">{row.year}</td>
                    <td className={cn(
                      'px-4 py-2 text-right',
                      row.balance < 0 ? 'text-destructive' : 'text-foreground'
                    )}>
                      {formatCurrency(row.balance)}
                    </td>
                    <td className="px-4 py-2 text-right text-foreground">
                      {formatCurrency(row.inflows)}
                    </td>
                    <td className="px-4 py-2 text-right text-foreground">
                      {formatCurrency(row.outflows)}
                    </td>
                    <td className={cn(
                      'px-4 py-2 text-right',
                      row.netChange >= 0 ? 'text-success' : 'text-destructive'
                    )}>
                      {row.netChange >= 0 ? '+' : ''}{formatCurrency(row.netChange)}
                    </td>
                    <td className="px-4 py-2">
                      <span className={cn(
                        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
                        row.isRetirement
                          ? 'bg-success/10 text-success'
                          : 'bg-primary/10 text-primary'
                      )}>
                        {row.isRetirement ? 'Retirement' : 'Accumulation'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <p className="mt-2 text-xs text-muted-foreground text-center">
          Showing {records.length} years • Retirement starts at age {retirementAge}
        </p>
      </CollapsibleContent>
    </Collapsible>
  );
}
```

#### 2. Update Index Export
**File**: `src/components/projections/index.ts`

```typescript
export { ProjectionChart } from './ProjectionChart';
export { ProjectionTable } from './ProjectionTable';
```

#### 3. Add to Plans Page
**File**: `src/app/plans/page.tsx`

```typescript
import { ProjectionChart, ProjectionTable } from '@/components/projections';

// ... inside the Card component, after ProjectionChart:
<CardContent>
  <ProjectionChart
    records={projection.records}
    retirementAge={snapshot.retirementAge}
    currentAge={snapshot.currentAge}
    inflationRate={DEFAULT_INFLATION_RATE}
  />
  <ProjectionTable
    records={projection.records}
    retirementAge={snapshot.retirementAge}
  />
</CardContent>
```

### Success Criteria:

#### Automated Verification:
- [ ] Type checking passes: `npm run typecheck`
- [ ] Linting passes: `npm run lint`
- [ ] Build succeeds: `npm run build`
- [ ] All tests pass: `npm test -- --run`

#### Manual Verification:
- [ ] "View Year-by-Year Details" trigger appears below chart
- [ ] Clicking trigger expands/collapses table smoothly
- [ ] Table shows all years with correct data
- [ ] Retirement year row is highlighted
- [ ] Negative balances show in red
- [ ] Positive/negative net changes are color-coded
- [ ] "Export CSV" button appears when table is open
- [ ] CSV downloads with correct data
- [ ] Table scrolls horizontally on mobile
- [ ] Table has vertical scroll with sticky header for many rows
- [ ] Default state is collapsed

**Implementation Note**: After completing this phase, all Story 2 features are complete. Run full test suite and perform comprehensive manual testing.

---

## Testing Strategy

### Unit Tests:
- ProjectionChart renders with mock data
- X-axis toggle switches data keys
- Tooltip renders with correct format
- Legend displays phase information

### Integration Tests:
- Plans page loads projection data
- Chart renders with real projection engine output
- Navigation to /plans works correctly

### Manual Testing Steps:
1. Log in with a test account that has completed onboarding
2. Navigate to `/plans` from the navigation menu
3. Verify chart displays with balance line
4. Click "Year" toggle - verify X-axis changes to calendar years
5. Click "Age" toggle - verify X-axis returns to ages
6. Hover over the chart line - verify tooltip shows balance and phase
7. Verify retirement reference line appears at correct age
8. Resize browser to mobile width - verify chart remains readable
9. Toggle dark mode - verify colors adjust appropriately
10. Check summary cards show correct values
11. Click "Today's $" toggle - verify values decrease (inflation-adjusted)
12. Click "Future $" toggle - verify values return to nominal
13. Verify tooltip shows both nominal and real values
14. Click "View Year-by-Year Details" - verify table expands
15. Verify retirement age row is highlighted in table
16. Click "Export CSV" - verify file downloads with correct data
17. Scroll table horizontally on mobile - verify all columns accessible
18. Collapse table - verify it animates smoothly

## Performance Considerations

- Use `useMemo` for chart data transformations to prevent recalculation on every render
- Recharts uses SVG which handles the data size well (typically 40-60 data points)
- ResponsiveContainer handles window resize efficiently
- Server-side projection calculation prevents client-side computation delay

## Migration Notes

No database migrations required. This feature only adds frontend components.

## References

- Original ticket: [thoughts/personal/tickets/epic-3/projection-modeling/story-2-scope.md](thoughts/personal/tickets/epic-3/projection-modeling/story-2-scope.md)
- Story 2 research: [thoughts/shared/research/2025-12-21-epic-3-story-2-visualization-research.md](thoughts/shared/research/2025-12-21-epic-3-story-2-visualization-research.md)
- Story 1 implementation: [thoughts/shared/plans/2025-12-18-epic-3-story-1-projection-engine.md](thoughts/shared/plans/2025-12-18-epic-3-story-1-projection-engine.md)
- Projection engine: [src/lib/projections/engine.ts](src/lib/projections/engine.ts)
- Projection types: [src/lib/projections/types.ts](src/lib/projections/types.ts)

---

## Recommendations for Deferred Items

The following items were explicitly deferred from Story 2. Here are recommendations for future implementation:

### 1. "What-If" Parameter Editing

**Current State**: Projection runs server-side with user's saved financial data. No client-side parameter adjustment.

**Recommendation**: Implement as Story 3 (core epic goal for AI-driven analysis).

**Approach**:
1. Convert Plans page to client-side data fetching (use `useSWR` or React Query)
2. Create an `AssumptionsPanel` component with editable fields:
   - Expected Return (slider: 4-10%)
   - Inflation Rate (slider: 1-5%)
   - Retirement Age (number input)
   - Monthly Expenses (currency input)
3. Use `POST /api/projections/calculate` with override parameters
4. Debounce inputs (300ms) to prevent excessive API calls
5. Show loading state on chart during recalculation

**Component Structure**:
```
src/components/projections/
├── ProjectionChart.tsx      # Existing
├── ProjectionTable.tsx      # Existing
├── AssumptionsPanel.tsx     # New - editable assumptions form
├── ProjectionContainer.tsx  # New - orchestrates data fetching + state
└── index.ts
```

**Complexity**: Medium
**Dependencies**: Story 2 complete

---

### 2. Portfolio-Level Breakdowns (Stacked Chart)

**Current State**: `ProjectionRecord.balanceByType` already contains `taxDeferred`, `taxFree`, `taxable` breakdown.

**Recommendation**: Consider for future epic focused on tax optimization visualization.

**Approach**:
1. Add a "View" toggle: "Total Balance" | "By Account Type"
2. Use Recharts `AreaChart` with stacked areas for breakdown view
3. Color coding:
   - Tax-Deferred (401k, IRA): Primary color
   - Tax-Free (Roth): Success/green
   - Taxable (Brokerage): Warning/amber
4. Update legend and tooltips to show all three categories

**Complexity**: Medium
**Dependencies**: Story 2 complete

---

### 3. Monte Carlo / Probabilistic Bands

**Current State**: Engine is deterministic. No probability simulation exists.

**Recommendation**: Major feature for future epic (not recommended for near-term).

**Approach**:
1. Create new engine function `runMonteCarloProjection()` that runs N simulations (e.g., 1000)
2. Calculate percentile bands (10th, 25th, 50th, 75th, 90th)
3. Use Recharts `Area` components for confidence bands
4. Consider Web Worker for computation to avoid blocking UI
5. Add toggle to switch between deterministic and probabilistic views

**Complexity**: High (1-2 weeks)
**Dependencies**: Significant engine work, performance optimization

---

### Priority Order for Future Stories

| Priority | Item | Effort | Value |
|----------|------|--------|-------|
| 1 | What-If Parameter Editing | Medium | High (core epic goal) |
| 2 | Portfolio Breakdowns | Medium | Medium |
| 3 | Monte Carlo Bands | High | High (but complex) |

**Suggested Story 3**: "What-If Analysis" - Interactive projection exploration with editable parameters.