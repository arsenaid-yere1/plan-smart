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
 * Individual spending phase configuration
 * Supports both multiplier-based and absolute amount spending
 */
export interface SpendingPhase {
  id: string;
  name: string;
  startAge: number;
  endAge?: number;  // Inferred from next phase or maxAge if not specified

  // Multiplier-based spending (1.0 = 100% of base)
  essentialMultiplier: number;
  discretionaryMultiplier: number;

  // Optional absolute amount overrides (takes precedence over multipliers)
  absoluteEssential?: number;
  absoluteDiscretionary?: number;
}

/**
 * Complete spending phase configuration
 */
export interface SpendingPhaseConfig {
  enabled: boolean;
  phases: SpendingPhase[];
}

/**
 * Epic 10: Intentional Portfolio Depletion Target
 * Allows users to specify how much they want to spend by a certain age
 */
export interface DepletionTarget {
  enabled: boolean;
  targetPercentageSpent: number;  // 0-100, e.g., 75 means spend 75% by target age
  targetAge: number;              // Age by which to reach spending target
  /** Epic 10.2: Reserve preservation configuration */
  reserve?: ReserveConfig;
}

/**
 * Epic 10.2: Reserve Preservation Configuration
 * Defines how much portfolio should be protected from spending
 */
export type ReserveType = 'derived' | 'percentage' | 'absolute';

export type ReservePurpose =
  | 'longevity'
  | 'emergency'
  | 'legacy'
  | 'healthcare'
  | 'peace_of_mind';

export interface ReserveConfig {
  /** How reserve is specified */
  type: ReserveType;
  /** Amount (only used if type is 'percentage' or 'absolute') */
  amount?: number;
  /** Optional purposes for documentation (does not affect calculations) */
  purposes?: ReservePurpose[];
  /** Optional notes */
  notes?: string;
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

  /** Optional spending phase configuration for age-based spending variation */
  spendingPhaseConfig?: SpendingPhaseConfig;

  /** Epic 10: Optional depletion target configuration */
  depletionTarget?: DepletionTarget;

  /** Epic 10.2: Pre-calculated absolute reserve floor amount */
  reserveFloor?: number;
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

  // Epic 9: Phase information for UI display
  activePhaseId?: string;
  activePhaseName?: string;

  // Epic 10.2: Reserve tracking
  /** Amount above reserve floor (undefined if no reserve configured) */
  reserveBalance?: number;
  /** Whether withdrawal was constrained by reserve this year */
  reserveConstrained?: boolean;
  /** Stage of spending reduction: none, discretionary_reduced, essentials_only, essentials_reduced */
  reductionStage?: 'none' | 'discretionary_reduced' | 'essentials_only' | 'essentials_reduced';
  /** Actual essential spending after reserve constraint (may be less than planned) */
  actualEssentialSpending?: number;
  /** Actual discretionary spending after reserve constraint (may be less than planned) */
  actualDiscretionarySpending?: number;
  /** Unmet spending need due to reserve constraint */
  spendingShortfall?: number;
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

  // Epic 10.2: Reserve summary
  /** The absolute dollar reserve floor (undefined if no reserve) */
  reserveFloor?: number;
  /** Number of years where spending was constrained by reserve */
  yearsReserveConstrained?: number;
  /** First age when discretionary spending was reduced due to reserve */
  firstReserveConstraintAge?: number | null;
  /** First age when reduced to essentials only */
  firstEssentialsOnlyAge?: number | null;
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
  /** Whether withdrawal was limited by reserve floor */
  reserveConstrained?: boolean;
  /** Unmet withdrawal need due to reserve constraint */
  reserveShortfall?: number;
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

/**
 * Comparison result between flat and phased spending strategies
 * Used by Story 9.2 to show trade-offs
 */
export interface SpendingComparison {
  flatSpending: {
    /** Total spending from retirement to maxAge */
    totalLifetimeSpending: number;
    /** Age when portfolio depletes, or null if never */
    portfolioDepletionAge: number | null;
    /** Portfolio balance at maxAge */
    endingBalance: number;
    /** Year-by-year spending amounts for chart */
    yearlySpending: { age: number; amount: number }[];
  };
  phasedSpending: {
    /** Total spending from retirement to maxAge */
    totalLifetimeSpending: number;
    /** Age when portfolio depletes, or null if never */
    portfolioDepletionAge: number | null;
    /** Portfolio balance at maxAge */
    endingBalance: number;
    /** Year-by-year spending with phase info for chart */
    yearlySpending: { age: number; amount: number; phase: string | null }[];
    /** Extra spending in early years vs flat approach */
    earlyYearsBonus: number;
    /** Number of years considered "early years" (default: first 10 years of retirement) */
    earlyYearsCount: number;
  };
  /** Age where cumulative spending equals between strategies, or null if never */
  breakEvenAge: number | null;
  /** Difference in portfolio longevity (positive = phased lasts longer) */
  longevityDifference: number;
}

/**
 * Response from /api/projections/compare endpoint
 */
export interface SpendingComparisonResponse {
  comparison: SpendingComparison;
  inputs: {
    retirementAge: number;
    maxAge: number;
    baseEssentialExpenses: number;
    baseDiscretionaryExpenses: number;
    phases: SpendingPhase[];
  };
  meta: {
    calculationTimeMs: number;
  };
}