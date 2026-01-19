---
date: 2026-01-16T12:00:00-08:00
researcher: Claude
git_commit: 9e250f49cb36463219b0ca2b89895b1c5529286f
branch: main
repository: plan-smart
topic: "Epic 8 Implementation Gap Analysis - Safety-First Income Floor Modeling"
tags: [research, codebase, epic-8, income-floor, guaranteed-income, essential-expenses, safety-first]
status: complete
last_updated: 2026-01-16
last_updated_by: Claude
---

# Research: Epic 8 Implementation Gap Analysis - Safety-First Income Floor Modeling

**Date**: 2026-01-16T12:00:00-08:00
**Researcher**: Claude
**Git Commit**: 9e250f49cb36463219b0ca2b89895b1c5529286f
**Branch**: main
**Repository**: plan-smart

## Research Question

Explore gaps in the current implementation for Epic 8 (Safety-First Income Floor Modeling) as defined in `thoughts/personal/tickets/epic-8/story-1-scope.md`.

## Summary

The codebase has a solid foundation for Epic 8 implementation but lacks several critical features. The key gaps are:

| Feature | Current State | Gap Level |
|---------|---------------|-----------|
| `isGuaranteed` field on income streams | NOT IMPLEMENTED | **High** |
| `isSpouse` field for SS differentiation | NOT IMPLEMENTED | **Medium** |
| Essential expenses preserved in projections | AGGREGATED (lost) | **High** |
| Income floor calculation | NOT IMPLEMENTED | **High** |
| Coverage ratio calculation | NOT IMPLEMENTED | **High** |
| Income floor insight display | NOT IMPLEMENTED | **High** |

## Detailed Findings

### 1. Income Stream Data Model

**Location**: `src/lib/projections/types.ts:22-30`

**Current Interface**:
```typescript
export interface IncomeStream {
  id: string;
  name: string;
  type: IncomeStreamType;       // 'social_security' | 'pension' | 'rental' | 'annuity' | 'part_time' | 'other'
  annualAmount: number;
  startAge: number;
  endAge?: number;
  inflationAdjusted: boolean;   // COLA toggle - EXISTS
}
```

**Missing Fields** (per Epic 8 spec):
- `isGuaranteed: boolean` - Auto-set based on type, user override
- `isSpouse?: boolean` - For household income modeling

**Gap Analysis**:
- The `type` field exists but is cosmetic - not used for reliability classification
- No mechanism to distinguish primary vs spouse Social Security streams
- No automatic or manual classification of guaranteed vs variable income

**Implementation Required**:
1. Add `isGuaranteed` field to `IncomeStream` interface
2. Add `isSpouse` field to `IncomeStream` interface
3. Create auto-classification function based on type
4. Update database schema (`IncomeStreamJson`)
5. Update UI form to display/edit these fields

### 2. Expense Model

**Location**: `src/types/onboarding.ts:187-190` and `src/db/schema/financial-snapshot.ts:35-38`

**Current Implementation**:
```typescript
export interface IncomeExpenses {
  monthlyEssential?: number;
  monthlyDiscretionary?: number;
}
```

**Data Collection**: Essential and discretionary expenses are captured separately during onboarding in `src/components/onboarding/step3b-income-expenses.tsx:67-110`.

**Critical Gap - Aggregation**:

The expenses are **immediately aggregated** at multiple points:

1. **Input Builder** (`src/lib/projections/input-builder.ts:62-64`):
```typescript
annualExpenses = ((incomeExpenses.monthlyEssential ?? 0) + (incomeExpenses.monthlyDiscretionary ?? 0)) * 12;
```

2. **API Route** (`src/app/api/projections/calculate/route.ts:181-184`):
```typescript
const monthly = (incomeExpenses.monthlyEssential || 0) + (incomeExpenses.monthlyDiscretionary || 0);
annualExpenses = monthly * 12;
```

**Result**: Essential vs discretionary distinction is LOST before reaching the projection engine.

**Implementation Required**:
1. Add `annualEssentialExpenses` and `annualDiscretionaryExpenses` to `ProjectionInput` interface
2. Update input builder to preserve both values
3. Update projection engine to track both through calculations
4. Add to `ProjectionRecord` output for year-by-year tracking

### 3. Projection Engine

**Location**: `src/lib/projections/engine.ts`

**Current Income Processing** (lines 95-108):
```typescript
function calculateTotalIncome(
  streams: IncomeStream[],
  age: number,
  inflationMultiplier: number
): number {
  return streams.reduce((total, stream) => {
    if (age >= stream.startAge && (stream.endAge === undefined || age <= stream.endAge)) {
      const streamInflation = stream.inflationAdjusted ? inflationMultiplier : 1;
      return total + stream.annualAmount * streamInflation;
    }
    return total;
  }, 0);
}
```

**Gap**: No separation of guaranteed vs variable income in calculation.

**Current Expense Processing** (lines 162-171):
- Single `annualExpenses` value with inflation
- Healthcare tracked separately (good pattern to follow)
- No essential/discretionary breakdown

**Current Income vs Expense Comparison** (lines 174-177):
```typescript
const totalIncome = calculateTotalIncome(input.incomeStreams, age, inflationMultiplier);
const withdrawalNeeded = Math.max(0, expensesNeeded - totalIncome);
```

**Gap**: No coverage ratio calculation, no guaranteed income floor analysis.

**Implementation Required**:
1. New function: `calculateGuaranteedIncome()` filtering by `isGuaranteed`
2. Preserve essential expenses through projection loop
3. Calculate coverage ratio: `guaranteedIncome / essentialExpenses`
4. Determine floor establishment age

### 4. Insights Infrastructure

**Location**: `src/lib/projections/sensitivity.ts` and `src/components/insights/`

**Current Insight Types**:
1. **LeverImpact** - Sensitivity analysis on 6 levers
2. **LowFrictionWin** - Actionable opportunities
3. **SensitiveAssumption** - Assumptions to review

**Current Focus**: All insights focus on:
- Portfolio balance impact
- Fund depletion timing
- Sensitivity to assumptions

**Gap**: No income floor-related insights exist:
- No `guaranteedIncomeCoverageRatio` calculation
- No `incomeFloorEstablishedAge` determination
- No pass/fail indicator for income floor status

**Implementation Required**:
1. New insight type: `IncomeFloorAnalysis` interface (as specified in Epic 8 scope)
2. New calculation function: `calculateIncomeFloor()`
3. New insight generation: `generateIncomeFloorInsight()`
4. New UI component: `IncomeFloorCard` or similar
5. Integration with existing `InsightsSection`

### 5. UI Components

**Income Stream Form** (`src/components/onboarding/step-income-streams.tsx`):
- Has type selector dropdown
- Has COLA (inflation adjustment) toggle
- **Missing**: Spouse toggle, guaranteed indicator

**Dashboard/Insights** (`src/components/insights/`):
- Has `TopLeversCard`, `LowFrictionWinsCard`, `AssumptionSensitivityCard`
- **Missing**: Income floor status card
- **Missing**: Guaranteed income vs essential expenses comparison view

**Projection Display** (`src/components/projections/`):
- Shows income and expenses in table
- **Missing**: Breakdown of guaranteed vs variable income
- **Missing**: Coverage ratio display

## Code References

### Data Model
- `src/lib/projections/types.ts:22-30` - IncomeStream interface (needs `isGuaranteed`, `isSpouse`)
- `src/lib/projections/types.ts:11-17` - IncomeStreamType enum (classification source)
- `src/db/schema/financial-snapshot.ts:40-48` - IncomeStreamJson database type
- `src/types/onboarding.ts:187-190` - IncomeExpenses interface

### Aggregation Points (need modification)
- `src/lib/projections/input-builder.ts:59-70` - Expense aggregation
- `src/app/api/projections/calculate/route.ts:177-193` - API expense aggregation
- `src/lib/projections/types.ts:79-82` - ProjectionInput (single annualExpenses)

### Projection Engine
- `src/lib/projections/engine.ts:95-108` - calculateTotalIncome (no guaranteed filter)
- `src/lib/projections/engine.ts:162-171` - Expense calculation (no essential breakdown)
- `src/lib/projections/engine.ts:174-177` - Income vs expense comparison

### Insights
- `src/lib/projections/sensitivity.ts:79-143` - analyzeSensitivity (base pattern)
- `src/lib/projections/sensitivity-types.ts:6-68` - Insight type definitions
- `src/app/api/insights/analyze/route.ts:35-171` - Insights API endpoint
- `src/components/insights/InsightsSection.tsx:15-119` - Main insights container

### UI Forms
- `src/components/onboarding/step-income-streams.tsx:97-222` - Income stream cards
- `src/components/onboarding/step3b-income-expenses.tsx:66-110` - Expense inputs
- `src/components/onboarding/step5-review.tsx:211-230` - Expense display

## Architecture Insights

### Patterns to Follow

1. **Separate Inflation Rates**: Healthcare uses separate inflation rate (5% vs 2.5%) - good pattern for essential vs discretionary if needed

2. **Sensitivity Testing Pattern**: Baseline + delta testing is well-established - can be adapted for income floor scenarios

3. **AI Enhancement Pattern**: Core calculations are deterministic; AI provides narrative only - maintain this for income floor insights

4. **Progressive Enhancement**: Insights work without AI (explanations optional) - income floor should follow same pattern

### Recommended Implementation Order

Based on dependencies:

1. **Phase 1: Data Model** (Story 8.1)
   - Add `isGuaranteed` and `isSpouse` to IncomeStream
   - Create classification function
   - Update database schema
   - Update UI forms

2. **Phase 2: Expense Preservation** (Story 8.2, Part 1)
   - Add essential/discretionary to ProjectionInput
   - Update input builder
   - Preserve through projection engine
   - Update ProjectionRecord output

3. **Phase 3: Income Floor Calculation** (Story 8.2, Part 2)
   - Implement `calculateGuaranteedIncome()`
   - Implement `calculateIncomeFloor()`
   - Calculate coverage ratio per year
   - Determine floor establishment age

4. **Phase 4: Insight Display** (Story 8.3)
   - Create `IncomeFloorAnalysis` type
   - Implement insight generation
   - Create UI component
   - Integrate with InsightsSection

## Historical Context (from thoughts/)

- `thoughts/personal/tickets/epic-8/story-1-scope.md` - Full Epic 8 specification with acceptance criteria
- `thoughts/personal/tickets/epic-7/story-1-scope.md` - Epic 7 (Income Source Classification) is a prerequisite
- `thoughts/shared/research/2026-01-15-story-7.1-income-source-classification.md` - Recent research on income classification foundation
- `thoughts/shared/research/2025-12-26-story-3.4-multiple-income-expense-streams-research.md` - Multiple income streams implementation research

## Related Research

- `thoughts/shared/research/2026-01-14-ENG-6.1-actionable-insights-implementation.md` - Insights infrastructure research
- `thoughts/shared/research/2025-12-17-epic-3-projection-engine-implementation-readiness.md` - Projection engine analysis

## Open Questions

1. **Spouse Income Modeling**: Should `isSpouse` be on individual streams or should there be a household-level spouse Social Security configuration?

2. **User Override for Guaranteed Classification**: Should users be able to override auto-classification (e.g., mark rental income as "reliable")?

3. **Partial Coverage Display**: How granular should coverage tracking be? Per-year breakdown vs summary metrics?

4. **Integration with Scenarios**: Should income floor analysis work with "what-if" scenarios from Epic 5?

5. **AI Narrative**: Should the income floor insight have an AI-generated explanation like other insights?

## Implementation Effort Estimate

| Component | Complexity | Files to Modify |
|-----------|------------|-----------------|
| Data model changes | Low | 4 files |
| Expense preservation | Medium | 5 files |
| Income floor calculation | Medium | 2 new files |
| Insight integration | Medium | 3 files |
| UI components | Medium | 4-5 files |
| Tests | Medium | 3-4 new files |

**Total**: Medium complexity epic with well-defined scope and clear dependencies.
