---
date: 2025-12-05T12:00:00-08:00
researcher: Claude
git_commit: fb6969abcb9aa1be7c5b2253836501bfb394d7c7
branch: main
repository: plan-smart
topic: "Epic 2 Guided Onboarding (Financial Setup) Implementation Research"
tags: [research, codebase, onboarding, wizard, financial-data, epic-2]
status: complete
last_updated: 2025-12-05
last_updated_by: Claude
---

# Research: Epic 2 Guided Onboarding (Financial Setup) Implementation

**Date**: 2025-12-05T12:00:00-08:00
**Researcher**: Claude
**Git Commit**: fb6969abcb9aa1be7c5b2253836501bfb394d7c7
**Branch**: main
**Repository**: plan-smart

## Research Question

How should we implement the Epic 2 Guided Onboarding wizard for financial setup, building on the existing Epic 1 authentication and basic onboarding infrastructure?

## Summary

The codebase already has a solid foundation for implementing Epic 2's enhanced onboarding wizard:

1. **Existing 4-step onboarding wizard** can be extended to 5 steps for the new financial data collection
2. **React Hook Form + Zod validation** is already in use and should be extended with new schemas
3. **Drizzle ORM** is configured with `financial_snapshot` and `plans` tables that need schema expansion
4. **No OpenAI/GPT integration exists yet** - this will need to be added for natural language parsing
5. **shadcn/ui components** provide the UI building blocks, though a Dialog component needs to be created

## Detailed Findings

### 1. Current Onboarding Implementation

**Location**: [src/app/onboarding/](src/app/onboarding/)

The existing onboarding wizard has 4 steps:

| Step | Component | Data Collected |
|------|-----------|----------------|
| 1 | [step1-personal-info.tsx](src/components/onboarding/step1-personal-info.tsx) | Birth year |
| 2 | [step2-retirement-info.tsx](src/components/onboarding/step2-retirement-info.tsx) | Target retirement age, filing status |
| 3 | [step3-financial-info.tsx](src/components/onboarding/step3-financial-info.tsx) | Annual income, savings rate |
| 4 | [step4-risk-tolerance.tsx](src/components/onboarding/step4-risk-tolerance.tsx) | Risk tolerance level |

**State Management Pattern** ([src/app/onboarding/page.tsx](src/app/onboarding/page.tsx)):
```typescript
const [currentStep, setCurrentStep] = useState(1);
const [formData, setFormData] = useState<Partial<CompleteOnboardingData>>({});
```

**Progress Indicator**: Shows "Step X of 4" with a progress bar (25% per step)

### 2. Epic 2 Requirements vs. Current State

**New Data to Collect (from [scope.md](thoughts/personal/tickets/epic-2/onboarding/scope.md)):**

| Category | New Fields | Current State |
|----------|------------|---------------|
| Retirement Accounts | 401k, IRA, Brokerage balances | Not collected |
| Monthly Contributions | Per-account contribution amounts | Not collected |
| Major Assets | Home value, other investments | Not collected |
| Debts | Mortgage, loans, credit cards | Not collected |
| Income & Expenses | Monthly essential/discretionary | Partial (annual income exists) |

**Proposed New Data Model:**
```typescript
type InvestmentAccount = {
  id: string;
  label: string;
  type: "401k" | "IRA" | "Brokerage" | "Cash" | "Other";
  balance: number;
  monthlyContribution?: number;
};

type Debt = {
  id: string;
  label: string;
  type: "Mortgage" | "StudentLoan" | "CreditCard" | "AutoLoan" | "Other";
  balance: number;
  interestRate?: number;
};

type AssetsAndDebts = {
  primaryResidence?: {
    estimatedValue?: number;
    mortgageBalance?: number;
    interestRate?: number;
  };
  otherAssets: InvestmentAccount[];
  debts: Debt[];
};
```

### 3. Form Handling & Validation

**Current Stack**:
- React Hook Form v7 ([package.json:47](package.json))
- Zod validation ([package.json:50](package.json))
- @hookform/resolvers ([package.json:25](package.json))

**Existing Validation Schemas** ([src/lib/validation/onboarding.ts](src/lib/validation/onboarding.ts)):
- Step schemas are merged for final validation
- Pattern supports adding new step schemas

**Recommended New Schemas:**
```typescript
// New step schema for savings & contributions
export const step2ExtendedSchema = z.object({
  investmentAccounts: z.array(z.object({
    id: z.string(),
    label: z.string().min(1),
    type: z.enum(['401k', 'IRA', 'Brokerage', 'Cash', 'Other']),
    balance: z.number().min(0),
    monthlyContribution: z.number().min(0).optional(),
  })).min(1, 'At least one account is required'),
});

// New step schema for assets & debts
export const step4AssetsDebtsSchema = z.object({
  primaryResidence: z.object({
    estimatedValue: z.number().min(0).optional(),
    mortgageBalance: z.number().min(0).optional(),
    interestRate: z.number().min(0).max(30).optional(),
  }).optional(),
  debts: z.array(z.object({
    id: z.string(),
    label: z.string().min(1),
    type: z.enum(['Mortgage', 'StudentLoan', 'CreditCard', 'AutoLoan', 'Other']),
    balance: z.number().min(0),
    interestRate: z.number().min(0).max(100).optional(),
  })),
});
```

### 4. UI Components Available

**Existing Components** ([src/components/ui/](src/components/ui/)):

| Component | File | Usage for Epic 2 |
|-----------|------|------------------|
| Button | [button.tsx](src/components/ui/button.tsx) | Navigation, form submission |
| Input | [input.tsx](src/components/ui/input.tsx) | Text/number fields |
| Label | [label.tsx](src/components/ui/label.tsx) | Form field labels |
| Card | [card.tsx](src/components/ui/card.tsx) | Step containers |
| Checkbox | [checkbox.tsx](src/components/ui/checkbox.tsx) | Option selection |
| RadioGroup | [radio-group.tsx](src/components/ui/radio-group.tsx) | Single-choice options |
| Alert | [alert.tsx](src/components/ui/alert.tsx) | Error/success messages |
| Toast | [toast.tsx](src/components/ui/toast.tsx) | Notifications |
| Form | [form.tsx](src/components/ui/form.tsx) | React Hook Form integration |

**Missing Components Needed:**
- **Dialog/Modal**: `@radix-ui/react-dialog` is installed but no Dialog component exists - needed for quick-edit on review screen
- **Select/Dropdown**: Would help for account type selection
- **Accordion**: Useful for collapsible review sections

### 5. Database Schema Changes Required

**Current Schema** ([src/db/schema/financial-snapshot.ts](src/db/schema/financial-snapshot.ts)):
```typescript
// Existing fields
birthYear: integer
targetRetirementAge: integer
filingStatus: text
annualIncome: numeric(12,2)
savingsRate: numeric(5,2)
riskTolerance: text
```

**Recommended Schema Additions:**

Option A: **JSONB Column** (simpler, more flexible):
```typescript
// Add to financial_snapshot table
investmentAccounts: jsonb('investment_accounts'), // InvestmentAccount[]
assetsAndDebts: jsonb('assets_and_debts'),        // AssetsAndDebts
incomeExpenses: jsonb('income_expenses'),          // IncomeExpenses
```

Option B: **Normalized Tables** (better for querying/reporting):
```sql
CREATE TABLE investment_accounts (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES user_profile(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  account_type TEXT NOT NULL,
  balance NUMERIC(12,2) NOT NULL,
  monthly_contribution NUMERIC(10,2),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE debts (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES user_profile(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  debt_type TEXT NOT NULL,
  balance NUMERIC(12,2) NOT NULL,
  interest_rate NUMERIC(5,2),
  created_at TIMESTAMP DEFAULT NOW()
);
```

**Recommendation**: Use JSONB for MVP (faster to implement), with option to normalize later if querying/analytics needs arise.

### 6. API Endpoints Required

**Existing Endpoint** ([src/app/api/onboarding/complete/route.ts](src/app/api/onboarding/complete/route.ts)):
- Creates financial snapshot
- Creates default plan
- Marks onboarding complete

**New Endpoints Needed:**

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/parse-financial-nl` | POST | Natural language parsing via GPT |
| `/api/onboarding/complete` | POST | Update existing endpoint for new data |
| `/api/generate-plan` | POST | Generate retirement plan (optional, can be part of complete) |

### 7. Natural Language Parsing (New Feature)

**No OpenAI integration exists currently**. Need to add:

1. **Install OpenAI SDK**:
   ```bash
   npm install openai
   ```

2. **Create parsing endpoint** ([src/app/api/parse-financial-nl/route.ts](src/app/api/parse-financial-nl/route.ts)):
   ```typescript
   import OpenAI from 'openai';

   const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

   export async function POST(request: NextRequest) {
     const { text } = await request.json();

     const completion = await openai.chat.completions.create({
       model: 'gpt-4o-mini',
       messages: [
         { role: 'system', content: EXTRACTION_PROMPT },
         { role: 'user', content: text },
       ],
       response_format: { type: 'json_object' },
     });

     return NextResponse.json({
       data: JSON.parse(completion.choices[0].message.content),
       confidence: calculateConfidence(/* ... */),
     });
   }
   ```

3. **UX Flow**:
   - User enters natural language in "Smart intake" box
   - Show loading spinner during parsing
   - Display detected fields with confidence scores
   - Allow user to confirm or edit before applying

### 8. Proposed Wizard Flow (5 Steps)

| Step | Title | Fields | New/Existing |
|------|-------|--------|--------------|
| 1 | Basics | Age, retirement age, life expectancy | **Modified** |
| 2 | Savings & Contributions | Investment accounts, balances, contributions | **New** |
| 3 | Income & Expenses (Optional) | Annual income, monthly essential, discretionary | **New** |
| 4 | Assets & Debts | Home, mortgage, other debts | **New** |
| 5 | Review & Confirm | Summary with quick-edit, generate plan button | **New** |

### 9. Implementation Plan

**Phase 1: Schema & Types (Day 1)**
1. Create new TypeScript interfaces in [src/types/onboarding.ts](src/types/onboarding.ts)
2. Add JSONB columns to financial_snapshot schema
3. Generate and run migration
4. Update Zod validation schemas

**Phase 2: UI Components (Day 2)**
1. Create Dialog component from Radix UI
2. Create Select dropdown component
3. Create "Add Account" / "Add Debt" dynamic list pattern

**Phase 3: Step Components (Days 3-4)**
1. Modify Step 1 (add life expectancy preset)
2. Create Step 2 (savings & contributions)
3. Create Step 3 (income & expenses - optional)
4. Create Step 4 (assets & debts)
5. Create Step 5 (review with quick-edit)

**Phase 4: Natural Language Parsing (Day 5)**
1. Install OpenAI SDK
2. Create `/api/parse-financial-nl` endpoint
3. Create "Smart intake" UI component
4. Add confidence scoring and field highlighting

**Phase 5: Integration & Testing (Day 6)**
1. Update onboarding page for 5 steps
2. Update `/api/onboarding/complete` for new data
3. Write unit tests for validation schemas
4. Write E2E tests for complete wizard flow

## Code References

- Onboarding wizard main page: [src/app/onboarding/page.tsx](src/app/onboarding/page.tsx)
- Onboarding step components: [src/components/onboarding/](src/components/onboarding/)
- Validation schemas: [src/lib/validation/onboarding.ts](src/lib/validation/onboarding.ts)
- Type definitions: [src/types/onboarding.ts](src/types/onboarding.ts)
- Financial snapshot schema: [src/db/schema/financial-snapshot.ts](src/db/schema/financial-snapshot.ts)
- Plans schema: [src/db/schema/plans.ts](src/db/schema/plans.ts)
- API onboarding complete: [src/app/api/onboarding/complete/route.ts](src/app/api/onboarding/complete/route.ts)
- UI components: [src/components/ui/](src/components/ui/)
- Form component (React Hook Form integration): [src/components/ui/form.tsx](src/components/ui/form.tsx)

## Architecture Insights

### Patterns to Follow
1. **Step Component Interface**: Each step receives `onNext`, `onBack`, `initialData`, and `isSubmitting` props
2. **State Accumulation**: Form data is accumulated in parent state, passed down as `initialData`
3. **Zod Schema Composition**: Step schemas are merged with `.merge()` for final validation
4. **Controller Pattern**: Use React Hook Form's `Controller` for complex components (RadioGroup, custom inputs)
5. **Secure Query Builder**: Use [src/db/secure-query.ts](src/db/secure-query.ts) pattern for user data isolation

### Conventions
- All form fields use `register()` or `Controller` from React Hook Form
- Number inputs use `valueAsNumber: true` for automatic type conversion
- Progress bar uses percentage calculation based on current step
- Error messages displayed inline below fields

## Historical Context (from thoughts/)

- [thoughts/personal/tickets/epic-2/onboarding/scope.md](thoughts/personal/tickets/epic-2/onboarding/scope.md) - Original scope document with user stories and data models
- [thoughts/personal/tickets/epic-1/accounts/scope.md](thoughts/personal/tickets/epic-1/accounts/scope.md) - Epic 1 scope showing what's already implemented
- [thoughts/shared/plans/2025-11-17-epic-1-auth-onboarding-implementation.md](thoughts/shared/plans/2025-11-17-epic-1-auth-onboarding-implementation.md) - Complete Epic 1 implementation plan
- [thoughts/shared/research/2025-11-12-epic-1-technology-selection.md](thoughts/shared/research/2025-11-12-epic-1-technology-selection.md) - Technology stack decisions

## Related Research

- [thoughts/shared/research/2025-11-11-epic-1-implementation-readiness.md](thoughts/shared/research/2025-11-11-epic-1-implementation-readiness.md) - Epic 1 readiness assessment
- [thoughts/shared/research/2025-12-05-clean-ui-design-website-experience.md](thoughts/shared/research/2025-12-05-clean-ui-design-website-experience.md) - UI design system

## Open Questions

1. **JSONB vs. Normalized**: Should investment accounts and debts use JSONB columns or normalized tables?
   - **Recommendation**: JSONB for MVP, normalize if analytics needs arise

2. **OpenAI Model Selection**: Which model for NL parsing - `gpt-4o-mini` (cheaper) or `gpt-4o` (more accurate)?
   - **Recommendation**: Start with `gpt-4o-mini`, upgrade if accuracy issues

3. **Resumable Sessions**: Should wizard state persist to localStorage for resume capability?
   - **Scope says**: "resumable in a single session" - in-memory is acceptable for MVP

4. **Partner/Spouse Data**: Is this needed for MVP?
   - **Scope lists as open question** - recommend deferring to later phase

5. **Accessibility**: What WCAG level is required?
   - **Not specified** - recommend WCAG 2.1 AA as baseline
