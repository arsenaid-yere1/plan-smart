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

// Epic 2: Debt Schema (Mortgage removed - now tracked with properties)
export const debtSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1, 'Debt name is required'),
  type: z.enum(['StudentLoan', 'CreditCard', 'AutoLoan', 'Other']),
  balance: z.number().min(0, 'Balance cannot be negative'),
  interestRate: z.number().min(0).max(100).optional(),
});

// Epic 2: Primary Residence Schema
export const primaryResidenceSchema = z.object({
  estimatedValue: z.number().min(0).max(100000000).optional(),
  mortgageBalance: z.number().min(0).max(100000000).optional(),
  interestRate: z.number().min(0).max(30).optional(),
});

// Real Estate Property Schema
export const realEstatePropertySchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1, 'Property name is required'),
  type: z.enum(['primary', 'rental', 'vacation', 'land']),
  estimatedValue: z.number().min(0, 'Value cannot be negative').max(100000000),
  mortgageBalance: z.number().min(0).max(100000000).optional(),
  mortgageInterestRate: z.number().min(0).max(30).optional(),
  // NOTE: Rental income is managed via Income Streams section, not here
});

export const step4AssetsDebtsSchema = z.object({
  primaryResidence: primaryResidenceSchema.optional(), // Keep for migration
  realEstateProperties: z.array(realEstatePropertySchema).optional(),
  debts: z.array(debtSchema),
});

// Epic 3: Income Streams Schema
export const incomeStreamSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1, 'Name is required'),
  type: z.enum(['social_security', 'pension', 'rental', 'annuity', 'part_time', 'other']),
  annualAmount: z.number().min(0, 'Amount cannot be negative'),
  startAge: z.number().min(50, 'Start age must be at least 50').max(90, 'Start age must be 90 or less'),
  endAge: z.number().min(50).max(120).optional(),
  inflationAdjusted: z.boolean(),
});

export const stepIncomeStreamsSchema = z.object({
  incomeStreams: z.array(incomeStreamSchema),
});

export type OnboardingStepIncomeStreamsData = z.infer<typeof stepIncomeStreamsSchema>;

// Epic 2: Complete Schema V2 (with optional income streams from Epic 3)
export const completeOnboardingSchemaV2 = step1Schema
  .merge(step2Schema)
  .merge(step3Schema)
  .merge(step4Schema)
  .merge(step2SavingsSchema)
  .merge(step3IncomeExpensesSchema)
  .merge(step4AssetsDebtsSchema)
  .merge(stepIncomeStreamsSchema.partial());
