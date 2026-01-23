# Story 10.3 – Depletion Feedback

## User Story

> As a user,
> I want to see how my depletion target translates into monthly spending,
> so I understand the practical impact of my choices.

> As a user,
> I want visual feedback showing my portfolio trajectory toward the depletion target,
> so I can see if I'm on track with my intentional spending plan.

## Acceptance Criteria

- [ ] Display calculated monthly spending amount derived from depletion target
- [ ] Show spending breakdown by phase (if life-phase spending is enabled):
  - Go-Go years: $X/month
  - Slow-Go years: $Y/month
  - No-Go years: $Z/month
- [ ] Projection chart shows:
  - Depletion target point clearly marked (age + portfolio value)
  - Reserve floor line if reserve is configured
  - Current trajectory vs. target trajectory
- [ ] Real-time updates as user adjusts:
  - Depletion percentage
  - Target age
  - Reserve amount
- [ ] Summary card showing:
  - "To reach X% depletion by age Y, you can spend $Z/month"
  - Comparison to current spending plan (if different)
- [ ] Warning indicators when:
  - Current spending exceeds sustainable rate for target
  - Current spending is significantly below target (leaving money unspent)
  - Reserve would be breached before target age

---

## Epic Context

**Epic 10: Intentional Portfolio Depletion Controls**

### Epic Goal

Let users plan to use their money — not just preserve it. Most financial planning tools treat portfolio depletion as failure. PlanSmart recognizes that money is meant to be spent, and helps users plan intentional drawdown strategies.

### Epic Success Criteria

- Depletion targets are explicit inputs (not inferred)
- Remaining reserves are clearly shown at target age
- Warnings only trigger if reserves drop below safety thresholds
- Users feel empowered to spend, not scared into hoarding

### Differentiator

> Most planners avoid depletion.
> **PlanSmart designs for it.**

---

## Technical Implementation Notes

### Calculation Engine

```typescript
interface DepletionFeedback {
  sustainableMonthlySpending: number;
  sustainableAnnualSpending: number;
  phaseBreakdown?: PhaseSpendingBreakdown[];
  trajectoryStatus: 'on_track' | 'underspending' | 'overspending';
  warningMessages: string[];
  projectedReserveAtTarget: number;
}

interface PhaseSpendingBreakdown {
  phaseName: string;
  startAge: number;
  endAge: number;
  monthlySpending: number;
  annualSpending: number;
}

const calculateDepletionFeedback = (
  currentPortfolio: number,
  depletionTarget: DepletionTarget,
  reserve: ReserveConfig,
  currentAge: number,
  lifeExpectancy: number,
  expectedReturn: number,
  inflationRate: number,
  spendingPhases?: SpendingPhase[]
): DepletionFeedback => {
  // Calculate target ending value
  const targetReserve = reserve.type === 'absolute'
    ? reserve.amount
    : currentPortfolio * (reserve.amount / 100);

  const yearsToTarget = depletionTarget.targetAge - currentAge;

  // Use present value of annuity formula adjusted for growth
  // to calculate sustainable withdrawal
  const realReturn = (1 + expectedReturn) / (1 + inflationRate) - 1;

  // Simplified calculation - actual implementation would integrate
  // with projection engine for accuracy
  const sustainableAnnual = calculateSustainableWithdrawal(
    currentPortfolio,
    targetReserve,
    yearsToTarget,
    realReturn
  );

  return {
    sustainableMonthlySpending: sustainableAnnual / 12,
    sustainableAnnualSpending: sustainableAnnual,
    // ... additional calculations
  };
};
```

### Visualization Components

```typescript
interface DepletionChartProps {
  projectionData: ProjectionYear[];
  depletionTarget: DepletionTarget;
  reserve: ReserveConfig;
  currentAge: number;
}

// Chart annotations
interface ChartAnnotation {
  type: 'target_point' | 'reserve_floor' | 'warning_zone';
  x: number;  // Age
  y: number;  // Portfolio value
  label: string;
}
```

### Feedback Summary Component

```typescript
interface DepletionSummaryProps {
  feedback: DepletionFeedback;
  currentPlannedSpending: number;
  depletionTarget: DepletionTarget;
}

// Display format:
// "To spend 75% of your portfolio by age 80, you can spend $6,250/month"
// "This is $500/month more than your current plan"
// OR
// "Your current spending of $7,000/month will deplete 85% by age 80"
```

---

## UI/UX Considerations

### Tone and Framing

- Frame depletion as **intentional spending**, not failure
- Use encouraging language: "You can enjoy $X/month" not "You must limit to $X"
- Warnings should be informative, not alarming
- Highlight when users are **underspending** — leaving money on the table

### Visual Design

- Use green/positive colors for "on track" status
- Amber for "underspending" (missing out on life)
- Red only for "will breach reserve" (genuine concern)
- Clear milestone marker on chart for depletion target

---

## Out of Scope (for this story)

| Excluded | Notes |
|----------|-------|
| Depletion target input | Story 10.1 |
| Reserve configuration | Story 10.2 |
| Tax-optimized withdrawal sequencing | Future epic |
| Monte Carlo simulation of depletion scenarios | Future enhancement |
| Spending recommendations based on market performance | Future enhancement |
