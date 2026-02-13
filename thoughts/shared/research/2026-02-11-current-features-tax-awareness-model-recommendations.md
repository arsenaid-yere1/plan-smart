---
date: 2026-02-11T12:00:00-08:00
researcher: Claude
git_commit: 0f1b206e50d301bb784eb1348262242892c68fe5
branch: main
repository: plan-smart
topic: "Current Features Analysis and Tax Awareness Model Recommendations"
tags: [research, codebase, tax-awareness, feature-analysis, projection-engine, recommendations]
status: complete
last_updated: 2026-02-11
last_updated_by: Claude
---

# Research: Current Features Analysis and Tax Awareness Model Recommendations

**Date**: 2026-02-11T12:00:00-08:00
**Researcher**: Claude
**Git Commit**: 0f1b206e50d301bb784eb1348262242892c68fe5
**Branch**: main
**Repository**: plan-smart

## Research Question
What are the current features of the PlanSmart application and what tax awareness model enhancements should be recommended?

## Summary

PlanSmart is a **retirement planning application** built with Next.js 15, React 19, TypeScript, and Supabase. The application currently has a robust foundation for tax-aware retirement planning:

### Current Capabilities
1. **Account Type Classification**: 6 account types mapped to 3 tax categories (taxDeferred, taxFree, taxable)
2. **Tax-Aware Withdrawal Strategy**: Basic ordering (taxable → taxDeferred → taxFree) to preserve tax-free growth
3. **Multi-Phase Spending**: Configurable spending phases (Go-Go, Slow-Go, No-Go) with multipliers
4. **Depletion Target Planning**: Reserve floor and sustainable spending calculations
5. **Income Stream Modeling**: Social Security, pensions, and other retirement income

### Key Gaps Identified
1. **No actual tax calculations** - only strategic ordering, no liability estimation
2. **No RMD (Required Minimum Distribution) enforcement** for ages 73+
3. **No Roth conversion optimization** strategies
4. **No tax bracket modeling** or marginal rate calculations
5. **State residence captured but unused** for state tax considerations

### Recommendations (Priority Order)
1. **Phase 1**: RMD Enforcement (High impact, moderate complexity)
2. **Phase 2**: Tax Liability Estimation (High impact, high complexity)
3. **Phase 3**: Roth Conversion Optimization (High value, high complexity)
4. **Phase 4**: State Tax Integration (Medium impact, moderate complexity)

---

## Detailed Findings

### 1. Current Application Architecture

#### Technology Stack
| Component | Technology | Version |
|-----------|------------|---------|
| Framework | Next.js | 15.1.0 |
| UI Library | React | 19.0.0 |
| Database | PostgreSQL (Supabase) | - |
| ORM | Drizzle | 0.44.7 |
| Charting | Recharts | 3.6.0 |
| Validation | Zod | 4.1.13 |
| State | React Hook Form | 7.66.1 |

#### Core Feature Epics Implemented
1. **Epic 1**: Authentication & User Profile
2. **Epic 2**: Enhanced Onboarding Wizard
3. **Epic 3**: Projection Engine & Visualization
4. **Epic 7**: Income Source Classification (partial)
5. **Epic 10**: Depletion Target & Reserve Controls

### 2. Tax-Related Data Structures

#### Account Type Classification
**File**: [src/lib/projections/types.ts:54-61](https://github.com/arsenaid-yere1/plan-smart/blob/0f1b206e50d301bb784eb1348262242892c68fe5/src/lib/projections/types.ts#L54-L61)

```typescript
export type TaxCategory = 'taxDeferred' | 'taxFree' | 'taxable';

export const ACCOUNT_TAX_CATEGORY: Record<AccountType, TaxCategory> = {
  '401k': 'taxDeferred',
  'IRA': 'taxDeferred',
  'Roth_IRA': 'taxFree',
  'Brokerage': 'taxable',
  'Cash': 'taxable',
  'Other': 'taxable',
};
```

#### Balance Tracking by Tax Type
**File**: [src/lib/projections/types.ts:66-70](https://github.com/arsenaid-yere1/plan-smart/blob/0f1b206e50d301bb784eb1348262242892c68fe5/src/lib/projections/types.ts#L66-L70)

```typescript
export interface BalanceByType {
  taxDeferred: number;
  taxFree: number;
  taxable: number;
}
```

This structure is used throughout:
- Portfolio balances (tracked year-by-year)
- Contribution allocations (percentage-based)
- Withdrawal tracking (by account type)

#### Financial Snapshot Schema
**File**: [src/db/schema/financial-snapshot.ts](https://github.com/arsenaid-yere1/plan-smart/blob/0f1b206e50d301bb784eb1348262242892c68fe5/src/db/schema/financial-snapshot.ts)

Key tax-relevant fields already collected:
- `stateOfResidence`: US state code (unused for tax calculations)
- `filingStatus`: single | married | head_of_household
- `investmentAccounts`: JSONB array with type, balance, contributions
- `incomeSources`: Tax-classified income with flexibility flags

### 3. Current Tax-Aware Withdrawal Strategy

#### Withdrawal Ordering Logic
**File**: [src/lib/projections/engine.ts:28-57](https://github.com/arsenaid-yere1/plan-smart/blob/0f1b206e50d301bb784eb1348262242892c68fe5/src/lib/projections/engine.ts#L28-L57)

Current implementation uses a **fixed priority order**:

| Priority | Account Type | Tax Treatment | Rationale |
|----------|--------------|---------------|-----------|
| 1st | Taxable (Brokerage, Cash) | Capital gains | Lower tax rates, no growth penalty |
| 2nd | Tax-Deferred (401k, IRA) | Ordinary income | Taxable but has been growing deferred |
| 3rd | Tax-Free (Roth IRA) | Tax-free | Preserve tax-free compounding |

**Limitations**:
- No consideration of actual tax brackets
- No awareness of RMD requirements
- No optimization for tax liability minimization
- Doesn't account for capital gains basis

#### Contribution Allocation
**File**: [src/lib/projections/assumptions.ts:31-35](https://github.com/arsenaid-yere1/plan-smart/blob/0f1b206e50d301bb784eb1348262242892c68fe5/src/lib/projections/assumptions.ts#L31-L35)

```typescript
export const DEFAULT_CONTRIBUTION_ALLOCATION: BalanceByType = {
  taxDeferred: 60,  // 60% to 401(k)/Traditional IRA
  taxFree: 30,      // 30% to Roth IRA
  taxable: 10,      // 10% to brokerage
};
```

### 4. Visualization Components

#### Projection Chart
**File**: [src/components/projections/ProjectionChart.tsx](https://github.com/arsenaid-yere1/plan-smart/blob/0f1b206e50d301bb784eb1348262242892c68fe5/src/components/projections/ProjectionChart.tsx)

Current features:
- Balance trajectory over time
- Phase distinction (accumulation vs retirement)
- Reserve floor visualization
- Depletion target tracking
- Inflation adjustment toggle

**Gap**: `balanceByType` data is calculated but **not visualized**. Users cannot see breakdown by tax category.

#### Dashboard Components
**Files**:
- [src/app/dashboard/dashboard-client.tsx](https://github.com/arsenaid-yere1/plan-smart/blob/0f1b206e50d301bb784eb1348262242892c68fe5/src/app/dashboard/dashboard-client.tsx)
- [src/components/dashboard/NetWorthSummary.tsx](https://github.com/arsenaid-yere1/plan-smart/blob/0f1b206e50d301bb784eb1348262242892c68fe5/src/components/dashboard/NetWorthSummary.tsx)

Current: Shows net worth, retirement balance projections, AI summaries.
Missing: Tax-categorized balance breakdown visualization.

### 5. Income Source Classification (Epic 7)

#### Tax Flexibility Modeling
**File**: [src/types/income-sources.ts:14-18](https://github.com/arsenaid-yere1/plan-smart/blob/0f1b206e50d301bb784eb1348262242892c68fe5/src/types/income-sources.ts#L14-L18)

```typescript
export interface TaxFlexibility {
  canDefer: boolean;      // Can defer income to future years
  canReduce: boolean;     // Can reduce through deductions/expenses
  canRestructure: boolean; // Can change entity structure
}
```

Income types with defaults:
- **W-2 Employment**: No flexibility
- **Self-Employed**: Full flexibility
- **Business Owner**: Full flexibility
- **Contract/1099**: Partial (can defer and reduce)
- **Rental Income**: Can reduce only
- **Investment Income**: Can defer only

**Status**: Classification is collected but not used in projections.

### 6. What's NOT Implemented

Based on comprehensive codebase analysis:

| Feature | Status | Notes |
|---------|--------|-------|
| Tax bracket calculations | Not implemented | Comments reference "ordinary income" but no math |
| Federal tax liability estimation | Not implemented | - |
| State tax calculations | Not implemented | State field exists, unused |
| RMD enforcement | Not implemented | Explicitly deferred in planning docs |
| Roth conversion strategies | Not documented | No planning or implementation |
| Capital gains basis tracking | Not implemented | Withdrawals are gross amounts |
| Medicare IRMAA brackets | Not implemented | - |
| ACA subsidy optimization | Not implemented | - |
| Tax-loss harvesting | Not implemented | - |

---

## Architecture Insights

### Data Flow: Financial Data to Projection

```
1. Onboarding → Financial Snapshot (DB)
2. Financial Snapshot → Input Builder → ProjectionInput
3. ProjectionInput → Engine → ProjectionResult
4. ProjectionResult → Chart/Table/Summary Components
```

**Extension Point**: The Input Builder pattern ([src/lib/projections/input-builder.ts](https://github.com/arsenaid-yere1/plan-smart/blob/0f1b206e50d301bb784eb1348262242892c68fe5/src/lib/projections/input-builder.ts)) provides clean abstraction for adding tax calculation inputs.

### Withdrawal Strategy: Current vs Enhanced

**Current (engine.ts:28-57)**:
```typescript
// Simple fixed ordering
1. Withdraw from taxable → 2. Withdraw from taxDeferred → 3. Withdraw from taxFree
```

**Enhanced (Proposed)**:
```typescript
// Tax-bracket-aware ordering
1. Calculate income already received (SS, pensions)
2. Determine remaining "room" in current tax bracket
3. Fill lower brackets with tax-deferred withdrawals
4. Use Roth for amounts that would exceed desired bracket
5. Use taxable for capital gains (favorable rates)
6. Enforce RMD from tax-deferred if applicable
```

---

## Tax Awareness Model Recommendations

### Phase 1: RMD Enforcement (Recommended Priority: HIGH)

**Impact**: Critical for users 73+ with significant tax-deferred assets
**Complexity**: Moderate
**Estimated Scope**: 2-3 weeks

#### What it addresses:
- IRS requires minimum distributions from 401k/IRA starting at age 73 (75 in 2033+)
- Current system doesn't force withdrawals, leading to inaccurate projections
- Users with $500k+ in tax-deferred accounts need this for accuracy

#### Implementation requirements:
1. **IRS Uniform Lifetime Table** lookup by age
2. **Per-account RMD tracking** (each account has its own RMD)
3. **Force withdrawals** even when not needed for expenses
4. **Update withdrawal logic** to withdraw RMD from tax-deferred first

#### Suggested types:
```typescript
interface RMDConfig {
  enabled: boolean;
  startAge: number; // 73 by default, configurable for planning
  distributionTable: 'uniform' | 'joint'; // IRS tables
}

interface ProjectionRecord {
  // ... existing fields
  rmdRequired?: number;      // Calculated RMD for this year
  rmdTaken?: number;         // Actual withdrawal from tax-deferred
  excessOverRmd?: number;    // Amount withdrawn beyond RMD
}
```

#### Files to modify:
- `src/lib/projections/engine.ts` - Add RMD calculation step
- `src/lib/projections/types.ts` - Add RMD-related types
- `src/lib/projections/assumptions.ts` - Add IRS distribution tables
- `src/app/api/projections/calculate/route.ts` - Add RMD config handling

### Phase 2: Tax Liability Estimation (Recommended Priority: HIGH)

**Impact**: Shows users after-tax purchasing power
**Complexity**: High
**Estimated Scope**: 4-6 weeks

#### What it addresses:
- Current projections show gross withdrawals, not net income
- Users don't understand their actual spending power
- Filing status and state residence are collected but unused

#### Implementation requirements:
1. **Federal tax bracket tables** (2024, with inflation indexing)
2. **Standard deduction handling** by filing status
3. **Social Security taxation** (up to 85% taxable based on income)
4. **State tax rates** by state of residence
5. **Tax liability per projection year**

#### Suggested types:
```typescript
interface TaxConfig {
  enabled: boolean;
  includeStateTax: boolean;
  filingStatus: FilingStatus;
  stateOfResidence?: string;
  additionalDeductions?: number;
}

interface TaxBreakdown {
  grossIncome: number;
  taxableIncome: number;
  federalTax: number;
  stateTax: number;
  totalTax: number;
  effectiveRate: number;
  marginalBracket: number;
}

interface ProjectionRecord {
  // ... existing fields
  taxBreakdown?: TaxBreakdown;
  afterTaxIncome?: number;
}
```

#### New files needed:
- `src/lib/tax/brackets.ts` - Federal and state tax brackets
- `src/lib/tax/calculator.ts` - Tax calculation logic
- `src/lib/tax/social-security-tax.ts` - SS taxation rules
- `src/lib/tax/types.ts` - Tax-related types

### Phase 3: Roth Conversion Optimization (Recommended Priority: MEDIUM-HIGH)

**Impact**: Major tax savings for users with large traditional balances
**Complexity**: High
**Estimated Scope**: 4-6 weeks

#### What it addresses:
- Strategic Roth conversions can save significant taxes over time
- Converting during low-income years (early retirement) at lower brackets
- Reducing future RMDs by lowering tax-deferred balances

#### Implementation requirements:
1. **Roth conversion modeling** as a new transaction type
2. **Tax bracket analysis** to find optimal conversion amounts
3. **Multi-year optimization** (not just single-year)
4. **Conversion impact visualization**

#### Suggested types:
```typescript
interface RothConversionStrategy {
  enabled: boolean;
  mode: 'manual' | 'fill_bracket' | 'optimize';
  targetBracket?: number; // Fill up to this bracket
  annualLimit?: number;   // Max conversion per year
  startAge?: number;      // When to start conversions
  endAge?: number;        // When to stop (e.g., before SS)
}

interface ConversionEvent {
  age: number;
  amount: number;
  taxPaid: number;
  fromBalance: number;    // Tax-deferred balance before
  toBalance: number;      // Tax-free balance after
}
```

#### Visualization additions:
- Roth conversion ladder timeline
- Tax paid vs tax saved comparison
- Bracket filling visualization

### Phase 4: State Tax Integration (Recommended Priority: MEDIUM)

**Impact**: Important for users in high-tax states
**Complexity**: Moderate
**Estimated Scope**: 2-3 weeks

#### What it addresses:
- State income tax varies from 0% to 13.3%
- Some states don't tax retirement income
- Relocation planning for tax optimization

#### Implementation requirements:
1. **State tax rate tables** (50 states + DC)
2. **Retirement income exemptions** by state
3. **Social Security taxation** by state
4. **Integration with federal calculation**

#### State categories:
- **No income tax**: TX, FL, WA, NV, WY, SD, AK, TN, NH (partial)
- **No retirement tax**: PA, MS, IL (pension only)
- **High tax**: CA (13.3%), NY (10.9%), NJ (10.75%)
- **Moderate**: Most other states

---

## Recommended Implementation Roadmap

### Immediate (Next Sprint)
1. **Visualize balanceByType** - Users should see their tax-categorized balances
2. **Add RMD warning** - Alert users approaching 73 that RMDs are not modeled

### Short-term (1-2 months)
3. **Implement Phase 1: RMD Enforcement**
4. **Add tax settings UI** - Filing status, state (already collected, surface in settings)

### Medium-term (2-4 months)
5. **Implement Phase 2: Tax Liability Estimation**
6. **Enhance withdrawal strategy** - Tax-bracket-aware ordering
7. **Add after-tax projections** - Show net income, not gross

### Long-term (4-6 months)
8. **Implement Phase 3: Roth Conversion Optimization**
9. **Add scenario comparison** - "What if I convert $50k this year?"

### Future Consideration
10. **Phase 4: State Tax Integration**
11. **Medicare IRMAA planning**
12. **ACA subsidy optimization** (early retirement)

---

## Code References

### Current Tax-Aware Implementation
- [src/lib/projections/engine.ts:28-57](https://github.com/arsenaid-yere1/plan-smart/blob/0f1b206e50d301bb784eb1348262242892c68fe5/src/lib/projections/engine.ts#L28-L57) - withdrawFromAccounts()
- [src/lib/projections/types.ts:54-70](https://github.com/arsenaid-yere1/plan-smart/blob/0f1b206e50d301bb784eb1348262242892c68fe5/src/lib/projections/types.ts#L54-L70) - Tax category definitions
- [src/lib/projections/assumptions.ts:31-35](https://github.com/arsenaid-yere1/plan-smart/blob/0f1b206e50d301bb784eb1348262242892c68fe5/src/lib/projections/assumptions.ts#L31-L35) - Default allocations

### Data Collection Points
- [src/components/onboarding/step1-personal-info.tsx:74-87](https://github.com/arsenaid-yere1/plan-smart/blob/0f1b206e50d301bb784eb1348262242892c68fe5/src/components/onboarding/step1-personal-info.tsx#L74-L87) - State residence
- [src/components/onboarding/step2-retirement-info.tsx:78-111](https://github.com/arsenaid-yere1/plan-smart/blob/0f1b206e50d301bb784eb1348262242892c68fe5/src/components/onboarding/step2-retirement-info.tsx#L78-L111) - Filing status
- [src/components/onboarding/step2b-savings-contributions.tsx](https://github.com/arsenaid-yere1/plan-smart/blob/0f1b206e50d301bb784eb1348262242892c68fe5/src/components/onboarding/step2b-savings-contributions.tsx) - Account type selection

### Extension Points
- [src/lib/projections/input-builder.ts](https://github.com/arsenaid-yere1/plan-smart/blob/0f1b206e50d301bb784eb1348262242892c68fe5/src/lib/projections/input-builder.ts) - Input transformation layer
- [src/lib/projections/warnings.ts](https://github.com/arsenaid-yere1/plan-smart/blob/0f1b206e50d301bb784eb1348262242892c68fe5/src/lib/projections/warnings.ts) - Warning generation
- [src/app/api/projections/calculate/route.ts](https://github.com/arsenaid-yere1/plan-smart/blob/0f1b206e50d301bb784eb1348262242892c68fe5/src/app/api/projections/calculate/route.ts) - API endpoint

---

## Historical Context (from thoughts/)

- [thoughts/shared/research/2025-12-17-epic-3-projection-engine-implementation-readiness.md](thoughts/shared/research/2025-12-17-epic-3-projection-engine-implementation-readiness.md) - Original projection engine design decisions, including explicit deferral of RMD
- [thoughts/shared/plans/2025-12-18-epic-3-story-1-projection-engine.md](thoughts/shared/plans/2025-12-18-epic-3-story-1-projection-engine.md) - Detailed implementation plan with tax-aware withdrawal algorithm
- [thoughts/personal/tickets/epic-7/story-1-scope.md](thoughts/personal/tickets/epic-7/story-1-scope.md) - Epic 7 scope establishing tax awareness as first-class input
- [thoughts/shared/research/2026-01-15-story-7.1-income-source-classification.md](thoughts/shared/research/2026-01-15-story-7.1-income-source-classification.md) - Income source tax classification research

---

## Related Research

- [2025-12-17-epic-3-projection-engine-implementation-readiness.md](2025-12-17-epic-3-projection-engine-implementation-readiness.md) - Projection engine data sources
- [2025-12-21-epic-3-story-2-visualization-research.md](2025-12-21-epic-3-story-2-visualization-research.md) - Chart component architecture

---

## Open Questions

1. **Tax Year**: Should projections use current tax law or allow for future bracket changes?
2. **Roth 401k**: Should `Roth_401k` be added as a separate account type? Currently only `Roth_IRA` exists.
3. **Beneficiary Planning**: Should inherited IRA rules be considered for estate planning scenarios?
4. **Capital Gains Basis**: Should cost basis be tracked for accurate taxable account treatment?
5. **Quarterly Estimated Taxes**: Should the projection model estimated tax payments for retirees?

---

## Summary Metrics

| Metric | Current | With Tax Model |
|--------|---------|----------------|
| Tax categories | 3 | 3 |
| Withdrawal strategies | 1 (fixed order) | 3+ (bracket-aware, RMD-compliant, optimized) |
| Tax calculations | 0 | Federal + State |
| RMD handling | None | Full enforcement |
| User visibility | Gross amounts | After-tax purchasing power |
| Planning scenarios | 1 | Multiple (with/without conversions, etc.) |
