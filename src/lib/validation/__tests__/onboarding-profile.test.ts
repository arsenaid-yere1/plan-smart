import { describe, expect, it } from 'vitest';
import {
  completeOnboardingSchema,
  completeOnboardingSchemaV2,
} from '../onboarding';
import { profileUpdateSchema } from '../profile';

const incomeSource = {
  id: 'salary',
  type: 'w2_employment' as const,
  label: 'Salary',
  annualAmount: 100000,
  variability: 'recurring' as const,
  flexibility: { canDefer: false, canReduce: false, canRestructure: false },
  isPrimary: true,
};

const baseOnboarding = {
  birthYear: 1980,
  targetRetirementAge: 67,
  filingStatus: 'single' as const,
  annualIncome: 100000,
  savingsRate: 20,
  incomeSources: [incomeSource],
  riskTolerance: 'moderate' as const,
};

describe('Zod 4 onboarding and profile schema composition', () => {
  it('imports and parses the original onboarding schema while preserving refinements', () => {
    expect(completeOnboardingSchema.safeParse(baseOnboarding).success).toBe(true);
    expect(completeOnboardingSchema.safeParse({
      ...baseOnboarding,
      annualIncome: 90000,
    }).success).toBe(false);
  });

  it('parses complete onboarding V2 without throwing during module initialization', () => {
    const result = completeOnboardingSchemaV2.safeParse({
      ...baseOnboarding,
      investmentAccounts: [{
        id: '401k', label: '401(k)', type: '401k', balance: 100000,
      }],
      debts: [],
    });
    expect(result.success).toBe(true);
  });

  it('accepts partial profile updates and retains income-source checks', () => {
    expect(profileUpdateSchema.safeParse({ targetRetirementAge: 70 }).success).toBe(true);
    expect(profileUpdateSchema.safeParse({ targetRetirementAge: 90 }).success).toBe(false);
    expect(profileUpdateSchema.safeParse({
      annualIncome: 100000,
      incomeSources: [incomeSource],
    }).success).toBe(true);
    expect(profileUpdateSchema.safeParse({
      annualIncome: 90000,
      incomeSources: [incomeSource],
    }).success).toBe(false);
  });
});
