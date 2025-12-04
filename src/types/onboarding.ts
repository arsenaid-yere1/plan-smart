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
