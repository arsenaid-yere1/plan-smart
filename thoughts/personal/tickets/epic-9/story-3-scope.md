# Story 9.3 – Visual Spending Timeline

## User Story

> As a user,
> I want to see a timeline showing spending levels by age band,
> so I can visualize how my retirement spending will evolve over time.

## Acceptance Criteria

- [ ] Timeline visualization showing:
  - Age bands on x-axis
  - Spending amounts on y-axis
  - Phase boundaries clearly marked with labels
  - Color-coded regions for each phase
- [ ] Interactive features:
  - Hover to see exact spending at any age
  - Click phase to edit its parameters
  - Drag phase boundaries to adjust (optional enhancement)
- [ ] Shows both nominal and real (inflation-adjusted) values toggle
- [ ] Integrates with projection chart (spending as one layer)
- [ ] Mobile-responsive design

---

## Epic Context

**Epic 9: Life-Phase–Based Spending Planning**

### Epic Goal

Replace flat withdrawal assumptions with intentional, age-based spending behavior.

### Visual Design Philosophy

The spending timeline should:
1. Make the "spending smile" concept tangible
2. Show clear phase transitions without overwhelming detail
3. Connect spending plan to portfolio projections
4. Enable quick iteration on phase definitions

---

## Technical Implementation Notes

### Chart Component

```typescript
interface SpendingTimelineProps {
  phases: SpendingPhase[];
  baseSpending: number;
  inflationRate: number;
  startAge: number;
  endAge: number;
  showNominal: boolean;  // true = nominal dollars, false = real dollars
  onPhaseClick?: (phaseId: string) => void;
}
```

### Visualization Options

**Option A: Area Chart**
- Stacked area showing spending by phase
- Clear visual of total spending over time
- Phase colors blend at boundaries

**Option B: Step Chart with Regions**
- Horizontal steps for each phase
- Background shading for phase regions
- Clearer phase boundaries

**Option C: Integrated with Portfolio Chart**
- Spending shown as a line/area on existing projection chart
- Unified view of assets and withdrawals
- Phase markers as vertical bands

### Recommended Approach: Option C (Integrated)

Integrate spending phases directly into the existing projection chart:
- Portfolio balance as primary area/line
- Spending rate shown as overlay line
- Phase boundaries as subtle vertical bands with labels
- Reduces cognitive load by showing everything in context

### Data Flow

```typescript
// Generate timeline data points
export function generateSpendingTimeline(
  phases: SpendingPhase[],
  baseSpending: number,
  inflationRate: number,
  startAge: number,
  endAge: number
): SpendingTimelinePoint[] {
  const points: SpendingTimelinePoint[] = [];

  for (let age = startAge; age <= endAge; age++) {
    const yearsFromStart = age - startAge;
    const spending = getSpendingForAge(age, baseSpending, phases, inflationRate, yearsFromStart);
    const realSpending = spending / Math.pow(1 + inflationRate, yearsFromStart);

    points.push({
      age,
      nominalSpending: spending,
      realSpending,
      phase: getPhaseForAge(age, phases),
    });
  }

  return points;
}
```

---

## UI/UX Requirements

### Desktop View
- Full-width chart in projection section
- Phase labels above chart
- Legend showing phase colors and spending levels
- Edit button to open phase editor modal

### Mobile View
- Simplified chart with touch-friendly interactions
- Swipe to navigate through phases
- Bottom sheet for phase editing

### Accessibility
- Screen reader descriptions for phase data
- Keyboard navigation for chart interactions
- High contrast mode support

---

## Out of Scope (for this story)

| Excluded | Notes |
|----------|-------|
| Drag-to-adjust phase boundaries | Nice-to-have enhancement |
| Animation between scenarios | Future polish |
| Export/share timeline image | Future feature |
