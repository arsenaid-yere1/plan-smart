import type { FilingStatus, RiskTolerance } from './database';

// US State codes for residence selection
export const US_STATES = [
  { value: 'AL', label: 'Alabama' },
  { value: 'AK', label: 'Alaska' },
  { value: 'AZ', label: 'Arizona' },
  { value: 'AR', label: 'Arkansas' },
  { value: 'CA', label: 'California' },
  { value: 'CO', label: 'Colorado' },
  { value: 'CT', label: 'Connecticut' },
  { value: 'DE', label: 'Delaware' },
  { value: 'FL', label: 'Florida' },
  { value: 'GA', label: 'Georgia' },
  { value: 'HI', label: 'Hawaii' },
  { value: 'ID', label: 'Idaho' },
  { value: 'IL', label: 'Illinois' },
  { value: 'IN', label: 'Indiana' },
  { value: 'IA', label: 'Iowa' },
  { value: 'KS', label: 'Kansas' },
  { value: 'KY', label: 'Kentucky' },
  { value: 'LA', label: 'Louisiana' },
  { value: 'ME', label: 'Maine' },
  { value: 'MD', label: 'Maryland' },
  { value: 'MA', label: 'Massachusetts' },
  { value: 'MI', label: 'Michigan' },
  { value: 'MN', label: 'Minnesota' },
  { value: 'MS', label: 'Mississippi' },
  { value: 'MO', label: 'Missouri' },
  { value: 'MT', label: 'Montana' },
  { value: 'NE', label: 'Nebraska' },
  { value: 'NV', label: 'Nevada' },
  { value: 'NH', label: 'New Hampshire' },
  { value: 'NJ', label: 'New Jersey' },
  { value: 'NM', label: 'New Mexico' },
  { value: 'NY', label: 'New York' },
  { value: 'NC', label: 'North Carolina' },
  { value: 'ND', label: 'North Dakota' },
  { value: 'OH', label: 'Ohio' },
  { value: 'OK', label: 'Oklahoma' },
  { value: 'OR', label: 'Oregon' },
  { value: 'PA', label: 'Pennsylvania' },
  { value: 'RI', label: 'Rhode Island' },
  { value: 'SC', label: 'South Carolina' },
  { value: 'SD', label: 'South Dakota' },
  { value: 'TN', label: 'Tennessee' },
  { value: 'TX', label: 'Texas' },
  { value: 'UT', label: 'Utah' },
  { value: 'VT', label: 'Vermont' },
  { value: 'VA', label: 'Virginia' },
  { value: 'WA', label: 'Washington' },
  { value: 'WV', label: 'West Virginia' },
  { value: 'WI', label: 'Wisconsin' },
  { value: 'WY', label: 'Wyoming' },
  { value: 'DC', label: 'District of Columbia' },
] as const;

export type USStateCode = typeof US_STATES[number]['value'];

export interface OnboardingStep1Data {
  birthYear: number;
  stateOfResidence?: USStateCode;
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
