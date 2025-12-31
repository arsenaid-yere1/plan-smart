---
date: 2025-12-31T12:00:00-08:00
researcher: Claude
git_commit: d0606eeae819617546547602490d336562021c60
branch: main
repository: plan-smart
topic: "Does the projection engine account for assets and debts?"
tags: [research, codebase, projections, assets, debts, financial-engine, real-estate, mortgage, expenses]
status: complete
last_updated: 2025-12-31
last_updated_by: Claude
last_updated_note: "Unified with mortgage expense assumption validation research"
---

# Research: Does the Projection Engine Account for Assets & Debts?

**Date**: 2025-12-31T12:00:00-08:00
**Researcher**: Claude
**Git Commit**: d0606eeae819617546547602490d336562021c60
**Branch**: main
**Repository**: plan-smart

## Research Question
Does the projection engine properly account for user assets and debts in its financial calculations?

## Summary

**Yes, the projection engine accounts for both assets and debts**, but with important nuances:

| Category | How It's Handled | Status |
|----------|-----------------|--------|
| **Investment Accounts** | ✅ Fully integrated - balances aggregated by tax category | Complete |
| **Debts** | ✅ Integrated - reduces effective contributions during accumulation | Complete |
| **Monthly Expenses** | ✅ Includes mortgage - UI instructs users to include housing costs | Complete |
| **Primary Residence** | ❌ NOT included in projections (by design - avoids double-counting) | Display Only |
| **Other Real Estate** | ❌ No data model exists | Missing |
| **Rental Income** | ⚠️ Partial - income stream only, no property linkage | Incomplete |

### Key Findings

1. **Investment accounts ARE fully accounted for** - Balances are aggregated by tax category (taxDeferred, taxFree, taxable) and form the foundation of the projection calculations.

2. **Debts ARE accounted for** - Annual debt payments are estimated using amortization and **subtracted from contributions** during the accumulation phase.

3. **Monthly expenses INCLUDE mortgage payments** - The UI explicitly instructs users to include "rent/mortgage" in their essential expenses, which is why mortgage data is deliberately excluded from projection calculations.

4. **Primary residence is display-only** - Home equity is stored in the database for net worth display but deliberately excluded from projection engine to avoid double-counting mortgage payments.

## Detailed Findings

### 1. Investment Accounts (Assets) - ✅ FULLY INTEGRATED

Investment accounts flow through the system as follows:

**Data Source** ([financial-snapshot.ts:65](src/db/schema/financial-snapshot.ts#L65)):
```typescript
investmentAccounts: jsonb('investment_accounts').$type<InvestmentAccountJson[]>()
```

**Transformation** ([input-builder.ts:39-56](src/lib/projections/input-builder.ts#L39-L56)):
```typescript
// Aggregate balances by tax category
const balancesByType: BalanceByType = {
  taxDeferred: 0,
  taxFree: 0,
  taxable: 0,
};

const accounts = snapshot.investmentAccounts ?? [];
for (const account of accounts) {
  const category = ACCOUNT_TAX_CATEGORY[account.type] ?? 'taxable';
  balancesByType[category] += account.balance;
}

// Calculate annual contribution from monthly amounts
const annualContribution = accounts.reduce(
  (sum, acc) => sum + (acc.monthlyContribution ?? 0) * 12,
  0
);
```

**Tax Category Mapping** ([types.ts:35-42](src/lib/projections/types.ts#L35-L42)):
```typescript
export const ACCOUNT_TAX_CATEGORY: Record<AccountType, TaxCategory> = {
  '401k': 'taxDeferred',
  'IRA': 'taxDeferred',
  'Roth_IRA': 'taxFree',
  'Brokerage': 'taxable',
  'Cash': 'taxable',
  'Other': 'taxable',
};
```

**Engine Usage** ([engine.ts:121](src/lib/projections/engine.ts#L121)):
```typescript
let balances = { ...input.balancesByType };
```

### 2. Debts - ✅ INTEGRATED (Reduces Contributions)

Debts are handled through estimated annual payments that reduce effective contributions:

**Data Source** ([financial-snapshot.ts:67](src/db/schema/financial-snapshot.ts#L67)):
```typescript
debts: jsonb('debts').$type<DebtJson[]>()
```

**Estimation Function** ([assumptions.ts:130-147](src/lib/projections/assumptions.ts#L130-L147)):
```typescript
export function estimateAnnualDebtPayments(
  debts: Array<{ balance: number; interestRate?: number }>
): number {
  return debts.reduce((total, debt) => {
    const rate = (debt.interestRate || 5) / 100; // Default 5%
    const monthlyRate = rate / 12;
    const numPayments = 120; // 10 years assumed payoff

    // Standard amortization formula
    const factor = Math.pow(1 + monthlyRate, numPayments);
    const monthlyPayment = debt.balance * (monthlyRate * factor) / (factor - 1);

    return total + (monthlyPayment * 12);
  }, 0);
}
```

**Input Builder Integration** ([input-builder.ts:72](src/lib/projections/input-builder.ts#L72)):
```typescript
const annualDebtPayments = estimateAnnualDebtPayments(snapshot.debts ?? []);
```

**Engine Usage** ([engine.ts:146-150](src/lib/projections/engine.ts#L146-L150)):
```typescript
// During ACCUMULATION PHASE:
// Effective contribution = grown contribution - debt payments
const effectiveContribution = Math.max(
  0,
  grownContribution - input.annualDebtPayments
);
```

**Important Note**: Debt payments only affect the **accumulation phase**. Once retired, debt payments are assumed to be included in annual expenses (or paid off).

### 3. Monthly Expenses & Mortgage - ✅ VALIDATED ASSUMPTION

**Critical Design Decision**: The system assumes users include mortgage payments in their monthly expenses. This is validated by UI evidence.

**UI Evidence** ([step3b-income-expenses.tsx:73-76](src/components/onboarding/step3b-income-expenses.tsx#L73-L76)):
```typescript
// Help text for Monthly Essential Expenses field
"Include rent/mortgage, utilities, groceries, insurance, minimum debt payments"
```

**Expense Collection Flow**:
1. **Step 6 (Expenses)**: Users enter monthly essential + discretionary expenses
   - Help text explicitly says: "Include rent/mortgage, utilities, groceries, insurance, minimum debt payments"
2. **Step 8 (Assets/Debts)**: Users enter primary residence data (value, mortgage balance, rate)
   - Labeled "Primary Residence (Optional)" - for display/net worth only
   - Separate "Other Debts" section for non-housing debts

**Monthly to Annual Conversion** ([input-builder.ts:59-69](src/lib/projections/input-builder.ts#L59-L69)):
```typescript
const annualExpenses = incomeExpenses && (incomeExpenses.monthlyEssential || incomeExpenses.monthlyDiscretionary)
  ? ((incomeExpenses.monthlyEssential ?? 0) + (incomeExpenses.monthlyDiscretionary ?? 0)) * 12
  : deriveAnnualExpenses(annualIncome, savingsRate);
```

**Key Points**:
- `annualExpenses` is used directly without adding mortgage payments
- No mortgage payments are added to expenses at any point in the engine
- The system trusts that user-provided expenses are complete (including housing costs)

**Why This Design Prevents Double-Counting**:

| Data Location | Purpose | Used in Projections? |
|---------------|---------|---------------------|
| Monthly expenses (includes mortgage) | Retirement spending calculation | ✅ Yes - as `annualExpenses` |
| Primary residence mortgage balance | Display net worth / equity | ❌ No |
| Debts[] array (other debts) | Reduce contributions during accumulation | ✅ Yes - reduces contributions |

**Potential Double-Counting Risk**:
If a user enters mortgage in expenses AND adds a mortgage debt in "Other Debts", the mortgage would affect projections twice:
1. Via expenses (during retirement drawdown)
2. Via debt payments (reducing contributions during accumulation)

**Mitigations**:
1. UI uses "Other Debts" label (implying debts OTHER than housing)
2. Default debt type is "CreditCard", not "Mortgage"
3. Primary Residence section is separate from Other Debts
4. Debt payments only affect contribution phase, not retirement expenses

**Validation Summary**:

| Check | Status | Evidence |
|-------|--------|----------|
| UI tells users to include mortgage in expenses | ✅ VALIDATED | Help text: "Include rent/mortgage..." |
| Primary residence mortgage not used in calculations | ✅ VALIDATED | No references in projection engine |
| Debts reduce contributions, not expenses | ✅ VALIDATED | engine.ts:147-150 |
| Design prevents double-counting | ✅ VALIDATED | Separation of display vs calculation data |

### 4. Primary Residence - Display Only (By Design)

Primary residence data is stored but **deliberately excluded** from projections to avoid double-counting:

**Data Source** ([financial-snapshot.ts:66](src/db/schema/financial-snapshot.ts#L66)):
```typescript
primaryResidence: jsonb('primary_residence').$type<PrimaryResidenceJson>()

type PrimaryResidenceJson = {
  estimatedValue?: number;
  mortgageBalance?: number;
  interestRate?: number;
};
```

**Gap Analysis**:
- `input-builder.ts` does NOT reference `snapshot.primaryResidence`
- `engine.ts` has no concept of home equity
- Home equity is **not** added to net worth calculations in projections
- Mortgage interest is **not** factored into debt calculations (only `debts[]` array)

## Code References

| File | Line(s) | Description |
|------|---------|-------------|
| [engine.ts](src/lib/projections/engine.ts) | 117-239 | Main `runProjection()` function |
| [engine.ts](src/lib/projections/engine.ts) | 147-150 | Debt payments reduce contributions |
| [engine.ts](src/lib/projections/engine.ts) | 166-176 | Expense calculation in drawdown phase |
| [input-builder.ts](src/lib/projections/input-builder.ts) | 31-100 | `buildProjectionInputFromSnapshot()` - transforms DB data |
| [input-builder.ts](src/lib/projections/input-builder.ts) | 59-69 | Monthly to annual expense conversion |
| [types.ts](src/lib/projections/types.ts) | 57-90 | `ProjectionInput` interface definition |
| [assumptions.ts](src/lib/projections/assumptions.ts) | 130-147 | `estimateAnnualDebtPayments()` function |
| [financial-snapshot.ts](src/db/schema/financial-snapshot.ts) | 50-75 | Database schema with all financial fields |
| [step3b-income-expenses.tsx](src/components/onboarding/step3b-income-expenses.tsx) | 73-76 | Help text: "Include rent/mortgage..." |
| [step4b-assets-debts.tsx](src/components/onboarding/step4b-assets-debts.tsx) | 78-114 | Primary residence UI collection |
| [validation/onboarding.ts](src/lib/validation/onboarding.ts) | 56-79 | Expense and primary residence validation schemas |

## Architecture Insights

### Design Pattern: Separation of Display Data vs. Calculation Data

The system deliberately separates:
1. **Display data** (primaryResidence): Stored for user visibility and net worth calculation
2. **Calculation data** (expenses, debts[]): Used in projection engine

This pattern prevents double-counting by keeping mortgage-related data in display-only fields while trusting user-provided expense figures.

### Design Decision: Debts Reduce Contributions, Not Expenses

Rather than adding debt payments to retirement expenses (which would require tracking payoff dates), the system:
1. Assumes debts are paid off before/by retirement
2. Reduces contributions during accumulation phase
3. Trusts that user's expense input reflects retirement spending

This simplification avoids complex debt amortization scheduling while still accounting for debt impact on wealth accumulation.

### Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                      Financial Snapshot (DB)                        │
├─────────────────────────────────────────────────────────────────────┤
│ investmentAccounts[]  │  debts[]  │  primaryResidence  │  expenses │
└──────────┬────────────┴─────┬─────┴──────────┬─────────┴─────┬─────┘
           │                  │                │               │
           ▼                  ▼                ▼               ▼
    ┌──────────────┐   ┌─────────────┐   ┌──────────────┐  ┌────────────┐
    │ Aggregate by │   │ Estimate    │   │ DISPLAY ONLY │  │ Includes   │
    │ tax category │   │ annual pmts │   │ (net worth)  │  │ mortgage   │
    └──────┬───────┘   └──────┬──────┘   └──────────────┘  └─────┬──────┘
           │                  │                                   │
           ▼                  ▼                                   ▼
    ┌──────────────────────────────────────────────────────────────────┐
    │                       ProjectionInput                            │
    │  - balancesByType: {taxDeferred, taxFree, taxable}               │
    │  - annualContribution                                            │
    │  - annualDebtPayments (other debts, NOT mortgage)                │
    │  - annualExpenses (INCLUDES mortgage from user input)            │
    │  - incomeStreams[]                                               │
    └──────────────────────────┬───────────────────────────────────────┘
                               │
                               ▼
    ┌──────────────────────────────────────────────────────────────────┐
    │                    runProjection(input)                          │
    │                                                                  │
    │  ACCUMULATION:                                                   │
    │    balance += (contribution - debtPayments)  // other debts only │
    │    balance *= (1 + return)                                       │
    │                                                                  │
    │  DRAWDOWN:                                                       │
    │    withdrawal = expenses - income  // expenses include mortgage  │
    │    balance -= withdrawal                                         │
    │    balance *= (1 + return)                                       │
    └──────────────────────────────────────────────────────────────────┘
```

### Debt Treatment Logic

The engine assumes:
1. **10-year amortization** for all debts (hardcoded)
2. **5% default interest rate** if not specified
3. Debt payments **reduce contributions** during working years
4. Debts are **implicitly paid off** by retirement (not explicitly tracked)

## Open Questions

1. **Should insurance and property tax be explicitly mentioned in expense help text?**
   - Current text mentions "insurance" generically
   - Property tax is not explicitly mentioned
   - Recommendation: Consider updating to "Include rent/mortgage, property taxes, homeowners insurance, utilities..."

2. **Should there be validation preventing mortgage in debts[] array?**
   - Currently a user CAN add a mortgage debt to "Other Debts"
   - This would cause mortgage to reduce contributions (not double-counted in expenses, but still affects projections)
   - Recommendation: Add a warning if user adds mortgage debt while having primaryResidence data

3. **Should primary residence (home equity) be included in net worth projections?**
   - Currently excluded - may understate retirement assets for homeowners
   - Could add as "illiquid asset" category with separate withdrawal rules

4. **Should debt payoff timeline be more sophisticated?**
   - Current 10-year assumption may not match actual payoff schedules
   - Could use actual remaining term based on debt type

## Recommendations

1. **Update expense help text** - Make it clearer what housing costs to include: "rent/mortgage, property taxes, homeowners insurance, utilities..."

2. **Add mortgage-in-debts warning** - If user adds a mortgage debt while having primaryResidence data, show a warning about potential double-counting.

3. **Consider adding primary residence to net worth display** - Many retirees downsize or use home equity (HELOC, reverse mortgage) for retirement funding.

4. **Add debt payoff tracking** - Track when specific debts are paid off to reflect reduced payments over time.

---

## Follow-up Research: Real Estate & Other Properties (2025-12-31)

### Research Question
How should real estate values (beyond primary residence) and their associated mortgages be accounted for in projections?

### Current State Analysis

#### What EXISTS for Real Estate

1. **Primary Residence** - Single property only ([financial-snapshot.ts:66](src/db/schema/financial-snapshot.ts#L66)):
   ```typescript
   primaryResidence: jsonb('primary_residence').$type<PrimaryResidenceJson>()

   type PrimaryResidenceJson = {
     estimatedValue?: number;
     mortgageBalance?: number;
     interestRate?: number;
   };
   ```

2. **Rental Income Stream** - Generic income type ([types.ts:11-17](src/lib/projections/types.ts#L11-L17)):
   ```typescript
   export type IncomeStreamType =
     | 'social_security'
     | 'pension'
     | 'rental'  // <-- Exists but detached from property
     | 'annuity'
     | 'part_time'
     | 'other';
   ```

3. **Mortgage as Debt Type** - In debts array ([onboarding.ts:72](src/types/onboarding.ts#L72)):
   ```typescript
   export type DebtType = 'Mortgage' | 'StudentLoan' | 'CreditCard' | 'AutoLoan' | 'Other';
   ```

#### What DOES NOT EXIST

| Missing Feature | Impact |
|-----------------|--------|
| **Properties array** | Cannot track multiple real estate holdings |
| **Property-to-income linkage** | Rental income not connected to property asset |
| **Property appreciation** | Home values are static, no growth modeling |
| **Property expenses** | No taxes, insurance, maintenance, HOA tracking |
| **Net rental income** | Gross rental income used (no expense deduction) |
| **Property sale modeling** | Cannot model selling property at specific age |
| **Equity extraction** | No HELOC/reverse mortgage modeling |

### Gap Analysis: Real Estate in Projections

```
CURRENT STATE:
┌─────────────────────────────────────────────────────────────┐
│                    Financial Snapshot                        │
├─────────────────────────────────────────────────────────────┤
│  primaryResidence: {           │  incomeStreams: [{         │
│    estimatedValue: 500000      │    type: 'rental',         │
│    mortgageBalance: 200000  ←──┼──→ NO CONNECTION           │
│    interestRate: 6.5           │    annualAmount: 24000     │
│  }                             │  }]                        │
│                                │                            │
│  debts: [{                     │  NO OTHER PROPERTIES       │
│    type: 'Mortgage',           │  NO PROPERTY EXPENSES      │
│    balance: ???             ←──┼──→ DUPLICATE DATA RISK     │
│  }]                            │  NO APPRECIATION           │
└─────────────────────────────────────────────────────────────┘
                        │
                        ▼
              Projection Engine
              - Ignores primaryResidence entirely
              - Ignores rental property equity
              - Only uses rental income stream (gross)
```

### Proposed Data Model Enhancement

To properly account for real estate:

```typescript
// NEW: Real estate property type
export type RealEstatePropertyJson = {
  id: string;
  name: string;                    // "Primary Home", "Beach Rental", etc.
  type: 'primary' | 'rental' | 'vacation' | 'land';

  // Asset side
  estimatedValue: number;
  appreciationRate?: number;       // Default: 3% for residential

  // Liability side
  mortgageBalance?: number;
  mortgageInterestRate?: number;
  mortgageMonthlyPayment?: number;
  mortgagePayoffYear?: number;     // When will it be paid off?

  // Income side (for rentals)
  annualRentalIncome?: number;
  annualExpenses?: number;         // Taxes, insurance, maintenance, HOA

  // Sale planning
  plannedSaleAge?: number;         // Age when planning to sell
  saleProceeds?: 'reinvest' | 'spend' | 'payoff_debts';
};

// Updated financial snapshot
export const financialSnapshot = pgTable('financial_snapshot', {
  // ... existing fields ...

  // REPLACE primaryResidence with properties array
  realEstateProperties: jsonb('real_estate_properties').$type<RealEstatePropertyJson[]>(),
});
```

### How Real Estate Should Flow Into Projections

```
PROPOSED STATE:
┌─────────────────────────────────────────────────────────────┐
│                    Financial Snapshot                        │
├─────────────────────────────────────────────────────────────┤
│  realEstateProperties: [                                    │
│    {                                                        │
│      id: 'prop-1',                                          │
│      name: 'Primary Home',                                  │
│      type: 'primary',                                       │
│      estimatedValue: 500000,                                │
│      appreciationRate: 0.03,                                │
│      mortgageBalance: 200000,                               │
│      mortgageInterestRate: 6.5,                             │
│      mortgageMonthlyPayment: 1500,                          │
│      mortgagePayoffYear: 2035,                              │
│    },                                                       │
│    {                                                        │
│      id: 'prop-2',                                          │
│      name: 'Rental Duplex',                                 │
│      type: 'rental',                                        │
│      estimatedValue: 350000,                                │
│      appreciationRate: 0.03,                                │
│      mortgageBalance: 250000,                               │
│      mortgageInterestRate: 7.0,                             │
│      mortgageMonthlyPayment: 1800,                          │
│      annualRentalIncome: 36000,                             │
│      annualExpenses: 8000,  // taxes, ins, maint            │
│      plannedSaleAge: 70,                                    │
│      saleProceeds: 'reinvest',                              │
│    }                                                        │
│  ]                                                          │
└─────────────────────────────────────────────────────────────┘
                        │
                        ▼
              input-builder.ts
              - Sum all mortgage payments → annualDebtPayments
              - Sum net rental income → add to incomeStreams
              - Track property values for net worth display
              - Model property sales at planned ages
                        │
                        ▼
              Projection Engine
              - Mortgage payments reduce contributions (existing)
              - Net rental income supplements retirement (existing)
              - Property sales add lump sum to taxable balance (NEW)
              - Equity available for emergencies (display only)
```

### Implementation Recommendations

#### Phase 1: Include Primary Residence Mortgage in Debts
- In `input-builder.ts`, if `primaryResidence.mortgageBalance` exists, include it in debt payment calculation
- Prevents double-entry (user entering mortgage in both places)

#### Phase 2: Add Real Estate Properties Array
- New JSONB column `real_estate_properties`
- Migration to convert existing `primaryResidence` to first property
- UI to add/edit multiple properties

#### Phase 3: Integrate Net Rental Income
- Calculate: `annualRentalIncome - annualExpenses - mortgagePayment`
- Auto-generate income stream from rental properties
- Link income stream to property (for sale modeling)

#### Phase 4: Property Appreciation & Sale Modeling
- Track property values over time with appreciation
- Model lump-sum addition to taxable accounts on sale
- Handle capital gains implications (future enhancement)

### Code Files That Need Changes

| File | Changes Needed |
|------|----------------|
| [financial-snapshot.ts](src/db/schema/financial-snapshot.ts) | Add `realEstateProperties` JSONB column |
| [onboarding.ts](src/types/onboarding.ts) | Add `RealEstateProperty` interface |
| [input-builder.ts](src/lib/projections/input-builder.ts) | Process properties → debts & income |
| [engine.ts](src/lib/projections/engine.ts) | Handle property sale events |
| [types.ts](src/lib/projections/types.ts) | Add property-related input fields |
| [step4b-assets-debts.tsx](src/components/onboarding/step4b-assets-debts.tsx) | UI for multiple properties |
| [assumptions.ts](src/lib/projections/assumptions.ts) | Add property appreciation defaults |

### Immediate Quick Wins

1. **DO NOT include primary residence mortgage in debt calculations** - This was considered but rejected because:
   - Users are instructed to include mortgage in their monthly expenses (see [step3b-income-expenses.tsx:73-76](src/components/onboarding/step3b-income-expenses.tsx#L73-L76))
   - Adding mortgage to debt calculations would double-count it
   - Current design is intentional and correct

2. **Display home equity in net worth** - Show `estimatedValue - mortgageBalance` in dashboard (display only, not in projections)

3. **Update expense help text** - Consider updating to: "Include rent/mortgage, property taxes, homeowners insurance, utilities, groceries..."
