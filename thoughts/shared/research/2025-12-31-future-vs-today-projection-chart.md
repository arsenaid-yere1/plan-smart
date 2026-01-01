---
date: 2025-12-31T12:00:00-08:00
researcher: Claude
git_commit: 1ffb951e80a7c4c92804ad21a20db653f85c508a
branch: main
repository: plan-smart
topic: "What does Future $ vs Today's $ mean in the projections chart?"
tags: [research, codebase, projections, inflation, chart, visualization]
status: complete
last_updated: 2025-12-31
last_updated_by: Claude
---

# Research: Future $ vs Today's $ in Projections Chart

**Date**: 2025-12-31T12:00:00-08:00
**Researcher**: Claude
**Git Commit**: 1ffb951e80a7c4c92804ad21a20db653f85c508a
**Branch**: main
**Repository**: plan-smart

## Research Question
What does "Future $" vs "Today's $" mean in the projections chart?

## Summary

The projections chart has a toggle that lets users view their projected balances in two ways:

1. **Future $ (Nominal Dollars)** - The actual dollar amounts you'll have at each age. This is the default view.
2. **Today's $ (Real Dollars)** - What those future dollars are worth in today's purchasing power, adjusted for inflation.

The key insight: **$1,000,000 in 35 years won't buy what $1,000,000 buys today.** The "Today's $" view shows you what your future money can actually purchase.

## Detailed Findings

### How It Works

The inflation adjustment uses compound deflation:

```typescript
// From ProjectionChart.tsx:75-79
const yearsFromNow = record.age - currentAge;
const inflationFactor = Math.pow(1 + inflationRate, yearsFromNow);
const realBalance = record.balance / inflationFactor;
const displayBalance = adjustForInflation ? realBalance : record.balance;
```

**Example Calculation:**
- Current age: 30
- Future age: 65 (35 years from now)
- Inflation rate: 2.5%
- Nominal balance at 65: $1,000,000
- Inflation factor: (1.025)^35 = 2.373
- Real balance: $1,000,000 / 2.373 = **$421,371**

This means $1,000,000 at age 65 has the same purchasing power as $421,371 today.

### UI Implementation

The toggle is implemented in [ProjectionChart.tsx:189-224](src/components/projections/ProjectionChart.tsx#L189-L224):

- Two buttons: "Future $" and "Today's $"
- Default selection is "Future $" (nominal values)
- Uses `aria-pressed` for accessibility
- State managed via `useState(false)` where false = Future $

### Tooltip Transparency

The tooltip always shows both values regardless of which mode is selected:

```
Primary display: Shows the currently selected view
Secondary display: Shows the alternative view in parentheses
```

For example, in "Today's $" mode:
- "Today's $: $421,371"
- "($1,000,000 in future dollars)"

### Important Design Decisions

1. **Calculation Layer vs Display Layer**: The projection engine always works in nominal (future) dollars. Inflation adjustment happens ONLY in the chart component for display purposes.

2. **No Storage of Real Values**: The database stores only nominal balances. Real balances are calculated on-the-fly based on the current inflation rate assumption.

3. **Export Uses Nominal**: When users export projections (CSV/PDF), they get nominal values only.

## Code References

- [ProjectionChart.tsx:53](src/components/projections/ProjectionChart.tsx#L53) - Toggle state definition
- [ProjectionChart.tsx:75-79](src/components/projections/ProjectionChart.tsx#L75-L79) - Inflation adjustment calculation
- [ProjectionChart.tsx:189-224](src/components/projections/ProjectionChart.tsx#L189-L224) - Toggle UI buttons
- [ProjectionChart.tsx:268-278](src/components/projections/ProjectionChart.tsx#L268-L278) - Tooltip showing both values
- [assumptions.ts:16](src/lib/projections/assumptions.ts#L16) - Default inflation rate (2.5%)
- [engine.ts:167-168](src/lib/projections/engine.ts#L167-L168) - Engine uses inflation for expense growth (separate from this feature)

## Architecture Insights

### Separation of Concerns
- **Engine** (`engine.ts`): Pure calculation, nominal dollars only
- **Chart** (`ProjectionChart.tsx`): Display transformation, handles both views
- **Database**: Stores nominal values, inflation rate as assumption

### Why This Design?
1. **Single Source of Truth**: Nominal values are stored; real values derived
2. **User Flexibility**: Changing inflation assumptions updates real values instantly
3. **Export Consistency**: Exported data matches what the engine calculates

### Inflation in the Engine vs Chart

The engine DOES use inflation, but differently:
- Engine inflates **expenses** year-over-year during retirement (costs go up)
- Chart deflates **balances** for display purposes (shows purchasing power)

These are complementary concepts:
- Engine: "Expenses will cost more in the future"
- Chart: "Your balance is worth less in purchasing power"

## Test Coverage

Tests verify the toggle behavior in [ProjectionChart.test.tsx:180-194](src/components/projections/__tests__/ProjectionChart.test.tsx#L180-L194):

```typescript
it('shows inflation toggle with Future $ active by default', () => {
  const futureButton = screen.getByText('Future $');
  const todaysButton = screen.getByText("Today's $");

  expect(futureButton).toHaveAttribute('aria-pressed', 'true');
  expect(todaysButton).toHaveAttribute('aria-pressed', 'false');
});
```

## Open Questions

None - the implementation is straightforward and well-documented in the code.
