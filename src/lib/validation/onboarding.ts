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
