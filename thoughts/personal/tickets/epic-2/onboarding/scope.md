# Guided Onboarding (Financial Setup) – Research

## 1. Goal

Build a **4–5 step onboarding wizard** that collects a user’s core retirement information and financial picture, supports **natural-language input parsing**, displays **step progress**, and ends with a **review/confirm summary** that triggers retirement plan generation.

## 2. User Stories (Given Epic)

1. Simple onboarding wizard (4–5 steps) that collects:
   - Age
   - Retirement target (age and/or income goal)
   - Current savings (e.g., 401k, brokerage)
   - Monthly contributions

   **Acceptance:** User can move back/forth between steps, with a completion indicator.

2. Major assets and debts:
   - Home value
   - Mortgage balance
   - Other debts (loans, credit cards)
   - Other assets (cash, brokerage, etc.)

   **Acceptance:** Inputs validated for numeric ranges and stored in local state.

3. Natural language input:
   - Example: `"I'm 45 with $300k in 401k and $2k monthly savings"`

   **Acceptance:** GPT extracts structured data and confirms detected fields.

4. Step progress:
   - Shows something like: “Step 3 of 5: Income & Expenses”
   - “Finish” triggers plan generation.

5. Review screen:
   - Summary of all captured data
   - Quick-edit capabilities for any field

   **Acceptance:** Final review page shows inputs and allows quick edit.

---

## 3. Assumptions & Constraints

- **Tech stack (assumed):**
  - Frontend: React + TypeScript + some router (React Router or Next.js App Router).
  - State: Local wizard state via React state, Zustand, or similar.
  - Forms & validation: Likely React Hook Form + Zod/Yup (or similar).
  - Backend: API available (or to be stubbed) for:
    - `POST /parse-financial-nl` (calls GPT or internal LLM service)
    - `POST /generate-plan` (takes structured onboarding payload).

- **Non-functional:**
  - Should feel fast; optimistic UI where possible.
  - Validation messages must be clear and non-technical.
  - Wizard should be **resumable in a single session** (state kept in-memory; persistence optional for MVP).

- **Product constraints (assumed MVP):**
  - Single user persona: mid-career user planning for retirement.
  - Single region & currency (e.g., USD) for MVP.
  - Mobile-friendly but desktop is primary; full responsive perfection can be phase 2.

---

## 4. Proposed Wizard Flow (First Pass)

**Step 1 – Basics**
- Fields:
  - Age
  - Desired retirement age
  - Optional: life expectancy assumption (or pick from presets)
- Goal: Anchor timeline.

**Step 2 – Current Savings & Contributions**
- Fields:
  - Retirement accounts (401k, IRA, etc.) – balances
  - Other investment accounts – balances
  - Monthly contributions to retirement
- Optional: “Add another account” pattern.

**Step 3 – Income & Expenses (Optional / Light-weight)**
- Fields:
  - Current annual income
  - Monthly essential expenses (rough)
  - Monthly discretionary expenses (rough)
- Allows skipping details if user just wants a quick estimate.

**Step 4 – Assets & Debts**
- Fields:
  - Home value, mortgage balance, interest rate (optional)
  - Other debts (loans/credit cards): type, balance, rate
  - Other assets (cash, brokerage, etc.) if not captured earlier.

**Step 5 – Review & Confirm**
- Collapsed summary by section:
  - “Basics”
  - “Savings & Contributions”
  - “Income & Expenses”
  - “Assets & Debts”
- Inline edit:
  - “Edit” button opens a small modal or side panel, or navigates back to that step with preserved data.
- “Generate my plan” button triggers plan generation action.

---

## 5. Data Model Sketch

```ts
type Currency = "USD"; // MVP

type RetirementBasics = {
  currentAge: number;
  targetRetirementAge: number;
};

type AccountType = "401k" | "IRA" | "Brokerage" | "Cash" | "Other";

type InvestmentAccount = {
  id: string;
  label: string;
  type: AccountType;
  balance: number;
  monthlyContribution?: number;
};

type IncomeExpenses = {
  annualIncome?: number;
  monthlyEssential?: number;
  monthlyDiscretionary?: number;
};

type DebtType = "Mortgage" | "StudentLoan" | "CreditCard" | "AutoLoan" | "Other";

type Debt = {
  id: string;
  label: string;
  type: DebtType;
  balance: number;
  interestRate?: number; // %
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

type OnboardingState = {
  basics: RetirementBasics;
  investmentAccounts: InvestmentAccount[];
  incomeExpenses?: IncomeExpenses;
  assetsAndDebts?: AssetsAndDebts;
};

## 6. Natural Language Parsing – Requirements

### Input Examples Users Might Provide
- “I’m 45 with 300k in my 401k and I put in 2k a month.”
- “I make 150k, spend 4k monthly, have 200k in brokerage and 20k in debt.”
- “Home worth 900k, mortgage 500k.”

### Expected Behavior
- GPT extracts relevant structured data into `OnboardingState`.
- Low-confidence fields are flagged in the UI.
- User must confirm parsed data before auto-filling fields.
- Partial results are allowed and should not block continuation.

### UX Flow
1. User enters a natural-language description into a **“Smart intake”** box.
2. Backend endpoint `/parse-financial-nl` returns:
   - Structured JSON
   - Confidence scores for each detected field
3. UI displays:
   - Summary of detected fields
   - Buttons:
     - **Apply**
     - **Edit before applying**

---

## 7. Open Questions
- Should onboarding autosave to `localStorage`?
- Do we handle spouse/partner data in the MVP?
- How granular should expenses be (categories vs. simple essential/discretionary)?
- What is the exact payload format required by `/generate-plan`?
- What accessibility standards need to be supported?
- Will localization or multi-currency support be needed soon?
