---
date: 2025-12-17T12:00:00-08:00
researcher: Claude
git_commit: 83987f9cd43a56d0609e18325285bcac6008d0ec
branch: main
repository: plan-smart
topic: "Epic 3 Story 1 - Projection Engine Implementation Readiness"
tags: [research, codebase, epic-3, projection-engine, financial-calculations, implementation-readiness]
status: complete
last_updated: 2025-12-17
last_updated_by: Claude
---

# Research: Epic 3 Story 1 - Projection Engine Implementation Readiness

**Date**: 2025-12-17T12:00:00-08:00
**Researcher**: Claude
**Git Commit**: 83987f9cd43a56d0609e18325285bcac6008d0ec
**Branch**: main
**Repository**: plan-smart

## Research Question
What existing code, patterns, and data structures can we leverage to implement the retirement projection engine (Epic 3 Story 1)?

## Summary

The codebase is **well-positioned** for implementing the projection engine. Key findings:

1. **Data Model Ready**: All required financial inputs are already collected and stored via Epic 2's enhanced onboarding
2. **API Patterns Established**: Clear conventions for POST endpoints with validation, auth, and error handling
3. **Calculation Patterns Exist**: Array reduction, aggregation, and transformation patterns are used throughout
4. **No Financial Math Exists**: Core projection algorithms (compound interest, inflation adjustment) need to be built from scratch
5. **Type System Strong**: Comprehensive TypeScript types and Zod schemas provide a solid foundation

**Estimated Implementation Effort**: This is primarily a greenfield calculation engine with well-defined inputs/outputs. The infrastructure exists; the algorithms need creation.

## Detailed Findings

### 1. Available Input Data (from `financial_snapshot` table)

All required projection inputs are already collected and stored:

| Field | Type | Location | Notes |
|-------|------|----------|-------|
| `birthYear` | integer | `financial_snapshot` | Calculate current age |
| `targetRetirementAge` | integer | `financial_snapshot` | End of accumulation phase |
| `annualIncome` | numeric(12,2) | `financial_snapshot` | For contribution calculations |
| `savingsRate` | numeric(5,2) | `financial_snapshot` | Percentage of income saved |
| `riskTolerance` | text | `financial_snapshot` | Maps to return assumptions |
| `investmentAccounts` | JSONB | `financial_snapshot` | Array with balances & contributions |
| `incomeExpenses` | JSONB | `financial_snapshot` | Monthly essential/discretionary |
| `debts` | JSONB | `financial_snapshot` | For net worth calculations |
| `primaryResidence` | JSONB | `financial_snapshot` | Home equity |

**Schema Reference**: [financial-snapshot.ts](src/db/schema/financial-snapshot.ts)

### 2. Reusable Calculation Patterns

The codebase has several patterns we can model the projection engine after:

#### Array Aggregation Pattern
Used extensively for summing account balances:
```typescript
// From src/app/api/onboarding/complete/route.ts:46-49
const totalSavings = (data.investmentAccounts || []).reduce(
  (sum, account) => sum + account.balance,
  0
);
```

#### Timer/Performance Pattern
Useful for ensuring <1s performance requirement:
```typescript
// From src/lib/monitoring/performance.ts:91-97
export function createTimer(): { getElapsed: () => number; startTime: number } {
  const startTime = Date.now();
  return {
    startTime,
    getElapsed: () => Date.now() - startTime,
  };
}
```

#### Structured Return Pattern
Rate limiter returns structured results, good model for projection output:
```typescript
// From src/lib/auth/rate-limit.ts
return { allowed: boolean, remaining: number, resetAt?: Date };
```

### 3. API Route Structure to Follow

New projection endpoint should follow established patterns:

```typescript
// Recommended: POST /api/projections/calculate
// File: src/app/api/projections/calculate/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getServerUser } from '@/lib/auth/server';

const projectionInputSchema = z.object({
  // Define input validation
});

export async function POST(request: NextRequest) {
  // 1. Authenticate
  const user = await getServerUser();
  if (!user) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  // 2. Validate input
  const body = await request.json();
  const parseResult = projectionInputSchema.safeParse(body);
  if (!parseResult.success) {
    return NextResponse.json(
      { message: 'Invalid data', errors: parseResult.error.flatten() },
      { status: 400 }
    );
  }

  // 3. Run projection
  const projection = runProjection(parseResult.data);

  // 4. Return results
  return NextResponse.json({ projection });
}
```

**Reference**: [onboarding/complete/route.ts](src/app/api/onboarding/complete/route.ts)

### 4. Type Definitions Needed

#### Input Types (partially exists)
```typescript
// Extend from existing types in src/types/onboarding.ts
interface ProjectionInput {
  currentAge: number;           // Derived from birthYear
  retirementAge: number;        // From targetRetirementAge
  maxAge: number;               // Default 90
  currentBalance: number;       // Sum of investmentAccounts
  annualContribution: number;   // From savingsRate * annualIncome
  expectedReturn: number;       // User-overridable (default from riskTolerance)
  inflationRate: number;        // Configurable assumption
  annualExpenses: number;       // From incomeExpenses (annualized)
}

// API request allows optional overrides
interface ProjectionRequest {
  // Optional overrides - if not provided, derive from financial snapshot
  expectedReturn?: number;      // Override default from risk tolerance
  inflationRate?: number;       // Override default 2.5%
  maxAge?: number;              // Override default 90

  // Social Security parameters
  socialSecurityAge?: number;   // Age when SS benefits begin (default: 67)
  socialSecurityMonthly?: number; // Estimated monthly SS benefit (in today's dollars)

  // Contribution allocation (must sum to 100)
  contributionAllocation?: {
    taxDeferred: number;        // % to 401k, Traditional IRA (default: 60)
    taxFree: number;            // % to Roth IRA, Roth 401k (default: 30)
    taxable: number;            // % to Brokerage, Cash (default: 10)
  };
}
```

#### Output Types (new)
```typescript
// As specified in story-1-scope.md, extended for tax-aware tracking
interface ProjectionRecord {
  age: number;
  year: number;
  balance: number;
  inflows: number;
  outflows: number;

  // Account-level breakdown for tax strategy visibility
  balanceByType?: {
    taxDeferred: number;    // 401k, Traditional IRA
    taxFree: number;        // Roth IRA, Roth 401k
    taxable: number;        // Brokerage, Cash
  };
  withdrawalsByType?: {
    taxDeferred: number;
    taxFree: number;
    taxable: number;
  };
}

interface ProjectionResult {
  records: ProjectionRecord[];
  summary: {
    startingBalance: number;
    endingBalance: number;
    totalContributions: number;
    totalWithdrawals: number;
    yearsUntilDepletion: number | null;
  };
}
```

### 5. Components to Build

| Component | Description | Complexity |
|-----------|-------------|------------|
| `src/lib/projections/engine.ts` | Core projection calculator | Medium |
| `src/lib/projections/assumptions.ts` | Return/inflation rate mappings | Low |
| `src/lib/projections/types.ts` | TypeScript interfaces | Low |
| `src/lib/validation/projections.ts` | Zod schemas for input | Low |
| `src/app/api/projections/calculate/route.ts` | API endpoint | Low |
| `src/app/api/projections/calculate/route.test.ts` | Unit tests | Medium |

### 6. Algorithm Requirements

The core projection algorithm needs to implement:

#### Accumulation Phase (currentAge → retirementAge)
```typescript
for each year until retirement:
  balance = previousBalance * (1 + expectedReturn)
  balance += annualContribution
  inflows = annualContribution
  outflows = 0
```

#### Drawdown Phase (retirementAge → maxAge)
```typescript
for each year after retirement:
  // Calculate inflation-adjusted expenses
  expensesNeeded = annualExpenses * (1 + inflationRate)^yearsFromRetirement

  // Calculate Social Security income (inflation-adjusted, starts at SS age)
  ssIncome = 0
  if (currentAge >= socialSecurityAge) {
    ssIncome = (socialSecurityMonthly * 12) * (1 + inflationRate)^yearsFromRetirement
  }

  // Net withdrawal needed from portfolio
  withdrawalNeeded = Math.max(0, expensesNeeded - ssIncome)

  balance = previousBalance * (1 + expectedReturn)
  balance -= withdrawalNeeded
  inflows = ssIncome  // SS counts as inflow in retirement
  outflows = expensesNeeded
```

### 7. Tax-Aware Withdrawal Strategy

Account types map to tax categories:

| Account Type | Tax Category | Withdrawal Order |
|--------------|--------------|------------------|
| Brokerage, Cash | `taxable` | 1st (capital gains) |
| 401k, Traditional IRA | `taxDeferred` | 2nd (ordinary income) |
| Roth IRA, Roth 401k | `taxFree` | 3rd (tax-free) |

**Withdrawal Algorithm:**
```typescript
function withdrawFromAccounts(amountNeeded: number, accounts: AccountBalances): WithdrawalResult {
  const withdrawals = { taxable: 0, taxDeferred: 0, taxFree: 0 };
  let remaining = amountNeeded;

  // 1. Withdraw from taxable accounts first (capital gains treatment)
  if (remaining > 0 && accounts.taxable > 0) {
    const fromTaxable = Math.min(remaining, accounts.taxable);
    withdrawals.taxable = fromTaxable;
    remaining -= fromTaxable;
  }

  // 2. Withdraw from tax-deferred accounts (ordinary income)
  if (remaining > 0 && accounts.taxDeferred > 0) {
    const fromDeferred = Math.min(remaining, accounts.taxDeferred);
    withdrawals.taxDeferred = fromDeferred;
    remaining -= fromDeferred;
  }

  // 3. Withdraw from tax-free accounts last (preserve tax-free growth)
  if (remaining > 0 && accounts.taxFree > 0) {
    const fromTaxFree = Math.min(remaining, accounts.taxFree);
    withdrawals.taxFree = fromTaxFree;
    remaining -= fromTaxFree;
  }

  return { withdrawals, shortfall: remaining };
}
```

### 8. Risk Tolerance → Return Mapping (Defaults)

These serve as **default values** that users can override:

| Risk Tolerance | Default Return | Rationale |
|----------------|----------------|-----------|
| conservative | 4.0% | Bond-heavy portfolio |
| moderate | 6.0% | Balanced 60/40 |
| aggressive | 8.0% | Equity-heavy |

**Default inflation**: 2.5% (historical average)

**Override behavior**: When user provides `expectedReturn` in the API request, it takes precedence over the risk tolerance mapping. This enables "what-if" analysis scenarios.

## Code References

- `src/db/schema/financial-snapshot.ts:40-62` - Financial snapshot schema with all input fields
- `src/app/api/onboarding/complete/route.ts:46-54` - Aggregation calculation patterns
- `src/lib/validation/onboarding.ts:87-93` - Zod schema composition pattern
- `src/lib/auth/server.ts:57-60` - Authentication helper
- `src/lib/monitoring/performance.ts:91-97` - Timer utility
- `src/db/secure-query.ts:31-37` - Type-safe data access pattern
- `src/types/onboarding.ts:54-60` - Investment account type definition

## Architecture Insights

### Patterns to Follow
1. **Stateless calculation**: Engine should be pure function with no side effects
2. **Separation of concerns**: Input mapping, calculation, output formatting as separate layers
3. **Configurable assumptions**: Return rates and inflation should be parameters, not hardcoded
4. **Type safety**: Use Zod for runtime validation, TypeScript for compile-time

### Recommended File Structure
```
src/lib/projections/
├── engine.ts           # Core projection logic
├── assumptions.ts      # Default values and mappings
├── types.ts            # TypeScript interfaces
├── index.ts            # Public exports
└── __tests__/
    └── engine.test.ts  # Unit tests for algorithms
```

### Data Flow
```
Request → Auth → Validate → Fetch Financial Snapshot → Map to Input → Run Projection → Format Output → Response
```

## Historical Context (from thoughts/)

- `thoughts/personal/tickets/epic-3/projection-modeling/story-1-scope.md` - Story requirements and output format
- `thoughts/shared/plans/2025-12-10-epic-2-onboarding-wizard-implementation.md` - JSONB schema for investment accounts and debts
- `thoughts/personal/tickets/epic-1/accounts/nfr.md` - Performance baseline (<500ms for similar operations)

**Note**: No prior architectural decisions exist for calculation engines. This is the first computational feature in the system.

## Decisions Made

1. **Return Rate Assumptions**: ✅ Users CAN override default return rates. Risk tolerance provides defaults, but users have full control to customize.
2. **Inflation Assumption**: ✅ Configurable per projection. Default is 2.5%, but users can override via `inflationRate` parameter.
3. **Social Security**: ✅ YES, account for SS income in drawdown phase. Reduces required portfolio withdrawals.
4. **Account Types & Tax Strategy**: ✅ Apply tax-aware withdrawal strategies based on account type:
   - **Roth IRA/401k**: Tax-free withdrawals, withdraw last to maximize tax-free growth
   - **Traditional 401k/IRA**: Taxable withdrawals, withdraw first in lower tax brackets
   - **Brokerage**: Capital gains treatment, use for bridging gaps
   - **Strategy**: Implement basic tax-efficient withdrawal ordering (taxable → tax-deferred → tax-free)
5. **Rebalancing**: ✅ Uniform return rate applied across all account types. No portfolio drift modeling for MVP.
6. **Already Retired**: ✅ If `currentAge >= targetRetirementAge`, skip accumulation phase entirely and begin drawdown immediately from year 1.
7. **Balance Depletion**: ✅ When balance hits $0 before maxAge, stop at $0 and show "shortfall" years. Cap withdrawals at available balance (no negative balances).
8. **Contribution Allocation**: ✅ User-specified allocation percentages per account type. Reflects real-world contribution strategies (e.g., max 401k first, then Roth, then brokerage).
9. **Growth Timing**: ✅ End of year model - apply contributions/withdrawals first, then growth. Formula: `(balance + cashflow) × (1 + return)`. Simple, standard approach, slightly conservative for drawdown projections.
10. **Expense Source / Missing Expense Data**: ✅ If `incomeExpenses` not provided, derive from income minus savings (`income × (1 - savingsRate)`), capped at 80% of income. Uses real data when available, falls back to derived spending, never blocks projection.
11. **Social Security Defaults**: ✅ Estimate based on income using simplified SSA formula with 20% conservative haircut. Tiered replacement rates: ~55% for <$30k, ~40% for $30k-$80k, ~30% for >$80k income, capped at SSA max (~$4,500/month). User can always override with actual SSA estimate.
12. **Debt Payments**: ✅ YES, factor debt payments into accumulation phase cash flow. Reduces effective contribution capacity. Use stored debt data (balance, interest rate) to estimate monthly payments and subtract from available savings.

## Implementation Checklist

- [ ] Create `src/lib/projections/types.ts` with input/output interfaces
- [ ] Create `src/lib/projections/assumptions.ts` with default rates
- [ ] Create `src/lib/projections/engine.ts` with core algorithm
- [ ] Create `src/lib/validation/projections.ts` with Zod schemas
- [ ] Create `src/app/api/projections/calculate/route.ts` endpoint
- [ ] Add unit tests for engine calculations
- [ ] Add integration tests for API endpoint
- [ ] Verify <1s performance requirement
- [ ] Add to existing logging/monitoring patterns
