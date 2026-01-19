import type { AccountType } from '@/types/onboarding';

/**
 * Tax category for investment accounts
 */
export type TaxCategory = 'taxDeferred' | 'taxFree' | 'taxable';

/**
 * Type of income stream
 */
export type IncomeStreamType =
  | 'social_security'
  | 'pension'
  | 'rental'
  | 'annuity'
  | 'part_time'
  | 'other';

/**
 * Income types considered guaranteed (not dependent on market conditions)
 */
export const GUARANTEED_INCOME_TYPES: IncomeStreamType[] = [
  'social_security',
  'pension',
  'annuity',
];

/**
 * Determine if an income type is considered guaranteed
 */
export function isGuaranteedIncomeType(type: IncomeStreamType): boolean {
  return GUARANTEED_INCOME_TYPES.includes(type);
}

/**
 * Individual income stream for retirement projection
 */
export interface IncomeStream {
  id: string;
  name: string;
  type: IncomeStreamType;
  annualAmount: number;      // In today's dollars
  startAge: number;          // Age when income begins
  endAge?: number;           // Age when income ends (undefined = lifetime)
  inflationAdjusted: boolean; // Whether to apply COLA
  // Epic 8: Safety-First Income Floor
  isGuaranteed: boolean;     // Auto-set based on type
  isSpouse?: boolean;        // For household income differentiation (SS, pension)
}

/**
 * Mapping of account types to tax categories
 */
export const ACCOUNT_TAX_CATEGORY: Record<AccountType, TaxCategory> = {
  '401k': 'taxDeferred',
  'IRA': 'taxDeferred',
  'Roth_IRA': 'taxFree',
  'Brokerage': 'taxable',
  'Cash': 'taxable',
  'Other': 'taxable',
};

/**
 * Balance breakdown by tax category
 */
export interface BalanceByType {
  taxDeferred: number;
  taxFree: number;
  taxable: number;
}

/**
 * Core inputs required for projection calculation
 * Derived from financial snapshot + optional overrides
 */
export interface ProjectionInput {
  currentAge: number;
  retirementAge: number;
  maxAge: number;

  // Account balances by tax category
  balancesByType: BalanceByType;

  // Annual contribution (derived from monthly * 12)
  annualContribution: number;

  // Contribution allocation percentages (must sum to 100)
  contributionAllocation: BalanceByType;

  // Return and inflation assumptions
  expectedReturn: number;
  inflationRate: number;

  // Annual contribution growth rate (default 0%)
  contributionGrowthRate: number;

  // Epic 8: Expense breakdown for income floor analysis
  /** Annual essential expenses in today's dollars (housing, food, insurance, etc.) */
  annualEssentialExpenses: number;

  /** Annual discretionary expenses in today's dollars (travel, entertainment, etc.) */
  annualDiscretionaryExpenses: number;

  /** @deprecated Use annualEssentialExpenses + annualDiscretionaryExpenses. Kept for backward compatibility. */
  annualExpenses: number;

  // Healthcare costs (separate due to higher inflation)
  annualHealthcareCosts: number;
  healthcareInflationRate: number;

  // Income streams (replaces socialSecurityAge/socialSecurityMonthly)
  incomeStreams: IncomeStream[];

  // Annual debt payments (reduces effective contributions)
  annualDebtPayments: number;
}

/**
 * API request schema - optional overrides for projection
 */
export interface ProjectionRequest {
  // Override default return rate from risk tolerance
  expectedReturn?: number;

  // Override default inflation (2.5%)
  inflationRate?: number;

  // Override default max age (90)
  maxAge?: number;

  // Annual contribution growth rate (default 0%)
  contributionGrowthRate?: number;

  // Legacy Social Security parameters (still supported for backward compatibility)
  socialSecurityAge?: number;
  socialSecurityMonthly?: number;

  // Income streams override
  incomeStreams?: IncomeStream[];

  // Healthcare cost overrides
  annualHealthcareCosts?: number;
  healthcareInflationRate?: number;

  // Contribution allocation override (must sum to 100)
  contributionAllocation?: {
    taxDeferred: number;
    taxFree: number;
    taxable: number;
  };
}

/**
 * Single year projection record
 */
export interface ProjectionRecord {
  age: number;
  year: number;
  balance: number;
  inflows: number;
  outflows: number;

  // Account-level breakdown for tax strategy visibility
  balanceByType: BalanceByType;
  withdrawalsByType?: BalanceByType;

  // Epic 8: Expense breakdown during retirement
  essentialExpenses?: number;
  discretionaryExpenses?: number;
}

/**
 * Summary statistics for the projection
 */
export interface ProjectionSummary {
  startingBalance: number;
  endingBalance: number;
  totalContributions: number;
  totalWithdrawals: number;
  yearsUntilDepletion: number | null;
  projectedRetirementBalance: number;
}

/**
 * Complete projection result
 */
export interface ProjectionResult {
  records: ProjectionRecord[];
  summary: ProjectionSummary;
}

/**
 * Withdrawal result from tax-aware strategy
 */
export interface WithdrawalResult {
  withdrawals: BalanceByType;
  shortfall: number;
}

/**
 * Stored assumptions for a projection (human-readable snapshot)
 */
export interface ProjectionAssumptions {
  expectedReturn: number;
  inflationRate: number;
  healthcareInflationRate: number;
  contributionGrowthRate: number;
  retirementAge: number;
  maxAge: number;
}

/**
 * Property summary for net worth display (display purposes only)
 */
export interface PropertySummary {
  totalValue: number;
  totalMortgage: number;
  totalEquity: number;
}