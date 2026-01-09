---
date: 2026-01-08T10:00:00-08:00
researcher: Claude
git_commit: d082b2a81044f9cdb7fd3056bcceb781cdaef0aa
branch: main
repository: plan-smart
topic: "Profile Page UI Improvements Research"
tags: [research, codebase, profile, ui-components, improvements, accessibility, ux]
status: complete
last_updated: 2026-01-08
last_updated_by: Claude
---

# Research: Profile Page UI Improvements

**Date**: 2026-01-08T10:00:00-08:00
**Researcher**: Claude
**Git Commit**: d082b2a81044f9cdb7fd3056bcceb781cdaef0aa
**Branch**: main
**Repository**: plan-smart

## Research Question

What improvements can be made to the profile page, including UI component enhancements?

## Summary

The profile page at `/profile` is a well-structured feature that allows users to view and edit their financial information. After comprehensive analysis, here are the key improvement opportunities:

### High-Priority Improvements
1. **Loading states** - Add skeleton loaders for data fetching
2. **Accessibility enhancements** - Improve keyboard navigation and screen reader support
3. **Visual hierarchy** - Better data visualization and section organization
4. **Responsive design** - Optimize mobile experience
5. **Data visualization** - Add charts/graphs for financial overview

### Medium-Priority Improvements
1. **Animations/transitions** - Smooth collapsible animations
2. **Inline editing** - Quick edit for simple fields without modal
3. **Data export** - Download profile data as PDF/CSV
4. **Confirmation dialogs** - Warn before discarding unsaved changes
5. **Progress indicators** - Show savings progress toward goals

### Low-Priority Improvements
1. **Dark mode optimization** - Theme-specific styling
2. **Keyboard shortcuts** - Quick actions for power users
3. **Print styling** - Optimized print layout

## Detailed Findings

### Current Implementation Analysis

#### Profile Page Structure
**Files**:
- [src/app/profile/page.tsx](src/app/profile/page.tsx) - Server component (51 lines)
- [src/app/profile/profile-client.tsx](src/app/profile/profile-client.tsx) - Client component (598 lines)
- [src/app/api/profile/route.ts](src/app/api/profile/route.ts) - API endpoint (99 lines)

#### Current Features
| Feature | Implementation | Quality |
|---------|----------------|---------|
| View financial data | Collapsible sections | Good |
| Edit via modals | Dialog + step forms | Good |
| Net worth summary | NetWorthSummary component | Good |
| Currency formatting | Intl.NumberFormat | Good |
| Toast notifications | useToast hook | Good |
| Form validation | Zod + React Hook Form | Excellent |

#### Current UI Components Used
- `Collapsible` - Expand/collapse sections with edit button
- `Dialog` - Modal for editing sections
- `NetWorthSummary` - Financial overview display
- Step components (Step1-Step4b) - Reused from onboarding

---

## Improvement Recommendations

### 1. Loading States & Skeletons

**Current Gap**: No loading state during initial data fetch or updates.

**Recommended Implementation**:

```tsx
// src/components/ui/skeleton.tsx (create new)
export function Skeleton({ className }: { className?: string }) {
  return (
    <div className={cn('animate-pulse rounded-md bg-muted', className)} />
  );
}

// Profile page loading state
function ProfileSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-32 w-full" /> {/* NetWorthSummary */}
      <Skeleton className="h-24 w-full" /> {/* Section 1 */}
      <Skeleton className="h-24 w-full" /> {/* Section 2 */}
      {/* ... more sections */}
    </div>
  );
}
```

**Files to modify**:
- Create: `src/components/ui/skeleton.tsx`
- Modify: [src/app/profile/profile-client.tsx](src/app/profile/profile-client.tsx)

**Effort**: Low | **Impact**: High

---

### 2. Accessibility Enhancements

**Current Gaps**:
- Collapsible lacks ARIA attributes for expandable regions
- Edit button doesn't indicate which section it controls
- No focus management after modal close

**Recommended Changes**:

```tsx
// Enhanced Collapsible with accessibility
<Collapsible
  title="Basics"
  defaultOpen
  onEdit={() => setEditSection('basics')}
  // Add these props:
  id="basics-section"
  aria-controls="basics-content"
  aria-expanded={isOpen}
>
  <div id="basics-content" role="region" aria-labelledby="basics-header">
    {/* content */}
  </div>
</Collapsible>

// Edit button enhancement
<button
  type="button"
  onClick={onEdit}
  aria-label={`Edit ${title} section`}
  className="text-sm text-primary hover:underline"
>
  Edit
</button>
```

**Files to modify**:
- [src/components/ui/collapsible.tsx](src/components/ui/collapsible.tsx)

**Effort**: Low | **Impact**: High (accessibility compliance)

---

### 3. Visual Data Presentation

**Current State**: Text-only display with basic formatting.

**Recommended Enhancements**:

#### 3a. Progress Bars for Goals
```tsx
// Show progress toward retirement savings goal
function SavingsProgress({ current, target }: { current: number; target: number }) {
  const percentage = Math.min((current / target) * 100, 100);
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-sm">
        <span>Savings Progress</span>
        <span>{percentage.toFixed(0)}%</span>
      </div>
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <div
          className="h-full bg-primary transition-all duration-300"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
```

#### 3b. Asset Allocation Visualization
```tsx
// Mini pie chart for investment mix
function AssetAllocation({ accounts }: { accounts: InvestmentAccountJson[] }) {
  const accountsByType = groupBy(accounts, 'type');
  // Use Recharts PieChart (already available)
  return (
    <div className="flex items-center gap-4">
      <PieChart width={80} height={80}>
        {/* ... */}
      </PieChart>
      <div className="space-y-1">
        {Object.entries(accountsByType).map(([type, accs]) => (
          <div key={type} className="flex items-center gap-2 text-sm">
            <div className={`w-3 h-3 rounded-full ${colorForType(type)}`} />
            <span>{type}: {formatCurrency(sumBalances(accs))}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
```

**Effort**: Medium | **Impact**: High (user engagement)

---

### 4. Collapsible Animation

**Current State**: Instant show/hide with no animation.

**Recommended Enhancement**:

```tsx
// Enhanced Collapsible with animation
export function Collapsible({ ... }) {
  const contentRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number | undefined>(defaultOpen ? undefined : 0);

  useEffect(() => {
    if (isOpen && contentRef.current) {
      setHeight(contentRef.current.scrollHeight);
    } else {
      setHeight(0);
    }
  }, [isOpen]);

  return (
    <div className="border rounded-lg overflow-hidden">
      {/* Header */}
      <div
        className="overflow-hidden transition-[max-height] duration-200 ease-in-out"
        style={{ maxHeight: height === 0 ? 0 : height ?? 'none' }}
        ref={contentRef}
      >
        <div className="px-4 pb-4">{children}</div>
      </div>
    </div>
  );
}
```

**Alternative**: Use Radix UI Collapsible primitive with built-in animations.

**Files to modify**:
- [src/components/ui/collapsible.tsx](src/components/ui/collapsible.tsx)

**Effort**: Low | **Impact**: Medium (polish)

---

### 5. Inline Editing for Simple Fields

**Current State**: All edits require opening a modal dialog.

**Recommendation**: Add inline edit capability for single-value fields.

```tsx
// InlineEdit component for simple values
function InlineEdit({
  value,
  onSave,
  format = (v) => v
}: InlineEditProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value);

  if (!isEditing) {
    return (
      <span
        className="cursor-pointer hover:bg-muted px-1 -mx-1 rounded"
        onClick={() => setIsEditing(true)}
      >
        {format(value)}
        <Pencil className="inline-block ml-1 h-3 w-3 text-muted-foreground" />
      </span>
    );
  }

  return (
    <form onSubmit={(e) => { e.preventDefault(); onSave(editValue); setIsEditing(false); }}>
      <Input value={editValue} onChange={(e) => setEditValue(e.target.value)} autoFocus />
      <div className="flex gap-2 mt-2">
        <Button size="sm" type="submit">Save</Button>
        <Button size="sm" variant="outline" onClick={() => setIsEditing(false)}>Cancel</Button>
      </div>
    </form>
  );
}
```

**Use cases**:
- Birth year
- Target retirement age
- Risk tolerance (could be dropdown)

**Effort**: Medium | **Impact**: Medium (convenience)

---

### 6. Responsive Design Improvements

**Current State**: Basic responsive with 2-column grids.

**Recommended Enhancements**:

```tsx
// Improved responsive layout
<div className="space-y-4">
  {/* Net worth - full width on mobile, compact on desktop */}
  <div className="lg:flex lg:gap-6">
    <NetWorthSummary
      breakdown={netWorthBreakdown}
      variant="detailed"
      className="lg:w-1/3"
    />
    <div className="lg:w-2/3 space-y-4 mt-4 lg:mt-0">
      {/* Quick stats */}
    </div>
  </div>

  {/* Sections - stack on mobile */}
  <div className="grid gap-4 md:grid-cols-2">
    <Collapsible title="Basics" />
    <Collapsible title="Retirement Goals" />
  </div>
</div>
```

**Mobile-specific improvements**:
- Larger touch targets for Edit buttons
- Bottom sheet dialogs instead of centered modals
- Swipe gestures for section navigation

**Effort**: Medium | **Impact**: High (mobile users)

---

### 7. Unsaved Changes Warning

**Current Gap**: No warning when closing modal with unsaved changes.

**Recommended Implementation**:

```tsx
// In profile-client.tsx
const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

const handleEditClose = () => {
  if (hasUnsavedChanges) {
    // Show confirmation dialog
    if (!confirm('You have unsaved changes. Discard them?')) {
      return;
    }
  }
  setEditSection(null);
  setHasUnsavedChanges(false);
};

// In step form wrapper
<Step1PersonalInfo
  onNext={(data) => handleEditSave(data)}
  initialData={formData}
  submitLabel="Save"
  onChange={() => setHasUnsavedChanges(true)} // Track changes
/>
```

**Better UX**: Use a custom ConfirmDialog component instead of browser confirm.

**Effort**: Low | **Impact**: High (prevents data loss)

---

### 8. Data Export Functionality

**Recommended Feature**: Allow users to export their profile data.

```tsx
// Export button in profile header
<div className="flex justify-between items-center mb-6">
  <h1 className="text-2xl font-bold">Financial Profile</h1>
  <DropdownMenu>
    <DropdownMenuTrigger asChild>
      <Button variant="outline" size="sm">
        <Download className="h-4 w-4 mr-2" />
        Export
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent>
      <DropdownMenuItem onClick={() => exportToPDF()}>
        Download as PDF
      </DropdownMenuItem>
      <DropdownMenuItem onClick={() => exportToJSON()}>
        Download as JSON
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
</div>
```

**Implementation**: Reuse jsPDF patterns from existing export functionality in projections.

**Files to reference**:
- [src/hooks/useProjectionExport.ts](src/hooks/useProjectionExport.ts)

**Effort**: Medium | **Impact**: Medium

---

### 9. Financial Health Score

**New Feature**: Display a computed financial health metric.

```tsx
// Financial Health Score component
function FinancialHealthScore({ profileData }: { profileData: ProfileData }) {
  const score = calculateHealthScore(profileData);
  const level = getHealthLevel(score); // 'excellent' | 'good' | 'fair' | 'needs-work'

  return (
    <div className={cn(
      'rounded-lg p-4 border',
      level === 'excellent' && 'bg-success/10 border-success',
      level === 'good' && 'bg-primary/10 border-primary',
      level === 'fair' && 'bg-warning/10 border-warning',
      level === 'needs-work' && 'bg-destructive/10 border-destructive',
    )}>
      <div className="flex items-center gap-3">
        <div className="text-3xl font-bold">{score}</div>
        <div>
          <div className="font-medium">{levelLabel(level)}</div>
          <div className="text-sm text-muted-foreground">
            {levelDescription(level)}
          </div>
        </div>
      </div>
    </div>
  );
}

function calculateHealthScore(data: ProfileData): number {
  let score = 50; // Base score

  // Savings rate bonus (up to +20)
  if (data.savingsRate >= 20) score += 20;
  else if (data.savingsRate >= 15) score += 15;
  else if (data.savingsRate >= 10) score += 10;

  // Investment diversification bonus (up to +15)
  const accountTypes = new Set(data.investmentAccounts.map(a => a.type));
  score += Math.min(accountTypes.size * 5, 15);

  // Debt-to-asset ratio (up to +15)
  const debtRatio = totalDebts(data) / totalAssets(data);
  if (debtRatio < 0.2) score += 15;
  else if (debtRatio < 0.4) score += 10;
  else if (debtRatio < 0.6) score += 5;

  return Math.min(score, 100);
}
```

**Effort**: Medium | **Impact**: High (engagement & motivation)

---

### 10. Section Reordering

**Enhancement**: Allow users to customize section display order.

```tsx
// DnD reordering (using @dnd-kit/sortable)
import { DndContext, closestCenter } from '@dnd-kit/core';
import { SortableContext, arrayMove, verticalListSortingStrategy } from '@dnd-kit/sortable';

const [sectionOrder, setSectionOrder] = useState([
  'basics', 'retirement', 'income', 'risk', 'savings', 'expenses', 'assets', 'income-streams'
]);

<DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
  <SortableContext items={sectionOrder} strategy={verticalListSortingStrategy}>
    {sectionOrder.map((section) => (
      <SortableSection key={section} id={section}>
        {renderSection(section)}
      </SortableSection>
    ))}
  </SortableContext>
</DndContext>
```

**Note**: This would require adding `@dnd-kit` as a dependency.

**Effort**: High | **Impact**: Low (nice-to-have)

---

## Implementation Priority Matrix

| Improvement | Effort | Impact | Priority |
|------------|--------|--------|----------|
| Loading skeletons | Low | High | P1 |
| Accessibility (Collapsible ARIA) | Low | High | P1 |
| Unsaved changes warning | Low | High | P1 |
| Collapsible animation | Low | Medium | P2 |
| Progress visualization | Medium | High | P2 |
| Responsive mobile improvements | Medium | High | P2 |
| Financial health score | Medium | High | P2 |
| Data export (PDF/JSON) | Medium | Medium | P3 |
| Inline editing | Medium | Medium | P3 |
| Asset allocation chart | Medium | High | P3 |
| Section reordering | High | Low | P4 |

---

## Code References

### Current Profile Implementation
- [src/app/profile/page.tsx](src/app/profile/page.tsx) - Server component
- [src/app/profile/profile-client.tsx](src/app/profile/profile-client.tsx) - Client component (main target for improvements)
- [src/app/api/profile/route.ts](src/app/api/profile/route.ts) - API endpoint

### UI Components to Enhance/Create
- [src/components/ui/collapsible.tsx](src/components/ui/collapsible.tsx) - Needs ARIA + animation
- Create: `src/components/ui/skeleton.tsx`
- Create: `src/components/profile/FinancialHealthScore.tsx`
- Create: `src/components/profile/SavingsProgress.tsx`

### Existing Patterns to Reuse
- [src/components/projections/AISummary.tsx:31-35](src/components/projections/AISummary.tsx#L31-L35) - Skeleton component pattern
- [src/hooks/useProjectionExport.ts](src/hooks/useProjectionExport.ts) - PDF/CSV export patterns
- [src/components/dashboard/NetWorthSummary.tsx](src/components/dashboard/NetWorthSummary.tsx) - Financial display patterns

### Related Design Research
- [thoughts/shared/research/2025-12-05-clean-ui-design-website-experience.md](thoughts/shared/research/2025-12-05-clean-ui-design-website-experience.md) - UI design principles
- [thoughts/shared/research/2025-12-25-story-2.3-view-edit-financial-info-research.md](thoughts/shared/research/2025-12-25-story-2.3-view-edit-financial-info-research.md) - Original profile implementation research

## Architecture Insights

### Component Structure
The profile page follows a server/client component split pattern consistent with the rest of the application:
- Server component handles auth check and initial data fetch
- Client component manages all interactive state (editing, modals)

### Reuse of Onboarding Components
A key strength is the reuse of onboarding step components for editing. This ensures:
- Consistent validation rules
- Single source of truth for form fields
- Reduced maintenance burden

### Suggested Refactoring
Consider extracting common display patterns into reusable components:
```
src/components/profile/
├── FinancialSection.tsx      # Base section with collapsible + edit
├── FinancialHealthScore.tsx  # New: Health metric
├── SavingsProgress.tsx       # New: Progress bars
├── AssetAllocation.tsx       # New: Pie chart
└── InlineEdit.tsx            # New: Quick edit component
```

## Historical Context

### Related Prior Research
- [2025-12-25 Story 2.3](thoughts/shared/research/2025-12-25-story-2.3-view-edit-financial-info-research.md) - Original implementation research for the profile page feature
- [2025-12-05 Clean UI Design](thoughts/shared/research/2025-12-05-clean-ui-design-website-experience.md) - Established UI design principles for the project

### Design System
The project uses:
- **shadcn/ui** (new-york style) - Component primitives
- **Tailwind CSS 3.4** - Utility-first styling
- **Radix UI** - Accessible headless components
- **Recharts** - Data visualization (already available)

## Open Questions

1. **Mobile-first priority**: Should mobile improvements be prioritized over desktop enhancements?
2. **Financial health score**: What algorithm should determine the health score? Need business input.
3. **Export formats**: Should we support CSV in addition to PDF and JSON?
4. **Section customization**: Is user preference for section order worth the added complexity?
5. **Inline vs modal editing**: Should we support both patterns or standardize on one?

## Next Steps

1. Create implementation tickets for P1 improvements
2. Design mockups for data visualization components
3. User research on mobile usage patterns
4. Determine financial health score algorithm with product team
