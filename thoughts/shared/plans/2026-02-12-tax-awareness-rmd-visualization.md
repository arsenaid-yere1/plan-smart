# Tax Awareness: RMD Enforcement & Tax-Categorized Balance Visualization

## Overview

This plan implements two key tax awareness features for PlanSmart:

1. **RMD (Required Minimum Distribution) Enforcement**: Force minimum withdrawals from tax-deferred accounts starting at age 73, complying with IRS regulations and improving projection accuracy for users with significant 401k/IRA balances.

2. **Tax-Categorized Balance Visualization**: Add a stacked area chart showing the breakdown of portfolio balances by tax category (taxDeferred, taxFree, taxable), using data that's already calculated but not displayed.

## Current State Analysis

### RMD Handling
- **Current**: No RMD enforcement. The projection engine at [engine.ts:28-57](src/lib/projections/engine.ts#L28-L57) uses a fixed withdrawal order (taxable → taxDeferred → taxFree) without considering RMD requirements.
- **Gap**: Users 73+ with significant tax-deferred assets receive inaccurate projections because RMDs are not modeled.
- **Documented Deferral**: RMD was explicitly deferred in original Epic 3 planning (per research document).

### Tax-Categorized Balances
- **Current**: `balanceByType` data is calculated in every `ProjectionRecord` ([engine.ts:433-437](src/lib/projections/engine.ts#L433-L437)) but **not visualized** in the chart.
- **Existing Pattern**: The chart already implements stacked areas for reserve visualization ([ProjectionChart.tsx:808-830](src/components/projections/ProjectionChart.tsx#L808-L830)) using `stackId`.
- **Quick Win**: The data exists; we just need to add a view toggle and visualization.

### Key Discoveries
- IRS Uniform Lifetime Table provides RMD divisors by age (starting at 73)
- RMDs are calculated per tax-deferred account, but for projection purposes we can use aggregate tax-deferred balance
- The current withdrawal strategy must change to: **RMD from tax-deferred first, then normal ordering**
- Chart supports multiple view modes (`balance` | `spending`), can add `tax-breakdown`

## Desired End State

After implementation:

1. **RMD Enforcement**:
   - Projections for users 73+ force minimum withdrawals from tax-deferred accounts
   - RMD is withdrawn even if expenses are fully covered by other income
   - UI shows RMD-related data in tooltips and optionally in a summary
   - Warning system alerts users approaching RMD age

2. **Tax-Categorized Visualization**:
   - New view mode in ProjectionChart shows stacked areas for taxDeferred, taxFree, taxable
   - Tooltips show breakdown by account type
   - Legend clearly identifies each category
   - Toggle between "Total Balance" and "By Tax Category" views

### Verification
- Unit tests verify RMD calculations match IRS tables
- Integration tests confirm withdrawal strategy change at age 73
- Visual inspection confirms stacked chart renders correctly
- Export functionality includes tax breakdown columns

## What We're NOT Doing

- **Tax liability calculation** - No computation of actual taxes owed (Phase 2)
- **Roth conversion optimization** - No conversion strategies (Phase 3)
- **State tax integration** - State field remains unused (Phase 4)
- **Per-account RMD tracking** - Using aggregate tax-deferred balance, not individual accounts
- **RMD deferral options** - Not modeling first-year RMD deferral to April 1
- **Inherited IRA rules** - Not applicable to primary user projections

## Implementation Approach

We'll implement in 4 phases:
1. **Phase 1**: RMD calculation infrastructure (types, tables, calculation function)
2. **Phase 2**: Engine integration (modify withdrawal strategy for RMD)
3. **Phase 3**: Tax-categorized balance visualization
4. **Phase 4**: UI polish and warnings

---

## Phase 1: RMD Calculation Infrastructure

### Overview
Add IRS Uniform Lifetime Table and RMD calculation function. This phase is backend-only with no UI changes.

### Changes Required

#### 1. Add RMD Types
**File**: `src/lib/projections/types.ts`
**Changes**: Add RMD-related types

```typescript
/**
 * RMD (Required Minimum Distribution) configuration
 */
export interface RMDConfig {
  /** Whether RMD enforcement is enabled (default: true) */
  enabled: boolean;
  /** Age at which RMDs begin (default: 73, will be 75 in 2033+) */
  startAge: number;
}

/**
 * RMD tracking for a projection year
 */
export interface RMDTracking {
  /** Whether RMD applies this year */
  rmdApplies: boolean;
  /** Calculated RMD amount for the year */
  rmdRequired: number;
  /** Actual withdrawal from tax-deferred accounts */
  rmdTaken: number;
  /** Amount withdrawn beyond RMD (for expenses) */
  excessOverRmd: number;
}
```

Add to `ProjectionRecord` interface:
```typescript
export interface ProjectionRecord {
  // ... existing fields ...

  /** RMD tracking (only populated if RMD applies) */
  rmd?: RMDTracking;
}
```

Add to `ProjectionInput` interface:
```typescript
export interface ProjectionInput {
  // ... existing fields ...

  /** RMD configuration (default: enabled, startAge 73) */
  rmdConfig?: RMDConfig;
}
```

#### 2. Add IRS Uniform Lifetime Table
**File**: `src/lib/projections/rmd.ts` (new file)
**Changes**: Create RMD calculation module

```typescript
/**
 * IRS Uniform Lifetime Table (2024)
 * Used for RMD calculations when account owner is the sole beneficiary
 * or beneficiary is not more than 10 years younger than owner
 *
 * Table shows life expectancy (distribution period) by age
 * RMD = Prior year-end balance / Distribution period
 */
export const UNIFORM_LIFETIME_TABLE: Record<number, number> = {
  73: 26.5,
  74: 25.5,
  75: 24.6,
  76: 23.7,
  77: 22.9,
  78: 22.0,
  79: 21.1,
  80: 20.2,
  81: 19.4,
  82: 18.5,
  83: 17.7,
  84: 16.8,
  85: 16.0,
  86: 15.2,
  87: 14.4,
  88: 13.7,
  89: 12.9,
  90: 12.2,
  91: 11.5,
  92: 10.8,
  93: 10.1,
  94: 9.5,
  95: 8.9,
  96: 8.4,
  97: 7.8,
  98: 7.3,
  99: 6.8,
  100: 6.4,
  101: 6.0,
  102: 5.6,
  103: 5.2,
  104: 4.9,
  105: 4.6,
  106: 4.3,
  107: 4.1,
  108: 3.9,
  109: 3.7,
  110: 3.5,
  111: 3.4,
  112: 3.3,
  113: 3.1,
  114: 3.0,
  115: 2.9,
  116: 2.8,
  117: 2.7,
  118: 2.5,
  119: 2.3,
  120: 2.0,
};

/**
 * Default RMD start age (SECURE 2.0 Act)
 * - 73 for those turning 72 after Dec 31, 2022
 * - 75 for those turning 74 after Dec 31, 2032
 */
export const DEFAULT_RMD_START_AGE = 73;

/**
 * Get the distribution period (life expectancy factor) for a given age
 * @param age - Account owner's age
 * @returns Distribution period, or null if age is below RMD start age
 */
export function getDistributionPeriod(age: number): number | null {
  if (age < DEFAULT_RMD_START_AGE) {
    return null;
  }
  // For ages beyond table (120+), use minimum
  return UNIFORM_LIFETIME_TABLE[Math.min(age, 120)] ?? 2.0;
}

/**
 * Calculate Required Minimum Distribution
 * @param priorYearEndBalance - Tax-deferred account balance at end of prior year
 * @param age - Account owner's age in the distribution year
 * @returns RMD amount, or 0 if age is below RMD start age
 */
export function calculateRMD(priorYearEndBalance: number, age: number): number {
  const distributionPeriod = getDistributionPeriod(age);

  if (distributionPeriod === null || priorYearEndBalance <= 0) {
    return 0;
  }

  return priorYearEndBalance / distributionPeriod;
}

/**
 * Default RMD configuration
 */
export const DEFAULT_RMD_CONFIG = {
  enabled: true,
  startAge: DEFAULT_RMD_START_AGE,
};
```

#### 3. Add RMD Tests
**File**: `src/lib/projections/__tests__/rmd.test.ts` (new file)

```typescript
import { describe, it, expect } from 'vitest';
import {
  calculateRMD,
  getDistributionPeriod,
  UNIFORM_LIFETIME_TABLE,
  DEFAULT_RMD_START_AGE,
} from '../rmd';

describe('RMD Calculations', () => {
  describe('getDistributionPeriod', () => {
    it('returns null for ages below RMD start age', () => {
      expect(getDistributionPeriod(72)).toBeNull();
      expect(getDistributionPeriod(65)).toBeNull();
    });

    it('returns correct distribution period for RMD ages', () => {
      expect(getDistributionPeriod(73)).toBe(26.5);
      expect(getDistributionPeriod(75)).toBe(24.6);
      expect(getDistributionPeriod(85)).toBe(16.0);
    });

    it('handles ages beyond table (120+)', () => {
      expect(getDistributionPeriod(121)).toBe(2.0);
      expect(getDistributionPeriod(130)).toBe(2.0);
    });
  });

  describe('calculateRMD', () => {
    it('returns 0 for ages below RMD start age', () => {
      expect(calculateRMD(500000, 72)).toBe(0);
      expect(calculateRMD(1000000, 65)).toBe(0);
    });

    it('returns 0 for zero or negative balance', () => {
      expect(calculateRMD(0, 75)).toBe(0);
      expect(calculateRMD(-1000, 75)).toBe(0);
    });

    it('calculates correct RMD at age 73', () => {
      // $500,000 / 26.5 = $18,867.92
      const rmd = calculateRMD(500000, 73);
      expect(rmd).toBeCloseTo(18867.92, 2);
    });

    it('calculates correct RMD at age 85', () => {
      // $300,000 / 16.0 = $18,750
      const rmd = calculateRMD(300000, 85);
      expect(rmd).toBe(18750);
    });

    it('RMD percentage increases with age', () => {
      const balance = 100000;
      const rmd73 = calculateRMD(balance, 73);
      const rmd85 = calculateRMD(balance, 85);
      const rmd95 = calculateRMD(balance, 95);

      // RMD percentage: 73 = 3.77%, 85 = 6.25%, 95 = 11.24%
      expect(rmd85).toBeGreaterThan(rmd73);
      expect(rmd95).toBeGreaterThan(rmd85);
    });
  });
});
```

### Success Criteria

#### Automated Verification
- [x] New file `src/lib/projections/rmd.ts` exists
- [x] Types added to `src/lib/projections/types.ts`
- [x] All RMD unit tests pass: `npm test src/lib/projections/__tests__/rmd.test.ts`
- [x] TypeScript compiles without errors: `npm run typecheck`
- [x] Linting passes: `npm run lint`

#### Manual Verification
- [ ] Review IRS table values against official IRS Publication 590-B

**Implementation Note**: Pause here for automated verification before proceeding to Phase 2.

---

## Phase 2: Engine Integration

### Overview
Modify the projection engine to enforce RMD withdrawals from tax-deferred accounts before applying the normal withdrawal strategy.

### Changes Required

#### 1. Update Withdrawal Strategy
**File**: `src/lib/projections/engine.ts`
**Changes**: Add RMD-aware withdrawal logic

Add import at top of file:
```typescript
import { calculateRMD, DEFAULT_RMD_CONFIG } from './rmd';
```

Create new function for RMD-aware withdrawals:
```typescript
/**
 * Execute tax-aware withdrawal strategy with RMD enforcement
 *
 * When RMD applies (age 73+):
 * 1. Calculate and withdraw RMD from tax-deferred first
 * 2. If more needed, continue with normal order (taxable → remaining taxDeferred → taxFree)
 *
 * @param amountNeeded - Total withdrawal needed for expenses
 * @param balances - Current account balances by tax type
 * @param rmdRequired - Required minimum distribution for this year (0 if not applicable)
 * @returns Withdrawal result with amounts by type and any shortfall
 */
export function withdrawFromAccountsWithRMD(
  amountNeeded: number,
  balances: BalanceByType,
  rmdRequired: number
): WithdrawalResult & { rmdTracking?: RMDTracking } {
  const withdrawals: BalanceByType = { taxDeferred: 0, taxFree: 0, taxable: 0 };
  let remaining = amountNeeded;

  // Track RMD specifics
  let rmdTaken = 0;
  const rmdApplies = rmdRequired > 0;

  // Step 1: If RMD applies, withdraw RMD from tax-deferred first
  if (rmdApplies && balances.taxDeferred > 0) {
    // Take the full RMD (or whatever is available if less)
    const rmdWithdrawal = Math.min(rmdRequired, balances.taxDeferred);
    withdrawals.taxDeferred = rmdWithdrawal;
    rmdTaken = rmdWithdrawal;

    // RMD may cover some or all of the needed amount
    remaining = Math.max(0, remaining - rmdWithdrawal);
  }

  // Step 2: If more needed, continue with normal ordering
  // (taxable first, then any remaining tax-deferred, then tax-free)

  // 2a. Withdraw from taxable accounts
  if (remaining > 0 && balances.taxable > 0) {
    const fromTaxable = Math.min(remaining, balances.taxable);
    withdrawals.taxable = fromTaxable;
    remaining -= fromTaxable;
  }

  // 2b. Withdraw additional from tax-deferred (beyond RMD)
  if (remaining > 0 && balances.taxDeferred > withdrawals.taxDeferred) {
    const availableDeferred = balances.taxDeferred - withdrawals.taxDeferred;
    const fromDeferred = Math.min(remaining, availableDeferred);
    withdrawals.taxDeferred += fromDeferred;
    remaining -= fromDeferred;
  }

  // 2c. Withdraw from tax-free accounts last
  if (remaining > 0 && balances.taxFree > 0) {
    const fromTaxFree = Math.min(remaining, balances.taxFree);
    withdrawals.taxFree = fromTaxFree;
    remaining -= fromTaxFree;
  }

  // Calculate excess over RMD
  const excessOverRmd = rmdApplies
    ? Math.max(0, withdrawals.taxDeferred - rmdRequired)
    : 0;

  return {
    withdrawals,
    shortfall: remaining,
    rmdTracking: rmdApplies ? {
      rmdApplies: true,
      rmdRequired,
      rmdTaken,
      excessOverRmd,
    } : undefined,
  };
}
```

#### 2. Modify runProjection Function
**File**: `src/lib/projections/engine.ts`
**Changes**: Update drawdown phase to use RMD-aware withdrawals

In the `runProjection` function, locate the drawdown phase section (around line 332) and modify:

```typescript
// Inside the drawdown phase (else block around line 332):

// Calculate RMD if applicable
const rmdConfig = input.rmdConfig ?? DEFAULT_RMD_CONFIG;
let rmdRequired = 0;

if (rmdConfig.enabled && age >= rmdConfig.startAge) {
  // RMD is based on PRIOR year-end balance
  // For first year, use current balance; otherwise use previous record
  const priorYearDeferredBalance = age === input.currentAge
    ? input.balancesByType.taxDeferred
    : records[records.length - 1]?.balanceByType.taxDeferred ?? 0;

  rmdRequired = calculateRMD(priorYearDeferredBalance, age);
}

// ... existing expense calculations ...

// Epic 10.2: Calculate reserve-constrained spending
const spendingResult = calculateReserveConstrainedSpending(
  balances,
  essentialExpenses,
  discretionaryExpenses,
  totalIncome,
  input.reserveFloor
);

// Determine total withdrawal needed
// If RMD is greater than spending needs, we still must withdraw the RMD
const withdrawalNeeded = Math.max(spendingResult.totalWithdrawal, rmdRequired);

// Execute RMD-aware withdrawal
const withdrawalResult = withdrawFromAccountsWithRMD(
  withdrawalNeeded,
  balances,
  rmdRequired
);
withdrawalsByType = withdrawalResult.withdrawals;

// Track RMD in record
const currentRmd = withdrawalResult.rmdTracking;

// ... rest of existing logic ...
```

Update the record creation to include RMD tracking:
```typescript
records.push({
  // ... existing fields ...
  rmd: currentRmd,
});
```

#### 3. Update Engine Tests
**File**: `src/lib/projections/__tests__/engine.test.ts`
**Changes**: Add RMD integration tests

```typescript
describe('RMD Enforcement', () => {
  const baseInput: ProjectionInput = {
    currentAge: 73,
    retirementAge: 65,
    maxAge: 90,
    balancesByType: {
      taxDeferred: 500000,
      taxFree: 100000,
      taxable: 50000,
    },
    annualContribution: 0,
    contributionAllocation: { taxDeferred: 60, taxFree: 30, taxable: 10 },
    expectedReturn: 0.06,
    inflationRate: 0.025,
    contributionGrowthRate: 0,
    annualEssentialExpenses: 40000,
    annualDiscretionaryExpenses: 20000,
    annualExpenses: 60000,
    annualHealthcareCosts: 8000,
    healthcareInflationRate: 0.05,
    incomeStreams: [
      {
        id: 'ss',
        name: 'Social Security',
        type: 'social_security',
        annualAmount: 30000,
        startAge: 67,
        inflationAdjusted: true,
        isGuaranteed: true,
      },
    ],
    annualDebtPayments: 0,
  };

  it('enforces RMD at age 73', () => {
    const result = runProjection(baseInput);
    const record73 = result.records[0];

    expect(record73.rmd).toBeDefined();
    expect(record73.rmd?.rmdApplies).toBe(true);
    // $500,000 / 26.5 = $18,867.92
    expect(record73.rmd?.rmdRequired).toBeCloseTo(18867.92, 2);
    expect(record73.rmd?.rmdTaken).toBeGreaterThan(0);
  });

  it('withdraws RMD even when not needed for expenses', () => {
    // High income covers all expenses
    const highIncomeInput = {
      ...baseInput,
      incomeStreams: [
        {
          id: 'ss',
          name: 'Social Security',
          type: 'social_security' as const,
          annualAmount: 80000,
          startAge: 67,
          inflationAdjusted: true,
          isGuaranteed: true,
        },
      ],
    };

    const result = runProjection(highIncomeInput);
    const record73 = result.records[0];

    // RMD should still be taken
    expect(record73.withdrawalsByType?.taxDeferred).toBeGreaterThan(0);
    expect(record73.rmd?.rmdTaken).toBeGreaterThan(0);
  });

  it('does not enforce RMD before age 73', () => {
    const youngInput = { ...baseInput, currentAge: 70 };
    const result = runProjection(youngInput);

    // First 3 years (70, 71, 72) should have no RMD
    for (let i = 0; i < 3; i++) {
      expect(result.records[i].rmd).toBeUndefined();
    }

    // Year at age 73 should have RMD
    expect(result.records[3].rmd?.rmdApplies).toBe(true);
  });

  it('can disable RMD enforcement via config', () => {
    const disabledRMDInput = {
      ...baseInput,
      rmdConfig: { enabled: false, startAge: 73 },
    };

    const result = runProjection(disabledRMDInput);

    // Should have no RMD tracking
    expect(result.records[0].rmd).toBeUndefined();
  });
});
```

### Success Criteria

#### Automated Verification
- [x] All existing engine tests still pass: `npm test src/lib/projections/__tests__/engine.test.ts`
- [x] New RMD integration tests pass
- [x] TypeScript compiles without errors: `npm run typecheck`
- [x] Linting passes: `npm run lint`

#### Manual Verification
- [ ] Create a test scenario: 73-year-old with $500k in 401k
- [ ] Verify first-year RMD shows as ~$18,868 in projection
- [ ] Verify RMD increases as percentage of balance over time
- [ ] Verify RMD is taken even when other income covers expenses

**Implementation Note**: Pause here for manual verification before proceeding to Phase 3.

---

## Phase 3: Tax-Categorized Balance Visualization

### Overview
Add a new view mode to ProjectionChart that displays the balance breakdown by tax category using stacked areas. This leverages existing `balanceByType` data.

### Changes Required

#### 1. Update ViewMode Type
**File**: `src/components/projections/ProjectionChart.tsx`
**Changes**: Add `tax-breakdown` view mode

Update type at line 18:
```typescript
type ViewMode = 'balance' | 'spending' | 'tax-breakdown';
```

#### 2. Add Tax Breakdown Data Transformation
**File**: `src/components/projections/ProjectionChart.tsx`
**Changes**: Add memo for tax-categorized chart data

Add after the `chartDataWithReserve` memo (around line 193):
```typescript
// Tax-categorized balance data transformation
const taxBreakdownData = useMemo(() => {
  if (viewMode !== 'tax-breakdown') return null;

  const safeInflationRate = inflationRate ?? 0.025;

  return records.map((record) => {
    const yearsFromNow = record.age - currentAge;
    const inflationFactor = Math.pow(1 + safeInflationRate, yearsFromNow);

    // Get balances by type
    const taxDeferred = record.balanceByType.taxDeferred;
    const taxFree = record.balanceByType.taxFree;
    const taxable = record.balanceByType.taxable;

    // Apply inflation adjustment if enabled
    const displayTaxDeferred = adjustForInflation ? taxDeferred / inflationFactor : taxDeferred;
    const displayTaxFree = adjustForInflation ? taxFree / inflationFactor : taxFree;
    const displayTaxable = adjustForInflation ? taxable / inflationFactor : taxable;

    return {
      ...record,
      xValue: xAxisType === 'age' ? record.age : record.year,
      displayTaxDeferred: Math.max(0, displayTaxDeferred),
      displayTaxFree: Math.max(0, displayTaxFree),
      displayTaxable: Math.max(0, displayTaxable),
      // Total for tooltip
      displayTotal: Math.max(0, displayTaxDeferred + displayTaxFree + displayTaxable),
      // Nominal values for tooltip
      nominalTaxDeferred: taxDeferred,
      nominalTaxFree: taxFree,
      nominalTaxable: taxable,
      isRetirement: record.age >= retirementAge,
    };
  });
}, [records, viewMode, currentAge, inflationRate, adjustForInflation, xAxisType, retirementAge]);

// Y-axis domain for tax breakdown view
const taxBreakdownYDomain = useMemo((): [number, 'auto'] => {
  if (!taxBreakdownData || taxBreakdownData.length === 0) return [0, 'auto'];

  const maxTotal = Math.max(
    ...taxBreakdownData.map(d => d.displayTaxDeferred + d.displayTaxFree + d.displayTaxable)
  );

  if (!Number.isFinite(maxTotal) || maxTotal <= 0) return [0, 'auto'];
  return [0, maxTotal * 1.05];
}, [taxBreakdownData]);
```

#### 3. Add View Mode Toggle Button
**File**: `src/components/projections/ProjectionChart.tsx`
**Changes**: Update toggle controls section (around line 437)

Replace the existing view mode toggle with:
```typescript
{/* View Mode Toggle - always show for tax breakdown */}
<div className="flex items-center gap-2">
  <span id="view-mode-label" className="text-sm text-muted-foreground">
    View:
  </span>
  <div
    className="inline-flex rounded-lg border border-border p-1"
    role="group"
    aria-labelledby="view-mode-label"
  >
    <button
      type="button"
      onClick={() => setViewMode('balance')}
      aria-pressed={viewMode === 'balance'}
      className={`rounded-md px-3 py-1 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 ${
        viewMode === 'balance'
          ? 'bg-primary text-primary-foreground'
          : 'text-muted-foreground hover:text-foreground'
      }`}
    >
      Balance
    </button>
    <button
      type="button"
      onClick={() => setViewMode('tax-breakdown')}
      aria-pressed={viewMode === 'tax-breakdown'}
      className={`rounded-md px-3 py-1 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 ${
        viewMode === 'tax-breakdown'
          ? 'bg-primary text-primary-foreground'
          : 'text-muted-foreground hover:text-foreground'
      }`}
    >
      By Account Type
    </button>
    {spendingEnabled && (
      <button
        type="button"
        onClick={() => setViewMode('spending')}
        aria-pressed={viewMode === 'spending'}
        className={`rounded-md px-3 py-1 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 ${
          viewMode === 'spending'
            ? 'bg-primary text-primary-foreground'
            : 'text-muted-foreground hover:text-foreground'
        }`}
      >
        Spending
      </button>
    )}
  </div>
</div>
```

#### 4. Add Tax Breakdown Chart Elements
**File**: `src/components/projections/ProjectionChart.tsx`
**Changes**: Add stacked areas for tax categories

Update the ComposedChart data prop (around line 481):
```typescript
<ComposedChart
  data={
    viewMode === 'spending'
      ? spendingData
      : viewMode === 'tax-breakdown'
        ? taxBreakdownData
        : chartDataWithReserve ?? chartData
  }
  // ... rest of props
>
```

Update YAxis domain (around line 506):
```typescript
<YAxis
  domain={
    viewMode === 'spending'
      ? yAxisDomain
      : viewMode === 'tax-breakdown'
        ? taxBreakdownYDomain
        : yAxisDomain
  }
  // ... rest of props
/>
```

Add tax breakdown chart elements after the spending view elements (around line 738):
```typescript
{/* Tax Breakdown view elements */}
{viewMode === 'tax-breakdown' && taxBreakdownData && (
  <>
    {/* Retirement age marker */}
    <ReferenceLine
      x={retirementXValue}
      stroke="hsl(var(--muted-foreground))"
      strokeDasharray="5 5"
      label={{
        value: 'Retirement',
        position: 'top',
        fill: LABEL_COLORS.muted,
        fontSize: 12,
      }}
    />
    {/* Stacked areas for tax categories */}
    {/* Order: Taxable (bottom), Tax-Deferred (middle), Tax-Free (top) */}
    <Area
      type="monotone"
      dataKey="displayTaxable"
      stackId="tax"
      fill="hsl(215 20% 65%)"
      stroke="hsl(215 20% 45%)"
      strokeWidth={1}
      name="Taxable"
    />
    <Area
      type="monotone"
      dataKey="displayTaxDeferred"
      stackId="tax"
      fill="hsl(35 90% 55%)"
      stroke="hsl(35 90% 40%)"
      strokeWidth={1}
      name="Tax-Deferred"
    />
    <Area
      type="monotone"
      dataKey="displayTaxFree"
      stackId="tax"
      fill="hsl(145 60% 45%)"
      stroke="hsl(145 60% 35%)"
      strokeWidth={1}
      name="Tax-Free"
    />
  </>
)}
```

#### 5. Add Tax Breakdown Tooltip
**File**: `src/components/projections/ProjectionChart.tsx`
**Changes**: Add tooltip handling for tax breakdown view

In the Tooltip content function (around line 517), add handling for tax breakdown:
```typescript
// Handle tax breakdown view tooltip
if (viewMode === 'tax-breakdown') {
  const data = payload[0].payload as (typeof taxBreakdownData)[0];

  return (
    <div className="rounded-lg border border-border bg-card p-3 shadow-md">
      <p className="text-sm font-medium text-foreground">
        {xAxisType === 'age' ? `Age ${data.age}` : `Year ${data.year}`}
      </p>
      <p className="text-sm font-medium text-foreground">
        Total: {formatTooltipCurrency(data.displayTotal)}
      </p>
      <div className="mt-2 space-y-1 text-sm">
        <p style={{ color: 'hsl(145 60% 45%)' }}>
          Tax-Free (Roth): {formatTooltipCurrency(data.displayTaxFree)}
        </p>
        <p style={{ color: 'hsl(35 90% 55%)' }}>
          Tax-Deferred (401k/IRA): {formatTooltipCurrency(data.displayTaxDeferred)}
        </p>
        <p style={{ color: 'hsl(215 20% 65%)' }}>
          Taxable (Brokerage): {formatTooltipCurrency(data.displayTaxable)}
        </p>
      </div>
      {!adjustForInflation && (
        <p className="mt-2 text-xs text-muted-foreground">
          Values in future dollars
        </p>
      )}
      <p className="mt-1 text-xs text-muted-foreground">
        {data.isRetirement ? 'Retirement Phase' : 'Accumulation Phase'}
      </p>
    </div>
  );
}
```

#### 6. Add Tax Breakdown Legend
**File**: `src/components/projections/ProjectionChart.tsx`
**Changes**: Add legend for tax breakdown view (in the legend section around line 891)

Add new legend section:
```typescript
{viewMode === 'tax-breakdown' ? (
  <>
    <div className="flex items-center gap-2">
      <div
        className="h-3 w-3 rounded-sm"
        style={{ backgroundColor: 'hsl(145 60% 45%)' }}
      />
      <span>Tax-Free (Roth)</span>
    </div>
    <div className="flex items-center gap-2">
      <div
        className="h-3 w-3 rounded-sm"
        style={{ backgroundColor: 'hsl(35 90% 55%)' }}
      />
      <span>Tax-Deferred (401k/IRA)</span>
    </div>
    <div className="flex items-center gap-2">
      <div
        className="h-3 w-3 rounded-sm"
        style={{ backgroundColor: 'hsl(215 20% 65%)' }}
      />
      <span>Taxable (Brokerage)</span>
    </div>
    <div className="flex items-center gap-2">
      <div className="h-4 w-0.5 border-l-2 border-dashed border-muted-foreground" />
      <span>Retirement Start</span>
    </div>
  </>
) : /* existing legend conditions */}
```

### Success Criteria

#### Automated Verification
- [x] TypeScript compiles without errors: `npm run typecheck`
- [x] Linting passes: `npm run lint`
- [x] Existing chart tests still pass
- [x] Build succeeds: `npm run build`

#### Manual Verification
- [ ] Navigate to plans page with projection data
- [ ] Click "By Account Type" toggle
- [ ] Verify stacked area chart shows three distinct colors
- [ ] Verify tooltip shows breakdown with amounts for each category
- [ ] Verify legend displays all three account types
- [ ] Verify inflation toggle works correctly in new view
- [ ] Verify retirement age marker appears
- [ ] Switch between views (Balance, By Account Type, Spending) works smoothly

**Implementation Note**: Pause here for manual verification before proceeding to Phase 4.

---

## Phase 4: UI Polish and RMD Warnings

### Overview
Add user-facing warnings and polish for RMD feature, including tooltip enhancement and projection warnings.

### Changes Required

#### 1. Add RMD to Tooltip (Balance View)
**File**: `src/components/projections/ProjectionChart.tsx`
**Changes**: Show RMD info in balance view tooltip when applicable

In the balance view tooltip section, add after income/expenses display:
```typescript
{/* RMD Information */}
{data.rmd?.rmdApplies && (
  <div className="mt-2 pt-2 border-t border-border">
    <p className="text-xs text-amber-600 dark:text-amber-400">
      RMD: {formatTooltipCurrency(data.rmd.rmdRequired)}
    </p>
    <p className="text-xs text-muted-foreground">
      Taken: {formatTooltipCurrency(data.rmd.rmdTaken)}
    </p>
  </div>
)}
```

#### 2. Add RMD Warning to Warnings System
**File**: `src/lib/projections/warnings.ts`
**Changes**: Add warning for users approaching RMD age

```typescript
// Add to warning generation logic
if (input.currentAge >= 70 && input.currentAge < 73) {
  const taxDeferredBalance = input.balancesByType.taxDeferred;
  if (taxDeferredBalance > 100000) {
    warnings.push({
      type: 'info',
      category: 'rmd',
      message: `You're approaching age 73 when Required Minimum Distributions (RMDs) begin. With ${formatCurrency(taxDeferredBalance)} in tax-deferred accounts, you'll be required to withdraw a minimum amount each year starting at age 73.`,
    });
  }
}

// Add warning for large RMDs
if (result.records.some(r => r.rmd?.rmdRequired && r.rmd.rmdRequired > 50000)) {
  warnings.push({
    type: 'info',
    category: 'rmd',
    message: 'Your projected RMDs exceed $50,000/year. Consider Roth conversions before age 73 to reduce future RMDs and tax burden.',
  });
}
```

#### 3. Add RMD Columns to Export
**File**: `src/hooks/useProjectionExport.ts`
**Changes**: Include RMD data in CSV and PDF exports

Update CSV headers:
```typescript
const headers = [
  'Age',
  'Year',
  'Balance',
  'Tax-Deferred',
  'Tax-Free',
  'Taxable',
  'Income',
  'Expenses',
  'RMD Required',
  'RMD Taken',
  'Net Change',
  'Phase',
];
```

Update row data:
```typescript
const rows = records.map(record => [
  record.age,
  record.year,
  formatCurrency(record.balance),
  formatCurrency(record.balanceByType.taxDeferred),
  formatCurrency(record.balanceByType.taxFree),
  formatCurrency(record.balanceByType.taxable),
  formatCurrency(record.inflows),
  formatCurrency(record.outflows),
  formatCurrency(record.rmd?.rmdRequired ?? 0),
  formatCurrency(record.rmd?.rmdTaken ?? 0),
  formatCurrency(record.inflows - record.outflows),
  record.activePhaseName ?? 'N/A',
]);
```

### Success Criteria

#### Automated Verification
- [x] TypeScript compiles without errors: `npm run typecheck`
- [x] Linting passes: `npm run lint`
- [x] All tests pass: `npm test` (projection tests - UI component tests have pre-existing issues)
- [x] Build succeeds: `npm run build`

#### Manual Verification
- [ ] Hover over data point at age 73+ to see RMD in tooltip
- [ ] Export CSV and verify new columns appear
- [ ] View projection for user aged 70-72 with significant tax-deferred balance and verify warning appears
- [ ] Verify warning about large RMDs appears when applicable

---

## Testing Strategy

### Unit Tests
- RMD calculation tests (distribution period, calculation accuracy)
- Withdrawal function tests with RMD scenarios
- Engine integration tests for RMD enforcement

### Integration Tests
- End-to-end projection with RMD-aged user
- API route tests with RMD parameters
- Export functionality with new columns

### Manual Testing Steps
1. Create user profile: Age 73, $500k in 401k, minimal taxable accounts
2. Run projection and verify RMD appears in year 1
3. Toggle to "By Account Type" view and verify visualization
4. Hover over data points to verify tooltips
5. Export to CSV and verify all columns present
6. Create user aged 71 with $300k in 401k, verify RMD warning appears

## Performance Considerations

- RMD calculation is O(1) lookup table access - negligible impact
- Tax breakdown chart data transformation is O(n) where n = projection years
- No database queries added - all calculations are client/engine-side

## Migration Notes

- No database schema changes required
- Existing projections will automatically include RMD when recalculated
- No data migration needed

## References

- Research document: `thoughts/shared/research/2026-02-11-current-features-tax-awareness-model-recommendations.md`
- Projection engine: `src/lib/projections/engine.ts`
- Chart component: `src/components/projections/ProjectionChart.tsx`
- IRS Publication 590-B (Uniform Lifetime Table)
