# Real Estate Properties Integration - Implementation Plan

## Overview

This plan implements comprehensive real estate tracking in the projection engine, addressing the gaps identified in the research document. Currently, primary residence data is stored but never used in projections, and rental income exists as a standalone income stream with no connection to property assets.

## Current State Analysis

**What exists:**
- `primaryResidence` JSONB field in `financial_snapshot` (stored but unused)
- `debts[]` array with mortgage as a debt type (separate from primary residence mortgage)
- `incomeStreams[]` with `rental` type (no connection to properties)
- Projection engine fully handles investment accounts and debts

**Key assumption:**
- **Mortgage payments are already included in user's monthly expenses** - Users enter their total monthly expenses which includes mortgage payments. Therefore, we should NOT add mortgage payments to debt calculations (that would double-count them).

**Key gaps:**
- No support for multiple properties (rental properties, vacation homes)
- Rental income has no linkage to property expenses
- Property values are not tracked for net worth display
- No way to calculate net rental income (gross - expenses)

### Key Discoveries:
- Debt payments flow through `estimateAnnualDebtPayments()` in [assumptions.ts:130-147](src/lib/projections/assumptions.ts#L130-L147)
- Input building happens in `buildProjectionInputFromSnapshot()` at [input-builder.ts:31-100](src/lib/projections/input-builder.ts#L31-L100)
- Primary residence schema at [financial-snapshot.ts:29-33](src/db/schema/financial-snapshot.ts#L29-L33)
- Assets/debts UI component at [step4b-assets-debts.tsx](src/components/onboarding/step4b-assets-debts.tsx)

## Desired End State

After implementation:
1. Users can track multiple real estate properties (primary, rental, vacation, land)
2. **Rental income is NOT auto-generated** - users manually add rental income via the existing Income Streams section (avoids duplication)
3. **Net worth display includes:**
   - Total assets (investment accounts + property values)
   - Total liabilities (mortgages + other debts)
   - Property equity (value - mortgage balance)
   - Overall net worth (assets - liabilities)
4. Property data is stored for future enhancements (appreciation, sale modeling)

### Verification Criteria:
- **Dashboard displays compact net worth summary** showing total net worth with assets/liabilities breakdown
- **Profile page displays detailed net worth breakdown** with:
  - Investment accounts total
  - Real estate value total
  - Mortgage balances
  - Other debts
  - Property equity (real estate value - mortgages)
  - Total net worth
- **Onboarding review shows net worth summary** before user completes onboarding
- Primary residence value/mortgage tracked for net worth but does NOT affect debt payment calculations
- Rental income continues to be managed via Income Streams section (no duplication)

## What We're NOT Doing

- Adding mortgage payments to debt calculations (already in monthly expenses)
- **Auto-generating rental income streams from properties** (users manage rental income via existing Income Streams section to avoid duplication)
- Property appreciation modeling (properties remain at static values)
- Property sale modeling at specific ages
- Equity extraction (HELOC, reverse mortgage)
- Capital gains calculations on property sales
- Property-specific tax implications
- Multiple mortgages per property

---

## Phase 1: Add Real Estate Properties Data Model

### Overview
This phase adds the database schema, types, validation, and UI for managing multiple real estate properties. We'll keep existing `primaryResidence` for backward compatibility while introducing the new `realEstateProperties` array.

### Changes Required:

#### 1. Add Type Definitions
**File**: `src/types/onboarding.ts`
**Changes**: Add new types for real estate properties

```typescript
// Add after line 95 (after PrimaryResidence interface)

// Real Estate Property Types
export type RealEstatePropertyType = 'primary' | 'rental' | 'vacation' | 'land';

export interface RealEstateProperty {
  id: string;
  name: string;
  type: RealEstatePropertyType;

  // Asset value
  estimatedValue: number;

  // Mortgage details (optional - property may be paid off)
  // Note: Mortgage payments are assumed to be included in monthly expenses
  mortgageBalance?: number;
  mortgageInterestRate?: number;

  // NOTE: Rental income is NOT stored here - users manage rental income
  // via the existing Income Streams section to avoid duplication
}

export const PROPERTY_TYPE_OPTIONS = [
  { value: 'primary', label: 'Primary Residence' },
  { value: 'rental', label: 'Rental Property' },
  { value: 'vacation', label: 'Vacation Home' },
  { value: 'land', label: 'Land' },
] as const;
```

**File**: `src/types/onboarding.ts`
**Changes**: Update `OnboardingStep4AssetsDebtsData` interface

```typescript
// Update OnboardingStep4AssetsDebtsData (around line 140)
export interface OnboardingStep4AssetsDebtsData {
  primaryResidence?: PrimaryResidence; // Keep for backward compatibility during migration
  realEstateProperties?: RealEstateProperty[]; // New array for multiple properties
  debts: Debt[];
}
```

#### 2. Add Database Schema Type
**File**: `src/db/schema/financial-snapshot.ts`
**Changes**: Add type definition and column for real estate properties

```typescript
// Add after IncomeStreamJson type (after line 48)

export type RealEstatePropertyJson = {
  id: string;
  name: string;
  type: 'primary' | 'rental' | 'vacation' | 'land';
  estimatedValue: number;
  mortgageBalance?: number;
  mortgageInterestRate?: number;
  // NOTE: Rental income is managed via Income Streams section, not here
};
```

```typescript
// Add new column after incomeStreams (after line 71)
realEstateProperties: jsonb('real_estate_properties').$type<RealEstatePropertyJson[]>(),
```

#### 3. Add Validation Schema
**File**: `src/lib/validation/onboarding.ts`
**Changes**: Add validation for real estate properties

```typescript
// Add after primaryResidenceSchema (after line 79)

export const realEstatePropertySchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1, 'Property name is required'),
  type: z.enum(['primary', 'rental', 'vacation', 'land']),
  estimatedValue: z.number().min(0, 'Value cannot be negative').max(100000000),
  mortgageBalance: z.number().min(0).max(100000000).optional(),
  mortgageInterestRate: z.number().min(0).max(30).optional(),
  // NOTE: Rental income is managed via Income Streams section, not here
});
```

```typescript
// Update step4AssetsDebtsSchema (around line 81)
export const step4AssetsDebtsSchema = z.object({
  primaryResidence: primaryResidenceSchema.optional(), // Keep for migration
  realEstateProperties: z.array(realEstatePropertySchema).optional(),
  debts: z.array(debtSchema),
});
```

#### 4. Generate Database Migration
**Command**: `npx drizzle-kit generate`

This will generate a migration file adding the `real_estate_properties` column.

#### 5. Create UI Component for Real Estate Properties
**File**: `src/components/onboarding/step4b-assets-debts.tsx`
**Changes**: Replace primary residence section with real estate properties array

The UI will follow the same pattern as the debts array (useFieldArray), with:
- Property name input
- Property type dropdown
- Estimated value input
- Mortgage fields (collapsible or conditional on "Has mortgage?" checkbox)

**Note**: Rental income is NOT collected here. Users should add rental income via the existing Income Streams section to avoid duplication.

```typescript
// Key additions to the component:

// 1. Add useFieldArray for properties
const { fields: propertyFields, append: appendProperty, remove: removeProperty } = useFieldArray({
  control,
  name: 'realEstateProperties',
});

// 2. Add function to create new property
const addProperty = () => {
  appendProperty({
    id: crypto.randomUUID(),
    name: '',
    type: 'primary',
    estimatedValue: 0,
    mortgageBalance: undefined,
    mortgageInterestRate: undefined,
    // NOTE: Rental income is managed via Income Streams section
  });
};

// 3. Render property cards with conditional fields based on type
```

#### 6. Update Profile Display
**File**: `src/app/profile/profile-client.tsx`
**Changes**: Update to display real estate properties instead of just primary residence

#### 7. Update API Endpoints
**Files**:
- `src/app/api/onboarding/complete/route.ts`
- `src/app/api/profile/route.ts`

**Changes**: Handle the new `realEstateProperties` field in POST and PATCH operations

### Success Criteria:

#### Automated Verification:
- [x] Migration generates successfully: `npx drizzle-kit generate`
- [x] Migration applies to database: `npx drizzle-kit push`
- [x] TypeScript compiles: `npm run typecheck`
- [x] Unit tests pass: `npm test -- --run` (2 pre-existing failures unrelated to this change)
- [x] Build succeeds: `npm run build`

#### Manual Verification:
- [ ] Onboarding flow shows new "Real Estate Properties" section
- [ ] Can add multiple properties of different types
- [ ] Rental properties do NOT show income/expense fields (managed via Income Streams)
- [ ] Profile page displays all properties correctly
- [ ] Editing properties via profile works correctly

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 2: Property Summary for Net Worth Display

### Overview
This phase adds a helper function to calculate property totals for net worth display. **Rental income is NOT auto-generated** - users continue to manage rental income via the existing Income Streams section.

**Why no auto-generation?** The existing Income Streams section already allows users to add rental income. Auto-generating income from properties would cause duplication if users have both a rental property AND a rental income stream.

### Changes Required:

#### 1. Add Property Summary Helper
**File**: `src/lib/projections/input-builder.ts`
**Changes**: Add helper function to calculate property totals (for net worth display only)

```typescript
// New helper function to add at top of file
export function calculatePropertySummary(
  properties: RealEstatePropertyJson[] | null | undefined
): PropertySummary {
  const props = properties ?? [];

  let totalValue = 0;
  let totalMortgage = 0;

  for (const property of props) {
    totalValue += property.estimatedValue ?? 0;
    totalMortgage += property.mortgageBalance ?? 0;
  }

  return {
    totalValue,
    totalMortgage,
    totalEquity: totalValue - totalMortgage,
  };
}
```

**Note**: This function is for display purposes only. It does NOT modify projection calculations or generate income streams.

#### 2. Add Property Summary Type
**File**: `src/lib/projections/types.ts`
**Changes**: Add PropertySummary type

```typescript
// Add new type for property summary (display only)
export interface PropertySummary {
  totalValue: number;
  totalMortgage: number;
  totalEquity: number;
}
```

### What This Phase Does NOT Do:
- ❌ Does NOT auto-generate rental income streams (users manage via Income Streams section)
- ❌ Does NOT modify projection engine calculations
- ❌ Does NOT add mortgage to debt calculations

### Success Criteria:

#### Automated Verification:
- [ ] TypeScript compiles: `npm run typecheck`
- [ ] Unit tests pass: `npm test -- --run`
- [ ] Build succeeds: `npm run build`
- [ ] Linting passes: `npm run lint`

#### Manual Verification:
- [ ] `calculatePropertySummary()` correctly totals property values and mortgages
- [ ] Users with no properties get empty summary (all zeros)
- [ ] Backward compatibility: Users with old `primaryResidence` data still work
- [ ] Rental income continues to work via existing Income Streams section (no duplication)

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 3: Net Worth Display with Property Equity

### Overview
This phase adds a comprehensive net worth display to the dashboard and profile pages. Currently, the application shows:
- Total investment account balance (profile page)
- Projected retirement balance (dashboard)
- Individual debts listed separately

**Missing**: A unified net worth calculation that includes property equity (property value - mortgage balance).

### Current State Analysis

**Where financial summaries are displayed:**
- [dashboard/page.tsx:168-181](src/app/dashboard/page.tsx#L168-L181) - Aggregates investment accounts by tax category
- [profile/profile-client.tsx:240-252](src/app/profile/profile-client.tsx#L240-L252) - Shows total investment account balance
- [profile/profile-client.tsx:315-330](src/app/profile/profile-client.tsx#L315-L330) - Shows primary residence (value & mortgage separately)
- [profile/profile-client.tsx:332-341](src/app/profile/profile-client.tsx#L332-L341) - Lists individual debts

**What's NOT displayed:**
- Property equity (value - mortgage)
- Total net worth (assets - liabilities)
- Unified financial summary

### Changes Required:

#### 1. Create Net Worth Calculation Utility
**File**: `src/lib/utils/net-worth.ts` (new file)
**Purpose**: Centralized net worth calculation logic

```typescript
import { InvestmentAccountJson, DebtJson, RealEstatePropertyJson } from '@/db/schema/financial-snapshot';

export interface NetWorthBreakdown {
  // Assets
  investmentAccounts: number;
  realEstateValue: number;
  totalAssets: number;

  // Liabilities
  realEstateMortgages: number;
  otherDebts: number;
  totalLiabilities: number;

  // Net Worth
  realEstateEquity: number;
  netWorth: number;
}

export function calculateNetWorth(
  investmentAccounts: InvestmentAccountJson[] | null | undefined,
  realEstateProperties: RealEstatePropertyJson[] | null | undefined,
  debts: DebtJson[] | null | undefined
): NetWorthBreakdown {
  // Investment accounts
  const investmentTotal = (investmentAccounts ?? []).reduce(
    (sum, acc) => sum + (acc.balance ?? 0),
    0
  );

  // Real estate
  const properties = realEstateProperties ?? [];
  const realEstateValue = properties.reduce(
    (sum, prop) => sum + (prop.estimatedValue ?? 0),
    0
  );
  const realEstateMortgages = properties.reduce(
    (sum, prop) => sum + (prop.mortgageBalance ?? 0),
    0
  );
  const realEstateEquity = realEstateValue - realEstateMortgages;

  // Other debts (non-mortgage)
  const otherDebts = (debts ?? []).reduce(
    (sum, debt) => sum + (debt.balance ?? 0),
    0
  );

  // Totals
  const totalAssets = investmentTotal + realEstateValue;
  const totalLiabilities = realEstateMortgages + otherDebts;
  const netWorth = totalAssets - totalLiabilities;

  return {
    investmentAccounts: investmentTotal,
    realEstateValue,
    totalAssets,
    realEstateMortgages,
    otherDebts,
    totalLiabilities,
    realEstateEquity,
    netWorth,
  };
}
```

#### 2. Create Net Worth Summary Component
**File**: `src/components/dashboard/NetWorthSummary.tsx` (new file)
**Purpose**: Reusable component for displaying net worth breakdown

```typescript
'use client';

import { formatCurrency } from '@/lib/utils';
import { NetWorthBreakdown } from '@/lib/utils/net-worth';

interface NetWorthSummaryProps {
  breakdown: NetWorthBreakdown;
  variant?: 'compact' | 'detailed';
}

export function NetWorthSummary({ breakdown, variant = 'compact' }: NetWorthSummaryProps) {
  if (variant === 'compact') {
    return (
      <div className="rounded-lg border p-4">
        <h3 className="text-sm font-medium text-muted-foreground">Net Worth</h3>
        <p className="text-2xl font-bold">{formatCurrency(breakdown.netWorth)}</p>
        <div className="mt-2 text-sm text-muted-foreground">
          <span>Assets: {formatCurrency(breakdown.totalAssets)}</span>
          <span className="mx-2">•</span>
          <span>Liabilities: {formatCurrency(breakdown.totalLiabilities)}</span>
        </div>
      </div>
    );
  }

  // Detailed variant shows full breakdown
  return (
    <div className="rounded-lg border p-4 space-y-4">
      <div>
        <h3 className="text-lg font-semibold">Net Worth</h3>
        <p className="text-3xl font-bold">{formatCurrency(breakdown.netWorth)}</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Assets */}
        <div>
          <h4 className="text-sm font-medium text-muted-foreground mb-2">Assets</h4>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span>Investment Accounts</span>
              <span>{formatCurrency(breakdown.investmentAccounts)}</span>
            </div>
            <div className="flex justify-between">
              <span>Real Estate Value</span>
              <span>{formatCurrency(breakdown.realEstateValue)}</span>
            </div>
            <div className="flex justify-between font-medium border-t pt-1">
              <span>Total Assets</span>
              <span>{formatCurrency(breakdown.totalAssets)}</span>
            </div>
          </div>
        </div>

        {/* Liabilities */}
        <div>
          <h4 className="text-sm font-medium text-muted-foreground mb-2">Liabilities</h4>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span>Mortgages</span>
              <span>{formatCurrency(breakdown.realEstateMortgages)}</span>
            </div>
            <div className="flex justify-between">
              <span>Other Debts</span>
              <span>{formatCurrency(breakdown.otherDebts)}</span>
            </div>
            <div className="flex justify-between font-medium border-t pt-1">
              <span>Total Liabilities</span>
              <span>{formatCurrency(breakdown.totalLiabilities)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Property Equity (if any real estate) */}
      {breakdown.realEstateValue > 0 && (
        <div className="text-sm text-muted-foreground border-t pt-2">
          Property Equity: {formatCurrency(breakdown.realEstateEquity)}
        </div>
      )}
    </div>
  );
}
```

#### 3. Update Dashboard Page
**File**: `src/app/dashboard/page.tsx`
**Changes**: Add net worth summary to dashboard

```typescript
// Import the utility and component
import { calculateNetWorth } from '@/lib/utils/net-worth';
import { NetWorthSummary } from '@/components/dashboard/NetWorthSummary';

// In the component, calculate net worth from snapshot data
const netWorthBreakdown = calculateNetWorth(
  snapshot.investmentAccounts,
  snapshot.realEstateProperties,
  snapshot.debts
);

// Add NetWorthSummary component to the dashboard layout
<NetWorthSummary breakdown={netWorthBreakdown} variant="compact" />
```

#### 4. Update Profile Page
**File**: `src/app/profile/profile-client.tsx`
**Changes**: Add detailed net worth breakdown to profile

```typescript
// Import the utility and component
import { calculateNetWorth } from '@/lib/utils/net-worth';
import { NetWorthSummary } from '@/components/dashboard/NetWorthSummary';

// Calculate net worth
const netWorthBreakdown = calculateNetWorth(
  data.investmentAccounts,
  data.realEstateProperties,
  data.debts
);

// Add detailed NetWorthSummary to profile page
<NetWorthSummary breakdown={netWorthBreakdown} variant="detailed" />
```

#### 5. Update Onboarding Review
**File**: `src/components/onboarding/step5-review.tsx`
**Changes**: Show net worth summary during onboarding review

Similar to profile page, add a summary showing total assets, liabilities, and net worth.

### Success Criteria:

#### Automated Verification:
- [ ] TypeScript compiles: `npm run typecheck`
- [ ] Unit tests pass: `npm test -- --run`
- [ ] Build succeeds: `npm run build`
- [ ] Linting passes: `npm run lint`

#### Manual Verification:
- [ ] Dashboard shows compact net worth summary with total assets and liabilities
- [ ] Profile page shows detailed breakdown (investment accounts, real estate equity, debts)
- [ ] Net worth correctly calculates: (investment accounts + property values) - (mortgages + other debts)
- [ ] Property equity displays correctly: property value - mortgage balance
- [ ] Users without properties see net worth based on investment accounts and debts only
- [ ] Onboarding review shows net worth summary

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful.

---

## Testing Strategy

### Unit Tests:
- Test `calculatePropertySummary()` helper function:
  - With no properties (returns zeros)
  - With single property
  - With multiple properties
  - With properties missing optional fields (mortgageBalance undefined)
- Test `calculateNetWorth()` utility function:
  - With investment accounts only
  - With real estate properties only
  - With debts only
  - With all asset/liability types combined
  - With negative equity scenarios (mortgage > property value)

### Integration Tests:
- API endpoints accept and persist property data correctly
- Backward compatibility with existing primaryResidence data
- Net worth calculation with real database data

### Manual Testing Steps:
1. Create new user with primary residence only - verify stored correctly
2. Add rental property - verify stored correctly (rental income managed separately via Income Streams)
3. Add multiple properties of different types - verify all displayed correctly
4. Verify debt calculations remain unchanged (mortgage NOT added)
5. Verify existing users without new data continue to work
6. **Verify NO rental income duplication:**
   - User adds rental property in Properties section
   - User adds rental income in Income Streams section
   - Verify only ONE rental income appears in projections (from Income Streams, not auto-generated)
7. **Net Worth Display Tests:**
   - Dashboard shows correct net worth (assets - liabilities)
   - Profile shows detailed breakdown with property equity
   - User with $500k home and $200k mortgage shows $300k property equity
   - User with no properties sees net worth based on investment accounts and debts only
   - Onboarding review shows accurate net worth summary

## Performance Considerations

- Processing properties in input-builder adds minimal overhead (array iteration)
- No additional database queries required
- Property data is already loaded with financial snapshot

## Migration Notes

### Existing Users
- Existing `primaryResidence` data will continue to work via backward compatibility
- New UI will allow users to add properties to `realEstateProperties` array
- Both fields can coexist during transition period

### Data Migration Strategy
**Soft migration (Recommended)**:
- Keep `primaryResidence` field, add `realEstateProperties` field
- UI prioritizes `realEstateProperties` if present
- When user edits properties, data is saved to new format only
- `primaryResidence` can be deprecated in future release

---

## References

- Original research: [thoughts/shared/research/2025-12-31-projection-engine-assets-debts-analysis.md](thoughts/shared/research/2025-12-31-projection-engine-assets-debts-analysis.md)
- Current schema: [src/db/schema/financial-snapshot.ts](src/db/schema/financial-snapshot.ts)
- Input builder: [src/lib/projections/input-builder.ts](src/lib/projections/input-builder.ts)
- Debt calculation: [src/lib/projections/assumptions.ts:130-147](src/lib/projections/assumptions.ts#L130-L147)
- Assets/Debts UI: [src/components/onboarding/step4b-assets-debts.tsx](src/components/onboarding/step4b-assets-debts.tsx)
