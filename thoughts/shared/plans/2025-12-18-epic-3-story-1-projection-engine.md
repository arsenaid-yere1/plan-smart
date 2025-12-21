# Epic 3 Story 1 - Projection Engine Implementation Plan

## Overview

Implement a retirement projection engine that calculates annual projections from current age through maximum lifespan (default 90), including pre-retirement accumulation and post-retirement drawdown phases. The engine will be deterministic, reproducible, and configurable, with performance under 1 second.

## Current State Analysis

### Available Data (from `financial_snapshot` table)
All required inputs are already collected via Epic 2 onboarding:
- `birthYear`, `targetRetirementAge` - Demographics
- `annualIncome`, `savingsRate` - Income/savings
- `riskTolerance` - Maps to default return assumptions
- `investmentAccounts` (JSONB) - Array with balances, types, and monthly contributions
- `incomeExpenses` (JSONB) - Monthly essential/discretionary spending
- `debts` (JSONB) - Array with balances and interest rates
- `primaryResidence` (JSONB) - Home equity data

### Existing Patterns to Follow
- **API Pattern**: [route.ts](src/app/api/onboarding/complete/route.ts) - POST with auth, Zod validation, structured responses
- **Aggregation Pattern**: Lines 46-54 - Array reduce for summing balances
- **Test Pattern**: [route.test.ts](src/app/api/auth/login/route.test.ts) - Vitest with mocks
- **Validation Pattern**: [onboarding.ts](src/lib/validation/onboarding.ts) - Zod schema composition

### What Doesn't Exist
- No financial math utilities (compound interest, inflation adjustment)
- No projection algorithms
- No `src/lib/projections/` directory

## Desired End State

A fully functional projection API endpoint that:
1. Accepts optional override parameters (return rate, inflation, max age, SS parameters)
2. Fetches user's financial snapshot from database
3. Calculates year-by-year projections with tax-aware account tracking
4. Returns structured results with both records array and summary statistics
5. Completes in under 1 second

### Verification:
- All unit tests pass for engine calculations
- API integration tests pass for endpoint
- Manual test with real user data returns expected projection format
- Performance test confirms <1s for typical inputs

## What We're NOT Doing

- Monte Carlo simulations
- Detailed tax optimization (just basic withdrawal ordering)
- Portfolio-level asset allocation modeling
- Rebalancing or portfolio drift modeling
- Complex Social Security age optimization
- RMD (Required Minimum Distribution) calculations

---

## Implementation Approach

Build the projection engine in layers from the bottom up:
1. **Types first** - Define all input/output interfaces
2. **Assumptions module** - Default values and mappings
3. **Core engine** - Pure calculation functions
4. **Validation schemas** - Zod schemas for API input
5. **API endpoint** - Wire everything together
6. **Tests** - Unit tests for calculations, integration tests for API

---

## Phase 1: Type Definitions

### Overview
Create TypeScript interfaces for all projection inputs, outputs, and intermediate data structures.

### Changes Required:

#### 1. Create Projection Types
**File**: `src/lib/projections/types.ts`

```typescript
import type { RiskTolerance } from '@/types/database';
import type { AccountType } from '@/types/onboarding';

/**
 * Tax category for investment accounts
 */
export type TaxCategory = 'taxDeferred' | 'taxFree' | 'taxable';

/**
 * Mapping of account types to tax categories
 */
export const ACCOUNT_TAX_CATEGORY: Record<AccountType, TaxCategory> = {
  '401k': 'taxDeferred',
  'IRA': 'taxDeferred',
  'Roth_IRA': 'taxFree',
  'Brokerage': 'taxable',
  'Cash': 'taxable',
  'Other': 'taxable',
};

/**
 * Balance breakdown by tax category
 */
export interface BalanceByType {
  taxDeferred: number;
  taxFree: number;
  taxable: number;
}

/**
 * Core inputs required for projection calculation
 * Derived from financial snapshot + optional overrides
 */
export interface ProjectionInput {
  currentAge: number;
  retirementAge: number;
  maxAge: number;

  // Account balances by tax category
  balancesByType: BalanceByType;

  // Annual contribution (derived from monthly * 12)
  annualContribution: number;

  // Contribution allocation percentages (must sum to 100)
  contributionAllocation: BalanceByType;

  // Return and inflation assumptions
  expectedReturn: number;
  inflationRate: number;

  // Annual contribution growth rate (default 0%)
  contributionGrowthRate: number;

  // Annual expenses in today's dollars (excluding healthcare)
  annualExpenses: number;

  // Healthcare costs (separate due to higher inflation)
  annualHealthcareCosts: number;
  healthcareInflationRate: number;

  // Social Security parameters
  socialSecurityAge: number;
  socialSecurityMonthly: number;

  // Annual debt payments (reduces effective contributions)
  annualDebtPayments: number;
}

/**
 * API request schema - optional overrides for projection
 */
export interface ProjectionRequest {
  // Override default return rate from risk tolerance
  expectedReturn?: number;

  // Override default inflation (2.5%)
  inflationRate?: number;

  // Override default max age (90)
  maxAge?: number;

  // Annual contribution growth rate (default 0%)
  contributionGrowthRate?: number;

  // Social Security parameters
  socialSecurityAge?: number;
  socialSecurityMonthly?: number;

  // Healthcare cost overrides
  annualHealthcareCosts?: number;
  healthcareInflationRate?: number;

  // Contribution allocation override (must sum to 100)
  contributionAllocation?: {
    taxDeferred: number;
    taxFree: number;
    taxable: number;
  };
}

/**
 * Single year projection record
 */
export interface ProjectionRecord {
  age: number;
  year: number;
  balance: number;
  inflows: number;
  outflows: number;

  // Account-level breakdown for tax strategy visibility
  balanceByType: BalanceByType;
  withdrawalsByType?: BalanceByType;
}

/**
 * Summary statistics for the projection
 */
export interface ProjectionSummary {
  startingBalance: number;
  endingBalance: number;
  totalContributions: number;
  totalWithdrawals: number;
  yearsUntilDepletion: number | null;
  projectedRetirementBalance: number;
}

/**
 * Complete projection result
 */
export interface ProjectionResult {
  records: ProjectionRecord[];
  summary: ProjectionSummary;
}

/**
 * Withdrawal result from tax-aware strategy
 */
export interface WithdrawalResult {
  withdrawals: BalanceByType;
  shortfall: number;
}
```

### Success Criteria:

#### Automated Verification:
- [x] TypeScript compiles without errors: `npm run typecheck`
- [x] File exists at correct location

#### Manual Verification:
- [x] Types are comprehensive and match research document specifications

---

## Phase 2: Assumptions Module

### Overview
Create default values for return rates, inflation, and Social Security estimation logic.

### Changes Required:

#### 1. Create Assumptions Module
**File**: `src/lib/projections/assumptions.ts`

```typescript
import type { RiskTolerance } from '@/types/database';
import type { BalanceByType } from './types';

/**
 * Default expected return rates by risk tolerance
 */
export const DEFAULT_RETURN_RATES: Record<RiskTolerance, number> = {
  conservative: 0.04,  // 4% - Bond-heavy portfolio
  moderate: 0.06,      // 6% - Balanced 60/40
  aggressive: 0.08,    // 8% - Equity-heavy
};

/**
 * Default inflation rate (historical average)
 */
export const DEFAULT_INFLATION_RATE = 0.025; // 2.5%

/**
 * Default maximum age for projections
 */
export const DEFAULT_MAX_AGE = 90;

/**
 * Default Social Security claiming age
 */
export const DEFAULT_SS_AGE = 67;

/**
 * Default contribution allocation
 */
export const DEFAULT_CONTRIBUTION_ALLOCATION: BalanceByType = {
  taxDeferred: 60,
  taxFree: 30,
  taxable: 10,
};

/**
 * Default contribution growth rate (0% = flat contributions)
 */
export const DEFAULT_CONTRIBUTION_GROWTH_RATE = 0;

/**
 * Default healthcare inflation rate (historically ~5-6%, higher than general inflation)
 */
export const DEFAULT_HEALTHCARE_INFLATION_RATE = 0.05; // 5%

/**
 * Default annual healthcare costs by age bracket (in today's dollars)
 * Based on Fidelity's annual retiree healthcare cost estimates
 */
export const DEFAULT_HEALTHCARE_COSTS_BY_AGE: Record<string, number> = {
  'under65': 8000,   // Pre-Medicare: ~$8k/year (ACA marketplace or employer)
  '65to74': 6500,    // Early Medicare: ~$6.5k/year (Medicare + supplements)
  '75plus': 12000,   // Late retirement: ~$12k/year (increased medical needs)
};

/**
 * Estimate annual healthcare costs based on age
 * @param age - Current age
 * @returns Estimated annual healthcare costs in today's dollars
 */
export function estimateHealthcareCosts(age: number): number {
  if (age < 65) {
    return DEFAULT_HEALTHCARE_COSTS_BY_AGE['under65'];
  } else if (age < 75) {
    return DEFAULT_HEALTHCARE_COSTS_BY_AGE['65to74'];
  } else {
    return DEFAULT_HEALTHCARE_COSTS_BY_AGE['75plus'];
  }
}

/**
 * SSA maximum monthly benefit (2024, approximate)
 */
export const SSA_MAX_MONTHLY_BENEFIT = 4500;

/**
 * Estimate Social Security monthly benefit based on annual income
 * Uses simplified SSA replacement rate formula with 20% conservative haircut
 *
 * @param annualIncome - User's annual income
 * @returns Estimated monthly SS benefit in today's dollars
 */
export function estimateSocialSecurityMonthly(annualIncome: number): number {
  // Tiered replacement rates (simplified SSA formula)
  let annualBenefit: number;

  if (annualIncome <= 30000) {
    // ~55% replacement for low income
    annualBenefit = annualIncome * 0.55;
  } else if (annualIncome <= 80000) {
    // ~40% replacement for middle income
    annualBenefit = 30000 * 0.55 + (annualIncome - 30000) * 0.40;
  } else {
    // ~30% replacement for high income (diminishing returns)
    annualBenefit = 30000 * 0.55 + 50000 * 0.40 + (annualIncome - 80000) * 0.30;
  }

  // Apply 20% conservative haircut
  const monthlyBenefit = (annualBenefit * 0.80) / 12;

  // Cap at SSA maximum
  return Math.min(monthlyBenefit, SSA_MAX_MONTHLY_BENEFIT);
}

/**
 * Calculate annual expenses from income and savings rate
 * Used as fallback when incomeExpenses is not provided
 *
 * @param annualIncome - User's annual income
 * @param savingsRate - Savings rate as percentage (0-100)
 * @returns Estimated annual expenses, capped at 80% of income
 */
export function deriveAnnualExpenses(
  annualIncome: number,
  savingsRate: number
): number {
  const spending = annualIncome * (1 - savingsRate / 100);
  const maxSpending = annualIncome * 0.80;
  return Math.min(spending, maxSpending);
}

/**
 * Estimate annual debt payments using simple amortization
 * For MVP, assumes 10-year payoff for all debts
 *
 * @param debts - Array of debt objects with balance and optional interest rate
 * @returns Estimated total annual debt payments
 */
export function estimateAnnualDebtPayments(
  debts: Array<{ balance: number; interestRate?: number }>
): number {
  return debts.reduce((total, debt) => {
    const rate = (debt.interestRate || 5) / 100; // Default 5% if not specified
    const monthlyRate = rate / 12;
    const numPayments = 120; // 10 years

    // Standard amortization formula: M = P * [r(1+r)^n] / [(1+r)^n - 1]
    if (monthlyRate === 0) {
      return total + (debt.balance / 10); // Simple division for 0% interest
    }

    const factor = Math.pow(1 + monthlyRate, numPayments);
    const monthlyPayment = debt.balance * (monthlyRate * factor) / (factor - 1);

    return total + (monthlyPayment * 12);
  }, 0);
}
```

### Success Criteria:

#### Automated Verification:
- [x] TypeScript compiles without errors: `npm run typecheck`
- [x] File exports all expected functions and constants

#### Manual Verification:
- [ ] SS estimation produces reasonable values for sample incomes ($50k → ~$1,500/month)
- [ ] Debt payment estimation is reasonable for sample debts

---

## Phase 3: Core Engine

### Overview
Implement the main projection calculation logic with accumulation and drawdown phases.

### Changes Required:

#### 1. Create Projection Engine
**File**: `src/lib/projections/engine.ts`

```typescript
import type {
  ProjectionInput,
  ProjectionRecord,
  ProjectionResult,
  BalanceByType,
  WithdrawalResult,
} from './types';

/**
 * Execute tax-aware withdrawal strategy
 * Order: taxable → taxDeferred → taxFree (preserve tax-free growth longest)
 */
export function withdrawFromAccounts(
  amountNeeded: number,
  balances: BalanceByType
): WithdrawalResult {
  const withdrawals: BalanceByType = { taxDeferred: 0, taxFree: 0, taxable: 0 };
  let remaining = amountNeeded;

  // 1. Withdraw from taxable accounts first (capital gains treatment)
  if (remaining > 0 && balances.taxable > 0) {
    const fromTaxable = Math.min(remaining, balances.taxable);
    withdrawals.taxable = fromTaxable;
    remaining -= fromTaxable;
  }

  // 2. Withdraw from tax-deferred accounts (ordinary income)
  if (remaining > 0 && balances.taxDeferred > 0) {
    const fromDeferred = Math.min(remaining, balances.taxDeferred);
    withdrawals.taxDeferred = fromDeferred;
    remaining -= fromDeferred;
  }

  // 3. Withdraw from tax-free accounts last (preserve tax-free growth)
  if (remaining > 0 && balances.taxFree > 0) {
    const fromTaxFree = Math.min(remaining, balances.taxFree);
    withdrawals.taxFree = fromTaxFree;
    remaining -= fromTaxFree;
  }

  return { withdrawals, shortfall: remaining };
}

/**
 * Apply investment returns to all account types
 */
function applyReturns(balances: BalanceByType, returnRate: number): BalanceByType {
  return {
    taxDeferred: balances.taxDeferred * (1 + returnRate),
    taxFree: balances.taxFree * (1 + returnRate),
    taxable: balances.taxable * (1 + returnRate),
  };
}

/**
 * Add contributions allocated by percentage
 */
function addContributions(
  balances: BalanceByType,
  annualContribution: number,
  allocation: BalanceByType
): BalanceByType {
  return {
    taxDeferred: balances.taxDeferred + (annualContribution * allocation.taxDeferred / 100),
    taxFree: balances.taxFree + (annualContribution * allocation.taxFree / 100),
    taxable: balances.taxable + (annualContribution * allocation.taxable / 100),
  };
}

/**
 * Subtract withdrawals from balances
 */
function subtractWithdrawals(
  balances: BalanceByType,
  withdrawals: BalanceByType
): BalanceByType {
  return {
    taxDeferred: Math.max(0, balances.taxDeferred - withdrawals.taxDeferred),
    taxFree: Math.max(0, balances.taxFree - withdrawals.taxFree),
    taxable: Math.max(0, balances.taxable - withdrawals.taxable),
  };
}

/**
 * Calculate total balance across all account types
 */
function totalBalance(balances: BalanceByType): number {
  return balances.taxDeferred + balances.taxFree + balances.taxable;
}

/**
 * Run the complete retirement projection
 *
 * Uses end-of-year model:
 * - Accumulation: (balance + contribution - debtPayments) × (1 + return)
 * - Drawdown: (balance - withdrawal) × (1 + return)
 */
export function runProjection(input: ProjectionInput): ProjectionResult {
  const records: ProjectionRecord[] = [];
  const currentYear = new Date().getFullYear();

  let balances = { ...input.balancesByType };
  let totalContributions = 0;
  let totalWithdrawals = 0;
  let yearsUntilDepletion: number | null = null;
  let projectedRetirementBalance = 0;

  // Handle already-retired case: skip accumulation if currentAge >= retirementAge
  const isAlreadyRetired = input.currentAge >= input.retirementAge;

  for (let age = input.currentAge; age <= input.maxAge; age++) {
    const year = currentYear + (age - input.currentAge);
    const yearsFromStart = age - input.currentAge;
    const yearsFromRetirement = age - input.retirementAge;
    const isRetired = age >= input.retirementAge;

    let inflows = 0;
    let outflows = 0;
    let withdrawalsByType: BalanceByType | undefined;

    if (!isRetired) {
      // ACCUMULATION PHASE
      // Calculate contribution with growth rate applied
      const growthMultiplier = Math.pow(1 + input.contributionGrowthRate, yearsFromStart);
      const grownContribution = input.annualContribution * growthMultiplier;

      // Effective contribution = grown contribution - debt payments
      const effectiveContribution = Math.max(
        0,
        grownContribution - input.annualDebtPayments
      );

      // Add contributions first
      balances = addContributions(balances, effectiveContribution, input.contributionAllocation);
      inflows = effectiveContribution;
      totalContributions += effectiveContribution;

      // Then apply returns (end of year model)
      balances = applyReturns(balances, input.expectedReturn);

      // Track retirement balance at transition
      if (age === input.retirementAge - 1) {
        projectedRetirementBalance = totalBalance(balances);
      }
    } else {
      // DRAWDOWN PHASE
      // Calculate inflation-adjusted general expenses
      const inflationMultiplier = Math.pow(1 + input.inflationRate, yearsFromRetirement);
      const generalExpenses = input.annualExpenses * inflationMultiplier;

      // Calculate healthcare costs with separate (higher) inflation
      const healthcareInflationMultiplier = Math.pow(1 + input.healthcareInflationRate, yearsFromRetirement);
      const healthcareExpenses = input.annualHealthcareCosts * healthcareInflationMultiplier;

      // Total expenses = general + healthcare
      const expensesNeeded = generalExpenses + healthcareExpenses;

      // Calculate Social Security income (inflation-adjusted, starts at SS age)
      let ssIncome = 0;
      if (age >= input.socialSecurityAge && input.socialSecurityMonthly > 0) {
        ssIncome = (input.socialSecurityMonthly * 12) * inflationMultiplier;
      }

      // Net withdrawal needed from portfolio
      const withdrawalNeeded = Math.max(0, expensesNeeded - ssIncome);

      // Execute tax-aware withdrawal
      const withdrawalResult = withdrawFromAccounts(withdrawalNeeded, balances);
      withdrawalsByType = withdrawalResult.withdrawals;

      // Update balances
      balances = subtractWithdrawals(balances, withdrawalResult.withdrawals);

      // Apply returns to remaining balance
      balances = applyReturns(balances, input.expectedReturn);

      // Track totals
      const actualWithdrawal = withdrawalResult.withdrawals.taxDeferred +
        withdrawalResult.withdrawals.taxFree +
        withdrawalResult.withdrawals.taxable;

      inflows = ssIncome;
      outflows = expensesNeeded;
      totalWithdrawals += actualWithdrawal;

      // Track depletion year
      if (yearsUntilDepletion === null && totalBalance(balances) <= 0) {
        yearsUntilDepletion = yearsFromStart;
      }

      // Set retirement balance for already-retired case
      if (isAlreadyRetired && age === input.currentAge) {
        projectedRetirementBalance = totalBalance(input.balancesByType);
      }
    }

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
    });
  }

  return {
    records,
    summary: {
      startingBalance: totalBalance(input.balancesByType),
      endingBalance: Math.max(0, totalBalance(balances)),
      totalContributions: Math.round(totalContributions * 100) / 100,
      totalWithdrawals: Math.round(totalWithdrawals * 100) / 100,
      yearsUntilDepletion,
      projectedRetirementBalance: Math.round(projectedRetirementBalance * 100) / 100,
    },
  };
}
```

### Success Criteria:

#### Automated Verification:
- [x] TypeScript compiles without errors: `npm run typecheck`
- [x] Unit tests pass (created in Phase 6)

#### Manual Verification:
- [ ] Engine produces sensible projections for sample inputs

---

## Phase 4: Validation Schemas

### Overview
Create Zod validation schemas for API request validation.

### Changes Required:

#### 1. Create Projection Validation Schema
**File**: `src/lib/validation/projections.ts`

```typescript
import { z } from 'zod';

/**
 * Contribution allocation schema - percentages must sum to 100
 */
export const contributionAllocationSchema = z
  .object({
    taxDeferred: z.number().min(0).max(100),
    taxFree: z.number().min(0).max(100),
    taxable: z.number().min(0).max(100),
  })
  .refine(
    (data) => data.taxDeferred + data.taxFree + data.taxable === 100,
    { message: 'Contribution allocation percentages must sum to 100' }
  );

/**
 * Projection request schema - all fields optional (defaults from financial snapshot)
 */
export const projectionRequestSchema = z.object({
  // Return rate override (0-20%)
  expectedReturn: z
    .number()
    .min(0, 'Expected return cannot be negative')
    .max(0.20, 'Expected return cannot exceed 20%')
    .optional(),

  // Inflation rate override (0-15%)
  inflationRate: z
    .number()
    .min(0, 'Inflation rate cannot be negative')
    .max(0.15, 'Inflation rate cannot exceed 15%')
    .optional(),

  // Max age override (current age + 1 to 120)
  maxAge: z
    .number()
    .int()
    .min(50, 'Max age must be at least 50')
    .max(120, 'Max age cannot exceed 120')
    .optional(),

  // Contribution growth rate (0-10%, default 0%)
  contributionGrowthRate: z
    .number()
    .min(0, 'Contribution growth rate cannot be negative')
    .max(0.10, 'Contribution growth rate cannot exceed 10%')
    .optional(),

  // Social Security claiming age (62-70)
  socialSecurityAge: z
    .number()
    .int()
    .min(62, 'Social Security age must be at least 62')
    .max(70, 'Social Security age cannot exceed 70')
    .optional(),

  // Monthly Social Security benefit
  socialSecurityMonthly: z
    .number()
    .min(0, 'Social Security benefit cannot be negative')
    .max(10000, 'Social Security benefit cannot exceed $10,000/month')
    .optional(),

  // Healthcare cost overrides
  annualHealthcareCosts: z
    .number()
    .min(0, 'Healthcare costs cannot be negative')
    .max(100000, 'Healthcare costs cannot exceed $100,000/year')
    .optional(),

  // Healthcare inflation rate override (0-15%)
  healthcareInflationRate: z
    .number()
    .min(0, 'Healthcare inflation rate cannot be negative')
    .max(0.15, 'Healthcare inflation rate cannot exceed 15%')
    .optional(),

  // Contribution allocation override
  contributionAllocation: contributionAllocationSchema.optional(),
});

export type ProjectionRequestInput = z.infer<typeof projectionRequestSchema>;
```

### Success Criteria:

#### Automated Verification:
- [x] TypeScript compiles without errors: `npm run typecheck`
- [x] Linting passes: `npm run lint`

#### Manual Verification:
- [ ] Validation correctly rejects invalid inputs (negative rates, out-of-range values)

---

## Phase 5: API Endpoint

### Overview
Create the POST endpoint that ties everything together.

### Changes Required:

#### 1. Create API Route
**File**: `src/app/api/projections/calculate/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getServerUser } from '@/lib/auth/server';
import { db } from '@/db/client';
import { financialSnapshot } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { projectionRequestSchema } from '@/lib/validation/projections';
import { runProjection } from '@/lib/projections/engine';
import {
  DEFAULT_RETURN_RATES,
  DEFAULT_INFLATION_RATE,
  DEFAULT_MAX_AGE,
  DEFAULT_SS_AGE,
  DEFAULT_CONTRIBUTION_ALLOCATION,
  DEFAULT_CONTRIBUTION_GROWTH_RATE,
  DEFAULT_HEALTHCARE_INFLATION_RATE,
  estimateSocialSecurityMonthly,
  deriveAnnualExpenses,
  estimateAnnualDebtPayments,
  estimateHealthcareCosts,
} from '@/lib/projections/assumptions';
import { ACCOUNT_TAX_CATEGORY, type BalanceByType, type ProjectionInput } from '@/lib/projections/types';
import type { RiskTolerance } from '@/types/database';
import type { InvestmentAccountJson, DebtJson, IncomeExpensesJson } from '@/db/schema/financial-snapshot';
import { createTimer } from '@/lib/monitoring/performance';

/**
 * Helper to run projection and return response
 */
async function calculateProjection(userId: string, overrides: Record<string, unknown> = {}) {
  // Fetch financial snapshot
  const [snapshot] = await db
    .select()
    .from(financialSnapshot)
    .where(eq(financialSnapshot.userId, userId))
    .limit(1);

  if (!snapshot) {
    return { error: 'Financial snapshot not found. Please complete onboarding.', status: 404 };
  }

  // Map financial snapshot to projection input
  const currentYear = new Date().getFullYear();
  const currentAge = currentYear - snapshot.birthYear;
  const riskTolerance = snapshot.riskTolerance as RiskTolerance;

  // Calculate balances by tax category (with warning for unknown types)
  const accounts = (snapshot.investmentAccounts || []) as InvestmentAccountJson[];
  const balancesByType: BalanceByType = {
    taxDeferred: 0,
    taxFree: 0,
    taxable: 0,
  };
  const warnings: string[] = [];

  accounts.forEach((account) => {
    const knownType = account.type as keyof typeof ACCOUNT_TAX_CATEGORY;
    if (!(knownType in ACCOUNT_TAX_CATEGORY)) {
      warnings.push(`Unknown account type "${account.type}" for "${account.label}" - treating as taxable`);
    }
    const category = ACCOUNT_TAX_CATEGORY[knownType] || 'taxable';
    balancesByType[category] += account.balance;
  });

  // Calculate annual contribution from monthly contributions
  const annualContribution = accounts.reduce(
    (sum, account) => sum + (account.monthlyContribution || 0) * 12,
    0
  );

  // Calculate annual expenses
  const incomeExpenses = snapshot.incomeExpenses as IncomeExpensesJson | null;
  let annualExpenses: number;

  if (incomeExpenses?.monthlyEssential || incomeExpenses?.monthlyDiscretionary) {
    // Use actual expense data if available
    const monthly = (incomeExpenses.monthlyEssential || 0) + (incomeExpenses.monthlyDiscretionary || 0);
    annualExpenses = monthly * 12;
  } else {
    // Derive from income and savings rate
    annualExpenses = deriveAnnualExpenses(
      parseFloat(snapshot.annualIncome),
      parseFloat(snapshot.savingsRate)
    );
  }

  // Estimate debt payments
  const debts = (snapshot.debts || []) as DebtJson[];
  const annualDebtPayments = estimateAnnualDebtPayments(debts);

  // Estimate healthcare costs based on retirement age (use retirement age for initial estimate)
  const annualHealthcareCosts = (overrides.annualHealthcareCosts as number) ??
    estimateHealthcareCosts(snapshot.targetRetirementAge);

  // Build projection input with defaults and overrides
  const projectionInput: ProjectionInput = {
    currentAge,
    retirementAge: snapshot.targetRetirementAge,
    maxAge: (overrides.maxAge as number) ?? DEFAULT_MAX_AGE,
    balancesByType,
    annualContribution,
    contributionAllocation: (overrides.contributionAllocation as BalanceByType) ?? DEFAULT_CONTRIBUTION_ALLOCATION,
    expectedReturn: (overrides.expectedReturn as number) ?? DEFAULT_RETURN_RATES[riskTolerance],
    inflationRate: (overrides.inflationRate as number) ?? DEFAULT_INFLATION_RATE,
    contributionGrowthRate: (overrides.contributionGrowthRate as number) ?? DEFAULT_CONTRIBUTION_GROWTH_RATE,
    annualExpenses,
    annualHealthcareCosts,
    healthcareInflationRate: (overrides.healthcareInflationRate as number) ?? DEFAULT_HEALTHCARE_INFLATION_RATE,
    socialSecurityAge: (overrides.socialSecurityAge as number) ?? DEFAULT_SS_AGE,
    socialSecurityMonthly: (overrides.socialSecurityMonthly as number) ??
      estimateSocialSecurityMonthly(parseFloat(snapshot.annualIncome)),
    annualDebtPayments,
  };

  // Run projection with performance timing
  const timer = createTimer();
  const result = runProjection(projectionInput);
  const calculationTimeMs = timer.getElapsed();

  if (process.env.NODE_ENV === 'development') {
    console.log(`Projection calculated in ${calculationTimeMs}ms`);
  }

  return {
    projection: result,
    // Enhanced input echo for debugging
    inputs: {
      currentAge,
      retirementAge: projectionInput.retirementAge,
      maxAge: projectionInput.maxAge,
      expectedReturn: projectionInput.expectedReturn,
      inflationRate: projectionInput.inflationRate,
      contributionGrowthRate: projectionInput.contributionGrowthRate,
      socialSecurityAge: projectionInput.socialSecurityAge,
      socialSecurityMonthly: projectionInput.socialSecurityMonthly,
      // Derived values for transparency
      annualExpenses,
      annualDebtPayments,
      annualContribution,
      startingBalancesByType: balancesByType,
    },
    meta: {
      calculationTimeMs,
      warnings: warnings.length > 0 ? warnings : undefined,
    },
  };
}

/**
 * GET - Run projection with all defaults
 */
export async function GET() {
  try {
    const user = await getServerUser();
    if (!user) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const result = await calculateProjection(user.id);

    if ('error' in result) {
      return NextResponse.json({ message: result.error }, { status: result.status });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Projection calculation error:', error);
    return NextResponse.json(
      { message: 'Failed to calculate projection' },
      { status: 500 }
    );
  }
}

/**
 * POST - Run projection with optional overrides
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getServerUser();
    if (!user) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    // Validate request body (optional overrides)
    const body = await request.json();
    const parseResult = projectionRequestSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        { message: 'Invalid data', errors: parseResult.error.flatten() },
        { status: 400 }
      );
    }

    const result = await calculateProjection(user.id, parseResult.data);

    if ('error' in result) {
      return NextResponse.json({ message: result.error }, { status: result.status });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Projection calculation error:', error);
    return NextResponse.json(
      { message: 'Failed to calculate projection' },
      { status: 500 }
    );
  }
}
```

#### 2. Create Index Export
**File**: `src/lib/projections/index.ts`

```typescript
export * from './types';
export * from './assumptions';
export * from './engine';
```

### Success Criteria:

#### Automated Verification:
- [x] TypeScript compiles without errors: `npm run typecheck`
- [x] Linting passes: `npm run lint`
- [x] Integration tests pass (created in Phase 7)

#### Manual Verification:
- [ ] API returns 401 for unauthenticated requests
- [ ] API returns 404 when no financial snapshot exists
- [ ] API returns valid projection for authenticated user with data

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation that the API endpoint works correctly with real user data before proceeding to Phase 6.

---

## Phase 6: Unit Tests

### Overview
Create comprehensive unit tests for the projection engine calculations.

### Changes Required:

#### 1. Create Engine Tests
**File**: `src/lib/projections/__tests__/engine.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { runProjection, withdrawFromAccounts } from '../engine';
import type { ProjectionInput, BalanceByType } from '../types';

describe('withdrawFromAccounts', () => {
  it('should withdraw from taxable first', () => {
    const balances: BalanceByType = {
      taxable: 50000,
      taxDeferred: 100000,
      taxFree: 50000,
    };

    const result = withdrawFromAccounts(30000, balances);

    expect(result.withdrawals.taxable).toBe(30000);
    expect(result.withdrawals.taxDeferred).toBe(0);
    expect(result.withdrawals.taxFree).toBe(0);
    expect(result.shortfall).toBe(0);
  });

  it('should cascade to taxDeferred when taxable exhausted', () => {
    const balances: BalanceByType = {
      taxable: 20000,
      taxDeferred: 100000,
      taxFree: 50000,
    };

    const result = withdrawFromAccounts(50000, balances);

    expect(result.withdrawals.taxable).toBe(20000);
    expect(result.withdrawals.taxDeferred).toBe(30000);
    expect(result.withdrawals.taxFree).toBe(0);
    expect(result.shortfall).toBe(0);
  });

  it('should report shortfall when all accounts exhausted', () => {
    const balances: BalanceByType = {
      taxable: 10000,
      taxDeferred: 10000,
      taxFree: 10000,
    };

    const result = withdrawFromAccounts(50000, balances);

    expect(result.withdrawals.taxable).toBe(10000);
    expect(result.withdrawals.taxDeferred).toBe(10000);
    expect(result.withdrawals.taxFree).toBe(10000);
    expect(result.shortfall).toBe(20000);
  });
});

describe('runProjection', () => {
  const baseInput: ProjectionInput = {
    currentAge: 30,
    retirementAge: 65,
    maxAge: 90,
    balancesByType: { taxDeferred: 50000, taxFree: 25000, taxable: 25000 },
    annualContribution: 20000,
    contributionAllocation: { taxDeferred: 60, taxFree: 30, taxable: 10 },
    expectedReturn: 0.06,
    inflationRate: 0.025,
    contributionGrowthRate: 0,
    annualExpenses: 50000,
    annualHealthcareCosts: 6500, // Medicare-age estimate
    healthcareInflationRate: 0.05, // 5% healthcare inflation
    socialSecurityAge: 67,
    socialSecurityMonthly: 2000,
    annualDebtPayments: 0,
  };

  it('should generate correct number of records', () => {
    const result = runProjection(baseInput);

    // 30 to 90 = 61 years of records
    expect(result.records.length).toBe(61);
    expect(result.records[0].age).toBe(30);
    expect(result.records[60].age).toBe(90);
  });

  it('should accumulate during pre-retirement', () => {
    const result = runProjection(baseInput);

    // Balance should grow during accumulation phase
    const ageAt30 = result.records.find(r => r.age === 30)!;
    const ageAt64 = result.records.find(r => r.age === 64)!;

    expect(ageAt64.balance).toBeGreaterThan(ageAt30.balance);
    expect(ageAt30.inflows).toBeGreaterThan(0); // Contributions
    expect(ageAt30.outflows).toBe(0); // No withdrawals yet
  });

  it('should draw down during retirement', () => {
    const result = runProjection(baseInput);

    const ageAt65 = result.records.find(r => r.age === 65)!;
    const ageAt66 = result.records.find(r => r.age === 66)!;

    expect(ageAt65.outflows).toBeGreaterThan(0); // Expenses
    expect(ageAt66.withdrawalsByType).toBeDefined();
  });

  it('should include Social Security income after SS age', () => {
    const result = runProjection(baseInput);

    const ageAt66 = result.records.find(r => r.age === 66)!;
    const ageAt67 = result.records.find(r => r.age === 67)!;

    expect(ageAt66.inflows).toBe(0); // Before SS age
    expect(ageAt67.inflows).toBeGreaterThan(0); // After SS age
  });

  it('should reduce contributions by debt payments', () => {
    const inputWithDebt = {
      ...baseInput,
      annualDebtPayments: 10000,
    };

    const withDebt = runProjection(inputWithDebt);
    const withoutDebt = runProjection(baseInput);

    // With debt should have lower ending balance
    expect(withDebt.summary.totalContributions).toBeLessThan(withoutDebt.summary.totalContributions);
  });

  it('should handle already retired case', () => {
    const retiredInput = {
      ...baseInput,
      currentAge: 70,
      retirementAge: 65,
    };

    const result = runProjection(retiredInput);

    // Should skip accumulation, start drawdown immediately
    expect(result.records[0].age).toBe(70);
    expect(result.records[0].outflows).toBeGreaterThan(0);
    expect(result.summary.totalContributions).toBe(0);
  });

  it('should track balance by account type', () => {
    const result = runProjection(baseInput);

    const firstRecord = result.records[0];
    expect(firstRecord.balanceByType).toBeDefined();
    expect(firstRecord.balanceByType.taxDeferred).toBeGreaterThan(0);
    expect(firstRecord.balanceByType.taxFree).toBeGreaterThan(0);
    expect(firstRecord.balanceByType.taxable).toBeGreaterThan(0);
  });

  it('should provide summary statistics', () => {
    const result = runProjection(baseInput);

    expect(result.summary.startingBalance).toBe(100000);
    expect(result.summary.totalContributions).toBeGreaterThan(0);
    expect(result.summary.totalWithdrawals).toBeGreaterThan(0);
    expect(result.summary.projectedRetirementBalance).toBeGreaterThan(0);
  });

  it('should complete in under 100ms', () => {
    const start = performance.now();
    runProjection(baseInput);
    const elapsed = performance.now() - start;

    expect(elapsed).toBeLessThan(100);
  });

  it('should track yearsUntilDepletion when balance runs out', () => {
    // Create scenario where user will run out of money
    const depletingInput: ProjectionInput = {
      currentAge: 60,
      retirementAge: 65,
      maxAge: 90,
      balancesByType: { taxDeferred: 50000, taxFree: 25000, taxable: 25000 }, // Only 100k
      annualContribution: 5000,
      contributionAllocation: { taxDeferred: 60, taxFree: 30, taxable: 10 },
      expectedReturn: 0.04,
      inflationRate: 0.03,
      contributionGrowthRate: 0,
      annualExpenses: 80000, // Very high expenses
      socialSecurityAge: 67,
      socialSecurityMonthly: 1500,
      annualDebtPayments: 0,
    };

    const result = runProjection(depletingInput);

    // Should run out of money at some point
    expect(result.summary.yearsUntilDepletion).not.toBeNull();
    expect(result.summary.yearsUntilDepletion).toBeGreaterThan(0);

    // Verify balance goes to 0 at depletion
    const depletionYear = result.summary.yearsUntilDepletion!;
    const recordAtDepletion = result.records.find(
      r => r.age === depletingInput.currentAge + depletionYear
    );
    expect(recordAtDepletion?.balance).toBe(0);
  });

  it('should grow contributions with contributionGrowthRate', () => {
    const inputWithGrowth = {
      ...baseInput,
      contributionGrowthRate: 0.03, // 3% annual growth
    };

    const withGrowth = runProjection(inputWithGrowth);
    const withoutGrowth = runProjection(baseInput);

    // With contribution growth should have higher total contributions
    expect(withGrowth.summary.totalContributions).toBeGreaterThan(
      withoutGrowth.summary.totalContributions
    );

    // And higher retirement balance
    expect(withGrowth.summary.projectedRetirementBalance).toBeGreaterThan(
      withoutGrowth.summary.projectedRetirementBalance
    );
  });

  it('should not have negative balances even when depleted', () => {
    const depletingInput: ProjectionInput = {
      currentAge: 65,
      retirementAge: 65,
      maxAge: 90,
      balancesByType: { taxDeferred: 10000, taxFree: 5000, taxable: 5000 }, // Only 20k
      annualContribution: 0,
      contributionAllocation: { taxDeferred: 60, taxFree: 30, taxable: 10 },
      expectedReturn: 0.04,
      inflationRate: 0.02,
      contributionGrowthRate: 0,
      annualExpenses: 50000, // High expenses
      socialSecurityAge: 67,
      socialSecurityMonthly: 1000,
      annualDebtPayments: 0,
    };

    const result = runProjection(depletingInput);

    // All balances should be >= 0
    result.records.forEach(record => {
      expect(record.balance).toBeGreaterThanOrEqual(0);
      expect(record.balanceByType.taxDeferred).toBeGreaterThanOrEqual(0);
      expect(record.balanceByType.taxFree).toBeGreaterThanOrEqual(0);
      expect(record.balanceByType.taxable).toBeGreaterThanOrEqual(0);
    });
  });
});
```

#### 2. Create Assumptions Tests
**File**: `src/lib/projections/__tests__/assumptions.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import {
  estimateSocialSecurityMonthly,
  deriveAnnualExpenses,
  estimateAnnualDebtPayments,
  estimateHealthcareCosts,
  SSA_MAX_MONTHLY_BENEFIT,
  DEFAULT_HEALTHCARE_COSTS_BY_AGE,
} from '../assumptions';

describe('estimateSocialSecurityMonthly', () => {
  it('should estimate ~55% replacement for low income', () => {
    const monthly = estimateSocialSecurityMonthly(25000);
    const annualized = monthly * 12;
    const replacement = annualized / 25000;

    expect(replacement).toBeGreaterThan(0.40);
    expect(replacement).toBeLessThan(0.50); // After 20% haircut
  });

  it('should estimate ~40% replacement for middle income', () => {
    const monthly = estimateSocialSecurityMonthly(60000);
    const annualized = monthly * 12;
    const replacement = annualized / 60000;

    expect(replacement).toBeGreaterThan(0.25);
    expect(replacement).toBeLessThan(0.40);
  });

  it('should cap at SSA maximum', () => {
    const monthly = estimateSocialSecurityMonthly(500000);

    expect(monthly).toBeLessThanOrEqual(SSA_MAX_MONTHLY_BENEFIT);
  });

  it('should return 0 for 0 income', () => {
    const monthly = estimateSocialSecurityMonthly(0);

    expect(monthly).toBe(0);
  });
});

describe('deriveAnnualExpenses', () => {
  it('should calculate spending as income minus savings', () => {
    const expenses = deriveAnnualExpenses(100000, 20);

    expect(expenses).toBe(80000);
  });

  it('should cap at 80% of income', () => {
    const expenses = deriveAnnualExpenses(100000, 5);

    expect(expenses).toBe(80000); // Capped, not 95000
  });

  it('should handle 0% savings rate', () => {
    const expenses = deriveAnnualExpenses(100000, 0);

    expect(expenses).toBe(80000); // Capped at 80%
  });
});

describe('estimateAnnualDebtPayments', () => {
  it('should calculate payments for single debt', () => {
    const debts = [{ balance: 10000, interestRate: 5 }];
    const annual = estimateAnnualDebtPayments(debts);

    // 10-year amortization at 5%
    expect(annual).toBeGreaterThan(1200);
    expect(annual).toBeLessThan(1400);
  });

  it('should sum payments for multiple debts', () => {
    const debts = [
      { balance: 10000, interestRate: 5 },
      { balance: 20000, interestRate: 7 },
    ];
    const annual = estimateAnnualDebtPayments(debts);

    expect(annual).toBeGreaterThan(3500);
  });

  it('should use default 5% rate when not specified', () => {
    const withRate = estimateAnnualDebtPayments([{ balance: 10000, interestRate: 5 }]);
    const withoutRate = estimateAnnualDebtPayments([{ balance: 10000 }]);

    expect(withRate).toBe(withoutRate);
  });

  it('should return 0 for empty debts', () => {
    const annual = estimateAnnualDebtPayments([]);

    expect(annual).toBe(0);
  });
});

describe('estimateHealthcareCosts', () => {
  it('should return pre-Medicare rate for age under 65', () => {
    expect(estimateHealthcareCosts(50)).toBe(DEFAULT_HEALTHCARE_COSTS_BY_AGE['under65']);
    expect(estimateHealthcareCosts(64)).toBe(DEFAULT_HEALTHCARE_COSTS_BY_AGE['under65']);
  });

  it('should return early Medicare rate for ages 65-74', () => {
    expect(estimateHealthcareCosts(65)).toBe(DEFAULT_HEALTHCARE_COSTS_BY_AGE['65to74']);
    expect(estimateHealthcareCosts(70)).toBe(DEFAULT_HEALTHCARE_COSTS_BY_AGE['65to74']);
    expect(estimateHealthcareCosts(74)).toBe(DEFAULT_HEALTHCARE_COSTS_BY_AGE['65to74']);
  });

  it('should return late retirement rate for ages 75+', () => {
    expect(estimateHealthcareCosts(75)).toBe(DEFAULT_HEALTHCARE_COSTS_BY_AGE['75plus']);
    expect(estimateHealthcareCosts(85)).toBe(DEFAULT_HEALTHCARE_COSTS_BY_AGE['75plus']);
    expect(estimateHealthcareCosts(100)).toBe(DEFAULT_HEALTHCARE_COSTS_BY_AGE['75plus']);
  });

  it('should return higher costs for 75+ than 65-74 (increased medical needs)', () => {
    expect(estimateHealthcareCosts(75)).toBeGreaterThan(estimateHealthcareCosts(65));
  });
});
```

### Success Criteria:

#### Automated Verification:
- [x] All unit tests pass: `npm test -- --run src/lib/projections`
- [x] TypeScript compiles without errors: `npm run typecheck`

#### Manual Verification:
- [ ] Test coverage is comprehensive for edge cases

---

## Phase 7: Integration Tests

### Overview
Create integration tests for the API endpoint.

### Changes Required:

#### 1. Create API Route Tests
**File**: `src/app/api/projections/calculate/route.test.ts`

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from './route';
import { NextRequest } from 'next/server';

// Mock auth
const mockGetServerUser = vi.fn();
vi.mock('@/lib/auth/server', () => ({
  getServerUser: () => mockGetServerUser(),
}));

// Mock database
const mockSelect = vi.fn();
const mockFrom = vi.fn();
const mockWhere = vi.fn();
const mockLimit = vi.fn();

vi.mock('@/db/client', () => ({
  db: {
    select: () => {
      mockSelect();
      return {
        from: (table: unknown) => {
          mockFrom(table);
          return {
            where: (condition: unknown) => {
              mockWhere(condition);
              return {
                limit: (n: number) => {
                  mockLimit(n);
                  return Promise.resolve([]);
                },
              };
            },
          };
        },
      };
    },
  },
}));

vi.mock('@/db/schema', () => ({
  financialSnapshot: { userId: 'user_id' },
}));

describe('POST /api/projections/calculate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return 401 when not authenticated', async () => {
    mockGetServerUser.mockResolvedValue(null);

    const request = new NextRequest('http://localhost:3000/api/projections/calculate', {
      method: 'POST',
      body: JSON.stringify({}),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.message).toBe('Unauthorized');
  });

  it('should return 404 when no financial snapshot exists', async () => {
    mockGetServerUser.mockResolvedValue({ id: 'test-user-id' });
    mockLimit.mockResolvedValue([]); // No snapshot

    const request = new NextRequest('http://localhost:3000/api/projections/calculate', {
      method: 'POST',
      body: JSON.stringify({}),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.message).toContain('Financial snapshot not found');
  });

  it('should return 400 for invalid override values', async () => {
    mockGetServerUser.mockResolvedValue({ id: 'test-user-id' });

    const request = new NextRequest('http://localhost:3000/api/projections/calculate', {
      method: 'POST',
      body: JSON.stringify({
        expectedReturn: -0.5, // Invalid: negative
      }),
    });

    const response = await POST(request);

    expect(response.status).toBe(400);
  });

  it('should validate contribution allocation sums to 100', async () => {
    mockGetServerUser.mockResolvedValue({ id: 'test-user-id' });

    const request = new NextRequest('http://localhost:3000/api/projections/calculate', {
      method: 'POST',
      body: JSON.stringify({
        contributionAllocation: {
          taxDeferred: 50,
          taxFree: 30,
          taxable: 10, // Sum = 90, not 100
        },
      }),
    });

    const response = await POST(request);

    expect(response.status).toBe(400);
  });
});
```

### Success Criteria:

#### Automated Verification:
- [x] All integration tests pass: `npm test -- --run src/app/api/projections`
- [x] TypeScript compiles without errors: `npm run typecheck`

#### Manual Verification:
- [ ] Tests cover all error cases (401, 404, 400)

---

## Testing Strategy

### Unit Tests:
- Projection engine core calculations
- Withdrawal ordering logic
- Assumptions functions (SS estimation, expense derivation, debt payments)
- Edge cases: already retired, zero balances, high inflation

### Integration Tests:
- API authentication
- API validation
- API with missing financial snapshot
- API with valid data (mocked)

### Manual Testing Steps:
1. Complete onboarding with sample data
2. Call `POST /api/projections/calculate` with no body
3. Verify response has `projection.records` array and `projection.summary`
4. Call with custom overrides (e.g., `expectedReturn: 0.10`)
5. Verify projection reflects the override
6. Test with already-retired scenario (birthYear that makes currentAge > retirementAge)

## Performance Considerations

- Engine is a pure function with no database calls during calculation
- Typical projection (60 years) should complete in <10ms
- Total API latency dominated by database fetch, target <200ms total
- No need for caching in MVP (projections are stateless)

## Future Enhancements

The following features are intentionally deferred from MVP but should be considered for future stories:

### RMD (Required Minimum Distribution) Calculations

**What**: IRS-mandated minimum withdrawals from tax-deferred accounts starting at age 73 (75 in 2033+).

**Why it matters**: Users with large 401k/Traditional IRA balances may be forced to withdraw more than needed for expenses, potentially pushing them into higher tax brackets.

**Implementation would require**:
- IRS Uniform Lifetime Table lookup by age
- Per-account RMD tracking (each account has its own RMD)
- Forcing withdrawals even when not needed for expenses
- Handling inherited IRA rules (different distribution schedules)
- Updating for legislative changes (SECURE Act, SECURE 2.0)

**Target users**: Those approaching or in retirement with significant tax-deferred assets ($500k+).

### Monte Carlo Simulations

**What**: Probabilistic modeling using thousands of randomized return sequences.

**Why it matters**: Shows probability of success rather than single-point estimates, accounts for sequence-of-returns risk.

**Implementation would require**:
- Historical return distribution data
- 1,000-10,000 simulation runs per projection
- Percentile-based result presentation (e.g., "80% chance of success")
- Async/background processing for performance

**Trade-off**: More realistic but harder to explain to users and slower to compute.

---

## References

- Research document: `thoughts/shared/research/2025-12-17-epic-3-projection-engine-implementation-readiness.md`
- Story scope: `thoughts/personal/tickets/epic-3/projection-modeling/story-1-scope.md`
- Onboarding API pattern: [route.ts](src/app/api/onboarding/complete/route.ts)
- Financial snapshot schema: [financial-snapshot.ts](src/db/schema/financial-snapshot.ts)
- Onboarding types: [onboarding.ts](src/types/onboarding.ts)