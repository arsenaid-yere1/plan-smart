---
date: 2025-12-25T12:00:00-08:00
researcher: Claude
git_commit: b13ef7ba5472c090c297bf3cf115436775d11f7d
branch: main
repository: plan-smart
topic: "Display Financial Results After Onboarding Implementation Readiness"
tags: [research, codebase, onboarding, projections, visualization, epic-2, story-2]
status: complete
last_updated: 2025-12-25
last_updated_by: Claude
---

# Research: Display Financial Results After Onboarding (Story 2.0)

**Date**: 2025-12-25T12:00:00-08:00
**Researcher**: Claude
**Git Commit**: b13ef7ba5472c090c297bf3cf115436775d11f7d
**Branch**: main
**Repository**: plan-smart

## Research Question

What existing infrastructure, components, and patterns are available in the codebase to implement Story 2.0 "Display Financial Results After Onboarding (Core Aha Moment)"? What gaps need to be filled?

## Summary

The codebase has **strong foundational support** for implementing the financial results display after onboarding. Key findings:

1. **Projection Engine**: Fully implemented at `src/lib/projections/engine.ts` - calculates year-by-year retirement projections
2. **Visualization**: Recharts-based `ProjectionChart` component exists with area fills for accumulation/retirement phases
3. **Current `/plans` Page**: Already displays projections but needs enhancement for the "Core Aha Moment" experience
4. **Routing**: Post-onboarding redirect to `/plans` is already implemented
5. **UI Components**: Card components and number formatting utilities exist
6. **Gap**: No three-tier retirement status ("On Track", "Needs Adjustment", "At Risk") - only binary sustainable/depletes

## Detailed Findings

### 1. Projection Engine (Fully Implemented)

The projection engine is production-ready and calculates comprehensive retirement scenarios.

#### Core Files
- [engine.ts](src/lib/projections/engine.ts) - Main calculation engine (223 lines)
- [types.ts](src/lib/projections/types.ts) - TypeScript interfaces (142 lines)
- [assumptions.ts](src/lib/projections/assumptions.ts) - Default values and estimation functions
- [route.ts](src/app/api/projections/calculate/route.ts) - REST API endpoint

#### Key Function: `runProjection()`
Location: [engine.ts:98-223](src/lib/projections/engine.ts#L98-L223)

**Inputs** (`ProjectionInput`):
- `currentAge`, `retirementAge`, `maxAge`
- `balancesByType` (taxDeferred, taxFree, taxable)
- `annualContribution`, `contributionAllocation`
- `expectedReturn`, `inflationRate`
- `annualExpenses`, `annualHealthcareCosts`
- `socialSecurityAge`, `socialSecurityMonthly`
- `annualDebtPayments`

**Outputs** (`ProjectionResult`):
```typescript
{
  records: ProjectionRecord[];  // Year-by-year data
  summary: {
    startingBalance: number;
    endingBalance: number;
    totalContributions: number;
    totalWithdrawals: number;
    yearsUntilDepletion: number | null;  // null = sustainable
    projectedRetirementBalance: number;
  }
}
```

#### Two-Phase Model
1. **Accumulation Phase** ([engine.ts:121-144](src/lib/projections/engine.ts#L121-L144))
   - Applies contribution growth and debt payments
   - Allocates contributions by tax category
   - Applies investment returns (end-of-year model)

2. **Drawdown Phase** ([engine.ts:145-195](src/lib/projections/engine.ts#L145-L195))
   - Inflation-adjusted expenses (general + healthcare)
   - Social Security income at specified age
   - Tax-aware withdrawal order: taxable → taxDeferred → taxFree

### 2. Current `/plans` Page

The existing plans page already displays projections but needs enhancement for the "Aha Moment".

#### Location
[src/app/plans/page.tsx](src/app/plans/page.tsx) (277 lines)

#### Current Features
- Fetches `financial_snapshot` data ([page.tsx:86-93](src/app/plans/page.tsx#L86-L93))
- Calculates projection using `runProjection()` ([page.tsx:192](src/app/plans/page.tsx#L192))
- Displays `ProjectionChart` ([page.tsx:215-220](src/app/plans/page.tsx#L215-L220))
- Displays `ProjectionTable` ([page.tsx:221-224](src/app/plans/page.tsx#L221-L224))
- Shows 3 summary cards ([page.tsx:229-271](src/app/plans/page.tsx#L229-L271)):
  - Balance at Retirement
  - Balance at Age 90
  - Status (Sustainable/Depletes)

#### Current Status Display (Binary Only)
```typescript
// page.tsx:263-270
{projection.summary.yearsUntilDepletion === null ? (
  <p className="text-2xl font-bold text-success">Sustainable</p>
) : (
  <p className="text-2xl font-bold text-destructive">
    Depletes at {currentAge + projection.summary.yearsUntilDepletion}
  </p>
)}
```

**Gap**: No intermediate "Needs Adjustment" status exists.

### 3. Chart/Visualization Components

#### ProjectionChart Component
Location: [src/components/projections/ProjectionChart.tsx](src/components/projections/ProjectionChart.tsx) (389 lines)

**Library**: Recharts 3.6.0 ([package.json:52](package.json#L52))

**Features**:
- ComposedChart with Area + Line ([line 218](src/components/projections/ProjectionChart.tsx#L218))
- Accumulation phase: Primary color fill at 10% opacity ([lines 310-317](src/components/projections/ProjectionChart.tsx#L310-L317))
- Retirement phase: Success color fill at 10% opacity ([lines 319-326](src/components/projections/ProjectionChart.tsx#L319-L326))
- Negative balance handling: Red line for depletion ([lines 343-356](src/components/projections/ProjectionChart.tsx#L343-L356))
- Retirement reference line: Vertical dashed marker ([lines 298-308](src/components/projections/ProjectionChart.tsx#L298-L308))
- Interactive toggles: Age/Year view, Future/Today's dollars ([lines 141-213](src/components/projections/ProjectionChart.tsx#L141-L213))
- Custom tooltip with detailed info ([lines 240-288](src/components/projections/ProjectionChart.tsx#L240-L288))

**Props Interface** ([lines 19-24](src/components/projections/ProjectionChart.tsx#L19-L24)):
```typescript
interface ProjectionChartProps {
  records: ProjectionRecord[];
  retirementAge: number;
  currentAge: number;
  inflationRate?: number;
}
```

### 4. UI Card/Metric Components

#### Card Component System
Location: [src/components/ui/card.tsx](src/components/ui/card.tsx)

**Composable Parts**:
- `Card` - Base container with rounded borders and shadow
- `CardHeader` - Top section with padding
- `CardDescription` - Label text (muted foreground)
- `CardContent` - Main content area

**Current Usage Pattern** ([plans/page.tsx:229-243](src/app/plans/page.tsx#L229-L243)):
```tsx
<Card>
  <CardHeader className="pb-2">
    <CardDescription>At Retirement (Age {retirementAge})</CardDescription>
  </CardHeader>
  <CardContent>
    <p className="text-2xl font-bold text-foreground">
      {formatCurrency(value)}
    </p>
  </CardContent>
</Card>
```

#### Number Formatting

**Abbreviated Format** ([ProjectionChart.tsx:26-34](src/components/projections/ProjectionChart.tsx#L26-L34)):
```typescript
function formatCurrency(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return `$${value.toFixed(0)}`;
}
```
- ≥ $1M → `$1.8M` (1 decimal)
- ≥ $1K → `$120K` (0 decimals)
- < $1K → `$500`

**Full Format** (inline Intl.NumberFormat):
```typescript
new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
}).format(value)  // → $1,234,567
```

#### Status Badge Pattern
Location: [ProjectionTable.tsx:136-143](src/components/projections/ProjectionTable.tsx#L136-L143)

```tsx
<span className={cn(
  'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
  isRetirement
    ? 'bg-success/10 text-success'
    : 'bg-primary/10 text-primary'
)}>
  {isRetirement ? 'Retirement' : 'Accumulation'}
</span>
```

### 5. Onboarding Flow & Post-Completion Routing

#### Completion Flow
1. User completes Step 5 Review → clicks "Generate My Plan"
2. POST to `/api/onboarding/complete` ([onboarding/page.tsx:100-103](src/app/onboarding/page.tsx#L100-L103))
3. API creates `financial_snapshot`, `plans` record, sets `onboardingCompleted: true`
4. Client redirects: `router.push('/plans')` ([onboarding/page.tsx:111](src/app/onboarding/page.tsx#L111))

#### Existing Redirect
The redirect to `/plans` is already implemented - no routing changes needed.

### 6. Error Handling Patterns

#### Alert Component
Location: [src/components/ui/alert.tsx](src/components/ui/alert.tsx)

**Destructive Variant** ([alert.tsx:12-13](src/components/ui/alert.tsx#L12-L13)):
```tsx
<Alert variant="destructive">
  <AlertDescription>{error}</AlertDescription>
</Alert>
```

#### Loading States
Pattern used throughout forms:
```tsx
const [isLoading, setIsLoading] = useState(false);

<Button disabled={isLoading}>
  {isLoading ? 'Loading...' : 'Submit'}
</Button>
```

#### Missing Patterns for Story 2
- No projection-specific error handling exists
- No retry mechanism for failed projections
- Need to add friendly error state for calculation failures

### 7. What Needs to Be Built (Gaps)

#### A. Three-Tier Retirement Status
**Requirement**: "On Track", "Needs Adjustment", "At Risk"
**Current State**: Binary only (Sustainable/Depletes)

**Implementation**:
```typescript
function getRetirementStatus(summary: ProjectionSummary): {
  status: 'on-track' | 'needs-adjustment' | 'at-risk';
  message: string;
} {
  // Sustainable through max age
  if (summary.yearsUntilDepletion === null) {
    return { status: 'on-track', message: 'On Track' };
  }

  // Depletes but not urgent (>20 years runway)
  if (summary.yearsUntilDepletion > 20) {
    return { status: 'needs-adjustment', message: 'Needs Adjustment' };
  }

  // Urgent action needed (≤20 years runway)
  return { status: 'at-risk', message: 'At Risk of Shortfall' };
}
```

#### B. Snapshot Cards Enhancement
**Requirement**: Display above the fold:
- Estimated assets at retirement ✅ (exists)
- Estimated monthly retirement spending supported ✅ (collected during onboarding)
- Age/year money runs out ✅ (exists as depletes age)
- Retirement age target ✅ (exists)

**Monthly Spending Data**: Already collected in `financial_snapshot.incomeExpenses`:
```typescript
type IncomeExpensesJson = {
  monthlyEssential?: number;    // Essential monthly expenses
  monthlyDiscretionary?: number; // Discretionary monthly expenses
};
```

Display as: `monthlyEssential + monthlyDiscretionary` = total monthly spending

#### C. Shortfall Year Visual Marker
**Requirement**: Visually mark shortfall year on chart
**Current**: Negative balances shown in red, but no explicit marker

**Enhancement**: Add ReferenceLine at depletion year:
```tsx
{summary.yearsUntilDepletion && (
  <ReferenceLine
    x={currentAge + summary.yearsUntilDepletion}
    stroke="hsl(var(--destructive))"
    strokeDasharray="5 5"
    label={{ value: 'Shortfall', fill: 'hsl(var(--destructive))' }}
  />
)}
```

#### D. Error State UI
**Requirement**: Friendly message if projection fails with retry option
**Current**: No projection-specific error handling

**Suggested Component**:
```tsx
function ProjectionError() {
  const router = useRouter();

  return (
    <Card className="text-center p-8">
      <AlertCircle className="h-12 w-12 mx-auto text-destructive mb-4" />
      <h2 className="text-xl font-semibold mb-2">
        We couldn't generate your plan yet
      </h2>
      <p className="text-muted-foreground mb-4">
        Something went wrong while calculating your projection.
      </p>
      <Button onClick={() => router.push('/onboarding')}>
        Edit Inputs
      </Button>
    </Card>
  );
}
```

#### E. Page Load Performance
**Requirement**: Page loads fully in <2 seconds
**Current**: Projection engine executes in <100ms (tested)
**Consideration**: Server-side rendering already used; may need loading skeleton

## Code References

### Core Projection Logic
- `src/lib/projections/engine.ts:98` - `runProjection()` entry point
- `src/lib/projections/engine.ts:121-144` - Accumulation phase
- `src/lib/projections/engine.ts:145-195` - Drawdown phase
- `src/lib/projections/types.ts:119-126` - `ProjectionSummary` type

### Visualization
- `src/components/projections/ProjectionChart.tsx:218` - ComposedChart setup
- `src/components/projections/ProjectionChart.tsx:298-308` - Retirement reference line
- `src/components/projections/ProjectionChart.tsx:26-34` - Currency abbreviation

### Current Plans Page
- `src/app/plans/page.tsx:192` - Projection calculation call
- `src/app/plans/page.tsx:229-271` - Summary cards display
- `src/app/plans/page.tsx:263-270` - Status display (binary)

### UI Components
- `src/components/ui/card.tsx` - Card component system
- `src/components/ui/alert.tsx` - Alert component
- `src/components/ui/button.tsx` - Button with loading states

### Onboarding Flow
- `src/app/onboarding/page.tsx:111` - Post-completion redirect to `/plans`
- `src/app/api/onboarding/complete/route.ts:79-86` - Sets `onboardingCompleted: true`

## Architecture Insights

### Data Flow
1. Onboarding → `financial_snapshot` table (JSONB fields for accounts, debts, expenses)
2. `/plans` page fetches snapshot → transforms to `ProjectionInput`
3. `runProjection()` calculates year-by-year records + summary
4. `ProjectionChart` + Cards render the results

### Design Patterns
- **Server Components**: Plans page uses async server component for data fetching
- **Pure Functions**: Projection engine is stateless, no side effects
- **Tax-Aware**: Withdrawal strategy considers account types for tax efficiency
- **Theme Support**: All colors use CSS variables (`hsl(var(--primary))`)

### Performance Characteristics
- Projection calculation: <100ms (verified in tests)
- 61 data points generated (age 30→90)
- No caching - calculated fresh on each page load
- Server-side rendering eliminates client-side fetch waterfall

## Historical Context (from thoughts/)

### Relevant Documents
- `thoughts/personal/tickets/epic-2/onboarding/story-2-scope.md` - Feature specification (this story)
- `thoughts/shared/plans/2025-12-10-epic-2-onboarding-wizard-implementation.md` - Onboarding implementation with redirect flow
- `thoughts/shared/plans/2025-12-18-epic-3-story-1-projection-engine.md` - Projection engine implementation plan
- `thoughts/shared/plans/2025-12-22-epic-3-story-2-visualization.md` - Chart visualization implementation plan
- `thoughts/shared/research/2025-12-21-epic-3-story-2-visualization-research.md` - Recharts library selection

### Key Decisions
- **Recharts chosen** over Chart.js/D3 for React declarative API and shadcn/ui compatibility
- **Server-side projection** eliminates loading states for initial render
- **Binary status** was MVP; three-tier status deferred to this story

## Related Research
- [2025-12-17-epic-3-projection-engine-implementation-readiness.md](thoughts/shared/research/2025-12-17-epic-3-projection-engine-implementation-readiness.md) - Data model analysis
- [2025-12-21-epic-3-story-2-visualization-research.md](thoughts/shared/research/2025-12-21-epic-3-story-2-visualization-research.md) - Recharts integration

## Additional Gaps & Best Practices

### 8. Accessibility Gaps

**What Exists:**
- Radix UI primitives with built-in keyboard navigation
- `aria-pressed` on chart toggle buttons
- `aria-expanded` on collapsible table
- `role="alert"` on error states
- Skip-to-content link
- Focus-visible states on all interactive elements

**What's Missing for Financial Results Page:**
- No `aria-label` on chart container for screen readers
- No screen reader text summarizing projection data
- No keyboard navigation for chart data points (tooltip is hover-only)
- No table caption or `scope` attributes on headers
- Status badge uses color alone - needs icon or pattern backup

**Recommendations:**
```tsx
// Add screen reader summary
<div className="sr-only">
  Your retirement projection shows {status}.
  Estimated assets at retirement: {formatCurrency(retirementBalance)}.
  {yearsUntilDepletion ? `Funds may run out at age ${depletionAge}.` : 'Funds projected to last through age 90.'}
</div>

// Add icon to status badge (not just color)
{status === 'on-track' && <CheckCircle className="h-5 w-5 mr-2" />}
{status === 'needs-adjustment' && <AlertTriangle className="h-5 w-5 mr-2" />}
{status === 'at-risk' && <XCircle className="h-5 w-5 mr-2" />}
```

### 9. Animation/Celebration Gaps ("Aha Moment")

**What Exists:**
- CSS transitions on buttons/inputs (150ms)
- Dialog fade/zoom animations (200ms)
- Progress bar width transitions (300ms)
- Recharts default line drawing animation

**What's Missing:**
- No celebratory animations for "On Track" status
- No number count-up for large financial figures
- No staggered reveal for snapshot cards
- No confetti or success particles
- No Framer Motion or animation library installed

**Recommendations for "Core Aha Moment":**
```bash
npm install framer-motion
```

```tsx
// Staggered card reveal
<motion.div
  initial={{ opacity: 0, y: 20 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ delay: index * 0.1 }}
>
  <Card>...</Card>
</motion.div>

// Number count-up for balances
import { useSpring, animated } from 'framer-motion'
const { value } = useSpring({ value: retirementBalance, from: 0 })
<animated.span>{value.to(v => formatCurrency(v))}</animated.span>

// Success celebration for "On Track"
{status === 'on-track' && <Confetti />}
```

### 10. Analytics/Tracking Gaps

**What Exists:**
- `createTimer()` utility for performance measurement
- PII-filtered structured logging (`logger.info/error/warn`)
- Calculation time returned in API response metadata

**What's Missing:**
- No page view tracking
- No user action event tracking
- No analytics provider (GA, Mixpanel, PostHog, etc.)
- No Sentry error tracking (mentioned in DEPLOYMENT.md but not implemented)
- No funnel analytics for onboarding → results flow

**Recommendations:**
- Track "projection_viewed" event on page load
- Track "status_displayed" with status value
- Track time-to-first-projection after onboarding
- Consider adding PostHog or similar for product analytics

### 11. Testing Requirements

**Existing Test Patterns:**
- Vitest with happy-dom for unit tests
- Playwright for E2E tests
- Mock patterns for Supabase, email, database
- `__tests__` directories co-located with source

**Required Tests for Story 2:**
1. **Unit Tests:**
   - `getRetirementStatus()` function with all threshold cases
   - Inflation adjustment calculation
   - Number formatting utilities

2. **Integration Tests:**
   - `/plans` page renders with projection data
   - Error state displays when projection fails
   - Redirect to `/onboarding` when "Edit Inputs" clicked

3. **E2E Tests:**
   - Complete onboarding → view results flow
   - Verify all 4 snapshot cards display
   - Verify chart renders with correct phases

**Test File Locations:**
```
src/lib/projections/__tests__/status.test.ts  (new)
src/app/plans/__tests__/page.test.tsx         (new)
e2e/onboarding-to-results.spec.ts             (new)
```

### 12. SEO/Metadata Gaps

**What Exists:**
- Root layout metadata: `title: 'Plan Smart - Retirement Planning'`
- No page-specific metadata

**What's Missing:**
- No `/plans` page-specific title
- No Open Graph tags for social sharing
- No structured data (JSON-LD)

**Recommendations:**
```tsx
// src/app/plans/page.tsx
export const metadata: Metadata = {
  title: 'Your Retirement Projection - Plan Smart',
  description: 'View your personalized retirement projection with asset growth over time',
};
```

## Open Questions

1. **Status Thresholds**: ✅ DECIDED
   - `yearsUntilDepletion === null` → **"On Track"** (sustainable through max age)
   - `yearsUntilDepletion > 20` → **"Needs Adjustment"** (depletes but not urgent)
   - `yearsUntilDepletion <= 20` → **"At Risk of Shortfall"** (urgent action needed)

2. **Monthly Spending Display**: ✅ DECIDED
   - Inflation-adjusted to the specific year being shown
   - Formula: `(monthlyEssential + monthlyDiscretionary) × (1 + inflationRate)^yearsUntilRetirement`
   - Example: $5,000/month today → $8,144/month at retirement (30 years, 2.5% inflation)

3. **Error Recovery**: ✅ DECIDED
   - Do NOT show partial results
   - "Edit Inputs" navigates back to onboarding (serves as input for analysis)
   - UI: Error message + "Edit Inputs" button → redirects to `/onboarding`

## Implementation Recommendations

### Layout: "Above the Fold" Design

**Current Layout Issues:**
- Chart is in a Card wrapper adding vertical padding
- Summary cards are BELOW the chart (require scrolling)
- ProjectionTable is inline with chart (takes space)

**Recommended Layout (Desktop - 1024px+):**
```
┌─────────────────────────────────────────────────────────────┐
│  [Status Badge: On Track / Needs Adjustment / At Risk]      │
│  Large, prominent, color-coded                              │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐        │
│  │ Assets   │ │ Monthly  │ │ Retire   │ │ Shortfall│        │
│  │ at Ret.  │ │ Spending │ │ Age      │ │ Year     │        │
│  │ $1.2M    │ │ $6,500   │ │ 65       │ │ N/A      │        │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘        │
├─────────────────────────────────────────────────────────────┤
│  [Projection Chart - Reduced Height ~250px]                 │
│  Area chart with retirement line + shortfall marker         │
└─────────────────────────────────────────────────────────────┘
   [Collapsible: View Detailed Table ▼] (below fold is OK)
```

**Key Changes:**
1. **Status badge FIRST** - Most important info at top
2. **4 snapshot cards in horizontal row** - `grid-cols-4` on desktop
3. **Chart height reduced** - From 384px to ~250px on desktop
4. **ProjectionTable collapsed by default** - Already has collapsible, just start closed
5. **Remove Card wrapper from chart** - Reduce padding, chart renders directly

**Responsive (Mobile - <768px):**
```
┌─────────────────────┐
│ [Status Badge]      │
├─────────────────────┤
│ ┌─────┐ ┌─────┐     │
│ │Card1│ │Card2│     │  ← 2-column grid
│ └─────┘ └─────┘     │
│ ┌─────┐ ┌─────┐     │
│ │Card3│ │Card4│     │
│ └─────┘ └─────┘     │
├─────────────────────┤
│ [Chart ~200px]      │
└─────────────────────┘
```

**CSS Classes:**
```tsx
// Status badge
<div className="mb-6">
  <span className={cn(
    "inline-flex items-center rounded-full px-4 py-2 text-lg font-semibold",
    status === 'on-track' && "bg-success/10 text-success",
    status === 'needs-adjustment' && "bg-warning/10 text-warning",
    status === 'at-risk' && "bg-destructive/10 text-destructive"
  )}>
    {statusMessage}
  </span>
</div>

// Snapshot cards grid
<div className="grid gap-4 grid-cols-2 lg:grid-cols-4 mb-6">

// Chart container (no Card wrapper)
<div className="h-[200px] sm:h-[220px] lg:h-[250px]">
```

### Phase 1: Core Functionality
1. Add `getRetirementStatus()` function with three-tier logic
2. Move status badge to top of page with icon (not just color)
3. Add "Monthly Spending" card with inflation-adjusted value
4. Restructure to 4-column card grid above chart
5. Reduce chart height and remove Card wrapper
6. Add shortfall year reference line to chart
7. Start ProjectionTable collapsed (already collapsible)
8. Add page-specific metadata for SEO

### Phase 2: Accessibility & Error Handling
1. Add screen reader summary of projection results
2. Add icons to status badge (CheckCircle/AlertTriangle/XCircle)
3. Create `ProjectionError` component with "Edit Inputs" → `/onboarding`
4. Wrap projection calculation in try-catch
5. Add table caption and scope attributes

### Phase 3: Animation & Polish (Optional - "Aha Moment")
1. Install framer-motion for animations
2. Add staggered reveal for snapshot cards
3. Add number count-up animation for large values
4. Consider confetti for "On Track" status (user preference)
5. Verify <2s load time

### Phase 4: Testing
1. Unit tests for `getRetirementStatus()` function
2. Unit tests for inflation adjustment calculation
3. Integration test for `/plans` page rendering
4. E2E test for onboarding → results flow

### No Route Changes Needed
The existing redirect from onboarding to `/plans` is already correct. Story 2.0 is primarily about enhancing the `/plans` page content, not changing the flow.
