# Epic 8: Safety-First Income Floor Modeling - Implementation Plan

## Overview

This plan implements the "Safety-First Income Floor Modeling" feature, which separates "never-fail" guaranteed income from market-dependent income and shows users whether their essential expenses are covered by reliable income sources. This gives users psychological and mathematical "permission to spend" when their income floor is established.

## Current State Analysis

### What Exists
- `IncomeStream` interface with `type`, `annualAmount`, `startAge`, `endAge`, `inflationAdjusted` fields
- Income stream types: `social_security`, `pension`, `rental`, `annuity`, `part_time`, `other`
- Essential and discretionary expenses captured during onboarding (`monthlyEssential`, `monthlyDiscretionary`)
- Projection engine that calculates retirement projections with income streams
- Insights infrastructure with sensitivity analysis, low-friction wins, and sensitive assumptions

### What's Missing
- `isGuaranteed` field on income streams (auto-classified by type)
- `isSpouse` field for Social Security differentiation
- Essential expenses preserved through projection engine (currently aggregated immediately)
- Income floor calculation (guaranteed income vs essential expenses)
- Coverage ratio calculation per year
- Income floor insight UI component

### Key Discoveries
- Expense aggregation happens in `input-builder.ts:63-64` - essential + discretionary combined into single `annualExpenses`
- `calculateTotalIncome()` in `engine.ts:95-108` sums all income without guaranteed/variable distinction
- Insights API at `route.ts:35-171` follows pattern of deterministic calculation + optional AI explanation
- `InsightsSection.tsx` renders three cards in a grid - we'll add a fourth

## Desired End State

After this implementation:
1. Each income stream has an `isGuaranteed` boolean (auto-set based on type) and optional `isSpouse` boolean
2. Projection engine tracks essential expenses separately from discretionary
3. A new `calculateIncomeFloor()` function computes coverage ratio per year
4. Users see an "Income Floor" insight card showing:
   - Whether their essential expenses are covered by guaranteed income
   - At what age the floor is established (if applicable)
   - A pass/fail indicator (green/yellow/red)
   - An AI-generated explanation (optional)

### Verification
- Unit tests for income floor calculations with various scenarios
- UI displays correct coverage status based on test data
- Existing functionality (projections, insights) remains unchanged

## What We're NOT Doing

- User override for guaranteed classification (auto-classification only)
- Integration with scenario mode (income floor hides during scenarios)
- Spousal benefit optimization or complex SS claiming strategies
- Annuity purchase recommendations
- Dynamic spending strategies ("Spend Boldly" is a separate epic)

## Implementation Approach

We'll implement in four phases, each independently testable:
1. **Data Model**: Add fields to IncomeStream, update database schema
2. **Expense Preservation**: Track essential/discretionary separately through projections
3. **Income Floor Calculation**: New calculation module for coverage analysis
4. **Insight Display**: UI component integrated with existing insights

---

## Phase 1: Data Model Changes

### Overview
Add `isGuaranteed` and `isSpouse` fields to the income stream data model with auto-classification based on income type.

### Changes Required

#### 1. Type Definitions
**File**: `src/lib/projections/types.ts`

Add new fields to `IncomeStream` interface (after line 29):

```typescript
export interface IncomeStream {
  id: string;
  name: string;
  type: IncomeStreamType;
  annualAmount: number;
  startAge: number;
  endAge?: number;
  inflationAdjusted: boolean;
  // NEW FIELDS - Epic 8
  isGuaranteed: boolean;        // Auto-set based on type
  isSpouse?: boolean;           // For household income differentiation (SS, pension)
}
```

Add guaranteed type constant (after line 17):

```typescript
/**
 * Income types considered guaranteed (not dependent on market conditions)
 */
export const GUARANTEED_INCOME_TYPES: IncomeStreamType[] = [
  'social_security',
  'pension',
  'annuity',
];
```

Add helper function:

```typescript
/**
 * Determine if an income type is considered guaranteed
 */
export function isGuaranteedIncomeType(type: IncomeStreamType): boolean {
  return GUARANTEED_INCOME_TYPES.includes(type);
}
```

#### 2. Database Schema
**File**: `src/db/schema/financial-snapshot.ts`

Update `IncomeStreamJson` type (lines 40-48):

```typescript
export type IncomeStreamJson = {
  id: string;
  name: string;
  type: 'social_security' | 'pension' | 'rental' | 'annuity' | 'part_time' | 'other';
  annualAmount: number;
  startAge: number;
  endAge?: number;
  inflationAdjusted: boolean;
  // NEW FIELDS - Epic 8
  isGuaranteed: boolean;
  isSpouse?: boolean;
};
```

#### 3. Onboarding Type Definitions
**File**: `src/types/onboarding.ts`

Update `IncomeStreamData` interface to match (find the interface and add fields):

```typescript
export interface IncomeStreamData {
  id: string;
  name: string;
  type: IncomeStreamType;
  annualAmount: number;
  startAge: number;
  endAge?: number;
  inflationAdjusted: boolean;
  // NEW FIELDS - Epic 8
  isGuaranteed: boolean;
  isSpouse?: boolean;
}
```

#### 4. Validation Schema
**File**: `src/lib/validation/onboarding.ts`

Update income stream schema to include new fields:

```typescript
export const incomeStreamSchema = z.object({
  id: z.string(),
  name: z.string().min(1, 'Name is required'),
  type: z.enum(['social_security', 'pension', 'rental', 'annuity', 'part_time', 'other']),
  annualAmount: z.number().min(0),
  startAge: z.number().min(0).max(120),
  endAge: z.number().min(0).max(120).optional(),
  inflationAdjusted: z.boolean(),
  // NEW FIELDS - Epic 8
  isGuaranteed: z.boolean(),
  isSpouse: z.boolean().optional(),
});
```

#### 5. Income Stream Form Component
**File**: `src/components/onboarding/step-income-streams.tsx`

Update `addIncomeStream` function (lines 66-76) to auto-set `isGuaranteed`:

```typescript
import { isGuaranteedIncomeType } from '@/lib/projections/types';

const addIncomeStream = () => {
  const defaultType = 'social_security';
  append({
    id: crypto.randomUUID(),
    name: '',
    type: defaultType,
    annualAmount: 0,
    startAge: 67,
    endAge: undefined,
    inflationAdjusted: true,
    isGuaranteed: isGuaranteedIncomeType(defaultType),
    isSpouse: false,
  });
};
```

Add type change handler to update `isGuaranteed` when type changes. In the type Select's onChange:

```typescript
<Controller
  name={`incomeStreams.${index}.type`}
  control={control}
  render={({ field }) => (
    <Select
      options={[...INCOME_STREAM_TYPE_OPTIONS]}
      value={field.value}
      onChange={(e) => {
        const newType = e.target.value as IncomeStreamType;
        field.onChange(newType);
        // Auto-update isGuaranteed based on new type
        setValue(`incomeStreams.${index}.isGuaranteed`, isGuaranteedIncomeType(newType));
      }}
    />
  )}
/>
```

Add spouse toggle (only for SS and pension types) after the COLA checkbox:

```typescript
{/* Spouse toggle - only for SS and pension */}
{(field.type === 'social_security' || field.type === 'pension') && (
  <div className="flex items-center space-x-2">
    <Controller
      name={`incomeStreams.${index}.isSpouse`}
      control={control}
      render={({ field: spouseField }) => (
        <Checkbox
          id={`incomeStreams.${index}.isSpouse`}
          checked={spouseField.value ?? false}
          onCheckedChange={spouseField.onChange}
        />
      )}
    />
    <Label
      htmlFor={`incomeStreams.${index}.isSpouse`}
      className="text-sm font-normal cursor-pointer"
    >
      This is spouse&apos;s benefit
    </Label>
  </div>
)}
```

Add guaranteed indicator badge (read-only, informational):

```typescript
{/* Guaranteed indicator */}
<div className="flex items-center gap-2 text-sm">
  {watch(`incomeStreams.${index}.isGuaranteed`) ? (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
      <Shield className="h-3 w-3 mr-1" />
      Guaranteed
    </span>
  ) : (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">
      <TrendingUp className="h-3 w-3 mr-1" />
      Variable
    </span>
  )}
</div>
```

Add imports at top of file:

```typescript
import { Shield, TrendingUp } from 'lucide-react';
import { isGuaranteedIncomeType } from '@/lib/projections/types';
import type { IncomeStreamType } from '@/lib/projections/types';
```

#### 6. Data Migration for Existing Users
**File**: `src/lib/projections/input-builder.ts`

Update income stream building to ensure `isGuaranteed` is set for legacy data:

```typescript
import { isGuaranteedIncomeType } from './types';

// In buildProjectionInputFromSnapshot, update line 83:
const rawStreams = overrides.incomeStreams ?? snapshot.incomeStreams ?? [];

// Ensure isGuaranteed is set for all streams (migration for legacy data)
const incomeStreams = rawStreams.map(stream => ({
  ...stream,
  isGuaranteed: stream.isGuaranteed ?? isGuaranteedIncomeType(stream.type),
  isSpouse: stream.isSpouse ?? false,
}));
```

### Success Criteria

#### Automated Verification
- [x] TypeScript compiles without errors: `npm run typecheck`
- [x] Linting passes: `npm run lint`
- [x] Existing tests pass: `npm test` (Note: 2 pre-existing test failures unrelated to Epic 8)
- [x] Build succeeds: `npm run build`

#### Manual Verification
- [ ] Adding a new Social Security stream shows "Guaranteed" badge
- [ ] Adding a new Rental income stream shows "Variable" badge
- [ ] Changing type from SS to Rental updates badge from Guaranteed to Variable
- [ ] Spouse toggle appears only for Social Security and Pension types
- [ ] Existing income streams load correctly (migration applies)

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation before proceeding to Phase 2.

---

## Phase 2: Expense Preservation

### Overview
Preserve the essential vs discretionary expense distinction through the projection engine instead of aggregating them immediately.

### Changes Required

#### 1. Update ProjectionInput Interface
**File**: `src/lib/projections/types.ts`

Replace single `annualExpenses` with separate fields (lines 78-79):

```typescript
// Replace:
// annualExpenses: number;

// With:
/** Annual essential expenses in today's dollars (housing, food, insurance, etc.) */
annualEssentialExpenses: number;

/** Annual discretionary expenses in today's dollars (travel, entertainment, etc.) */
annualDiscretionaryExpenses: number;

/** @deprecated Use annualEssentialExpenses + annualDiscretionaryExpenses. Kept for backward compatibility. */
annualExpenses: number;
```

#### 2. Update ProjectionRecord Interface
**File**: `src/lib/projections/types.ts`

Add expense breakdown to projection records (after line 135):

```typescript
export interface ProjectionRecord {
  age: number;
  year: number;
  balance: number;
  inflows: number;
  outflows: number;
  balanceByType: BalanceByType;
  withdrawalsByType?: BalanceByType;
  // NEW - Epic 8: Expense breakdown
  essentialExpenses?: number;
  discretionaryExpenses?: number;
}
```

#### 3. Update Input Builder
**File**: `src/lib/projections/input-builder.ts`

Replace expense aggregation (lines 59-70) with preservation:

```typescript
// Calculate annual expenses - preserve essential vs discretionary
let annualEssentialExpenses: number;
let annualDiscretionaryExpenses: number;

const incomeExpenses = snapshot.incomeExpenses;
if (incomeExpenses?.monthlyEssential != null || incomeExpenses?.monthlyDiscretionary != null) {
  annualEssentialExpenses = (incomeExpenses.monthlyEssential ?? 0) * 12;
  annualDiscretionaryExpenses = (incomeExpenses.monthlyDiscretionary ?? 0) * 12;
} else {
  // Fallback: derive from income/savings rate, treat all as essential
  const derivedExpenses = deriveAnnualExpenses(
    Number(snapshot.annualIncome),
    Number(snapshot.savingsRate)
  );
  annualEssentialExpenses = derivedExpenses;
  annualDiscretionaryExpenses = 0;
}

// For backward compatibility
const annualExpenses = annualEssentialExpenses + annualDiscretionaryExpenses;
```

Update the return object to include new fields:

```typescript
return {
  currentAge,
  retirementAge,
  maxAge: overrides.maxAge ?? DEFAULT_MAX_AGE,
  balancesByType,
  annualContribution,
  contributionAllocation: overrides.contributionAllocation ?? DEFAULT_CONTRIBUTION_ALLOCATION,
  expectedReturn: overrides.expectedReturn ?? DEFAULT_RETURN_RATES[riskTolerance],
  inflationRate: overrides.inflationRate ?? DEFAULT_INFLATION_RATE,
  contributionGrowthRate: overrides.contributionGrowthRate ?? DEFAULT_CONTRIBUTION_GROWTH_RATE,
  annualEssentialExpenses,
  annualDiscretionaryExpenses,
  annualExpenses, // backward compatibility
  annualHealthcareCosts,
  healthcareInflationRate: overrides.healthcareInflationRate ?? DEFAULT_HEALTHCARE_INFLATION_RATE,
  incomeStreams,
  annualDebtPayments,
};
```

#### 4. Update Projection Engine
**File**: `src/lib/projections/engine.ts`

Update expense calculation in drawdown phase (lines 162-171):

```typescript
// DRAWDOWN PHASE
// Calculate inflation-adjusted expenses (preserve breakdown)
const inflationMultiplier = Math.pow(1 + input.inflationRate, yearsFromRetirement);

const essentialExpenses = input.annualEssentialExpenses * inflationMultiplier;
const discretionaryExpenses = input.annualDiscretionaryExpenses * inflationMultiplier;
const generalExpenses = essentialExpenses + discretionaryExpenses;

// Calculate healthcare costs with separate (higher) inflation
const healthcareInflationMultiplier = Math.pow(1 + input.healthcareInflationRate, yearsFromRetirement);
const healthcareExpenses = input.annualHealthcareCosts * healthcareInflationMultiplier;

// Total expenses = essential + discretionary + healthcare
const expensesNeeded = generalExpenses + healthcareExpenses;
```

Update the record creation (lines 209-221) to include expense breakdown:

```typescript
records.push({
  age,
  year,
  balance: Math.max(0, totalBalance(balances)),
  inflows: Math.round(inflows * 100) / 100,
  outflows: Math.round(outflows * 100) / 100,
  balanceByType: {
    taxDeferred: Math.max(0, Math.round(balances.taxDeferred * 100) / 100),
    taxFree: Math.max(0, Math.round(balances.taxFree * 100) / 100),
    taxable: Math.max(0, Math.round(balances.taxable * 100) / 100),
  },
  withdrawalsByType,
  // NEW - Epic 8
  essentialExpenses: isRetired ? Math.round(essentialExpenses * 100) / 100 : undefined,
  discretionaryExpenses: isRetired ? Math.round(discretionaryExpenses * 100) / 100 : undefined,
});
```

Note: Define `essentialExpenses` and `discretionaryExpenses` variables at the start of the loop (before the if/else) and set them in the drawdown phase.

#### 5. Update Sensitivity Analysis
**File**: `src/lib/projections/sensitivity.ts`

Update the expense lever test (around line 44) to use the combined value:

```typescript
// The annualExpenses lever should test total expenses (backward compatible)
{
  lever: 'annualExpenses' as keyof ProjectionInput,
  displayName: 'Annual Expenses',
  delta: (input: ProjectionInput) => input.annualExpenses * 0.10,
  direction: 'decrease' as const,
},
```

This ensures existing sensitivity analysis continues to work.

#### 6. Update API Route
**File**: `src/app/api/projections/calculate/route.ts`

If there's direct expense aggregation in this file, update to preserve the breakdown. Based on the research, lines 177-193 may need updating to match the input builder pattern.

### Success Criteria

#### Automated Verification
- [ ] TypeScript compiles without errors: `npm run typecheck`
- [ ] Linting passes: `npm run lint`
- [ ] Existing tests pass: `npm test`
- [ ] Build succeeds: `npm run build`
- [ ] Projection API returns valid results: manual curl test

#### Manual Verification
- [ ] Projection table shows same totals as before (backward compatible)
- [ ] Projection records include `essentialExpenses` and `discretionaryExpenses` during retirement years
- [ ] Sensitivity analysis "Annual Expenses" lever still works correctly
- [ ] Users who entered only essential (no discretionary) expenses see correct projections

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation before proceeding to Phase 3.

---

## Phase 3: Income Floor Calculation

### Overview
Create a new module to calculate guaranteed income coverage of essential expenses, determining if and when an "income floor" is established.

### Changes Required

#### 1. Create Income Floor Types
**File**: `src/lib/projections/income-floor-types.ts` (NEW FILE)

```typescript
/**
 * Types for Income Floor Analysis (Epic 8)
 */

/**
 * Coverage data for a single year
 */
export interface YearlyCoverage {
  age: number;
  year: number;
  guaranteedIncome: number;
  essentialExpenses: number;
  coverageRatio: number;  // guaranteedIncome / essentialExpenses
  isFullyCovered: boolean;  // coverageRatio >= 1.0
}

/**
 * Complete income floor analysis result
 */
export interface IncomeFloorAnalysis {
  /** Sum of guaranteed income at retirement age */
  guaranteedIncomeAtRetirement: number;

  /** Essential expenses at retirement age (inflation-adjusted) */
  essentialExpensesAtRetirement: number;

  /** Coverage ratio at retirement (guaranteed / essential) */
  coverageRatioAtRetirement: number;

  /** Whether income floor is established at any point */
  isFloorEstablished: boolean;

  /** First age where guaranteed income >= essential expenses (null if never) */
  floorEstablishedAge: number | null;

  /** Coverage status category */
  status: 'fully-covered' | 'partial' | 'insufficient';

  /** Year-by-year coverage data */
  coverageByAge: YearlyCoverage[];

  /** Human-readable insight statement */
  insightStatement: string;
}

/**
 * Coverage status thresholds
 */
export const COVERAGE_THRESHOLDS = {
  FULL: 1.0,      // >= 100% = fully covered
  PARTIAL: 0.5,   // >= 50% = partial coverage
  // < 50% = insufficient
} as const;
```

#### 2. Create Income Floor Calculator
**File**: `src/lib/projections/income-floor.ts` (NEW FILE)

```typescript
/**
 * Income Floor Calculator (Epic 8)
 *
 * Calculates whether guaranteed income covers essential expenses,
 * implementing the "Safety-First" philosophy.
 */

import type { IncomeStream, ProjectionInput } from './types';
import { GUARANTEED_INCOME_TYPES } from './types';
import type { IncomeFloorAnalysis, YearlyCoverage } from './income-floor-types';
import { COVERAGE_THRESHOLDS } from './income-floor-types';

/**
 * Calculate total guaranteed income for a given age
 */
export function calculateGuaranteedIncome(
  streams: IncomeStream[],
  age: number,
  inflationMultiplier: number
): number {
  return streams
    .filter(stream => stream.isGuaranteed)
    .reduce((total, stream) => {
      // Check if stream is active this year
      if (age >= stream.startAge && (stream.endAge === undefined || age <= stream.endAge)) {
        const streamInflation = stream.inflationAdjusted ? inflationMultiplier : 1;
        return total + stream.annualAmount * streamInflation;
      }
      return total;
    }, 0);
}

/**
 * Calculate income floor analysis for a projection
 */
export function calculateIncomeFloor(input: ProjectionInput): IncomeFloorAnalysis {
  const coverageByAge: YearlyCoverage[] = [];
  const currentYear = new Date().getFullYear();

  let floorEstablishedAge: number | null = null;
  let guaranteedIncomeAtRetirement = 0;
  let essentialExpensesAtRetirement = 0;

  // Calculate coverage for each retirement year
  for (let age = input.retirementAge; age <= input.maxAge; age++) {
    const year = currentYear + (age - input.currentAge);
    const yearsFromRetirement = age - input.retirementAge;

    // Calculate inflation-adjusted essential expenses
    const inflationMultiplier = Math.pow(1 + input.inflationRate, yearsFromRetirement);
    const essentialExpenses = input.annualEssentialExpenses * inflationMultiplier;

    // Calculate guaranteed income for this age
    const guaranteedIncome = calculateGuaranteedIncome(
      input.incomeStreams,
      age,
      inflationMultiplier
    );

    // Calculate coverage ratio (handle zero expenses edge case)
    const coverageRatio = essentialExpenses > 0
      ? guaranteedIncome / essentialExpenses
      : guaranteedIncome > 0 ? Infinity : 1;

    const isFullyCovered = coverageRatio >= COVERAGE_THRESHOLDS.FULL;

    // Track first age where floor is established
    if (isFullyCovered && floorEstablishedAge === null) {
      floorEstablishedAge = age;
    }

    // Capture retirement age values
    if (age === input.retirementAge) {
      guaranteedIncomeAtRetirement = guaranteedIncome;
      essentialExpensesAtRetirement = essentialExpenses;
    }

    coverageByAge.push({
      age,
      year,
      guaranteedIncome: Math.round(guaranteedIncome * 100) / 100,
      essentialExpenses: Math.round(essentialExpenses * 100) / 100,
      coverageRatio: Math.round(coverageRatio * 1000) / 1000,
      isFullyCovered,
    });
  }

  // Determine coverage ratio at retirement
  const coverageRatioAtRetirement = essentialExpensesAtRetirement > 0
    ? guaranteedIncomeAtRetirement / essentialExpensesAtRetirement
    : 1;

  // Determine status
  const status = determineStatus(coverageRatioAtRetirement, floorEstablishedAge);

  // Generate insight statement
  const insightStatement = generateInsightStatement(
    status,
    floorEstablishedAge,
    coverageRatioAtRetirement,
    input.retirementAge
  );

  return {
    guaranteedIncomeAtRetirement: Math.round(guaranteedIncomeAtRetirement * 100) / 100,
    essentialExpensesAtRetirement: Math.round(essentialExpensesAtRetirement * 100) / 100,
    coverageRatioAtRetirement: Math.round(coverageRatioAtRetirement * 1000) / 1000,
    isFloorEstablished: floorEstablishedAge !== null,
    floorEstablishedAge,
    status,
    coverageByAge,
    insightStatement,
  };
}

/**
 * Determine coverage status based on ratio and floor establishment
 */
function determineStatus(
  coverageRatio: number,
  floorEstablishedAge: number | null
): IncomeFloorAnalysis['status'] {
  if (floorEstablishedAge !== null) {
    return 'fully-covered';
  }
  if (coverageRatio >= COVERAGE_THRESHOLDS.PARTIAL) {
    return 'partial';
  }
  return 'insufficient';
}

/**
 * Generate human-readable insight statement
 */
function generateInsightStatement(
  status: IncomeFloorAnalysis['status'],
  floorEstablishedAge: number | null,
  coverageRatio: number,
  retirementAge: number
): string {
  const percentCovered = Math.round(coverageRatio * 100);

  switch (status) {
    case 'fully-covered':
      if (floorEstablishedAge === retirementAge) {
        return `Your essential lifestyle is fully covered by guaranteed income from retirement.`;
      }
      return `Your essential lifestyle is fully covered by guaranteed income starting at age ${floorEstablishedAge}.`;

    case 'partial':
      return `Guaranteed income covers ${percentCovered}% of essential expenses at retirement.`;

    case 'insufficient':
      return `Essential expenses exceed guaranteed income throughout retirement. Guaranteed income covers ${percentCovered}% of essential expenses.`;
  }
}

/**
 * Check if any guaranteed income streams exist
 */
export function hasGuaranteedIncome(streams: IncomeStream[]): boolean {
  return streams.some(stream => stream.isGuaranteed);
}

/**
 * Get summary of guaranteed income streams
 */
export function getGuaranteedIncomeSummary(streams: IncomeStream[]): {
  count: number;
  totalAnnual: number;
  types: string[];
} {
  const guaranteedStreams = streams.filter(stream => stream.isGuaranteed);
  return {
    count: guaranteedStreams.length,
    totalAnnual: guaranteedStreams.reduce((sum, s) => sum + s.annualAmount, 0),
    types: [...new Set(guaranteedStreams.map(s => s.type))],
  };
}
```

#### 3. Create Unit Tests
**File**: `src/lib/projections/__tests__/income-floor.test.ts` (NEW FILE)

```typescript
import { describe, it, expect } from 'vitest';
import {
  calculateGuaranteedIncome,
  calculateIncomeFloor,
  hasGuaranteedIncome,
} from '../income-floor';
import type { IncomeStream, ProjectionInput } from '../types';

describe('calculateGuaranteedIncome', () => {
  const baseStreams: IncomeStream[] = [
    {
      id: '1',
      name: 'Social Security',
      type: 'social_security',
      annualAmount: 24000,
      startAge: 67,
      inflationAdjusted: true,
      isGuaranteed: true,
    },
    {
      id: '2',
      name: 'Rental Income',
      type: 'rental',
      annualAmount: 12000,
      startAge: 65,
      inflationAdjusted: false,
      isGuaranteed: false,
    },
    {
      id: '3',
      name: 'Pension',
      type: 'pension',
      annualAmount: 18000,
      startAge: 65,
      inflationAdjusted: true,
      isGuaranteed: true,
    },
  ];

  it('should sum only guaranteed income streams', () => {
    const result = calculateGuaranteedIncome(baseStreams, 67, 1.0);
    // SS ($24,000) + Pension ($18,000) = $42,000
    expect(result).toBe(42000);
  });

  it('should exclude streams not yet started', () => {
    const result = calculateGuaranteedIncome(baseStreams, 65, 1.0);
    // Only Pension ($18,000) is active at 65, SS starts at 67
    expect(result).toBe(18000);
  });

  it('should apply inflation to inflation-adjusted streams', () => {
    const result = calculateGuaranteedIncome(baseStreams, 67, 1.1); // 10% inflation
    // SS: $24,000 * 1.1 = $26,400, Pension: $18,000 * 1.1 = $19,800
    expect(result).toBe(46200);
  });

  it('should return 0 when no guaranteed streams exist', () => {
    const variableOnly = baseStreams.filter(s => !s.isGuaranteed);
    const result = calculateGuaranteedIncome(variableOnly, 67, 1.0);
    expect(result).toBe(0);
  });
});

describe('calculateIncomeFloor', () => {
  const baseInput: ProjectionInput = {
    currentAge: 55,
    retirementAge: 65,
    maxAge: 90,
    balancesByType: { taxDeferred: 500000, taxFree: 100000, taxable: 50000 },
    annualContribution: 20000,
    contributionAllocation: { taxDeferred: 60, taxFree: 30, taxable: 10 },
    expectedReturn: 0.06,
    inflationRate: 0.025,
    contributionGrowthRate: 0,
    annualEssentialExpenses: 36000,
    annualDiscretionaryExpenses: 12000,
    annualExpenses: 48000,
    annualHealthcareCosts: 6000,
    healthcareInflationRate: 0.05,
    incomeStreams: [
      {
        id: '1',
        name: 'Social Security',
        type: 'social_security',
        annualAmount: 24000,
        startAge: 67,
        inflationAdjusted: true,
        isGuaranteed: true,
      },
      {
        id: '2',
        name: 'Pension',
        type: 'pension',
        annualAmount: 18000,
        startAge: 65,
        inflationAdjusted: true,
        isGuaranteed: true,
      },
    ],
    annualDebtPayments: 0,
  };

  it('should calculate floor established when guaranteed exceeds essential', () => {
    const result = calculateIncomeFloor(baseInput);

    // At age 67: SS ($24k) + Pension ($18k) = $42k guaranteed
    // Essential expenses at 65 (retirement): $36k
    // Floor should be established at 65 when pension starts ($18k < $36k)
    // Actually floor established at 67 when SS starts
    expect(result.isFloorEstablished).toBe(true);
    expect(result.floorEstablishedAge).toBe(67);
    expect(result.status).toBe('fully-covered');
  });

  it('should return partial when guaranteed covers 50-99% of essential', () => {
    const partialInput = {
      ...baseInput,
      annualEssentialExpenses: 60000, // Increase essential expenses
      incomeStreams: [
        {
          id: '1',
          name: 'Pension',
          type: 'pension' as const,
          annualAmount: 36000, // 60% coverage
          startAge: 65,
          inflationAdjusted: true,
          isGuaranteed: true,
        },
      ],
    };

    const result = calculateIncomeFloor(partialInput);
    expect(result.status).toBe('partial');
    expect(result.coverageRatioAtRetirement).toBeCloseTo(0.6, 1);
  });

  it('should return insufficient when guaranteed covers <50% of essential', () => {
    const insufficientInput = {
      ...baseInput,
      annualEssentialExpenses: 100000, // High essential expenses
      incomeStreams: [
        {
          id: '1',
          name: 'Small Pension',
          type: 'pension' as const,
          annualAmount: 20000, // 20% coverage
          startAge: 65,
          inflationAdjusted: true,
          isGuaranteed: true,
        },
      ],
    };

    const result = calculateIncomeFloor(insufficientInput);
    expect(result.status).toBe('insufficient');
    expect(result.isFloorEstablished).toBe(false);
  });

  it('should handle zero essential expenses gracefully', () => {
    const zeroExpenses = {
      ...baseInput,
      annualEssentialExpenses: 0,
    };

    const result = calculateIncomeFloor(zeroExpenses);
    expect(result.status).toBe('fully-covered');
    expect(result.coverageRatioAtRetirement).toBe(Infinity);
  });
});

describe('hasGuaranteedIncome', () => {
  it('should return true when guaranteed streams exist', () => {
    const streams: IncomeStream[] = [
      { id: '1', name: 'SS', type: 'social_security', annualAmount: 24000, startAge: 67, inflationAdjusted: true, isGuaranteed: true },
    ];
    expect(hasGuaranteedIncome(streams)).toBe(true);
  });

  it('should return false when no guaranteed streams exist', () => {
    const streams: IncomeStream[] = [
      { id: '1', name: 'Rental', type: 'rental', annualAmount: 12000, startAge: 65, inflationAdjusted: false, isGuaranteed: false },
    ];
    expect(hasGuaranteedIncome(streams)).toBe(false);
  });

  it('should return false for empty streams', () => {
    expect(hasGuaranteedIncome([])).toBe(false);
  });
});
```

### Success Criteria

#### Automated Verification
- [ ] TypeScript compiles without errors: `npm run typecheck`
- [ ] Linting passes: `npm run lint`
- [ ] New unit tests pass: `npm test src/lib/projections/__tests__/income-floor.test.ts`
- [ ] All tests pass: `npm test`
- [ ] Build succeeds: `npm run build`

#### Manual Verification
- [ ] Import and call `calculateIncomeFloor()` from Node REPL with test data
- [ ] Verify coverage ratio calculation matches expected values
- [ ] Verify insight statements are grammatically correct and accurate

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation before proceeding to Phase 4.

---

## Phase 4: Income Floor Insight Display

### Overview
Create the UI component to display income floor analysis results and integrate with the existing insights section.

### Changes Required

#### 1. Update InsightsResponse Type
**File**: `src/lib/projections/sensitivity-types.ts`

Add income floor analysis to the API response (after line 53):

```typescript
import type { IncomeFloorAnalysis } from './income-floor-types';

// Update InsightsResponse interface:
export interface InsightsResponse {
  topLevers: LeverImpact[];
  leverExplanation: string;
  lowFrictionWins: LowFrictionWin[];
  sensitiveAssumptions: SensitiveAssumption[];
  sensitivityExplanation: string;
  baseline: {
    balance: number;
    depletion: number | null;
  };
  // NEW - Epic 8
  incomeFloor: IncomeFloorAnalysis | null;  // null if no income streams
  incomeFloorExplanation: string;
}
```

#### 2. Update Insights API
**File**: `src/app/api/insights/analyze/route.ts`

Add income floor calculation after sensitivity analysis (around line 67):

```typescript
import { calculateIncomeFloor, hasGuaranteedIncome } from '@/lib/projections/income-floor';

// After existing analysis calls...

// Calculate income floor (Epic 8)
let incomeFloor: IncomeFloorAnalysis | null = null;
if (hasGuaranteedIncome(input.incomeStreams) && input.annualEssentialExpenses > 0) {
  incomeFloor = calculateIncomeFloor(input);
}
```

Add AI explanation generation for income floor (after existing explanation generation):

```typescript
// Generate income floor explanation (only if floor analysis exists)
let incomeFloorExplanation = '';
if (incomeFloor && openAiConfigured) {
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const incomeFloorUserMessage = buildIncomeFloorUserMessage(incomeFloor, input);

      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: INCOME_FLOOR_EXPLANATION_SYSTEM_PROMPT },
          { role: 'user', content: incomeFloorUserMessage },
        ],
        response_format: { type: 'json_object' },
        temperature: 0,
        max_tokens: 256,
      });

      const content = completion.choices[0]?.message?.content;
      if (!content) continue;

      const parsed = JSON.parse(content) as { explanation: string };
      const violations = validateExplanation(parsed.explanation);

      if (violations.length === 0) {
        incomeFloorExplanation = parsed.explanation;
        break;
      }
    } catch (error) {
      console.error('Income floor explanation generation error:', error);
    }
  }
}
```

Update the response object to include income floor:

```typescript
return NextResponse.json({
  topLevers: sensitivityResult.topLevers,
  leverExplanation,
  lowFrictionWins,
  sensitiveAssumptions,
  sensitivityExplanation,
  baseline: {
    balance: sensitivityResult.baselineBalance,
    depletion: sensitivityResult.baselineDepletion,
  },
  // NEW - Epic 8
  incomeFloor,
  incomeFloorExplanation,
} satisfies InsightsResponse);
```

#### 3. Add AI Prompt for Income Floor
**File**: `src/lib/projections/insights-explain.ts`

Add new prompt and message builder:

```typescript
export const INCOME_FLOOR_EXPLANATION_SYSTEM_PROMPT = `You are a financial planning assistant explaining income floor analysis results.

Your task is to provide a brief, personalized explanation of the user's income floor status - whether their guaranteed income (Social Security, pensions, annuities) covers their essential living expenses.

Guidelines:
- Be encouraging but honest
- Focus on the safety and security aspect
- If floor is established, emphasize the psychological benefit of knowing essential expenses are covered
- If partial or insufficient, be matter-of-fact without being alarming
- Never give specific financial advice or recommendations
- Keep explanation to 2-3 sentences maximum
- Use plain language, avoid jargon

Respond with JSON: { "explanation": "your explanation here" }`;

export function buildIncomeFloorUserMessage(
  analysis: IncomeFloorAnalysis,
  input: ProjectionInput
): string {
  const guaranteedStreams = input.incomeStreams.filter(s => s.isGuaranteed);
  const streamNames = guaranteedStreams.map(s => s.name).join(', ');

  return `Income Floor Analysis:
- Status: ${analysis.status}
- Coverage ratio at retirement: ${Math.round(analysis.coverageRatioAtRetirement * 100)}%
- Guaranteed income sources: ${streamNames || 'None'}
- Essential expenses: $${analysis.essentialExpensesAtRetirement.toLocaleString()}/year
- Guaranteed income at retirement: $${analysis.guaranteedIncomeAtRetirement.toLocaleString()}/year
- Floor established age: ${analysis.floorEstablishedAge ?? 'Not established'}
- Retirement age: ${input.retirementAge}

Provide a brief, personalized explanation of what this means for the user's retirement security.`;
}
```

#### 4. Create Income Floor Card Component
**File**: `src/components/insights/IncomeFloorCard.tsx` (NEW FILE)

```typescript
'use client';

import { Shield, AlertTriangle, TrendingUp } from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import type { IncomeFloorAnalysis } from '@/lib/projections/income-floor-types';
import { cn } from '@/lib/utils';

interface IncomeFloorCardProps {
  analysis: IncomeFloorAnalysis | null;
  explanation: string;
  isLoading: boolean;
}

export function IncomeFloorCard({
  analysis,
  explanation,
  isLoading,
}: IncomeFloorCardProps) {
  // Loading state
  if (isLoading) {
    return (
      <Card className="animate-pulse">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <div className="h-5 w-5 rounded bg-muted" />
            <div className="h-5 w-32 rounded bg-muted" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="h-4 w-full rounded bg-muted" />
            <div className="h-4 w-3/4 rounded bg-muted" />
          </div>
        </CardContent>
      </Card>
    );
  }

  // No analysis available
  if (!analysis) {
    return null;
  }

  const statusConfig = getStatusConfig(analysis.status);
  const coveragePercent = Math.round(analysis.coverageRatioAtRetirement * 100);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <statusConfig.icon
            className={cn('h-5 w-5', statusConfig.iconColor)}
          />
          <CardTitle className="text-base">Income Floor</CardTitle>
        </div>
        <CardDescription>
          How well your guaranteed income covers essential expenses
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Status Indicator */}
        <div
          className={cn(
            'flex items-center justify-between p-3 rounded-lg',
            statusConfig.bgColor
          )}
        >
          <div>
            <p className={cn('font-semibold', statusConfig.textColor)}>
              {statusConfig.label}
            </p>
            <p className="text-sm text-muted-foreground">
              {analysis.insightStatement}
            </p>
          </div>
          <div className="text-right">
            <p className={cn('text-2xl font-bold', statusConfig.textColor)}>
              {coveragePercent}%
            </p>
            <p className="text-xs text-muted-foreground">coverage</p>
          </div>
        </div>

        {/* Coverage Details */}
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-muted-foreground">Guaranteed Income</p>
            <p className="font-medium">
              ${analysis.guaranteedIncomeAtRetirement.toLocaleString()}/yr
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">Essential Expenses</p>
            <p className="font-medium">
              ${analysis.essentialExpensesAtRetirement.toLocaleString()}/yr
            </p>
          </div>
        </div>

        {/* Floor Established Age */}
        {analysis.floorEstablishedAge && (
          <div className="flex items-center gap-2 text-sm">
            <Shield className="h-4 w-4 text-green-600 dark:text-green-400" />
            <span>
              Floor established at age {analysis.floorEstablishedAge}
            </span>
          </div>
        )}

        {/* AI Explanation */}
        {explanation && (
          <p className="text-sm text-muted-foreground border-t pt-3">
            {explanation}
          </p>
        )}

        {/* Coverage Progress Bar */}
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>0%</span>
            <span>50%</span>
            <span>100%</span>
          </div>
          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <div
              className={cn(
                'h-full rounded-full transition-all',
                statusConfig.barColor
              )}
              style={{ width: `${Math.min(coveragePercent, 100)}%` }}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function getStatusConfig(status: IncomeFloorAnalysis['status']) {
  switch (status) {
    case 'fully-covered':
      return {
        icon: Shield,
        iconColor: 'text-green-600 dark:text-green-400',
        label: 'Fully Covered',
        bgColor: 'bg-green-50 dark:bg-green-950/30',
        textColor: 'text-green-700 dark:text-green-300',
        barColor: 'bg-green-500',
      };
    case 'partial':
      return {
        icon: TrendingUp,
        iconColor: 'text-amber-600 dark:text-amber-400',
        label: 'Partial Coverage',
        bgColor: 'bg-amber-50 dark:bg-amber-950/30',
        textColor: 'text-amber-700 dark:text-amber-300',
        barColor: 'bg-amber-500',
      };
    case 'insufficient':
      return {
        icon: AlertTriangle,
        iconColor: 'text-red-600 dark:text-red-400',
        label: 'Needs Attention',
        bgColor: 'bg-red-50 dark:bg-red-950/30',
        textColor: 'text-red-700 dark:text-red-300',
        barColor: 'bg-red-500',
      };
  }
}
```

#### 5. Integrate with InsightsSection
**File**: `src/components/insights/InsightsSection.tsx`

Add import and render the new card:

```typescript
import { IncomeFloorCard } from './IncomeFloorCard';

// In the component, update the grid to be 4 columns on xl:
<div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 mt-4">
  {/* NEW - Income Floor Card first (most important for safety-first) */}
  <IncomeFloorCard
    analysis={insights?.incomeFloor ?? null}
    explanation={insights?.incomeFloorExplanation ?? ''}
    isLoading={isLoading}
  />
  <TopLeversCard
    levers={insights?.topLevers ?? []}
    explanation={insights?.leverExplanation ?? ''}
    isLoading={isLoading}
  />
  <LowFrictionWinsCard
    wins={insights?.lowFrictionWins ?? []}
    isLoading={isLoading}
  />
  <AssumptionSensitivityCard
    assumptions={insights?.sensitiveAssumptions ?? []}
    explanation={insights?.sensitivityExplanation ?? ''}
    isLoading={isLoading}
  />
</div>
```

Update the summary text to mention income floor when relevant:

```typescript
const topLever = insights?.topLevers[0];
const incomeFloorStatus = insights?.incomeFloor?.status;

let summaryText: string;
if (incomeFloorStatus === 'fully-covered') {
  summaryText = 'Your essential expenses are fully covered by guaranteed income';
} else if (topLever) {
  summaryText = `${topLever.displayName} has the biggest impact on your projection`;
} else {
  summaryText = 'Discover what affects your retirement most';
}
```

#### 6. Export Types
**File**: `src/lib/projections/index.ts` (if exists, or create)

Ensure the new types are exported:

```typescript
export * from './income-floor';
export * from './income-floor-types';
```

### Success Criteria

#### Automated Verification
- [ ] TypeScript compiles without errors: `npm run typecheck`
- [ ] Linting passes: `npm run lint`
- [ ] All tests pass: `npm test`
- [ ] Build succeeds: `npm run build`

#### Manual Verification
- [ ] Income Floor card appears in Insights section
- [ ] Card shows "Fully Covered" (green) when guaranteed income >= essential expenses
- [ ] Card shows "Partial Coverage" (yellow) when 50-99% coverage
- [ ] Card shows "Needs Attention" (red) when <50% coverage
- [ ] Card is hidden when user has no guaranteed income streams
- [ ] AI explanation appears below the coverage details
- [ ] Progress bar accurately reflects coverage percentage
- [ ] Card responsive on mobile (stacks correctly)
- [ ] Card hides during scenario mode (existing behavior inherited)

**Implementation Note**: After completing this phase and all automated verification passes, the Epic 8 implementation is complete.

---

## Testing Strategy

### Unit Tests
- `src/lib/projections/__tests__/income-floor.test.ts` - Core calculation logic
- Test edge cases: zero expenses, zero income, Infinity handling
- Test status determination at boundary values (49%, 50%, 99%, 100%)

### Integration Tests
- API endpoint returns correct `incomeFloor` field
- Projection records include expense breakdown
- Data migration correctly sets `isGuaranteed` for legacy streams

### Manual Testing Steps
1. Create a new user with Social Security ($24k) and essential expenses ($36k)
2. Verify Income Floor card shows "Partial Coverage" (~67%)
3. Add a pension ($18k) starting at retirement
4. Verify card updates to "Fully Covered" when pension + SS >= essential
5. Change pension type to "rental" - verify it becomes "Variable" and coverage drops
6. Test with user who has no income streams - verify card is hidden

---

## Performance Considerations

- Income floor calculation runs once per insights fetch (not per projection year)
- Coverage by age array is bounded by `maxAge - retirementAge` (typically 25-30 entries)
- No additional database queries required - uses existing projection input

---

## Migration Notes

### Existing User Data
- Existing income streams without `isGuaranteed` field will have it auto-set via the migration code in `input-builder.ts`
- No database migration required - field is added to JSONB schema
- First projection after deployment will include correct `isGuaranteed` values

### Backward Compatibility
- `annualExpenses` field kept for backward compatibility
- Existing sensitivity analysis continues to work
- API response structure is additive (new fields, no removed fields)

---

## References

- Original ticket: `thoughts/personal/tickets/epic-8/story-1-scope.md`
- Gap analysis: `thoughts/shared/research/2026-01-16-epic-8-implementation-gap-analysis.md`
- Existing insights pattern: `src/app/api/insights/analyze/route.ts`
- Projection engine: `src/lib/projections/engine.ts`
