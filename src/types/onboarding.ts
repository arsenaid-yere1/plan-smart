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
