# Story 9.2 – Front-Loaded Spending Support

## User Story

> As a user,
> I want to intentionally spend more during my healthiest years,
> without being penalized by generic rules like the 4% rule.

> As a user,
> I want to see how aggressive early spending affects my long-term security,
> so I can make informed tradeoffs between enjoying now and ensuring later.

## Acceptance Criteria

- [ ] "Front-load spending" toggle or explicit spending curve option
- [ ] When enabled, projection engine:
  - Applies phase-based spending multipliers
  - Shows impact on portfolio longevity
  - Calculates "breakeven" point where higher early spending equals flat spending
- [ ] Comparison view: flat vs phase-based spending scenarios
- [ ] No penalty messaging for choosing higher early spending (neutral framing)
- [ ] Clear visualization of spending trajectory over time

---

## Epic Context

**Epic 9: Life-Phase–Based Spending Planning**

### Why This Matters

The 4% rule and similar safe withdrawal rate frameworks assume:
- Constant inflation-adjusted spending
- No adaptation based on market conditions
- No recognition that early retirement years are more active

Reality shows:
- Retirees spend 20-30% more in early retirement on travel and activities
- Spending naturally declines 1-2% per year in real terms after age 75
- Forced frugality in healthy years to fund hypothetical late-life spending is often regretted

### Differentiator

> "Most tools tell you to save for 30 years of flat spending.
> PlanSmart helps you spend boldly when it matters most."

---

## Technical Implementation Notes

### Projection Engine Changes

```typescript
// Update getSpendingForAge to use phases
export function getSpendingForAge(
  age: number,
  baseSpending: number,
  phases: SpendingPhase[],
  inflationRate: number,
  yearsFromStart: number
): number {
  const phase = phases.find(p =>
    age >= p.startAge && (p.endAge === undefined || age < p.endAge)
  );

  const multiplier = phase?.spendingMultiplier ?? 1.0;
  const inflationFactor = Math.pow(1 + inflationRate, yearsFromStart);

  return baseSpending * multiplier * inflationFactor;
}
```

### Comparison Metrics

```typescript
export interface SpendingComparison {
  flatSpending: {
    totalLifetimeSpending: number;
    portfolioDepletionAge: number | null;
    endingBalance: number;
  };
  phasedSpending: {
    totalLifetimeSpending: number;
    portfolioDepletionAge: number | null;
    endingBalance: number;
    earlyYearsBonus: number;  // Extra spending in Go-Go years vs flat
  };
  breakEvenAge: number | null;  // Age where cumulative spending equals
}
```

### UI Components

1. **Spending Mode Toggle**: Flat vs Life-Phase
2. **Phase Editor**: Inline editing of phase boundaries and multipliers
3. **Comparison Chart**: Side-by-side or overlay of spending trajectories
4. **Impact Summary**: "Spending $X more in first 10 years, portfolio lasts until age Y"

---

## Guardrails

- No prescriptive language ("you should spend more")
- Show facts: spending amounts, portfolio impact, tradeoffs
- Respect user's risk tolerance and goals
- Warn if front-loaded spending creates income floor gap (Epic 8 integration)

---

## Out of Scope (for this story)

| Excluded | Notes |
|----------|-------|
| Dynamic spending rules (guardrails) | Future enhancement |
| Market-adaptive spending | Separate epic |
| Healthcare cost spikes | Separate modeling |
