import type { FilingStatus, RiskTolerance } from './database';

export interface OnboardingStep1Data {
  birthYear: number;
}

export interface OnboardingStep2Data {
  targetRetirementAge: number;
  filingStatus: FilingStatus;
}

export interface OnboardingStep3Data {
  annualIncome: number;
  savingsRate: number;
}

export interface OnboardingStep4Data {
  riskTolerance: RiskTolerance;
}

export interface CompleteOnboardingData
  extends OnboardingStep1Data,
    OnboardingStep2Data,
    OnboardingStep3Data,
    OnboardingStep4Data {}

export const FILING_STATUS_OPTIONS = [
  { value: 'single', label: 'Single' },
  { value: 'married', label: 'Married Filing Jointly' },
  { value: 'head_of_household', label: 'Head of Household' },
] as const;

export const RISK_TOLERANCE_OPTIONS = [
  {
    value: 'conservative',
    label: 'Conservative',
    description: 'Prioritize capital preservation over growth',
  },
  {
    value: 'moderate',
    label: 'Moderate',
    description: 'Balanced approach between growth and stability',
  },
  {
    value: 'aggressive',
    label: 'Aggressive',
    description: 'Maximize growth potential, accept higher volatility',
  },
] as const;

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

// Epic 2: Debt Types (Mortgage removed - now tracked with properties)
export type DebtType = 'StudentLoan' | 'CreditCard' | 'AutoLoan' | 'Other';

export interface Debt {
  id: string;
  label: string;
  type: DebtType;
  balance: number;
  interestRate?: number;
}

export const DEBT_TYPE_OPTIONS = [
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

// Real Estate Property Types
export type RealEstatePropertyType = 'primary' | 'rental' | 'vacation' | 'land';

export interface RealEstateProperty {
  id: string;
  name: string;
  type: RealEstatePropertyType;

  // Asset value
  estimatedValue: number;

  // Mortgage details (optional - property may be paid off)
  // Note: Mortgage payments are assumed to be included in monthly expenses
  mortgageBalance?: number;
  mortgageInterestRate?: number;

  // NOTE: Rental income is NOT stored here - users manage rental income
  // via the existing Income Streams section to avoid duplication
}

export const PROPERTY_TYPE_OPTIONS = [
  { value: 'primary', label: 'Primary Residence' },
  { value: 'rental', label: 'Rental Property' },
  { value: 'vacation', label: 'Vacation Home' },
  { value: 'land', label: 'Land' },
] as const;

// Epic 2: Income & Expenses
export interface IncomeExpenses {
  monthlyEssential?: number;
  monthlyDiscretionary?: number;
}

// Epic 3: Income Streams
export type IncomeStreamType =
  | 'social_security'
  | 'pension'
  | 'rental'
  | 'annuity'
  | 'part_time'
  | 'other';

export interface IncomeStream {
  id: string;
  name: string;
  type: IncomeStreamType;
  annualAmount: number;
  startAge: number;
  endAge?: number;
  inflationAdjusted: boolean;
}

export const INCOME_STREAM_TYPE_OPTIONS = [
  { value: 'social_security', label: 'Social Security' },
  { value: 'pension', label: 'Pension' },
  { value: 'rental', label: 'Rental Income' },
  { value: 'annuity', label: 'Annuity' },
  { value: 'part_time', label: 'Part-Time Work' },
  { value: 'other', label: 'Other' },
] as const;

// Epic 2: New Step Data Interfaces
export interface OnboardingStep2SavingsData {
  investmentAccounts: InvestmentAccount[];
}

export interface OnboardingStep3IncomeExpensesData {
  incomeExpenses?: IncomeExpenses;
}

export interface OnboardingStep4AssetsDebtsData {
  primaryResidence?: PrimaryResidence; // Keep for backward compatibility during migration
  realEstateProperties?: RealEstateProperty[]; // New array for multiple properties
  debts: Debt[];
}

// Epic 3: Income Streams Step Data
export interface OnboardingStepIncomeStreamsData {
  incomeStreams: IncomeStream[];
}

// Epic 2: Extended Complete Data (replaces existing CompleteOnboardingData)
export interface CompleteOnboardingDataV2
  extends OnboardingStep1Data,
    OnboardingStep2Data,
    OnboardingStep3Data,
    OnboardingStep4Data,
    OnboardingStep2SavingsData,
    OnboardingStep3IncomeExpensesData,
    OnboardingStep4AssetsDebtsData,
    Partial<OnboardingStepIncomeStreamsData> {}
