# Story 6 - Input Validation for Projection Feature Implementation Plan

## Overview

Implement comprehensive input validation for the projection feature to ensure users receive clear feedback when inputs are invalid or unrealistic. This includes cross-field age validation (current < retirement < lifespan), non-negative numeric validation, and friendly error messages with edge case handling.

## Current State Analysis

### What Exists Now

1. **Individual field validation** - All numeric fields have `.min(0)` constraints in Zod schemas
2. **Range validation** - Ages and rates have min/max bounds (e.g., retirement age 50-80)
3. **Error display patterns** - Inline errors, Alert components, and Toast notifications are established
4. **Engine safety** - Projection engine handles edge cases like zero savings gracefully

### What's Missing

1. **Cross-field age validation** - No check that `currentAge < retirementAge < maxAge`
2. **Early validation in API** - Age relationship validation happens implicitly in engine, not explicitly in API
3. **Warning system for edge cases** - No warnings for unusual but valid inputs (high inflation, low returns)
4. **User-facing validation feedback** - No consolidated validation error display in the Plans page

### Key Discoveries

- `currentAge` is calculated in the API route (`route.ts:92-93`) from `birthYear`
- `retirementAge` comes from `snapshot.targetRetirementAge` or override (`route.ts:141`)
- `maxAge` defaults to 90 or uses override (`route.ts:158`)
- The engine silently handles invalid age relationships but produces incorrect results
- Existing `.refine()` pattern is used for `contributionAllocationSchema` (lines 25-28 in `projections.ts`)

## Desired End State

After this implementation:

1. **API-level validation** prevents projections from running when `currentAge >= retirementAge` or `retirementAge >= maxAge`
2. **Clear error messages** explain exactly what's wrong (e.g., "Your retirement age (65) must be greater than your current age (68)")
3. **Warnings** inform users about unusual inputs without blocking the projection
4. **Consistent error display** on the Plans page using existing Alert component pattern

### Success Verification

- API returns 400 with descriptive error when age relationships are invalid
- Plans page displays validation errors using Alert component
- Edge cases (zero savings, high inflation) generate warnings but allow projection
- All existing tests pass

## What We're NOT Doing

- Changing onboarding validation (users can have any birth year/retirement age during onboarding)
- Blocking projections for unusual but valid scenarios (just warn)
- Adding real-time client-side validation before API call
- Changing the projection engine's internal handling

## Implementation Approach

The validation will be added at the API layer after `projectionInput` is built but before `runProjection()` is called. This approach:
- Catches all invalid configurations regardless of source (snapshot or overrides)
- Provides clear error messages with actual values
- Allows warnings to be returned alongside successful projections

## Phase 1: Add Cross-Field Age Validation to API

### Overview
Add validation logic to the projection API route that checks age relationships after building the projection input.

### Changes Required:

#### 1. Add Validation Helper Function
**File**: `src/app/api/projections/calculate/route.ts`
**Changes**: Add a validation function after the imports section

```typescript
/**
 * Validate age relationships for projection input
 * Returns error message if invalid, null if valid
 */
function validateAgeRelationships(
  currentAge: number,
  retirementAge: number,
  maxAge: number
): { valid: false; message: string } | { valid: true } {
  if (currentAge >= retirementAge) {
    return {
      valid: false,
      message: `Retirement age (${retirementAge}) must be greater than your current age (${currentAge}). Please adjust your retirement age or update your birth year in your profile.`,
    };
  }

  if (retirementAge >= maxAge) {
    return {
      valid: false,
      message: `Life expectancy (${maxAge}) must be greater than your retirement age (${retirementAge}). Please increase life expectancy or reduce retirement age.`,
    };
  }

  return { valid: true };
}
```

#### 2. Add Validation Check in calculateProjection
**File**: `src/app/api/projections/calculate/route.ts`
**Changes**: Add validation after building `projectionInput` (after line 170)

Insert after line 170 (after `projectionInput` is built):

```typescript
  // Validate age relationships
  const ageValidation = validateAgeRelationships(
    currentAge,
    projectionInput.retirementAge,
    projectionInput.maxAge
  );

  if (!ageValidation.valid) {
    return {
      error: ageValidation.message,
      status: 400,
      errorType: 'validation' as const,
    };
  }
```

#### 3. Update Return Type for Error Handling
**File**: `src/app/api/projections/calculate/route.ts`
**Changes**: The existing error handling already supports this pattern, but we need to ensure the 400 status is returned properly.

The existing code at lines 239-240 and 277-278 already handles errors:
```typescript
if ('error' in result) {
  return NextResponse.json({ message: result.error }, { status: result.status });
}
```

### Success Criteria:

#### Automated Verification:
- [x] All existing tests pass: `npm test -- --run`
- [x] Type checking passes: `npm run typecheck`
- [x] Linting passes: `npm run lint`
- [x] API returns 400 when currentAge >= retirementAge
- [x] API returns 400 when retirementAge >= maxAge

#### Manual Verification:
- [x] Navigate to Plans page with a user whose current age > retirement age and verify error is shown
- [x] Verify the error message includes the actual ages for clarity

---

## Phase 2: Add Warning System for Edge Cases

### Overview
Create a warning system that flags unusual inputs without blocking the projection. Warnings are returned in the API response for the UI to display.

### Changes Required:

#### 1. Create Warnings Helper Module
**File**: `src/lib/projections/warnings.ts` (new file)

```typescript
import type { ProjectionInput } from './types';

export interface ProjectionWarning {
  field: string;
  message: string;
  severity: 'info' | 'warning';
}

/**
 * Generate warnings for unusual but valid projection inputs
 */
export function generateProjectionWarnings(input: ProjectionInput): ProjectionWarning[] {
  const warnings: ProjectionWarning[] = [];

  // Very high inflation warning (> 8%)
  if (input.inflationRate > 0.08) {
    warnings.push({
      field: 'inflationRate',
      message: `Inflation rate of ${(input.inflationRate * 100).toFixed(1)}% is higher than historical averages. Consider using a more conservative estimate (2-4% is typical).`,
      severity: 'warning',
    });
  }

  // Very low expected return warning (< 2%)
  if (input.expectedReturn < 0.02 && input.expectedReturn >= 0) {
    warnings.push({
      field: 'expectedReturn',
      message: `Expected return of ${(input.expectedReturn * 100).toFixed(1)}% is quite conservative. Historical stock market returns average 7-10% before inflation.`,
      severity: 'info',
    });
  }

  // Zero savings with zero contributions warning
  const totalBalance = input.balancesByType.taxDeferred + input.balancesByType.taxFree + input.balancesByType.taxable;
  if (totalBalance === 0 && input.annualContribution === 0) {
    warnings.push({
      field: 'savings',
      message: 'Starting with no savings and no contributions will result in relying entirely on other income sources in retirement.',
      severity: 'warning',
    });
  }

  // High debt relative to contributions warning
  if (input.annualDebtPayments > 0 && input.annualContribution > 0) {
    const netContribution = input.annualContribution - input.annualDebtPayments;
    if (netContribution <= 0) {
      warnings.push({
        field: 'debt',
        message: 'Your debt payments exceed your retirement contributions. Consider prioritizing debt reduction.',
        severity: 'info',
      });
    }
  }

  // Very short retirement horizon warning
  const yearsToRetirement = input.retirementAge - input.currentAge;
  if (yearsToRetirement <= 5 && yearsToRetirement > 0) {
    warnings.push({
      field: 'retirementAge',
      message: `You're ${yearsToRetirement} year${yearsToRetirement === 1 ? '' : 's'} from retirement. Focus on preserving capital and finalizing your income strategy.`,
      severity: 'info',
    });
  }

  return warnings;
}
```

#### 2. Integrate Warnings into API Route
**File**: `src/app/api/projections/calculate/route.ts`
**Changes**: Import and call the warnings function

Add import at top of file:
```typescript
import { generateProjectionWarnings, type ProjectionWarning } from '@/lib/projections/warnings';
```

Update the calculateProjection function to generate warnings (after age validation, before runProjection):
```typescript
  // Generate warnings for unusual inputs
  const inputWarnings = generateProjectionWarnings(projectionInput);
  warnings.push(...inputWarnings.map(w => w.message));
```

#### 3. Update API Response to Include Structured Warnings
**File**: `src/app/api/projections/calculate/route.ts`
**Changes**: Enhance the meta section to include structured warnings

The existing `warnings` array is already returned in `meta.warnings`. Update to include both string warnings and structured warnings:

Change the return structure (around line 220-223):
```typescript
    meta: {
      calculationTimeMs,
      warnings: warnings.length > 0 ? warnings : undefined,
      inputWarnings: inputWarnings.length > 0 ? inputWarnings : undefined,
    },
```

### Success Criteria:

#### Automated Verification:
- [x] All existing tests pass: `npm test -- --run`
- [x] Type checking passes: `npm run typecheck`
- [x] New warnings module compiles without errors
- [x] API returns warnings for high inflation (> 8%)
- [x] API returns warnings for zero savings + zero contributions

#### Manual Verification:
- [ ] Set inflation to 10% in AssumptionsPanel and verify warning appears in response
- [ ] Verify projection still runs successfully with warnings

---

## Phase 3: Display Validation Errors and Warnings in UI

### Overview
Add error and warning display to the Plans page using existing Alert component patterns.

### Changes Required:

#### 1. Update Plans Page to Display Validation Errors
**File**: `src/app/plans/plans-client.tsx` (or wherever the projection is triggered)
**Changes**: Add Alert component for displaying validation errors

First, identify the component that handles projection errors. Add error state and display:

```tsx
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle, AlertTriangle, Info } from 'lucide-react';

// Add state for validation error
const [validationError, setValidationError] = useState<string | null>(null);
const [warnings, setWarnings] = useState<ProjectionWarning[]>([]);

// In the fetch/calculation handler:
if (!response.ok) {
  const error = await response.json();
  if (response.status === 400) {
    setValidationError(error.message);
    return;
  }
  // Handle other errors...
}

// Clear validation error on successful response
setValidationError(null);

// Extract warnings from response
if (data.meta?.inputWarnings) {
  setWarnings(data.meta.inputWarnings);
}
```

#### 2. Add Error Display Component
**File**: `src/app/plans/plans-client.tsx`
**Changes**: Add JSX for error display before the projection chart

```tsx
{validationError && (
  <Alert variant="destructive" className="mb-4">
    <AlertCircle className="h-4 w-4" />
    <AlertTitle>Cannot Generate Projection</AlertTitle>
    <AlertDescription>{validationError}</AlertDescription>
  </Alert>
)}
```

#### 3. Add Warning Display Component
**File**: `src/app/plans/plans-client.tsx`
**Changes**: Add JSX for warnings display

```tsx
{warnings.length > 0 && (
  <div className="space-y-2 mb-4">
    {warnings.map((warning, index) => (
      <Alert key={index} variant={warning.severity === 'warning' ? 'default' : 'default'}>
        {warning.severity === 'warning' ? (
          <AlertTriangle className="h-4 w-4 text-yellow-600" />
        ) : (
          <Info className="h-4 w-4 text-blue-600" />
        )}
        <AlertDescription>{warning.message}</AlertDescription>
      </Alert>
    ))}
  </div>
)}
```

### Success Criteria:

#### Automated Verification:
- [x] All existing tests pass: `npm test -- --run`
- [x] Type checking passes: `npm run typecheck`
- [x] Build succeeds: `npm run build`

#### Manual Verification:
- [ ] Navigate to Plans page with invalid age configuration and verify error Alert appears
- [ ] Verify projection chart is not displayed when validation error exists
- [ ] Set unusual values (10% inflation) and verify warning Alert appears above chart
- [ ] Verify warnings don't block the projection chart from displaying

---

## Testing Strategy

### Unit Tests

Add tests to verify validation logic:

**File**: `src/lib/projections/__tests__/warnings.test.ts` (new file)

```typescript
import { generateProjectionWarnings } from '../warnings';
import type { ProjectionInput } from '../types';

describe('generateProjectionWarnings', () => {
  const baseInput: ProjectionInput = {
    currentAge: 35,
    retirementAge: 65,
    maxAge: 90,
    balancesByType: { taxDeferred: 50000, taxFree: 10000, taxable: 5000 },
    annualContribution: 10000,
    contributionAllocation: { taxDeferred: 60, taxFree: 30, taxable: 10 },
    expectedReturn: 0.06,
    inflationRate: 0.025,
    contributionGrowthRate: 0,
    annualExpenses: 50000,
    annualHealthcareCosts: 6500,
    healthcareInflationRate: 0.05,
    incomeStreams: [],
    annualDebtPayments: 0,
  };

  it('should warn for high inflation (> 8%)', () => {
    const input = { ...baseInput, inflationRate: 0.10 };
    const warnings = generateProjectionWarnings(input);
    expect(warnings).toContainEqual(expect.objectContaining({
      field: 'inflationRate',
      severity: 'warning',
    }));
  });

  it('should warn for zero savings and zero contributions', () => {
    const input = {
      ...baseInput,
      balancesByType: { taxDeferred: 0, taxFree: 0, taxable: 0 },
      annualContribution: 0,
    };
    const warnings = generateProjectionWarnings(input);
    expect(warnings).toContainEqual(expect.objectContaining({
      field: 'savings',
      severity: 'warning',
    }));
  });

  it('should not warn for typical inputs', () => {
    const warnings = generateProjectionWarnings(baseInput);
    expect(warnings).toHaveLength(0);
  });
});
```

### Integration Tests

Add API route tests:

**File**: `src/app/api/projections/__tests__/calculate.test.ts`

Add test cases for age validation:
```typescript
it('should return 400 when current age >= retirement age', async () => {
  // Test with mock snapshot where birthYear makes currentAge > targetRetirementAge
});

it('should return 400 when retirement age >= max age', async () => {
  // Test with override maxAge < retirementAge
});

it('should include warnings in successful response', async () => {
  // Test with high inflation override
});
```

### Manual Testing Steps

1. **Test Invalid Age Relationships**:
   - Create a test user with birth year 1955 and target retirement age 65
   - Navigate to Plans page - should show error (current age 70 > retirement age 65)

2. **Test Warning Display**:
   - Use AssumptionsPanel to set inflation to 10%
   - Verify warning appears but projection still runs

3. **Test Edge Cases**:
   - Set all account balances to 0 and contributions to 0
   - Verify warning about zero savings appears

## References

- Story 6 Scope: `thoughts/personal/tickets/epic-3/projection-modeling/story-6-scope.md`
- Research Document: `thoughts/shared/research/2025-12-30-story-6-input-validation.md`
- Validation Schemas: `src/lib/validation/projections.ts`
- API Route: `src/app/api/projections/calculate/route.ts`
- Alert Component: `src/components/ui/alert.tsx`
