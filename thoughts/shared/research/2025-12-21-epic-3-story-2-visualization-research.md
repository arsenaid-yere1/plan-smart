---
date: 2025-12-21T12:00:00-08:00
researcher: Claude
git_commit: 1c71bdff708dca8b078e6e18984e1eae32423ae7
branch: main
repository: plan-smart
topic: "Story 2: Visualize Assets Over Time - Implementation Research"
tags: [research, codebase, epic-3, visualization, charts, recharts, projection-engine]
status: complete
last_updated: 2025-12-21
last_updated_by: Claude
---

# Research: Story 2 - Visualize Assets Over Time

**Date**: 2025-12-21T12:00:00-08:00
**Researcher**: Claude
**Git Commit**: 1c71bdff708dca8b078e6e18984e1eae32423ae7
**Branch**: main
**Repository**: plan-smart

## Research Question
What exists in the codebase to support implementing Story 2 (Visualize Assets Over Time) and what needs to be built?

## Summary

The codebase has **complete projection engine infrastructure** (Story 1) producing chart-ready data, a **robust design system** (Tailwind + shadcn/ui + Radix UI), and **established responsive patterns**, but **no charting library is currently installed**. The projection engine returns a `ProjectionRecord[]` array with year-by-year data perfect for time-series visualization.

### Key Findings:
1. **No charting library installed** - Need to add Recharts, Chart.js, or similar
2. **Projection data is chart-ready** - `ProjectionRecord[]` has age, year, balance, inflows, outflows
3. **Design system exists** - CSS variables for colors, dark mode support, Card components
4. **Mobile patterns established** - Responsive utilities, touch-friendly targets, collapsible sections

## Detailed Findings

### 1. Charting Infrastructure

**Current State: None**

No charting libraries exist in `package.json`. Relevant dependencies to evaluate:
- **Recharts** - React-specific, declarative, good shadcn integration
- **Chart.js + react-chartjs-2** - Lightweight, canvas-based
- **Visx** - Low-level D3 + React, maximum control
- **Nivo** - Feature-rich, built on D3

**Recommendation**: Recharts aligns best with the existing React + Tailwind stack and has shadcn-compatible styling patterns.

### 2. Projection Engine Output (Story 1)

**File**: [src/lib/projections/types.ts](src/lib/projections/types.ts)

The projection engine produces data structured for visualization:

```typescript
interface ProjectionResult {
  records: ProjectionRecord[];
  summary: ProjectionSummary;
}

interface ProjectionRecord {
  age: number;           // X-axis option 1
  year: number;          // X-axis option 2
  balance: number;       // Y-axis primary value
  inflows: number;       // Contributions or SS income
  outflows: number;      // Expenses (0 during accumulation)
  balanceByType: {       // For stacked/breakdown charts
    taxDeferred: number;
    taxFree: number;
    taxable: number;
  };
  withdrawalsByType?: BalanceByType; // Only in drawdown phase
}
```

**API Endpoint**: `POST /api/projections/calculate` returns `{projection, inputs, meta}`

### 3. Design System Components

**File**: [src/app/globals.css](src/app/globals.css)

**Chart-Ready Colors (CSS Variables):**
- Primary: `--primary` (Indigo #4F46E5)
- Success: `--success` (Green - for positive growth)
- Destructive: `--destructive` (Red - for negative balances)
- Muted: `--muted-foreground` (for grid lines, secondary data)
- Border: `--border` (for chart borders, axes)

**Dark Mode**: Automatic via CSS variables + `next-themes`

**Container Components**:
- `Card`, `CardHeader`, `CardContent` - Wrap chart in card for consistent styling
- `PageContainer` - Responsive padding (`px-4 sm:px-6 lg:px-8`)

### 4. Mobile Responsiveness Patterns

**Breakpoints** (Tailwind defaults):
- `sm:` 640px
- `md:` 768px
- `lg:` 1024px

**Applicable Patterns**:
- Full-width on mobile: `w-full`
- Responsive heights: `h-64 sm:h-80 lg:h-96`
- Text scaling: `text-xs md:text-sm` for labels
- Touch targets: minimum 44x44px (follow button `h-9` + padding)
- Collapsible for data-heavy views: `Collapsible` component exists

**Tooltip Strategy**:
- No native Tooltip component exists
- Consider: Recharts built-in tooltips + custom styling
- Mobile: Touch to show, tap elsewhere to dismiss

### 5. Phase Distinction Requirements

From Story 2 scope:
- **Accumulation phase**: Pre-retirement, `age < retirementAge`
- **Retirement phase**: Post-retirement, `age >= retirementAge`

**Visual Options**:
1. Color change at retirement age transition
2. Background shading (light fill behind phases)
3. Vertical reference line at retirement age
4. Gradient fill change

**Data for Phase Detection**:
- `projection.inputs.retirementAge` - Transition point
- Record-level: Compare `record.age` to `retirementAge`

### 6. Negative Balance Handling

Requirements:
- Distinct color (red/destructive)
- Clear zero-balance baseline

**Implementation**:
- Use `--destructive` color for balance < 0
- Y-axis includes 0 reference line
- `yearsUntilDepletion` in summary flags when balance hits 0

## Code References

- [src/lib/projections/engine.ts:98](src/lib/projections/engine.ts#L98) - `runProjection()` main function
- [src/lib/projections/types.ts:104-114](src/lib/projections/types.ts#L104-L114) - `ProjectionRecord` interface
- [src/lib/projections/types.ts:131-134](src/lib/projections/types.ts#L131-L134) - `ProjectionResult` interface
- [src/app/api/projections/calculate/route.ts:151](src/app/api/projections/calculate/route.ts#L151) - GET endpoint
- [src/app/api/projections/calculate/route.ts:177](src/app/api/projections/calculate/route.ts#L177) - POST endpoint
- [src/components/ui/card.tsx](src/components/ui/card.tsx) - Card component for chart wrapper
- [src/components/layout/page-container.tsx](src/components/layout/page-container.tsx) - Responsive container
- [src/app/globals.css:6-97](src/app/globals.css#L6-L97) - CSS color variables

## Architecture Insights

### Chart Data Flow
```
FinancialSnapshot (DB)
  → API /api/projections/calculate
  → ProjectionResult {records[], summary}
  → Chart Component (client-side)
  → Visual rendering
```

### Suggested Component Structure
```
src/components/projections/
├── ProjectionChart.tsx      # Main chart component
├── ChartTooltip.tsx         # Custom tooltip styling
├── ChartLegend.tsx          # Phase/color legend
└── index.ts                 # Exports
```

### Reactivity Pattern
- Use `useSWR` or React Query to fetch projection data
- Chart re-renders on data change
- Consider `useMemo` for chart data transformations

## Historical Context (from thoughts/)

- [thoughts/shared/plans/2025-12-18-epic-3-story-1-projection-engine.md](thoughts/shared/plans/2025-12-18-epic-3-story-1-projection-engine.md) - Story 1 implementation plan (7 phases, completed)
- [thoughts/shared/research/2025-12-17-epic-3-projection-engine-implementation-readiness.md](thoughts/shared/research/2025-12-17-epic-3-projection-engine-implementation-readiness.md) - Projection engine readiness analysis
- [thoughts/shared/research/2025-12-05-clean-ui-design-website-experience.md](thoughts/shared/research/2025-12-05-clean-ui-design-website-experience.md) - UI design system research
- [thoughts/personal/tickets/epic-3/projection-modeling/story-1-scope.md](thoughts/personal/tickets/epic-3/projection-modeling/story-1-scope.md) - Story 1 scope (core projection)
- [thoughts/personal/tickets/epic-3/projection-modeling/story-2-scope.md](thoughts/personal/tickets/epic-3/projection-modeling/story-2-scope.md) - Story 2 scope (visualization)

## Related Research

- [2025-12-17-epic-3-projection-engine-implementation-readiness.md](2025-12-17-epic-3-projection-engine-implementation-readiness.md) - Projection engine data sources

## Implementation Recommendations

### 1. Install Recharts
```bash
npm install recharts
```

### 2. Create Chart Component
```typescript
// src/components/projections/ProjectionChart.tsx
import { LineChart, Line, XAxis, YAxis, Tooltip, ReferenceLine, Area } from 'recharts';

interface ProjectionChartProps {
  records: ProjectionRecord[];
  retirementAge: number;
  xAxisType: 'age' | 'year';
}
```

### 3. Chart Configuration
- **X-axis**: Age (default) or Year (configurable)
- **Y-axis**: Balance with currency formatting
- **Colors**: CSS variable integration via `hsl(var(--primary))`
- **Responsive**: Container queries or percentage-based sizing

### 4. Tooltip Design
- Show: Age/Year, Balance (formatted as currency)
- Match Card styling: `bg-card border rounded-lg shadow`
- Dark mode compatible

### 5. Phase Visualization
```typescript
// Vertical reference line at retirement
<ReferenceLine x={retirementAge} stroke="hsl(var(--muted-foreground))" strokeDasharray="3 3" />

// Or gradient fill change
<defs>
  <linearGradient id="phaseGradient">
    <stop offset={`${accumulationPercent}%`} stopColor="hsl(var(--primary))" />
    <stop offset={`${accumulationPercent}%`} stopColor="hsl(var(--success))" />
  </linearGradient>
</defs>
```

## Decisions Made

1. **Charting library**: Recharts ✓
2. **X-axis**: Age only (Year toggle deferred)
3. **Location**: `/plans` page (not dashboard)
4. **Dashboard**: Shows current financial state only

## Plans Page Layout

### 1. Summary Cards (Top)
- Retirement Balance
- Ending Balance
- Status Indicator ("Sustainable ✓" or "Depletes at age X ⚠")

### 2. Projection Chart (Center, Hero)
- Largest element, full width
- Phase distinction (accumulation → retirement)

### 3. Assumptions Panel (Below or Sidebar)
- Editable for "what-if" analysis
- Fields: Expected Return, Inflation Rate, Retirement Age, Monthly Expenses
- Chart updates live on change

### 4. Year-by-Year Table (Bottom, Collapsible)
- Default collapsed
- Shows: age | year | balance | inflows | outflows

### Implementation Order
1. Chart only (Story 2 MVP)
2. Summary cards
3. Editable assumptions
4. Data table (low priority)

## Open Questions

1. **Inflation adjustment toggle**: Scope mentions "based on system settings" - where is this setting?
2. **Real-time updates**: Should chart animate during "what-if" parameter changes?
3. **Mobile tooltip UX**: Tap-to-show vs hover-over behavior?