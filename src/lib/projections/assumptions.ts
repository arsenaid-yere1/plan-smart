import type { RiskTolerance } from '@/types/database';
import type { BalanceByType } from './types';

/**
 * Default expected return rates by risk tolerance
 */
export const DEFAULT_RETURN_RATES: Record<RiskTolerance, number> = {
  conservative: 0.04,  // 4% - Bond-heavy portfolio
  moderate: 0.06,      // 6% - Balanced 60/40
  aggressive: 0.08,    // 8% - Equity-heavy
};

/**
 * Default inflation rate (historical average)
 */
export const DEFAULT_INFLATION_RATE = 0.025; // 2.5%

/**
 * Default maximum age for projections
 */
export const DEFAULT_MAX_AGE = 90;

/**
 * Default Social Security claiming age
 */
export const DEFAULT_SS_AGE = 67;

/**
 * Default contribution allocation
 */
export const DEFAULT_CONTRIBUTION_ALLOCATION: BalanceByType = {
  taxDeferred: 60,
  taxFree: 30,
  taxable: 10,
};

/**
 * Default contribution growth rate (0% = flat contributions)
 */
export const DEFAULT_CONTRIBUTION_GROWTH_RATE = 0;

/**
 * Default healthcare inflation rate (historically ~5-6%, higher than general inflation)
 */
export const DEFAULT_HEALTHCARE_INFLATION_RATE = 0.05; // 5%

/**
 * Default annual healthcare costs by age bracket (in today's dollars)
 * Based on Fidelity's annual retiree healthcare cost estimates
 */
export const DEFAULT_HEALTHCARE_COSTS_BY_AGE: Record<string, number> = {
  'under65': 8000,   // Pre-Medicare: ~$8k/year (ACA marketplace or employer)
  '65to74': 6500,    // Early Medicare: ~$6.5k/year (Medicare + supplements)
  '75plus': 12000,   // Late retirement: ~$12k/year (increased medical needs)
};

/**
 * Estimate annual healthcare costs based on age
 * @param age - Current age
 * @returns Estimated annual healthcare costs in today's dollars
 */
export function estimateHealthcareCosts(age: number): number {
  if (age < 65) {
    return DEFAULT_HEALTHCARE_COSTS_BY_AGE['under65'];
  } else if (age < 75) {
    return DEFAULT_HEALTHCARE_COSTS_BY_AGE['65to74'];
  } else {
    return DEFAULT_HEALTHCARE_COSTS_BY_AGE['75plus'];
  }
}

/**
 * SSA maximum monthly benefit (2024, approximate)
 */
export const SSA_MAX_MONTHLY_BENEFIT = 4500;

/**
 * Estimate Social Security monthly benefit based on annual income
 * Uses simplified SSA replacement rate formula with 20% conservative haircut
 *
 * @param annualIncome - User's annual income
 * @returns Estimated monthly SS benefit in today's dollars
 */
export function estimateSocialSecurityMonthly(annualIncome: number): number {
  // Tiered replacement rates (simplified SSA formula)
  let annualBenefit: number;

  if (annualIncome <= 30000) {
    // ~55% replacement for low income
    annualBenefit = annualIncome * 0.55;
  } else if (annualIncome <= 80000) {
    // ~40% replacement for middle income
    annualBenefit = 30000 * 0.55 + (annualIncome - 30000) * 0.40;
  } else {
    // ~30% replacement for high income (diminishing returns)
    annualBenefit = 30000 * 0.55 + 50000 * 0.40 + (annualIncome - 80000) * 0.30;
  }

  // Apply 20% conservative haircut
  const monthlyBenefit = (annualBenefit * 0.80) / 12;

  // Cap at SSA maximum
  return Math.min(monthlyBenefit, SSA_MAX_MONTHLY_BENEFIT);
}

/**
 * Calculate annual expenses from income and savings rate
 * Used as fallback when incomeExpenses is not provided
 *
 * @param annualIncome - User's annual income
 * @param savingsRate - Savings rate as percentage (0-100)
 * @returns Estimated annual expenses, capped at 80% of income
 */
export function deriveAnnualExpenses(
  annualIncome: number,
  savingsRate: number
): number {
  const spending = annualIncome * (1 - savingsRate / 100);
  const maxSpending = annualIncome * 0.80;
  return Math.min(spending, maxSpending);
}

/**
 * Estimate annual debt payments using simple amortization
 * For MVP, assumes 10-year payoff for all debts
 *
 * @param debts - Array of debt objects with balance and optional interest rate
 * @returns Estimated total annual debt payments
 */
export function estimateAnnualDebtPayments(
  debts: Array<{ balance: number; interestRate?: number }>
): number {
  return debts.reduce((total, debt) => {
    const rate = (debt.interestRate || 5) / 100; // Default 5% if not specified
    const monthlyRate = rate / 12;
    const numPayments = 120; // 10 years

    // Standard amortization formula: M = P * [r(1+r)^n] / [(1+r)^n - 1]
    if (monthlyRate === 0) {
      return total + (debt.balance / 10); // Simple division for 0% interest
    }

    const factor = Math.pow(1 + monthlyRate, numPayments);
    const monthlyPayment = debt.balance * (monthlyRate * factor) / (factor - 1);

    return total + (monthlyPayment * 12);
  }, 0);
}