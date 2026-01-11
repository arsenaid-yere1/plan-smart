# Profile Page P1 Improvements Implementation Plan

## Overview

This plan implements the high-priority (P1) improvements for the profile page, focusing on loading states, accessibility, unsaved changes protection, and smooth animations. These changes provide high user impact with relatively low implementation effort.

## Current State Analysis

The profile page ([src/app/profile/profile-client.tsx](src/app/profile/profile-client.tsx)) is a 623-line client component that:
- Displays 8 collapsible sections with financial data
- Uses 8 Dialog modals for editing (reusing onboarding step components)
- Has no loading skeleton for initial data fetch
- Uses a custom Collapsible component with no ARIA attributes or animations
- Does not warn users about unsaved changes when closing edit dialogs
- **Bug**: State of Residence field doesn't populate when editing Basics section (null vs undefined handling issue)

### Key Discoveries:
- Existing Skeleton pattern in [src/components/projections/AISummary.tsx:31-35](src/components/projections/AISummary.tsx#L31-L35)
- Collapsible component at [src/components/ui/collapsible.tsx](src/components/ui/collapsible.tsx) - 55 lines, no ARIA, instant show/hide
- Focus ring patterns using `focus-visible:ring-*` classes throughout UI components
- `aria-expanded` pattern used in [ProjectionTable.tsx:36-49](src/components/projections/ProjectionTable.tsx#L36-L49)

## Desired End State

After implementation:
1. **Loading Skeleton**: Profile page shows animated skeleton placeholders during initial data load
2. **Accessibility**: Collapsible sections have proper ARIA attributes, keyboard navigation, and screen reader support
3. **Unsaved Changes**: Users see a confirmation dialog when closing an edit modal with unsaved changes
4. **Smooth Animation**: Collapsible sections animate smoothly open/closed using CSS transitions

### Verification:
- Screen readers announce section states correctly
- Keyboard users can navigate all interactive elements
- Loading state visible during slow network conditions
- Animation smooth at 60fps

## What We're NOT Doing

- P2 improvements (Progress visualization, Financial health score, Mobile responsive enhancements)
- P3 improvements (Data export, Inline editing, Asset allocation chart)
- P4 improvements (Section reordering via drag-and-drop)
- Creating new standalone components for visualization (SavingsProgress, AssetAllocation)
- Adding new dependencies (no Radix Collapsible primitive, no dnd-kit)

## Implementation Approach

We will implement five improvements in order:
0. **Phase 0**: Fix State of Residence field in profile edit (bug fix)
1. **Phase 1**: Create reusable Skeleton component and add profile loading state
2. **Phase 2**: Enhance Collapsible with ARIA attributes and focus management
3. **Phase 3**: Add unsaved changes detection and confirmation dialog
4. **Phase 4**: Add CSS height animation to Collapsible

Each phase is independently deployable and testable.

---

## Phase 0: Fix State of Residence in Edit Form

### Overview
The State of Residence (tax state) field is displayed in the Basics section but doesn't populate correctly when editing. This is due to a `null` vs `undefined` handling issue when passing initial data to react-hook-form.

### Root Cause Analysis
- [profile-client.tsx:52](src/app/profile/profile-client.tsx#L52): `stateOfResidence: string | null` - database value is `null` when not set
- [profile-client.tsx:134](src/app/profile/profile-client.tsx#L134): `...profileData` spreads the `null` value directly
- [step1-personal-info.tsx:32](src/components/onboarding/step1-personal-info.tsx#L32): `defaultValues: initialData` - react-hook-form receives `null`
- The Select component's placeholder has `value=""`, but the form value is `null`, so nothing is selected

### Changes Required:

#### 1. Fix formData Transformation
**File**: `src/app/profile/profile-client.tsx`

Update the formData transformation to convert `null` to `undefined` for stateOfResidence:

```tsx
// Transform ProfileData to format expected by step components
const formData: Partial<CompleteOnboardingDataV2> = {
  ...profileData,
  stateOfResidence: profileData.stateOfResidence ?? undefined, // Convert null to undefined
  investmentAccounts: profileData.investmentAccounts.map((acc) => ({
    ...acc,
    type: acc.type as CompleteOnboardingDataV2['investmentAccounts'][0]['type'],
  })),
  primaryResidence: profileData.primaryResidence ?? undefined,
  realEstateProperties: (profileData.realEstateProperties ?? []).map((prop) => ({
    ...prop,
    type: prop.type as 'primary' | 'rental' | 'vacation' | 'land',
  })),
  debts: profileData.debts.map((debt) => ({
    ...debt,
    type: debt.type as CompleteOnboardingDataV2['debts'][0]['type'],
  })),
  incomeExpenses: profileData.incomeExpenses ?? undefined,
  incomeStreams: profileData.incomeStreams ?? [],
};
```

The key change is adding: `stateOfResidence: profileData.stateOfResidence ?? undefined,`

This ensures that when `stateOfResidence` is `null` (not set in database), it becomes `undefined`, which react-hook-form handles correctly by not setting a default value, allowing the Select placeholder to display.

#### 2. Ensure Select Component Handles Empty Value
**File**: `src/components/ui/select.tsx` (verify, likely no change needed)

The Select component should already handle this correctly since:
- Placeholder option has `value=""`
- When no value is selected (undefined), the placeholder shows

No changes needed here, but verify the component works correctly after the formData fix.

### Success Criteria:

#### Automated Verification:
- [x] TypeScript compiles without errors: `npm run typecheck`
- [x] Linting passes: `npm run lint`
- [x] Build succeeds: `npm run build`

#### Manual Verification:
- [x] Navigate to /profile with a state already set - verify state displays in Basics section
- [x] Click "Edit" on Basics section - verify state dropdown shows the correct state selected
- [x] For users without a state set - verify placeholder "Select your state" appears
- [x] Change state selection and save - verify new state persists
- [x] The state selection works the same as during initial onboarding

**Implementation Note**: This is a small bug fix that should be done first as it affects the editing experience for the Basics section.

---

## Phase 1: Loading Skeleton

### Overview
Create a reusable Skeleton component following shadcn/ui patterns, then add a loading state to the profile page that shows skeleton placeholders while data loads.

### Changes Required:

#### 1. Create Skeleton Component
**File**: `src/components/ui/skeleton.tsx` (new file)

```tsx
import { cn } from '@/lib/utils';

function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('animate-pulse rounded-md bg-muted', className)}
      {...props}
    />
  );
}

export { Skeleton };
```

#### 2. Create Profile Skeleton Component
**File**: `src/app/profile/profile-client.tsx`
**Changes**: Add ProfileSkeleton component and loading prop

Add this component near the top of the file (after imports):

```tsx
import { Skeleton } from '@/components/ui/skeleton';

function ProfileSkeleton() {
  return (
    <div className="space-y-4">
      {/* Net Worth Summary skeleton */}
      <div className="border rounded-lg p-6">
        <Skeleton className="h-8 w-40 mb-4" />
        <div className="grid grid-cols-2 gap-4">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      </div>
      {/* Section skeletons - 8 sections */}
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="border rounded-lg p-4">
          <div className="flex items-center justify-between mb-4">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-4 w-16" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </div>
        </div>
      ))}
    </div>
  );
}
```

#### 3. Update ProfileClient to Accept Loading Prop
**File**: `src/app/profile/profile-client.tsx`

Update the interface and component:

```tsx
interface ProfileClientProps {
  initialData: ProfileData;
  isLoading?: boolean;
}

export function ProfileClient({ initialData, isLoading = false }: ProfileClientProps) {
  // ... existing state

  if (isLoading) {
    return <ProfileSkeleton />;
  }

  // ... rest of component
}
```

#### 4. Add Suspense Boundary to Server Page
**File**: `src/app/profile/page.tsx`

The profile page already fetches data server-side, so we'll use React Suspense. Add a loading.tsx file:

**File**: `src/app/profile/loading.tsx` (new file)

```tsx
import { Skeleton } from '@/components/ui/skeleton';

export default function ProfileLoading() {
  return (
    <div className="container mx-auto max-w-4xl px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">Financial Profile</h1>
      <div className="space-y-4">
        {/* Net Worth Summary skeleton */}
        <div className="border rounded-lg p-6">
          <Skeleton className="h-8 w-40 mb-4" />
          <div className="grid grid-cols-2 gap-4">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        </div>
        {/* Section skeletons */}
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="border rounded-lg p-4">
            <div className="flex items-center justify-between mb-4">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-4 w-16" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

### Success Criteria:

#### Automated Verification:
- [x] TypeScript compiles without errors: `npm run typecheck`
- [x] Linting passes: `npm run lint`
- [x] Build succeeds: `npm run build`
- [x] New Skeleton component exists at `src/components/ui/skeleton.tsx`
- [x] Loading file exists at `src/app/profile/loading.tsx`

#### Manual Verification:
- [x] Skeleton appears briefly when navigating to /profile with slow network (DevTools Network throttling to "Slow 3G")
- [x] Skeleton layout matches the actual profile layout structure
- [x] Skeleton animates with pulse effect
- [x] No layout shift when content loads

---

## Phase 2: Collapsible Accessibility

### Overview
Enhance the Collapsible component with ARIA attributes, keyboard navigation, and screen reader support following WAI-ARIA disclosure pattern.

### Changes Required:

#### 1. Update Collapsible Component
**File**: `src/components/ui/collapsible.tsx`

Replace the entire file:

```tsx
'use client';

import * as React from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CollapsibleProps {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
  className?: string;
  onEdit?: () => void;
  id?: string;
}

export function Collapsible({
  title,
  defaultOpen = true,
  children,
  className,
  onEdit,
  id,
}: CollapsibleProps) {
  const [isOpen, setIsOpen] = React.useState(defaultOpen);

  // Generate stable IDs for accessibility
  const generatedId = React.useId();
  const baseId = id || generatedId;
  const headerId = `${baseId}-header`;
  const contentId = `${baseId}-content`;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setIsOpen(!isOpen);
    }
  };

  return (
    <div className={cn('border rounded-lg', className)}>
      <div
        id={headerId}
        role="button"
        tabIndex={0}
        aria-expanded={isOpen}
        aria-controls={contentId}
        className="flex items-center justify-between p-4 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-t-lg"
        onClick={() => setIsOpen(!isOpen)}
        onKeyDown={handleKeyDown}
      >
        <h3 className="font-medium">{title}</h3>
        <div className="flex items-center gap-2">
          {onEdit && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onEdit();
              }}
              aria-label={`Edit ${title}`}
              className="text-sm text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded px-1"
            >
              Edit
            </button>
          )}
          <ChevronDown
            aria-hidden="true"
            className={cn(
              'h-4 w-4 transition-transform duration-200',
              isOpen && 'rotate-180'
            )}
          />
        </div>
      </div>
      <div
        id={contentId}
        role="region"
        aria-labelledby={headerId}
        hidden={!isOpen}
      >
        {isOpen && <div className="px-4 pb-4">{children}</div>}
      </div>
    </div>
  );
}
```

### Key Changes:
- Added `role="button"` and `tabIndex={0}` for keyboard access
- Added `aria-expanded` to indicate open/close state
- Added `aria-controls` to link header to content
- Added `id` attributes for ARIA relationships
- Added `role="region"` and `aria-labelledby` on content
- Added `aria-label` on Edit button with section context
- Added keyboard handler for Enter and Space keys
- Added `focus-visible` ring styling for keyboard navigation
- Added `aria-hidden="true"` on decorative chevron
- Added `hidden` attribute on collapsed content for screen readers
- Added `duration-200` to chevron for consistent animation timing

### Success Criteria:

#### Automated Verification:
- [x] TypeScript compiles without errors: `npm run typecheck`
- [x] Linting passes: `npm run lint`
- [x] Build succeeds: `npm run build`

#### Manual Verification:
- [x] Can navigate to Collapsible header using Tab key
- [x] Can toggle section using Enter or Space key
- [x] Focus ring appears when using keyboard navigation
- [x] Screen reader announces "button, expanded" or "button, collapsed"
- [x] Screen reader announces "Edit Basics" (with section name) for edit buttons
- [x] Screen reader announces region when content is expanded
- [x] Visual chevron rotates with smooth 200ms transition

---

## Phase 3: Unsaved Changes Warning

### Overview
Track form changes in edit dialogs and show a confirmation when users try to close with unsaved changes. Uses the browser's native confirm dialog for simplicity.

### Changes Required:

#### 1. Add Form Change Tracking to ProfileClient
**File**: `src/app/profile/profile-client.tsx`

Add state and handlers near the top of the ProfileClient component:

```tsx
export function ProfileClient({ initialData }: ProfileClientProps) {
  const [profileData, setProfileData] = useState(initialData);
  const [editSection, setEditSection] = useState<EditSection>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const { toast } = useToast();

  const handleEditClose = () => {
    if (hasUnsavedChanges) {
      const confirmed = window.confirm(
        'You have unsaved changes. Are you sure you want to discard them?'
      );
      if (!confirmed) {
        return;
      }
    }
    setEditSection(null);
    setHasUnsavedChanges(false);
  };

  const handleFormChange = () => {
    if (!hasUnsavedChanges) {
      setHasUnsavedChanges(true);
    }
  };

  const handleEditSave = async (data: Partial<CompleteOnboardingDataV2>) => {
    try {
      const response = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to update profile');
      }

      setProfileData((prev) => ({ ...prev, ...data } as ProfileData));
      setEditSection(null);
      setHasUnsavedChanges(false); // Reset on successful save
      toast({
        title: 'Profile updated',
        description: 'Your financial information has been saved.',
      });
    } catch (error) {
      toast({
        title: 'Update failed',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'destructive',
      });
    }
  };

  // ... rest of component
```

#### 2. Update Step Components to Report Changes
The step components use react-hook-form which has a `formState.isDirty` property. We need to add an `onChange` callback prop to each step component.

**Example for Step1PersonalInfo** - Pattern to apply to all step components:

**File**: `src/components/onboarding/step1-personal-info.tsx`

Add to the interface:
```tsx
interface Step1PersonalInfoProps {
  onNext: (data: Step1Data) => void;
  initialData?: Partial<CompleteOnboardingDataV2>;
  submitLabel?: string;
  onChange?: () => void; // Add this
}
```

Add useEffect to detect changes:
```tsx
export function Step1PersonalInfo({
  onNext,
  initialData,
  submitLabel = 'Continue',
  onChange,
}: Step1PersonalInfoProps) {
  const {
    register,
    handleSubmit,
    formState: { errors, isDirty },
  } = useForm<Step1Data>({
    resolver: zodResolver(step1Schema),
    defaultValues: {
      birthYear: initialData?.birthYear ?? undefined,
      stateOfResidence: initialData?.stateOfResidence ?? undefined,
    },
  });

  // Report changes to parent
  React.useEffect(() => {
    if (isDirty && onChange) {
      onChange();
    }
  }, [isDirty, onChange]);

  // ... rest of component
}
```

**Files to update with the same pattern:**
- `src/components/onboarding/step1-personal-info.tsx`
- `src/components/onboarding/step2-retirement-info.tsx`
- `src/components/onboarding/step3-financial-info.tsx`
- `src/components/onboarding/step4-risk-tolerance.tsx`
- `src/components/onboarding/step2b-savings-contributions.tsx`
- `src/components/onboarding/step3b-income-expenses.tsx`
- `src/components/onboarding/step4b-assets-debts.tsx`
- `src/components/onboarding/step-income-streams.tsx`

#### 3. Pass onChange to Step Components in Dialogs
**File**: `src/app/profile/profile-client.tsx`

Update each dialog to pass the onChange handler:

```tsx
<Dialog open={editSection === 'basics'} onOpenChange={handleEditClose}>
  <DialogContent className="max-w-lg">
    <DialogHeader>
      <DialogTitle>Edit Basic Information</DialogTitle>
    </DialogHeader>
    <Step1PersonalInfo
      onNext={(data) => handleEditSave(data)}
      initialData={formData}
      submitLabel="Save"
      onChange={handleFormChange}
    />
  </DialogContent>
</Dialog>
```

Apply the same pattern to all 8 dialogs.

### Success Criteria:

#### Automated Verification:
- [x] TypeScript compiles without errors: `npm run typecheck`
- [x] Linting passes: `npm run lint`
- [x] Build succeeds: `npm run build`

#### Manual Verification:
- [ ] Open an edit dialog, make a change, click X or outside - confirm dialog appears
- [ ] Click "Cancel" in confirm dialog - edit modal stays open
- [ ] Click "OK" in confirm dialog - edit modal closes, changes are discarded
- [ ] Open an edit dialog, make NO changes, close - no confirm dialog appears
- [ ] Open an edit dialog, make a change, save - no confirm dialog (changes saved)
- [ ] Confirm dialog text clearly states changes will be discarded

---

## Phase 4: Collapsible CSS Animation

### Overview
Add smooth height animation to the Collapsible component using CSS max-height transitions. This provides visual polish without requiring additional dependencies.

### Changes Required:

#### 1. Update Collapsible Component with Height Animation
**File**: `src/components/ui/collapsible.tsx`

Replace the content section with animated version:

```tsx
'use client';

import * as React from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CollapsibleProps {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
  className?: string;
  onEdit?: () => void;
  id?: string;
}

export function Collapsible({
  title,
  defaultOpen = true,
  children,
  className,
  onEdit,
  id,
}: CollapsibleProps) {
  const [isOpen, setIsOpen] = React.useState(defaultOpen);
  const contentRef = React.useRef<HTMLDivElement>(null);
  const [contentHeight, setContentHeight] = React.useState<number | undefined>(
    defaultOpen ? undefined : 0
  );

  // Generate stable IDs for accessibility
  const generatedId = React.useId();
  const baseId = id || generatedId;
  const headerId = `${baseId}-header`;
  const contentId = `${baseId}-content`;

  // Update height when content or open state changes
  React.useEffect(() => {
    if (!contentRef.current) return;

    if (isOpen) {
      const height = contentRef.current.scrollHeight;
      setContentHeight(height);
      // After transition, remove fixed height to allow dynamic content
      const timer = setTimeout(() => {
        setContentHeight(undefined);
      }, 200); // Match transition duration
      return () => clearTimeout(timer);
    } else {
      // First set to current height, then to 0 for animation
      const height = contentRef.current.scrollHeight;
      setContentHeight(height);
      // Use requestAnimationFrame to ensure the height is set before animating to 0
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setContentHeight(0);
        });
      });
    }
  }, [isOpen]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setIsOpen(!isOpen);
    }
  };

  return (
    <div className={cn('border rounded-lg', className)}>
      <div
        id={headerId}
        role="button"
        tabIndex={0}
        aria-expanded={isOpen}
        aria-controls={contentId}
        className="flex items-center justify-between p-4 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-t-lg"
        onClick={() => setIsOpen(!isOpen)}
        onKeyDown={handleKeyDown}
      >
        <h3 className="font-medium">{title}</h3>
        <div className="flex items-center gap-2">
          {onEdit && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onEdit();
              }}
              aria-label={`Edit ${title}`}
              className="text-sm text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded px-1"
            >
              Edit
            </button>
          )}
          <ChevronDown
            aria-hidden="true"
            className={cn(
              'h-4 w-4 transition-transform duration-200',
              isOpen && 'rotate-180'
            )}
          />
        </div>
      </div>
      <div
        id={contentId}
        ref={contentRef}
        role="region"
        aria-labelledby={headerId}
        aria-hidden={!isOpen}
        className="overflow-hidden transition-[max-height] duration-200 ease-in-out"
        style={{
          maxHeight: contentHeight === undefined ? 'none' : `${contentHeight}px`,
        }}
      >
        <div className="px-4 pb-4">{children}</div>
      </div>
    </div>
  );
}
```

### Key Changes from Phase 2:
- Added `contentRef` to measure content height
- Added `contentHeight` state to control max-height
- Added `useEffect` to animate height on open/close
- Changed `hidden` attribute to `aria-hidden` (content always in DOM for animation)
- Added `overflow-hidden` and `transition-[max-height]` for smooth animation
- Uses `requestAnimationFrame` for reliable close animation
- After opening, removes fixed height to allow dynamic content changes
- Children always rendered (not conditionally) to allow height measurement

### Success Criteria:

#### Automated Verification:
- [x] TypeScript compiles without errors: `npm run typecheck`
- [x] Linting passes: `npm run lint`
- [x] Build succeeds: `npm run build`

#### Manual Verification:
- [ ] Collapsible sections animate smoothly when opening (200ms duration)
- [ ] Collapsible sections animate smoothly when closing (200ms duration)
- [ ] No visual glitches or jumps during animation
- [ ] Content within sections can resize without issues after animation completes
- [ ] Animation performance is smooth (check with DevTools Performance panel - should be 60fps)
- [ ] Accessibility still works (keyboard, screen reader) after animation changes

---

## Testing Strategy

### Unit Tests:
No new unit tests required for this phase - these are primarily UI/UX enhancements. If the project has component tests:

- Test Skeleton component renders with correct classes
- Test Collapsible ARIA attributes update correctly
- Test Collapsible keyboard handlers work

### Integration Tests:
- Test profile page loads with skeleton then content
- Test edit flow with unsaved changes warning

### Manual Testing Steps:
1. Navigate to /profile with slow network - verify skeleton appears
2. Tab through all collapsible sections - verify focus indicators
3. Use Enter/Space to toggle sections - verify keyboard works
4. Open edit dialog, make change, close - verify confirm dialog
5. Open/close all collapsible sections - verify smooth animation
6. Test with screen reader (VoiceOver/NVDA) - verify announcements

## Performance Considerations

- Skeleton uses CSS `animate-pulse` (GPU-accelerated)
- Collapsible animation uses `max-height` transition (not as performant as `transform` but simpler for variable-height content)
- `will-change` not added to avoid memory overhead for 8+ sections
- Animation duration of 200ms chosen for responsiveness without feeling rushed

## References

- Research document: [thoughts/shared/research/2026-01-08-profile-page-improvements.md](thoughts/shared/research/2026-01-08-profile-page-improvements.md)
- Existing Skeleton pattern: [src/components/projections/AISummary.tsx:31-35](src/components/projections/AISummary.tsx#L31-L35)
- ARIA disclosure pattern: [WAI-ARIA Practices - Disclosure](https://www.w3.org/WAI/ARIA/apg/patterns/disclosure/)
- Focus-visible patterns: [src/components/ui/button.tsx](src/components/ui/button.tsx)
