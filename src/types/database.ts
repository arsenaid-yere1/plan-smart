import type { InferSelectModel, InferInsertModel } from 'drizzle-orm';
import { userProfile, financialSnapshot, plans } from '@/db/schema';

// Select types (what you get from the database)
export type UserProfile = InferSelectModel<typeof userProfile>;
export type FinancialSnapshot = InferSelectModel<typeof financialSnapshot>;
export type Plan = InferSelectModel<typeof plans>;

// Insert types (what you send to the database)
export type NewUserProfile = InferInsertModel<typeof userProfile>;
export type NewFinancialSnapshot = InferInsertModel<typeof financialSnapshot>;
export type NewPlan = InferInsertModel<typeof plans>;

// Filing status enum
export type FilingStatus = 'single' | 'married' | 'head_of_household';

// Risk tolerance enum
export type RiskTolerance = 'conservative' | 'moderate' | 'aggressive';

// Onboarding data type
export interface OnboardingData {
  birthYear: number;
  targetRetirementAge: number;
  filingStatus: FilingStatus;
  annualIncome: number;
  savingsRate: number;
  riskTolerance: RiskTolerance;
}
