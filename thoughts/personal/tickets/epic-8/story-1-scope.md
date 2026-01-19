# EPIC 8 — Safety-First Income Floor Modeling

## Goal

Separate "never-fail" income from market risk so users gain psychological and mathematical permission to spend.

---

## 8.1: Guaranteed Income Sources

**As a user**, I want to enter pensions with inflation-adjustment options so my lifetime guaranteed income is accurately modeled.

**As a user**, I want to model Social Security claiming ages separately for each spouse.

### Built-in Guardrails

- Pension COLA toggle explicitly labeled (not assumed)
- Spouse income streams clearly distinguished in UI
- No implicit assumptions about claiming strategy

### Acceptance Criteria

- [ ] Pension income streams support `inflationAdjusted` toggle (EXISTING)
- [ ] Add spouse differentiation for Social Security:
  - Option A: `isSpouse: boolean` field on income streams
  - Option B: Dedicated spouse SS fields in household model
- [ ] UI clearly labels primary vs spouse income streams
- [ ] Validation ensures spouse SS start age is within valid range (62-70)

### Current State

| Feature | Status | Notes |
|---------|--------|-------|
| Pension with COLA | **Done** | `inflationAdjusted` boolean exists |
| Spouse SS claiming ages | **Not Done** | Single `startAge` per stream, no spouse awareness |

---

## 8.2: Income Classification

**As a user**, I want PlanSmart to automatically classify income as guaranteed vs market-dependent.

**As a user**, I want to see my essential expenses covered (or not) by guaranteed income alone.

### Built-in Guardrails

- Classification rules are explicit and deterministic
- No AI inference for reliability classification
- Essential expense threshold clearly defined

### Acceptance Criteria

- [ ] Add `isGuaranteed: boolean` or `reliability: 'guaranteed' | 'variable'` to `IncomeStream` interface
- [ ] Auto-classify by type:
  - Guaranteed: `social_security`, `pension`, `annuity`
  - Variable: `rental`, `part_time`, `other`
- [ ] Preserve essential vs discretionary expenses through projection engine (don't aggregate)
- [ ] Calculate: `guaranteedIncomeCoverageRatio = guaranteedIncome / essentialExpenses`
- [ ] Display coverage ratio in dashboard/insights

### Current State

| Feature | Status | Notes |
|---------|--------|-------|
| Income type field | **Done** | `type` exists but is cosmetic only |
| Guaranteed classification | **Not Done** | No `isGuaranteed` or reliability field |
| Essential expenses tracking | **Partial** | Captured in input, immediately aggregated in projections |
| Coverage calculation | **Not Done** | No comparison of guaranteed income vs essential expenses |

---

## 8.3: Income Floor Insight

**As a user**, I want a clear statement like:

> "Your essential lifestyle is fully covered by guaranteed income starting at age X."

### Built-in Guardrails

- Statement derived from deterministic calculation, not AI
- Threshold for "fully covered" is explicit (e.g., 100% coverage)
- No prescriptive language about what user "should" do

### Acceptance Criteria

- [ ] Calculate `incomeFloorEstablishedAge`: first age where `guaranteedIncome >= essentialExpenses`
- [ ] Generate insight statement:
  - If floor established: "Your essential lifestyle is fully covered by guaranteed income starting at age {X}."
  - If partial: "Guaranteed income covers {Y}% of essential expenses at retirement."
  - If not established: "Essential expenses exceed guaranteed income throughout retirement."
- [ ] Display pass/fail indicator in UI:
  - Green: Floor established
  - Yellow: Partial coverage (50-99%)
  - Red: Insufficient coverage (<50%)
- [ ] Include in AI summary context (but AI narrates, doesn't calculate)

### Current State

| Feature | Status | Notes |
|---------|--------|-------|
| Income floor calculation | **Not Done** | No such calculation exists |
| Income floor insight | **Not Done** | Insights focus on sensitivity, not floor status |
| Pass/fail indicator | **Not Done** | Current status based on fund depletion, not income coverage |

---

## Acceptance Criteria Summary

| Criterion | Status | Priority |
|-----------|--------|----------|
| Guaranteed income is inflation-adjusted | **Partial** | Low (COLA exists, classification missing) |
| Essential expenses can be toggled and compared against guaranteed income | **Not Done** | **High** |
| Clear pass/fail indicator for "income floor established" | **Not Done** | **High** |

---

## Technical Implementation Notes

### Data Model Changes

```typescript
// Update IncomeStream interface
export interface IncomeStream {
  id: string;
  name: string;
  type: IncomeStreamType;
  annualAmount: number;
  startAge: number;
  endAge?: number;
  inflationAdjusted: boolean;
  // NEW FIELDS
  isGuaranteed: boolean;        // Auto-set based on type, user can override
  isSpouse?: boolean;           // For household income modeling
}

// New interface for income floor analysis
export interface IncomeFloorAnalysis {
  guaranteedIncome: number;           // Sum of guaranteed streams at given age
  essentialExpenses: number;          // Annual essential expenses (inflation-adjusted)
  coverageRatio: number;              // guaranteedIncome / essentialExpenses
  isFloorEstablished: boolean;        // coverageRatio >= 1.0
  floorEstablishedAge: number | null; // First age where floor is established
  coverageByAge: Array<{              // Year-by-year coverage
    age: number;
    guaranteedIncome: number;
    essentialExpenses: number;
    coverageRatio: number;
  }>;
}
```

### New Functions Needed

```typescript
// In src/lib/projections/income-floor.ts

export function classifyIncomeReliability(type: IncomeStreamType): boolean {
  const guaranteedTypes: IncomeStreamType[] = ['social_security', 'pension', 'annuity'];
  return guaranteedTypes.includes(type);
}

export function calculateIncomeFloor(
  incomeStreams: IncomeStream[],
  essentialExpenses: number,
  inflationRate: number,
  startAge: number,
  endAge: number
): IncomeFloorAnalysis {
  // Calculate guaranteed income vs essential expenses for each year
  // Return analysis with floor established age
}

export function generateIncomeFloorInsight(analysis: IncomeFloorAnalysis): string {
  // Generate human-readable insight statement
}
```

### UI Changes

1. **Income Stream Form**: Add spouse toggle for SS streams
2. **Dashboard**: Add income floor status card
3. **Insights Section**: Add income floor insight to existing insights
4. **Projection Display**: Show guaranteed vs variable income breakdown

---

## Differentiator

> "Most tools calculate income. PlanSmart frames safety."

This epic delivers on the Safety-First philosophy by:
1. Explicitly classifying income reliability
2. Showing whether essential needs are secured
3. Giving users "permission to spend" when floor is established
4. Providing clear visual feedback on safety status

---

## Dependencies

- Requires existing income streams feature (Done)
- Requires existing essential/discretionary expense capture (Done)
- Builds on existing insights infrastructure (Done)

---

## Out of Scope (for this epic)

| Excluded | Notes |
|----------|-------|
| Spend-Boldly recommendations | Separate epic (after floor established) |
| Dynamic spending strategies | Future enhancement |
| Spousal benefit optimization | Complex SS rules, future phase |
| Annuity purchase recommendations | Would cross into advice territory |

---

## Definition of Done

- [ ] Spouse SS claiming ages supported in data model and UI
- [ ] Income streams auto-classified as guaranteed/variable
- [ ] Essential expenses preserved (not aggregated) in projection engine
- [ ] Income floor calculation implemented and tested
- [ ] Income floor insight displayed in dashboard
- [ ] Pass/fail indicator visible in UI
- [ ] Unit tests for income floor calculations
- [ ] E2E test for income floor user flow
