# Epic 2: Guided Onboarding (Financial Setup) Implementation Plan

## Overview

Extend the existing 4-step onboarding wizard to a comprehensive 5-step wizard that collects detailed financial data including investment accounts, assets, debts, and expenses. Add natural language input parsing via OpenAI GPT and a review/confirm screen with quick-edit capabilities.

## Current State Analysis

### Existing Implementation
- **4-step wizard** at [src/app/onboarding/page.tsx](src/app/onboarding/page.tsx) with state management via `useState`
- **Step components** in [src/components/onboarding/](src/components/onboarding/) using React Hook Form + Zod
- **Database schema** at [src/db/schema/financial-snapshot.ts](src/db/schema/financial-snapshot.ts) stores basic fields only
- **API endpoint** at [src/app/api/onboarding/complete/route.ts](src/app/api/onboarding/complete/route.ts) creates financial snapshot and default plan

### Key Discoveries
- `@radix-ui/react-dialog` is already installed ([package.json:30](package.json)) but no Dialog component exists
- OpenAI SDK is NOT installed - needs to be added for NL parsing
- Current step interface pattern: `onNext`, `onBack`, `initialData`, `isSubmitting` props
- Form data accumulates in parent state and passes down as `initialData`

## Desired End State

After implementation:
1. **5-step onboarding wizard** collecting: Basics, Savings & Contributions, Income & Expenses, Assets & Debts, Review & Confirm
2. **Natural language parsing** allowing users to describe their financial situation in plain text
3. **Review screen** with collapsible sections and inline quick-edit via dialog modals
4. **Database** stores investment accounts, debts, and assets as JSONB columns
5. **Generated retirement plan** uses all collected financial data

### Verification Criteria
- User can complete full 5-step wizard with all new fields
- Natural language input correctly parses financial data with confidence scores
- Review screen displays all data and allows editing any section
- Data persists correctly to database
- Existing users can still complete simplified onboarding

## What We're NOT Doing

- Partner/spouse data collection (deferred to later phase)
- Multi-currency support (USD only for MVP)
- LocalStorage persistence for resumable sessions (in-memory state is acceptable)
- Fully responsive mobile-first design (desktop primary, basic mobile support)
- Advanced expense categorization (simple essential/discretionary split only)
- Social Security integration or benefit calculations

## Implementation Approach

We'll implement incrementally in 6 phases:
1. **Schema & Types** - Add TypeScript interfaces and database columns
2. **UI Components** - Create missing Dialog and Select components
3. **New Step Components** - Build the 3 new wizard steps
4. **Review Screen** - Create summary with quick-edit
5. **Natural Language Parsing** - Add OpenAI integration
6. **Integration & Testing** - Wire everything together

---

## Phase 1: Schema & Types

### Overview
Define TypeScript interfaces for new data models and add JSONB columns to the database schema.

### Changes Required:

#### 1. Type Definitions
**File**: `src/types/onboarding.ts`
**Changes**: Add new type definitions for investment accounts, debts, and assets

```typescript
// Add to existing file after line 49

// Epic 2: Investment Account Types
export type AccountType = '401k' | 'IRA' | 'Roth_IRA' | 'Brokerage' | 'Cash' | 'Other';

export interface InvestmentAccount {
  id: string;
  label: string;
  type: AccountType;
  balance: number;
  monthlyContribution?: number;
}

export const ACCOUNT_TYPE_OPTIONS = [
  { value: '401k', label: '401(k)' },
  { value: 'IRA', label: 'Traditional IRA' },
  { value: 'Roth_IRA', label: 'Roth IRA' },
  { value: 'Brokerage', label: 'Brokerage Account' },
  { value: 'Cash', label: 'Cash/Savings' },
  { value: 'Other', label: 'Other' },
] as const;

// Epic 2: Debt Types
export type DebtType = 'Mortgage' | 'StudentLoan' | 'CreditCard' | 'AutoLoan' | 'Other';

export interface Debt {
  id: string;
  label: string;
  type: DebtType;
  balance: number;
  interestRate?: number;
}

export const DEBT_TYPE_OPTIONS = [
  { value: 'Mortgage', label: 'Mortgage' },
  { value: 'StudentLoan', label: 'Student Loan' },
  { value: 'CreditCard', label: 'Credit Card' },
  { value: 'AutoLoan', label: 'Auto Loan' },
  { value: 'Other', label: 'Other Debt' },
] as const;

// Epic 2: Primary Residence
export interface PrimaryResidence {
  estimatedValue?: number;
  mortgageBalance?: number;
  interestRate?: number;
}

// Epic 2: Income & Expenses
export interface IncomeExpenses {
  monthlyEssential?: number;
  monthlyDiscretionary?: number;
}

// Epic 2: New Step Data Interfaces
export interface OnboardingStep2SavingsData {
  investmentAccounts: InvestmentAccount[];
}

export interface OnboardingStep3IncomeExpensesData {
  incomeExpenses?: IncomeExpenses;
}

export interface OnboardingStep4AssetsDebtsData {
  primaryResidence?: PrimaryResidence;
  debts: Debt[];
}

// Epic 2: Extended Complete Data (replaces existing CompleteOnboardingData)
export interface CompleteOnboardingDataV2
  extends OnboardingStep1Data,
    OnboardingStep2Data,
    OnboardingStep3Data,
    OnboardingStep4Data,
    OnboardingStep2SavingsData,
    OnboardingStep3IncomeExpensesData,
    OnboardingStep4AssetsDebtsData {}
```

#### 2. Zod Validation Schemas
**File**: `src/lib/validation/onboarding.ts`
**Changes**: Add validation schemas for new step data

```typescript
// Add after existing schemas (after line 33)

// Epic 2: Investment Account Schema
export const investmentAccountSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1, 'Account name is required'),
  type: z.enum(['401k', 'IRA', 'Roth_IRA', 'Brokerage', 'Cash', 'Other']),
  balance: z.number().min(0, 'Balance cannot be negative'),
  monthlyContribution: z.number().min(0).optional(),
});

export const step2SavingsSchema = z.object({
  investmentAccounts: z
    .array(investmentAccountSchema)
    .min(1, 'At least one investment account is required'),
});

// Epic 2: Income & Expenses Schema
export const incomeExpensesSchema = z.object({
  monthlyEssential: z.number().min(0).max(1000000).optional(),
  monthlyDiscretionary: z.number().min(0).max(1000000).optional(),
});

export const step3IncomeExpensesSchema = z.object({
  incomeExpenses: incomeExpensesSchema.optional(),
});

// Epic 2: Debt Schema
export const debtSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1, 'Debt name is required'),
  type: z.enum(['Mortgage', 'StudentLoan', 'CreditCard', 'AutoLoan', 'Other']),
  balance: z.number().min(0, 'Balance cannot be negative'),
  interestRate: z.number().min(0).max(100).optional(),
});

// Epic 2: Primary Residence Schema
export const primaryResidenceSchema = z.object({
  estimatedValue: z.number().min(0).max(100000000).optional(),
  mortgageBalance: z.number().min(0).max(100000000).optional(),
  interestRate: z.number().min(0).max(30).optional(),
});

export const step4AssetsDebtsSchema = z.object({
  primaryResidence: primaryResidenceSchema.optional(),
  debts: z.array(debtSchema).default([]),
});

// Epic 2: Complete Schema V2
export const completeOnboardingSchemaV2 = step1Schema
  .merge(step2Schema)
  .merge(step3Schema)
  .merge(step4Schema)
  .merge(step2SavingsSchema)
  .merge(step3IncomeExpensesSchema)
  .merge(step4AssetsDebtsSchema);
```

#### 3. Database Schema Updates
**File**: `src/db/schema/financial-snapshot.ts`
**Changes**: Add JSONB columns for investment accounts, debts, and income/expenses

```typescript
import {
  pgTable,
  uuid,
  integer,
  numeric,
  text,
  timestamp,
  jsonb,
} from 'drizzle-orm/pg-core';
import { userProfile } from './user-profile';

// Type definitions for JSONB columns
export type InvestmentAccountJson = {
  id: string;
  label: string;
  type: string;
  balance: number;
  monthlyContribution?: number;
};

export type DebtJson = {
  id: string;
  label: string;
  type: string;
  balance: number;
  interestRate?: number;
};

export type PrimaryResidenceJson = {
  estimatedValue?: number;
  mortgageBalance?: number;
  interestRate?: number;
};

export type IncomeExpensesJson = {
  monthlyEssential?: number;
  monthlyDiscretionary?: number;
};

export const financialSnapshot = pgTable('financial_snapshot', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => userProfile.id, { onDelete: 'cascade' }),

  // Financial data from onboarding (existing)
  birthYear: integer('birth_year').notNull(),
  targetRetirementAge: integer('target_retirement_age').notNull(),
  filingStatus: text('filing_status').notNull(),
  annualIncome: numeric('annual_income', { precision: 12, scale: 2 }).notNull(),
  savingsRate: numeric('savings_rate', { precision: 5, scale: 2 }).notNull(),
  riskTolerance: text('risk_tolerance').notNull(),

  // Epic 2: New JSONB columns
  investmentAccounts: jsonb('investment_accounts').$type<InvestmentAccountJson[]>(),
  primaryResidence: jsonb('primary_residence').$type<PrimaryResidenceJson>(),
  debts: jsonb('debts').$type<DebtJson[]>(),
  incomeExpenses: jsonb('income_expenses').$type<IncomeExpensesJson>(),

  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});
```

#### 4. Generate and Run Migration
Run the following commands to generate and apply the migration:

```bash
npm run db:generate
npm run db:migrate
```

### Success Criteria:

#### Automated Verification:
- [x] TypeScript compiles without errors: `npm run typecheck`
- [x] Linting passes: `npm run lint`
- [x] Migration generates successfully: `npm run db:generate`
- [ ] Migration applies cleanly: `npm run db:migrate`
- [x] Existing tests still pass: `npm test -- --run`

#### Manual Verification:
- [ ] Database has new columns: `investment_accounts`, `primary_residence`, `debts`, `income_expenses`
- [ ] Columns accept valid JSONB data

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation before proceeding to Phase 2.

---

## Phase 2: UI Components

### Overview
Create missing Dialog and Select shadcn/ui components needed for the wizard.

### Changes Required:

#### 1. Dialog Component
**File**: `src/components/ui/dialog.tsx` (new file)
**Changes**: Create Dialog component using Radix UI (already installed)

```typescript
'use client';

import * as React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

const Dialog = DialogPrimitive.Root;
const DialogTrigger = DialogPrimitive.Trigger;
const DialogPortal = DialogPrimitive.Portal;
const DialogClose = DialogPrimitive.Close;

const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      'fixed inset-0 z-50 bg-black/80 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
      className
    )}
    {...props}
  />
));
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName;

const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, children, ...props }, ref) => (
  <DialogPortal>
    <DialogOverlay />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        'fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border bg-background p-6 shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] sm:rounded-lg',
        className
      )}
      {...props}
    >
      {children}
      <DialogPrimitive.Close className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground">
        <X className="h-4 w-4" />
        <span className="sr-only">Close</span>
      </DialogPrimitive.Close>
    </DialogPrimitive.Content>
  </DialogPortal>
));
DialogContent.displayName = DialogPrimitive.Content.displayName;

const DialogHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      'flex flex-col space-y-1.5 text-center sm:text-left',
      className
    )}
    {...props}
  />
);
DialogHeader.displayName = 'DialogHeader';

const DialogFooter = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      'flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2',
      className
    )}
    {...props}
  />
);
DialogFooter.displayName = 'DialogFooter';

const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn(
      'text-lg font-semibold leading-none tracking-tight',
      className
    )}
    {...props}
  />
));
DialogTitle.displayName = DialogPrimitive.Title.displayName;

const DialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn('text-sm text-muted-foreground', className)}
    {...props}
  />
));
DialogDescription.displayName = DialogPrimitive.Description.displayName;

export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogClose,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
};
```

#### 2. Select Component
**File**: `src/components/ui/select.tsx` (new file)
**Changes**: Create a simple Select component (native HTML select styled with Tailwind)

```typescript
'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

export interface SelectProps
  extends React.SelectHTMLAttributes<HTMLSelectElement> {
  options: { value: string; label: string }[];
  placeholder?: string;
}

const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, options, placeholder, ...props }, ref) => {
    return (
      <select
        className={cn(
          'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
          className
        )}
        ref={ref}
        {...props}
      >
        {placeholder && (
          <option value="" disabled>
            {placeholder}
          </option>
        )}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    );
  }
);
Select.displayName = 'Select';

export { Select };
```

#### 3. Collapsible Component
**File**: `src/components/ui/collapsible.tsx` (new file)
**Changes**: Create simple collapsible/accordion component for review screen

```typescript
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
}

export function Collapsible({
  title,
  defaultOpen = true,
  children,
  className,
  onEdit,
}: CollapsibleProps) {
  const [isOpen, setIsOpen] = React.useState(defaultOpen);

  return (
    <div className={cn('border rounded-lg', className)}>
      <div
        className="flex items-center justify-between p-4 cursor-pointer"
        onClick={() => setIsOpen(!isOpen)}
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
              className="text-sm text-primary hover:underline"
            >
              Edit
            </button>
          )}
          <ChevronDown
            className={cn(
              'h-4 w-4 transition-transform',
              isOpen && 'rotate-180'
            )}
          />
        </div>
      </div>
      {isOpen && <div className="px-4 pb-4">{children}</div>}
    </div>
  );
}
```

### Success Criteria:

#### Automated Verification:
- [x] TypeScript compiles without errors: `npm run typecheck`
- [x] Linting passes: `npm run lint`
- [x] Build succeeds: `npm run build`

#### Manual Verification:
- [ ] Dialog component renders and closes correctly
- [ ] Select component displays options and captures selection
- [ ] Collapsible component expands/collapses with smooth animation

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation before proceeding to Phase 3.

---

## Phase 3: New Step Components

### Overview
Create the three new wizard step components for collecting detailed financial data.

### Changes Required:

#### 1. Step 2B: Savings & Contributions
**File**: `src/components/onboarding/step2b-savings-contributions.tsx` (new file)
**Changes**: Create dynamic form for investment accounts with add/remove capability

```typescript
'use client';

import { useForm, useFieldArray, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { step2SavingsSchema } from '@/lib/validation/onboarding';
import {
  ACCOUNT_TYPE_OPTIONS,
  type OnboardingStep2SavingsData,
} from '@/types/onboarding';

interface Step2bProps {
  onNext: (data: OnboardingStep2SavingsData) => void;
  onBack: () => void;
  initialData?: Partial<OnboardingStep2SavingsData>;
}

export function Step2bSavingsContributions({
  onNext,
  onBack,
  initialData,
}: Step2bProps) {
  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<OnboardingStep2SavingsData>({
    resolver: zodResolver(step2SavingsSchema),
    defaultValues: {
      investmentAccounts: initialData?.investmentAccounts || [
        {
          id: crypto.randomUUID(),
          label: '',
          type: '401k',
          balance: 0,
          monthlyContribution: 0,
        },
      ],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'investmentAccounts',
  });

  const addAccount = () => {
    append({
      id: crypto.randomUUID(),
      label: '',
      type: '401k',
      balance: 0,
      monthlyContribution: 0,
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Savings & Contributions</CardTitle>
        <CardDescription>
          Tell us about your retirement and investment accounts
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onNext)} className="space-y-6">
          {fields.map((field, index) => (
            <div
              key={field.id}
              className="space-y-4 p-4 border rounded-lg relative"
            >
              {fields.length > 1 && (
                <button
                  type="button"
                  onClick={() => remove(index)}
                  className="absolute top-2 right-2 text-gray-400 hover:text-red-500"
                  aria-label="Remove account"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor={`investmentAccounts.${index}.label`}>
                    Account Name
                  </Label>
                  <Input
                    id={`investmentAccounts.${index}.label`}
                    placeholder="e.g., Company 401(k)"
                    {...register(`investmentAccounts.${index}.label`)}
                  />
                  {errors.investmentAccounts?.[index]?.label && (
                    <p className="text-sm text-red-500">
                      {errors.investmentAccounts[index]?.label?.message}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor={`investmentAccounts.${index}.type`}>
                    Account Type
                  </Label>
                  <Controller
                    name={`investmentAccounts.${index}.type`}
                    control={control}
                    render={({ field }) => (
                      <Select
                        options={[...ACCOUNT_TYPE_OPTIONS]}
                        value={field.value}
                        onChange={(e) => field.onChange(e.target.value)}
                      />
                    )}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor={`investmentAccounts.${index}.balance`}>
                    Current Balance ($)
                  </Label>
                  <Input
                    id={`investmentAccounts.${index}.balance`}
                    type="number"
                    placeholder="0"
                    {...register(`investmentAccounts.${index}.balance`, {
                      valueAsNumber: true,
                    })}
                  />
                  {errors.investmentAccounts?.[index]?.balance && (
                    <p className="text-sm text-red-500">
                      {errors.investmentAccounts[index]?.balance?.message}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label
                    htmlFor={`investmentAccounts.${index}.monthlyContribution`}
                  >
                    Monthly Contribution ($)
                  </Label>
                  <Input
                    id={`investmentAccounts.${index}.monthlyContribution`}
                    type="number"
                    placeholder="0"
                    {...register(
                      `investmentAccounts.${index}.monthlyContribution`,
                      { valueAsNumber: true }
                    )}
                  />
                </div>
              </div>
            </div>
          ))}

          {errors.investmentAccounts?.message && (
            <p className="text-sm text-red-500">
              {errors.investmentAccounts.message}
            </p>
          )}

          <Button
            type="button"
            variant="outline"
            onClick={addAccount}
            className="w-full"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Another Account
          </Button>

          <div className="flex gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={onBack}
              className="flex-1"
            >
              Back
            </Button>
            <Button type="submit" className="flex-1">
              Continue
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
```

#### 2. Step 3B: Income & Expenses (Optional)
**File**: `src/components/onboarding/step3b-income-expenses.tsx` (new file)
**Changes**: Create form for monthly expenses with skip option

```typescript
'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { step3IncomeExpensesSchema } from '@/lib/validation/onboarding';
import type { OnboardingStep3IncomeExpensesData } from '@/types/onboarding';

interface Step3bProps {
  onNext: (data: OnboardingStep3IncomeExpensesData) => void;
  onBack: () => void;
  initialData?: Partial<OnboardingStep3IncomeExpensesData>;
}

export function Step3bIncomeExpenses({
  onNext,
  onBack,
  initialData,
}: Step3bProps) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<OnboardingStep3IncomeExpensesData>({
    resolver: zodResolver(step3IncomeExpensesSchema),
    defaultValues: initialData,
  });

  const handleSkip = () => {
    onNext({ incomeExpenses: undefined });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Monthly Expenses</CardTitle>
        <CardDescription>
          Help us understand your spending (optional - you can skip this step)
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onNext)} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="monthlyEssential">
              Monthly Essential Expenses ($)
            </Label>
            <Input
              id="monthlyEssential"
              type="number"
              placeholder="e.g., 3000 (rent, utilities, food, insurance)"
              {...register('incomeExpenses.monthlyEssential', {
                valueAsNumber: true,
              })}
            />
            {errors.incomeExpenses?.monthlyEssential && (
              <p className="text-sm text-red-500">
                {errors.incomeExpenses.monthlyEssential.message}
              </p>
            )}
            <p className="text-sm text-gray-600">
              Include rent/mortgage, utilities, groceries, insurance, minimum
              debt payments
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="monthlyDiscretionary">
              Monthly Discretionary Expenses ($)
            </Label>
            <Input
              id="monthlyDiscretionary"
              type="number"
              placeholder="e.g., 1000 (dining, entertainment, travel)"
              {...register('incomeExpenses.monthlyDiscretionary', {
                valueAsNumber: true,
              })}
            />
            {errors.incomeExpenses?.monthlyDiscretionary && (
              <p className="text-sm text-red-500">
                {errors.incomeExpenses.monthlyDiscretionary.message}
              </p>
            )}
            <p className="text-sm text-gray-600">
              Include dining out, entertainment, subscriptions, travel,
              hobbies
            </p>
          </div>

          <div className="flex gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={onBack}
              className="flex-1"
            >
              Back
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={handleSkip}
              className="flex-1"
            >
              Skip
            </Button>
            <Button type="submit" className="flex-1">
              Continue
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
```

#### 3. Step 4B: Assets & Debts
**File**: `src/components/onboarding/step4b-assets-debts.tsx` (new file)
**Changes**: Create form for home equity and debts with dynamic debt list

```typescript
'use client';

import { useForm, useFieldArray, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { step4AssetsDebtsSchema } from '@/lib/validation/onboarding';
import {
  DEBT_TYPE_OPTIONS,
  type OnboardingStep4AssetsDebtsData,
} from '@/types/onboarding';

interface Step4bProps {
  onNext: (data: OnboardingStep4AssetsDebtsData) => void;
  onBack: () => void;
  initialData?: Partial<OnboardingStep4AssetsDebtsData>;
}

export function Step4bAssetsDebts({
  onNext,
  onBack,
  initialData,
}: Step4bProps) {
  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<OnboardingStep4AssetsDebtsData>({
    resolver: zodResolver(step4AssetsDebtsSchema),
    defaultValues: {
      primaryResidence: initialData?.primaryResidence || {},
      debts: initialData?.debts || [],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'debts',
  });

  const addDebt = () => {
    append({
      id: crypto.randomUUID(),
      label: '',
      type: 'CreditCard',
      balance: 0,
      interestRate: undefined,
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Assets & Debts</CardTitle>
        <CardDescription>
          Tell us about your home and any outstanding debts
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onNext)} className="space-y-6">
          {/* Primary Residence Section */}
          <div className="space-y-4">
            <h3 className="font-medium">Primary Residence (Optional)</h3>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="estimatedValue">Home Value ($)</Label>
                <Input
                  id="estimatedValue"
                  type="number"
                  placeholder="e.g., 500000"
                  {...register('primaryResidence.estimatedValue', {
                    valueAsNumber: true,
                  })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="mortgageBalance">Mortgage Balance ($)</Label>
                <Input
                  id="mortgageBalance"
                  type="number"
                  placeholder="e.g., 350000"
                  {...register('primaryResidence.mortgageBalance', {
                    valueAsNumber: true,
                  })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="mortgageRate">Interest Rate (%)</Label>
                <Input
                  id="mortgageRate"
                  type="number"
                  step="0.1"
                  placeholder="e.g., 6.5"
                  {...register('primaryResidence.interestRate', {
                    valueAsNumber: true,
                  })}
                />
              </div>
            </div>
          </div>

          {/* Debts Section */}
          <div className="space-y-4">
            <h3 className="font-medium">Other Debts</h3>

            {fields.map((field, index) => (
              <div
                key={field.id}
                className="space-y-4 p-4 border rounded-lg relative"
              >
                <button
                  type="button"
                  onClick={() => remove(index)}
                  className="absolute top-2 right-2 text-gray-400 hover:text-red-500"
                  aria-label="Remove debt"
                >
                  <Trash2 className="h-4 w-4" />
                </button>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor={`debts.${index}.label`}>Description</Label>
                    <Input
                      id={`debts.${index}.label`}
                      placeholder="e.g., Student Loans"
                      {...register(`debts.${index}.label`)}
                    />
                    {errors.debts?.[index]?.label && (
                      <p className="text-sm text-red-500">
                        {errors.debts[index]?.label?.message}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor={`debts.${index}.type`}>Type</Label>
                    <Controller
                      name={`debts.${index}.type`}
                      control={control}
                      render={({ field }) => (
                        <Select
                          options={[...DEBT_TYPE_OPTIONS]}
                          value={field.value}
                          onChange={(e) => field.onChange(e.target.value)}
                        />
                      )}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor={`debts.${index}.balance`}>
                      Balance ($)
                    </Label>
                    <Input
                      id={`debts.${index}.balance`}
                      type="number"
                      placeholder="0"
                      {...register(`debts.${index}.balance`, {
                        valueAsNumber: true,
                      })}
                    />
                    {errors.debts?.[index]?.balance && (
                      <p className="text-sm text-red-500">
                        {errors.debts[index]?.balance?.message}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor={`debts.${index}.interestRate`}>
                      Interest Rate (%)
                    </Label>
                    <Input
                      id={`debts.${index}.interestRate`}
                      type="number"
                      step="0.1"
                      placeholder="e.g., 18.5"
                      {...register(`debts.${index}.interestRate`, {
                        valueAsNumber: true,
                      })}
                    />
                  </div>
                </div>
              </div>
            ))}

            <Button
              type="button"
              variant="outline"
              onClick={addDebt}
              className="w-full"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Debt
            </Button>
          </div>

          <div className="flex gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={onBack}
              className="flex-1"
            >
              Back
            </Button>
            <Button type="submit" className="flex-1">
              Continue
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
```

#### 4. Export New Components
**File**: `src/components/onboarding/index.ts`
**Changes**: Add exports for new step components

```typescript
// Add to existing exports
export { Step2bSavingsContributions } from './step2b-savings-contributions';
export { Step3bIncomeExpenses } from './step3b-income-expenses';
export { Step4bAssetsDebts } from './step4b-assets-debts';
```

### Success Criteria:

#### Automated Verification:
- [ ] TypeScript compiles without errors: `npm run typecheck`
- [ ] Linting passes: `npm run lint`
- [ ] Build succeeds: `npm run build`

#### Manual Verification:
- [ ] Step 2B: Can add/remove investment accounts, form validates correctly
- [ ] Step 3B: Can enter expenses or skip the step
- [ ] Step 4B: Can enter home details and add/remove debts
- [ ] All forms show validation errors appropriately

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation before proceeding to Phase 4.

---

## Phase 4: Review Screen

### Overview
Create the Step 5 review/confirm screen with collapsible sections and quick-edit dialogs.

### Changes Required:

#### 1. Review Screen Component
**File**: `src/components/onboarding/step5-review.tsx` (new file)
**Changes**: Create comprehensive review screen with edit capability

```typescript
'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Collapsible } from '@/components/ui/collapsible';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { CompleteOnboardingDataV2 } from '@/types/onboarding';

// Import individual step components for editing
import { Step1PersonalInfo } from './step1-personal-info';
import { Step2RetirementInfo } from './step2-retirement-info';
import { Step3FinancialInfo } from './step3-financial-info';
import { Step4RiskTolerance } from './step4-risk-tolerance';
import { Step2bSavingsContributions } from './step2b-savings-contributions';
import { Step3bIncomeExpenses } from './step3b-income-expenses';
import { Step4bAssetsDebts } from './step4b-assets-debts';

interface Step5Props {
  onSubmit: () => void;
  onBack: () => void;
  formData: Partial<CompleteOnboardingDataV2>;
  onUpdateData: (data: Partial<CompleteOnboardingDataV2>) => void;
  isSubmitting: boolean;
}

type EditSection =
  | 'basics'
  | 'retirement'
  | 'income'
  | 'risk'
  | 'savings'
  | 'expenses'
  | 'assets'
  | null;

export function Step5Review({
  onSubmit,
  onBack,
  formData,
  onUpdateData,
  isSubmitting,
}: Step5Props) {
  const [editSection, setEditSection] = useState<EditSection>(null);

  const formatCurrency = (value?: number) => {
    if (value === undefined || value === null) return 'Not provided';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatPercent = (value?: number) => {
    if (value === undefined || value === null) return 'Not provided';
    return `${value}%`;
  };

  const currentYear = new Date().getFullYear();
  const currentAge = formData.birthYear
    ? currentYear - formData.birthYear
    : undefined;

  const handleEditClose = () => setEditSection(null);

  const handleEditSave = (data: Partial<CompleteOnboardingDataV2>) => {
    onUpdateData(data);
    setEditSection(null);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Review Your Information</CardTitle>
        <CardDescription>
          Please review your financial profile before generating your
          retirement plan
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Basics Section */}
        <Collapsible
          title="Basics"
          onEdit={() => setEditSection('basics')}
        >
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-gray-600">Current Age</dt>
              <dd className="font-medium">{currentAge || 'Not provided'}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-600">Target Retirement Age</dt>
              <dd className="font-medium">
                {formData.targetRetirementAge || 'Not provided'}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-600">Filing Status</dt>
              <dd className="font-medium capitalize">
                {formData.filingStatus?.replace('_', ' ') || 'Not provided'}
              </dd>
            </div>
          </dl>
        </Collapsible>

        {/* Income Section */}
        <Collapsible
          title="Income & Savings Rate"
          onEdit={() => setEditSection('income')}
        >
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-gray-600">Annual Income</dt>
              <dd className="font-medium">
                {formatCurrency(formData.annualIncome)}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-600">Savings Rate</dt>
              <dd className="font-medium">
                {formatPercent(formData.savingsRate)}
              </dd>
            </div>
          </dl>
        </Collapsible>

        {/* Investment Accounts Section */}
        <Collapsible
          title="Investment Accounts"
          onEdit={() => setEditSection('savings')}
        >
          {formData.investmentAccounts && formData.investmentAccounts.length > 0 ? (
            <div className="space-y-3">
              {formData.investmentAccounts.map((account) => (
                <div
                  key={account.id}
                  className="flex justify-between items-center text-sm border-b pb-2 last:border-0"
                >
                  <div>
                    <p className="font-medium">{account.label}</p>
                    <p className="text-gray-500 text-xs">
                      {account.type} • {formatCurrency(account.monthlyContribution)}/mo
                    </p>
                  </div>
                  <span className="font-medium">
                    {formatCurrency(account.balance)}
                  </span>
                </div>
              ))}
              <div className="flex justify-between pt-2 font-medium">
                <span>Total</span>
                <span>
                  {formatCurrency(
                    formData.investmentAccounts.reduce(
                      (sum, a) => sum + a.balance,
                      0
                    )
                  )}
                </span>
              </div>
            </div>
          ) : (
            <p className="text-gray-500 text-sm">No accounts added</p>
          )}
        </Collapsible>

        {/* Monthly Expenses Section */}
        <Collapsible
          title="Monthly Expenses"
          onEdit={() => setEditSection('expenses')}
        >
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-gray-600">Essential Expenses</dt>
              <dd className="font-medium">
                {formatCurrency(formData.incomeExpenses?.monthlyEssential)}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-600">Discretionary Expenses</dt>
              <dd className="font-medium">
                {formatCurrency(formData.incomeExpenses?.monthlyDiscretionary)}
              </dd>
            </div>
          </dl>
        </Collapsible>

        {/* Assets & Debts Section */}
        <Collapsible
          title="Assets & Debts"
          onEdit={() => setEditSection('assets')}
        >
          <div className="space-y-4 text-sm">
            {formData.primaryResidence?.estimatedValue && (
              <div>
                <h4 className="font-medium mb-2">Primary Residence</h4>
                <dl className="space-y-1 pl-4">
                  <div className="flex justify-between">
                    <dt className="text-gray-600">Home Value</dt>
                    <dd>{formatCurrency(formData.primaryResidence.estimatedValue)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-gray-600">Mortgage Balance</dt>
                    <dd>{formatCurrency(formData.primaryResidence.mortgageBalance)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-gray-600">Interest Rate</dt>
                    <dd>{formatPercent(formData.primaryResidence.interestRate)}</dd>
                  </div>
                </dl>
              </div>
            )}

            {formData.debts && formData.debts.length > 0 && (
              <div>
                <h4 className="font-medium mb-2">Debts</h4>
                {formData.debts.map((debt) => (
                  <div
                    key={debt.id}
                    className="flex justify-between items-center pl-4 border-b pb-2 last:border-0"
                  >
                    <div>
                      <p>{debt.label}</p>
                      <p className="text-gray-500 text-xs">
                        {debt.type} • {formatPercent(debt.interestRate)} APR
                      </p>
                    </div>
                    <span className="font-medium text-red-600">
                      {formatCurrency(debt.balance)}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {!formData.primaryResidence?.estimatedValue &&
              (!formData.debts || formData.debts.length === 0) && (
                <p className="text-gray-500">No assets or debts recorded</p>
              )}
          </div>
        </Collapsible>

        {/* Risk Tolerance Section */}
        <Collapsible
          title="Risk Tolerance"
          onEdit={() => setEditSection('risk')}
        >
          <p className="text-sm capitalize">
            {formData.riskTolerance || 'Not provided'}
          </p>
        </Collapsible>

        {/* Action Buttons */}
        <div className="flex gap-3 pt-4">
          <Button
            type="button"
            variant="outline"
            onClick={onBack}
            className="flex-1"
            disabled={isSubmitting}
          >
            Back
          </Button>
          <Button
            type="button"
            onClick={onSubmit}
            className="flex-1"
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Generating Plan...' : 'Generate My Plan'}
          </Button>
        </div>
      </CardContent>

      {/* Edit Dialogs */}
      <Dialog open={editSection === 'basics'} onOpenChange={handleEditClose}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Basic Information</DialogTitle>
          </DialogHeader>
          <Step1PersonalInfo
            onNext={(data) => handleEditSave(data)}
            initialData={formData}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={editSection === 'retirement'} onOpenChange={handleEditClose}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Retirement Goals</DialogTitle>
          </DialogHeader>
          <Step2RetirementInfo
            onNext={(data) => handleEditSave(data)}
            onBack={handleEditClose}
            initialData={formData}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={editSection === 'income'} onOpenChange={handleEditClose}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Income & Savings</DialogTitle>
          </DialogHeader>
          <Step3FinancialInfo
            onNext={(data) => handleEditSave(data)}
            onBack={handleEditClose}
            initialData={formData}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={editSection === 'risk'} onOpenChange={handleEditClose}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Risk Tolerance</DialogTitle>
          </DialogHeader>
          <Step4RiskTolerance
            onNext={(data) => handleEditSave(data)}
            onBack={handleEditClose}
            initialData={formData}
            isSubmitting={false}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={editSection === 'savings'} onOpenChange={handleEditClose}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Investment Accounts</DialogTitle>
          </DialogHeader>
          <Step2bSavingsContributions
            onNext={(data) => handleEditSave(data)}
            onBack={handleEditClose}
            initialData={formData}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={editSection === 'expenses'} onOpenChange={handleEditClose}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Monthly Expenses</DialogTitle>
          </DialogHeader>
          <Step3bIncomeExpenses
            onNext={(data) => handleEditSave(data)}
            onBack={handleEditClose}
            initialData={formData}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={editSection === 'assets'} onOpenChange={handleEditClose}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Assets & Debts</DialogTitle>
          </DialogHeader>
          <Step4bAssetsDebts
            onNext={(data) => handleEditSave(data)}
            onBack={handleEditClose}
            initialData={formData}
          />
        </DialogContent>
      </Dialog>
    </Card>
  );
}
```

#### 2. Export Review Component
**File**: `src/components/onboarding/index.ts`
**Changes**: Add export for review component

```typescript
export { Step5Review } from './step5-review';
```

### Success Criteria:

#### Automated Verification:
- [ ] TypeScript compiles without errors: `npm run typecheck`
- [ ] Linting passes: `npm run lint`
- [ ] Build succeeds: `npm run build`

#### Manual Verification:
- [ ] Review screen displays all collected data in collapsible sections
- [ ] Edit buttons open dialog modals with correct pre-filled data
- [ ] Saving edits updates the review display
- [ ] Generate Plan button shows loading state

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation before proceeding to Phase 5.

---

## Phase 5: Natural Language Parsing

### Overview
Add OpenAI integration for parsing natural language financial descriptions into structured data.

### Changes Required:

#### 1. Install OpenAI SDK
Run the following command:

```bash
npm install openai
```

#### 2. Environment Variable
**File**: `.env.local`
**Changes**: Add OpenAI API key (user must provide their own key)

```bash
OPENAI_API_KEY=sk-your-api-key-here
```

#### 3. NL Parsing API Endpoint
**File**: `src/app/api/parse-financial-nl/route.ts` (new file)
**Changes**: Create endpoint for GPT-powered financial data extraction

```typescript
import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { getServerUser } from '@/lib/auth/server';

const EXTRACTION_PROMPT = `You are a financial data extraction assistant. Extract structured financial information from the user's natural language input.

Return a JSON object with the following structure (include only fields that are mentioned):
{
  "birthYear": number | null,
  "targetRetirementAge": number | null,
  "annualIncome": number | null,
  "savingsRate": number | null,
  "investmentAccounts": [
    {
      "label": string,
      "type": "401k" | "IRA" | "Roth_IRA" | "Brokerage" | "Cash" | "Other",
      "balance": number,
      "monthlyContribution": number | null
    }
  ] | null,
  "primaryResidence": {
    "estimatedValue": number | null,
    "mortgageBalance": number | null,
    "interestRate": number | null
  } | null,
  "debts": [
    {
      "label": string,
      "type": "Mortgage" | "StudentLoan" | "CreditCard" | "AutoLoan" | "Other",
      "balance": number,
      "interestRate": number | null
    }
  ] | null,
  "incomeExpenses": {
    "monthlyEssential": number | null,
    "monthlyDiscretionary": number | null
  } | null,
  "confidence": {
    "overall": number,
    "fields": { [key: string]: number }
  }
}

Rules:
- Convert ages to birth years (current year is ${new Date().getFullYear()})
- Convert "k" notation to actual numbers (e.g., "300k" = 300000)
- Convert percentages to decimal where appropriate
- Infer account types from context (e.g., "retirement savings" likely means 401k or IRA)
- confidence scores should be 0-1 (1 = very confident, 0.5 = uncertain)
- Only include fields that are explicitly or strongly implied in the input`;

export async function POST(request: NextRequest) {
  try {
    // Verify authentication
    const user = await getServerUser();
    if (!user) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const { text } = await request.json();

    if (!text || typeof text !== 'string') {
      return NextResponse.json(
        { message: 'Text input is required' },
        { status: 400 }
      );
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { message: 'OpenAI API key not configured' },
        { status: 500 }
      );
    }

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: EXTRACTION_PROMPT },
        { role: 'user', content: text },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.1,
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      return NextResponse.json(
        { message: 'Failed to parse response' },
        { status: 500 }
      );
    }

    const parsed = JSON.parse(content);

    return NextResponse.json({
      success: true,
      data: parsed,
    });
  } catch (error) {
    console.error('NL parsing error:', error);
    return NextResponse.json(
      { message: 'Failed to parse financial data' },
      { status: 500 }
    );
  }
}
```

#### 4. Smart Intake Component
**File**: `src/components/onboarding/smart-intake.tsx` (new file)
**Changes**: Create UI component for natural language input

```typescript
'use client';

import { useState } from 'react';
import { Sparkles, Loader2, Check, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import type { CompleteOnboardingDataV2 } from '@/types/onboarding';

interface SmartIntakeProps {
  onApply: (data: Partial<CompleteOnboardingDataV2>) => void;
  onSkip: () => void;
}

interface ParsedField {
  key: string;
  label: string;
  value: string | number;
  confidence: number;
}

export function SmartIntake({ onApply, onSkip }: SmartIntakeProps) {
  const [text, setText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [parsedData, setParsedData] = useState<{
    data: Partial<CompleteOnboardingDataV2>;
    fields: ParsedField[];
  } | null>(null);

  const handleParse = async () => {
    if (!text.trim()) return;

    setIsLoading(true);
    setError(null);
    setParsedData(null);

    try {
      const response = await fetch('/api/parse-financial-nl', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });

      if (!response.ok) {
        throw new Error('Failed to parse input');
      }

      const result = await response.json();
      const data = result.data;

      // Convert to display-friendly format
      const fields: ParsedField[] = [];
      const confidenceScores = data.confidence?.fields || {};

      if (data.birthYear) {
        const age = new Date().getFullYear() - data.birthYear;
        fields.push({
          key: 'birthYear',
          label: 'Age',
          value: age,
          confidence: confidenceScores.birthYear || data.confidence?.overall || 0.8,
        });
      }

      if (data.targetRetirementAge) {
        fields.push({
          key: 'targetRetirementAge',
          label: 'Target Retirement Age',
          value: data.targetRetirementAge,
          confidence: confidenceScores.targetRetirementAge || data.confidence?.overall || 0.8,
        });
      }

      if (data.annualIncome) {
        fields.push({
          key: 'annualIncome',
          label: 'Annual Income',
          value: `$${data.annualIncome.toLocaleString()}`,
          confidence: confidenceScores.annualIncome || data.confidence?.overall || 0.8,
        });
      }

      if (data.investmentAccounts?.length) {
        const total = data.investmentAccounts.reduce(
          (sum: number, a: { balance: number }) => sum + a.balance,
          0
        );
        fields.push({
          key: 'investmentAccounts',
          label: 'Investment Accounts',
          value: `${data.investmentAccounts.length} account(s) totaling $${total.toLocaleString()}`,
          confidence: confidenceScores.investmentAccounts || data.confidence?.overall || 0.8,
        });
      }

      if (data.primaryResidence?.estimatedValue) {
        fields.push({
          key: 'primaryResidence',
          label: 'Home Value',
          value: `$${data.primaryResidence.estimatedValue.toLocaleString()}`,
          confidence: confidenceScores.primaryResidence || data.confidence?.overall || 0.8,
        });
      }

      if (data.debts?.length) {
        const total = data.debts.reduce(
          (sum: number, d: { balance: number }) => sum + d.balance,
          0
        );
        fields.push({
          key: 'debts',
          label: 'Total Debt',
          value: `$${total.toLocaleString()}`,
          confidence: confidenceScores.debts || data.confidence?.overall || 0.8,
        });
      }

      // Add IDs to investment accounts and debts
      if (data.investmentAccounts) {
        data.investmentAccounts = data.investmentAccounts.map(
          (account: { label: string; type: string; balance: number; monthlyContribution?: number }) => ({
            ...account,
            id: crypto.randomUUID(),
          })
        );
      }

      if (data.debts) {
        data.debts = data.debts.map(
          (debt: { label: string; type: string; balance: number; interestRate?: number }) => ({
            ...debt,
            id: crypto.randomUUID(),
          })
        );
      }

      setParsedData({ data, fields });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to parse input');
    } finally {
      setIsLoading(false);
    }
  };

  const handleApply = () => {
    if (parsedData) {
      onApply(parsedData.data);
    }
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return 'text-green-600';
    if (confidence >= 0.5) return 'text-yellow-600';
    return 'text-red-600';
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          Smart Intake
        </CardTitle>
        <CardDescription>
          Describe your financial situation in plain English and we&apos;ll
          extract the details automatically
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="smartInput">Your financial snapshot</Label>
          <textarea
            id="smartInput"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="e.g., I'm 45 years old with $300k in my 401k and $50k in a Roth IRA. I contribute $2k/month to retirement. My home is worth $500k with $300k left on the mortgage at 6.5%. I also have $15k in student loans."
            className="flex min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={isLoading}
          />
        </div>

        {error && (
          <div className="flex items-center gap-2 text-red-600 text-sm">
            <AlertCircle className="h-4 w-4" />
            {error}
          </div>
        )}

        {parsedData && (
          <div className="space-y-3 p-4 bg-gray-50 rounded-lg">
            <h4 className="font-medium">Detected Information:</h4>
            <ul className="space-y-2">
              {parsedData.fields.map((field) => (
                <li
                  key={field.key}
                  className="flex items-center justify-between text-sm"
                >
                  <span className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-green-600" />
                    <span className="font-medium">{field.label}:</span>
                    <span>{field.value}</span>
                  </span>
                  <span
                    className={`text-xs ${getConfidenceColor(field.confidence)}`}
                  >
                    {Math.round(field.confidence * 100)}% confident
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex gap-3">
          <Button
            type="button"
            variant="ghost"
            onClick={onSkip}
            className="flex-1"
            disabled={isLoading}
          >
            Skip & Enter Manually
          </Button>

          {!parsedData ? (
            <Button
              type="button"
              onClick={handleParse}
              className="flex-1"
              disabled={isLoading || !text.trim()}
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Analyzing...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Analyze
                </>
              )}
            </Button>
          ) : (
            <Button type="button" onClick={handleApply} className="flex-1">
              Apply & Continue
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
```

#### 5. Export Smart Intake
**File**: `src/components/onboarding/index.ts`
**Changes**: Add export for smart intake component

```typescript
export { SmartIntake } from './smart-intake';
```

### Success Criteria:

#### Automated Verification:
- [ ] OpenAI SDK installs successfully: `npm install openai`
- [ ] TypeScript compiles without errors: `npm run typecheck`
- [ ] Linting passes: `npm run lint`
- [ ] Build succeeds: `npm run build`

#### Manual Verification:
- [ ] API endpoint accepts text and returns parsed data (requires valid OpenAI key)
- [ ] Smart Intake UI displays loading state during parsing
- [ ] Parsed fields display with confidence scores
- [ ] Apply button pre-fills wizard form data
- [ ] Skip button proceeds to manual entry

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation before proceeding to Phase 6.

---

## Phase 6: Integration & Testing

### Overview
Wire up all components into the main onboarding page and update the API endpoint.

### Changes Required:

#### 1. Update Onboarding Page
**File**: `src/app/onboarding/page.tsx`
**Changes**: Integrate 7-step flow (Smart Intake + 5 original + 3 new steps collapsed)

```typescript
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Step1PersonalInfo,
  Step2RetirementInfo,
  Step3FinancialInfo,
  Step4RiskTolerance,
  Step2bSavingsContributions,
  Step3bIncomeExpenses,
  Step4bAssetsDebts,
  Step5Review,
  SmartIntake,
} from '@/components/onboarding';
import type { CompleteOnboardingDataV2 } from '@/types/onboarding';

type WizardStep =
  | 'smart-intake'
  | 'basics'
  | 'retirement'
  | 'income-savings'
  | 'savings-accounts'
  | 'expenses'
  | 'assets-debts'
  | 'risk'
  | 'review';

const STEP_ORDER: WizardStep[] = [
  'smart-intake',
  'basics',
  'retirement',
  'income-savings',
  'savings-accounts',
  'expenses',
  'assets-debts',
  'risk',
  'review',
];

const STEP_LABELS: Record<WizardStep, string> = {
  'smart-intake': 'Quick Start',
  basics: 'Basics',
  retirement: 'Retirement Goals',
  'income-savings': 'Income & Savings',
  'savings-accounts': 'Investment Accounts',
  expenses: 'Monthly Expenses',
  'assets-debts': 'Assets & Debts',
  risk: 'Risk Tolerance',
  review: 'Review',
};

export default function OnboardingPage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState<WizardStep>('smart-intake');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState<Partial<CompleteOnboardingDataV2>>(
    {}
  );

  const currentStepIndex = STEP_ORDER.indexOf(currentStep);
  const totalSteps = STEP_ORDER.length;
  const progressPercent = Math.round(
    ((currentStepIndex + 1) / totalSteps) * 100
  );

  const goToStep = (step: WizardStep) => setCurrentStep(step);
  const goNext = () => {
    const nextIndex = currentStepIndex + 1;
    if (nextIndex < totalSteps) {
      setCurrentStep(STEP_ORDER[nextIndex]);
    }
  };
  const goBack = () => {
    const prevIndex = currentStepIndex - 1;
    if (prevIndex >= 0) {
      setCurrentStep(STEP_ORDER[prevIndex]);
    }
  };

  const updateFormData = (data: Partial<CompleteOnboardingDataV2>) => {
    setFormData((prev) => ({ ...prev, ...data }));
  };

  const handleStepComplete = (data: Partial<CompleteOnboardingDataV2>) => {
    updateFormData(data);
    goNext();
  };

  const handleSmartIntakeApply = (data: Partial<CompleteOnboardingDataV2>) => {
    updateFormData(data);
    goNext();
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch('/api/onboarding/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to complete onboarding');
      }

      router.push('/plans');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen py-12">
      <div className="mx-auto max-w-2xl px-4">
        {/* Progress indicator */}
        <div className="mb-8">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-medium text-foreground">
              {STEP_LABELS[currentStep]}
            </span>
            <span className="text-sm text-muted-foreground">
              Step {currentStepIndex + 1} of {totalSteps}
            </span>
          </div>
          <div className="h-2 w-full rounded-full bg-muted">
            <div
              className="h-2 rounded-full bg-primary transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {/* Error message */}
        {error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
            {error}
          </div>
        )}

        {/* Steps */}
        {currentStep === 'smart-intake' && (
          <SmartIntake onApply={handleSmartIntakeApply} onSkip={goNext} />
        )}

        {currentStep === 'basics' && (
          <Step1PersonalInfo
            onNext={handleStepComplete}
            initialData={formData}
          />
        )}

        {currentStep === 'retirement' && (
          <Step2RetirementInfo
            onNext={handleStepComplete}
            onBack={goBack}
            initialData={formData}
          />
        )}

        {currentStep === 'income-savings' && (
          <Step3FinancialInfo
            onNext={handleStepComplete}
            onBack={goBack}
            initialData={formData}
          />
        )}

        {currentStep === 'savings-accounts' && (
          <Step2bSavingsContributions
            onNext={handleStepComplete}
            onBack={goBack}
            initialData={formData}
          />
        )}

        {currentStep === 'expenses' && (
          <Step3bIncomeExpenses
            onNext={handleStepComplete}
            onBack={goBack}
            initialData={formData}
          />
        )}

        {currentStep === 'assets-debts' && (
          <Step4bAssetsDebts
            onNext={handleStepComplete}
            onBack={goBack}
            initialData={formData}
          />
        )}

        {currentStep === 'risk' && (
          <Step4RiskTolerance
            onNext={handleStepComplete}
            onBack={goBack}
            initialData={formData}
            isSubmitting={false}
          />
        )}

        {currentStep === 'review' && (
          <Step5Review
            onSubmit={handleSubmit}
            onBack={goBack}
            formData={formData}
            onUpdateData={updateFormData}
            isSubmitting={isSubmitting}
          />
        )}
      </div>
    </div>
  );
}
```

#### 2. Update API Endpoint
**File**: `src/app/api/onboarding/complete/route.ts`
**Changes**: Handle new data fields and store in JSONB columns

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getServerUser } from '@/lib/auth/server';
import { db } from '@/db/client';
import { financialSnapshot, plans, userProfile } from '@/db/schema';
import { completeOnboardingSchemaV2 } from '@/lib/validation/onboarding';
import { eq } from 'drizzle-orm';

export async function POST(request: NextRequest) {
  try {
    // Verify authentication
    const user = await getServerUser();
    if (!user) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    // Validate onboarding data
    const body = await request.json();
    const parseResult = completeOnboardingSchemaV2.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        { message: 'Invalid data', errors: parseResult.error.flatten() },
        { status: 400 }
      );
    }

    const data = parseResult.data;

    // Create financial snapshot with new JSONB fields
    await db.insert(financialSnapshot).values({
      userId: user.id,
      birthYear: data.birthYear,
      targetRetirementAge: data.targetRetirementAge,
      filingStatus: data.filingStatus,
      annualIncome: data.annualIncome.toString(),
      savingsRate: data.savingsRate.toString(),
      riskTolerance: data.riskTolerance,
      // Epic 2: New JSONB fields
      investmentAccounts: data.investmentAccounts || [],
      primaryResidence: data.primaryResidence || null,
      debts: data.debts || [],
      incomeExpenses: data.incomeExpenses || null,
    });

    // Calculate total savings for plan config
    const totalSavings = (data.investmentAccounts || []).reduce(
      (sum, account) => sum + account.balance,
      0
    );

    const totalMonthlyContributions = (data.investmentAccounts || []).reduce(
      (sum, account) => sum + (account.monthlyContribution || 0),
      0
    );

    // Create default retirement plan with enhanced config
    await db.insert(plans).values({
      userId: user.id,
      name: 'Personal Plan v1',
      description: 'Your personalized retirement plan',
      config: {
        birthYear: data.birthYear,
        targetRetirementAge: data.targetRetirementAge,
        annualIncome: data.annualIncome,
        savingsRate: data.savingsRate,
        riskTolerance: data.riskTolerance,
        // Epic 2: Enhanced config
        totalSavings,
        totalMonthlyContributions,
        investmentAccountCount: data.investmentAccounts?.length || 0,
        hasHomeEquity: !!data.primaryResidence?.estimatedValue,
        totalDebt: (data.debts || []).reduce((sum, d) => sum + d.balance, 0),
        createdViaOnboarding: true,
        onboardingVersion: 2,
      },
    });

    // Mark onboarding as complete
    await db
      .update(userProfile)
      .set({
        onboardingCompleted: true,
        birthYear: data.birthYear.toString(),
        filingStatus: data.filingStatus,
      })
      .where(eq(userProfile.id, user.id));

    return NextResponse.json({
      message: 'Onboarding completed successfully',
    });
  } catch (error) {
    console.error('Onboarding completion error:', error);
    return NextResponse.json(
      { message: 'Failed to complete onboarding' },
      { status: 500 }
    );
  }
}
```

#### 3. Update Component Index Exports
**File**: `src/components/onboarding/index.ts`
**Changes**: Ensure all exports are present

```typescript
export { Step1PersonalInfo } from './step1-personal-info';
export { Step2RetirementInfo } from './step2-retirement-info';
export { Step3FinancialInfo } from './step3-financial-info';
export { Step4RiskTolerance } from './step4-risk-tolerance';
export { Step2bSavingsContributions } from './step2b-savings-contributions';
export { Step3bIncomeExpenses } from './step3b-income-expenses';
export { Step4bAssetsDebts } from './step4b-assets-debts';
export { Step5Review } from './step5-review';
export { SmartIntake } from './smart-intake';
```

### Success Criteria:

#### Automated Verification:
- [ ] TypeScript compiles without errors: `npm run typecheck`
- [ ] Linting passes: `npm run lint`
- [ ] Build succeeds: `npm run build`
- [ ] Existing tests still pass: `npm test -- --run`
- [ ] E2E tests pass (if applicable): `npm run test:e2e`

#### Manual Verification:
- [ ] Complete wizard flow works from start to finish
- [ ] Smart Intake pre-fills data correctly
- [ ] All steps display correct data and validation
- [ ] Review screen shows all collected information
- [ ] Quick-edit dialogs work on review screen
- [ ] Data persists correctly to database after completion
- [ ] User redirects to /plans after successful completion
- [ ] Backward navigation preserves form data

**Implementation Note**: After completing this phase and all verification passes, the Epic 2 Guided Onboarding implementation is complete.

---

## Testing Strategy

### Unit Tests

Create tests in `src/lib/validation/__tests__/onboarding.test.ts`:

1. **Validation Schema Tests**:
   - Test `investmentAccountSchema` accepts valid data
   - Test `investmentAccountSchema` rejects negative balances
   - Test `debtSchema` validates interest rate range
   - Test `step2SavingsSchema` requires at least one account
   - Test `completeOnboardingSchemaV2` merges all schemas correctly

### Integration Tests

1. **API Endpoint Tests** (`src/app/api/onboarding/complete/__tests__/route.test.ts`):
   - Test endpoint rejects unauthenticated requests
   - Test endpoint validates input data
   - Test endpoint creates financial snapshot with JSONB data
   - Test endpoint creates plan with enhanced config
   - Test endpoint marks onboarding complete

2. **NL Parsing Tests** (`src/app/api/parse-financial-nl/__tests__/route.test.ts`):
   - Test endpoint extracts age correctly
   - Test endpoint parses investment accounts
   - Test endpoint handles "k" notation
   - Test endpoint returns confidence scores

### E2E Tests

Create Playwright test in `e2e/onboarding.spec.ts`:

1. Full wizard completion flow
2. Smart intake → manual entry flow
3. Back navigation preserves data
4. Quick-edit on review screen
5. Error handling for failed submission

### Manual Testing Steps

1. Create new user account
2. Start onboarding wizard
3. Test Smart Intake with: "I'm 42 with $250k in my 401k, $50k in Roth IRA, and contribute $1500/month. Home worth $400k, mortgage $280k at 7%"
4. Verify parsed data displays correctly
5. Apply and continue through wizard
6. Add another investment account manually
7. Skip expenses step
8. Add a credit card debt
9. Complete to review screen
10. Edit retirement age via dialog
11. Submit and verify redirect to /plans
12. Check database for correct data storage

---

## Performance Considerations

1. **Form State**: Using React useState is sufficient for MVP. Consider Zustand if state complexity grows.

2. **API Calls**: Smart intake makes single OpenAI API call. Consider debouncing if implementing real-time parsing.

3. **Bundle Size**: OpenAI SDK adds ~50KB to server bundle (not client). Monitor if other AI features are added.

4. **Database**: JSONB columns are efficient for read-heavy workloads. Consider normalized tables if complex querying needed later.

---

## Migration Notes

- Existing users with completed onboarding will have `null` for new JSONB columns
- No data migration needed - new columns are nullable
- Frontend gracefully handles missing data with "Not provided" displays

---

## References

- Original scope: [thoughts/personal/tickets/epic-2/onboarding/scope.md](thoughts/personal/tickets/epic-2/onboarding/scope.md)
- Research document: [thoughts/shared/research/2025-12-05-epic-2-onboarding-wizard-implementation.md](thoughts/shared/research/2025-12-05-epic-2-onboarding-wizard-implementation.md)
- Epic 1 implementation plan: [thoughts/shared/plans/2025-11-17-epic-1-auth-onboarding-implementation.md](thoughts/shared/plans/2025-11-17-epic-1-auth-onboarding-implementation.md)
- Existing onboarding page: [src/app/onboarding/page.tsx](src/app/onboarding/page.tsx)
- Existing step components: [src/components/onboarding/](src/components/onboarding/)
