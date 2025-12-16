import { z } from 'zod';

const currentYear = new Date().getFullYear();

export const step1Schema = z.object({
  birthYear: z
    .number()
    .min(1920, 'Birth year must be 1920 or later')
    .max(currentYear - 18, 'You must be at least 18 years old'),
});

export const step2Schema = z.object({
  targetRetirementAge: z
    .number()
    .min(50, 'Retirement age must be at least 50')
    .max(80, 'Retirement age must be 80 or younger'),
  filingStatus: z.enum(['single', 'married', 'head_of_household']),
});

export const step3Schema = z.object({
  annualIncome: z
    .number()
    .min(0, 'Annual income cannot be negative')
    .max(10000000, 'Annual income cannot exceed $10,000,000'),
  savingsRate: z
    .number()
    .min(0, 'Savings rate cannot be negative')
    .max(100, 'Savings rate cannot exceed 100%'),
});

export const step4Schema = z.object({
  riskTolerance: z.enum(['conservative', 'moderate', 'aggressive']),
});

export const completeOnboardingSchema = step1Schema
  .merge(step2Schema)
  .merge(step3Schema)
  .merge(step4Schema);

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
