---
date: 2025-12-30T12:00:00-08:00
researcher: Claude
git_commit: 39a55fd458b371a7cadbe3be6adb76ae5b6e7cc9
branch: main
repository: plan-smart
topic: "Story 6 - Input Validation for Projection Feature"
tags: [research, validation, projections, user-feedback, edge-cases]
status: complete
last_updated: 2025-12-30
last_updated_by: Claude
---

# Research: Story 6 - Input Validation for Projection Feature

**Date**: 2025-12-30T12:00:00-08:00
**Researcher**: Claude
**Git Commit**: 39a55fd458b371a7cadbe3be6adb76ae5b6e7cc9
**Branch**: main
**Repository**: plan-smart

## Research Question

Based on Story 6 scope (`thoughts/personal/tickets/epic-3/projection-modeling/story-6-scope.md`):
- How should we validate ages (current < retirement < lifespan)?
- How should we ensure numeric inputs are non-negative?
- How should we display clear, friendly error messages?
- How should we handle edge cases (zero savings, zero contributions, very high inflation/low returns)?

## Summary

The codebase already has robust validation infrastructure using Zod schemas for most inputs. However, there are gaps in cross-field age validation and edge case handling for the projection feature. The existing patterns provide clear guidance for implementing Story 6 requirements.

**Key Findings:**
1. **Age validation exists but lacks cross-field checks** - Birth year, retirement age, and max age are validated individually but not in relation to each other
2. **Non-negative validation already implemented** - All numeric fields use `.min(0)` or appropriate lower bounds
3. **Error display patterns established** - Inline errors, alerts, and toasts all have consistent patterns
4. **Edge cases partially handled** - Engine handles zero balances but validation could prevent unrealistic scenarios earlier

## Detailed Findings

### Current Validation Architecture

#### Validation Libraries in Use
- **Zod** (v4.1.13) - Primary schema validation
- **@hookform/resolvers** (v5.2.2) - React Hook Form integration
- **react-hook-form** (v7.66.1) - Form state management

#### Validation Schema Locations
| Schema | Location | Purpose |
|--------|----------|---------|
| `step1Schema` | `src/lib/validation/onboarding.ts:5-10` | Birth year validation |
| `step2Schema` | `src/lib/validation/onboarding.ts:12-18` | Retirement age, filing status |
| `projectionRequestSchema` | `src/lib/validation/projections.ts:33-105` | Projection API overrides |
| `incomeStreamSchema` | `src/lib/validation/onboarding.ts:87-96` | Income stream validation |

### Age Validation (Current State)

#### Birth Year
- **Location**: `src/lib/validation/onboarding.ts:5-10`
- **Validation**: Min 1920, Max current year - 18
- **Gap**: Not validated against retirement age

#### Retirement Age
- **Location**: `src/lib/validation/onboarding.ts:13-16`
- **Validation**: Min 50, Max 80
- **Gap**: Not validated against current age (derived from birth year)

#### Max Age (Lifespan)
- **Location**: `src/lib/validation/projections.ts:49-54`
- **Validation**: Min 50, Max 120
- **Gap**: Not validated against retirement age

#### Current Age Calculation
- **Location**: `src/app/api/projections/calculate/route.ts:92-93`
- **Method**: `new Date().getFullYear() - snapshot.birthYear`
- **Note**: Calculated server-side, not directly validated

### Required: Cross-Field Age Validation

Story 6 requires: `currentAge < retirementAge < maxAge`

**Implementation Options:**

1. **Onboarding-Level Validation** (Recommended)
   - Add `.refine()` to step2Schema to check `retirementAge > currentAge`
   - Current age derived from birth year in step 1

2. **API-Level Validation**
   - Add cross-field check in `projectionRequestSchema`
   - Reject requests where relationships are invalid

3. **Input Builder Validation**
   - Add checks in `buildProjectionInputFromSnapshot()`
   - Return validation errors before calculation

**Suggested Implementation** (in `projections.ts`):
```typescript
const projectionInputSchema = z.object({
  currentAge: z.number(),
  retirementAge: z.number(),
  maxAge: z.number(),
}).refine(
  (data) => data.currentAge < data.retirementAge,
  { message: 'Retirement age must be greater than your current age', path: ['retirementAge'] }
).refine(
  (data) => data.retirementAge < data.maxAge,
  { message: 'Life expectancy must be greater than retirement age', path: ['maxAge'] }
);
```

### Numeric Input Validation (Current State)

All numeric inputs already have non-negative validation:

| Field | Location | Validation |
|-------|----------|------------|
| `balance` | `onboarding.ts:47` | `.min(0)` |
| `monthlyContribution` | `onboarding.ts:48` | `.min(0)` |
| `annualAmount` | `onboarding.ts:91` | `.min(0, 'Amount cannot be negative')` |
| `annualIncome` | `onboarding.ts:21-23` | `.min(0, 'Annual income cannot be negative')` |
| `savingsRate` | `onboarding.ts:24-26` | `.min(0, 'Savings rate cannot be negative')` |
| `expectedReturn` | `projections.ts:36-38` | `.min(0)` |
| `inflationRate` | `projections.ts:42-44` | `.min(0)` |

**Status**: Complete - all numeric inputs validated as non-negative

### Error Display Patterns

#### 1. Inline Field Errors (Primary Pattern)
**Location**: All onboarding form components
**Style**:
```jsx
{errors.fieldName && (
  <p className="text-sm text-red-500">{errors.fieldName.message}</p>
)}
```

#### 2. Alert Component for Form-Level Errors
**Location**: `src/components/ui/alert.tsx`
**Usage**:
```jsx
<Alert variant="destructive">
  <AlertTitle>Error Title</AlertTitle>
  <AlertDescription>{errorMessage}</AlertDescription>
</Alert>
```

#### 3. Toast Notifications for Async Errors
**Location**: `src/hooks/use-toast.ts`
**Usage**:
```jsx
toast({
  title: 'Calculation Error',
  description: 'Unable to generate projection',
  variant: 'destructive',
});
```

### Edge Case Handling

#### Current Engine Guards

| Edge Case | Handling | Location |
|-----------|----------|----------|
| Zero savings | Calculations proceed normally | `engine.ts:140-163` |
| Zero contributions | Effective contribution = 0 | `engine.ts:147-150` |
| Account depletion | Balance floored at 0 | `engine.ts:79-82, 216` |
| Already retired | Skips accumulation phase | `engine.ts:128, 208-210` |
| Division by zero | Special handling for 0% interest | `assumptions.ts:139-141` |

#### Recommended Additional Validation

**1. Very High Inflation (> 8%)**
Current: Allowed up to 15% (`projections.ts:45`)
Recommendation: Show warning when > 8%, still allow

**2. Very Low Returns (< 2%)**
Current: Allowed down to 0%
Recommendation: Show warning for < 2% returns

**3. Zero Everything**
Current: Calculations run, show zero results
Recommendation: Show friendly message if no meaningful inputs

**4. Debt Payments > Contributions**
Current: Effective contribution = 0 (`engine.ts:150`)
Recommendation: Show warning that savings may be delayed

### Implementation Recommendations

#### 1. Add Cross-Field Age Validation

**File**: `src/lib/validation/projections.ts`

Add a new schema for projection input validation:
```typescript
export const projectionInputValidationSchema = z.object({
  currentAge: z.number().min(18).max(100),
  retirementAge: z.number().min(50).max(80),
  maxAge: z.number().min(50).max(120),
}).refine(
  (data) => data.currentAge < data.retirementAge,
  {
    message: 'Retirement age must be after your current age',
    path: ['retirementAge']
  }
).refine(
  (data) => data.retirementAge < data.maxAge,
  {
    message: 'Life expectancy must be after retirement age',
    path: ['maxAge']
  }
);
```

#### 2. Add Warning System for Edge Cases

**File**: Create `src/lib/projections/warnings.ts`

```typescript
export interface ProjectionWarning {
  field: string;
  message: string;
  severity: 'info' | 'warning';
}

export function generateInputWarnings(input: ProjectionInput): ProjectionWarning[] {
  const warnings: ProjectionWarning[] = [];

  // Very high inflation warning
  if (input.inflationRate > 0.08) {
    warnings.push({
      field: 'inflationRate',
      message: 'Inflation above 8% is historically unusual. Consider a more conservative estimate.',
      severity: 'warning',
    });
  }

  // Very low returns warning
  if (input.expectedReturn < 0.02) {
    warnings.push({
      field: 'expectedReturn',
      message: 'Expected returns below 2% may be overly conservative.',
      severity: 'info',
    });
  }

  // Zero savings warning
  const totalBalance = Object.values(input.balancesByType).reduce((a, b) => a + b, 0);
  if (totalBalance === 0 && input.annualContribution === 0) {
    warnings.push({
      field: 'savings',
      message: 'Starting with zero savings and zero contributions will result in no retirement funds.',
      severity: 'warning',
    });
  }

  return warnings;
}
```

#### 3. Prevent Projection with Invalid Ages

**File**: `src/app/api/projections/calculate/route.ts`

Add validation after building projection input:
```typescript
// After building projectionInput
const ageValidation = projectionInputValidationSchema.safeParse({
  currentAge: projectionInput.currentAge,
  retirementAge: projectionInput.retirementAge,
  maxAge: projectionInput.maxAge,
});

if (!ageValidation.success) {
  return NextResponse.json(
    {
      message: 'Invalid age configuration',
      errors: ageValidation.error.flatten()
    },
    { status: 400 }
  );
}
```

#### 4. Add UI Feedback Component

**File**: Create `src/components/projections/InputWarnings.tsx`

Display warnings returned from the API in the plans page.

## Code References

- `src/lib/validation/onboarding.ts:5-10` - Birth year validation
- `src/lib/validation/onboarding.ts:12-18` - Retirement age validation
- `src/lib/validation/projections.ts:33-105` - Projection request schema
- `src/app/api/projections/calculate/route.ts:92-93` - Current age calculation
- `src/app/api/projections/calculate/route.ts:266-273` - Validation error handling
- `src/lib/projections/engine.ts:117-239` - Main projection loop
- `src/lib/projections/engine.ts:147-150` - Zero contribution handling
- `src/lib/projections/engine.ts:79-82` - Balance depletion handling
- `src/components/projections/AssumptionsPanel.tsx:60-136` - Runtime assumption sliders
- `src/components/ui/alert.tsx:6-20` - Alert component variants
- `src/hooks/use-toast.ts:11-12` - Toast configuration

## Architecture Insights

### Validation Layer Strategy
The codebase uses a two-tier validation approach:
1. **Client-side** - React Hook Form with Zod resolver for immediate feedback
2. **Server-side** - Zod schemas in API routes for security and consistency

### Error Display Philosophy
- **Field-level errors**: Inline red text below inputs
- **Form-level errors**: Alert component with destructive variant
- **Async errors**: Toast notifications
- **Warnings**: Not currently implemented (opportunity for Story 6)

### Calculation Safety
The projection engine is designed to never crash:
- All balances floored at 0
- Withdrawal limited to available funds
- Division by zero handled explicitly
- Continues simulation even after depletion

## Open Questions

1. **Should warnings block projection?** - Current recommendation: No, show warnings but allow calculation
2. **Where to show warnings?** - Options: Alert above chart, inline with sliders, or toast
3. **AssumptionsPanel validation** - Should slider limits be dynamic based on other inputs?
4. **Historical context** - Should we show "typical" ranges for inflation/returns?
