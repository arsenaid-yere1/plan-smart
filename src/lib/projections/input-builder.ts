import type { ProjectionInput, BalanceByType, IncomeStream, TaxCategory, PropertySummary, IncomeStreamType } from './types';
import { ACCOUNT_TAX_CATEGORY, isGuaranteedIncomeType } from './types';
import type { RealEstatePropertyJson } from '@/db/schema/financial-snapshot';
import type { financialSnapshot } from '@/db/schema/financial-snapshot';
import {
  DEFAULT_MAX_AGE,
  DEFAULT_INFLATION_RATE,
  DEFAULT_HEALTHCARE_INFLATION_RATE,
  DEFAULT_CONTRIBUTION_GROWTH_RATE,
  DEFAULT_CONTRIBUTION_ALLOCATION,
  DEFAULT_RETURN_RATES,
  DEFAULT_SS_AGE,
  deriveAnnualExpenses,
  estimateAnnualDebtPayments,
  estimateHealthcareCosts,
  estimateSocialSecurityMonthly,
} from './assumptions';
import type { RiskTolerance } from '@/types/database';

type FinancialSnapshotRow = typeof financialSnapshot.$inferSelect;

export interface ProjectionOverrides {
  expectedReturn?: number;
  inflationRate?: number;
  maxAge?: number;
  contributionGrowthRate?: number;
  retirementAge?: number;
  incomeStreams?: IncomeStream[];
  annualHealthcareCosts?: number;
  healthcareInflationRate?: number;
  contributionAllocation?: BalanceByType;
}

export function buildProjectionInputFromSnapshot(
  snapshot: FinancialSnapshotRow,
  overrides: ProjectionOverrides
): ProjectionInput {
  const currentYear = new Date().getFullYear();
  const currentAge = currentYear - snapshot.birthYear;
  const riskTolerance = snapshot.riskTolerance as RiskTolerance;

  // Aggregate balances by tax category
  const balancesByType: BalanceByType = {
    taxDeferred: 0,
    taxFree: 0,
    taxable: 0,
  };

  const accounts = snapshot.investmentAccounts ?? [];
  for (const account of accounts) {
    const category: TaxCategory = ACCOUNT_TAX_CATEGORY[account.type as keyof typeof ACCOUNT_TAX_CATEGORY] ?? 'taxable';
    balancesByType[category] += account.balance;
  }

  // Calculate annual contribution
  const annualContribution = accounts.reduce(
    (sum, acc) => sum + (acc.monthlyContribution ?? 0) * 12,
    0
  );

  // Calculate annual expenses - preserve essential vs discretionary (Epic 8)
  let annualEssentialExpenses: number;
  let annualDiscretionaryExpenses: number;

  const incomeExpenses = snapshot.incomeExpenses;
  if (incomeExpenses?.monthlyEssential != null || incomeExpenses?.monthlyDiscretionary != null) {
    annualEssentialExpenses = (incomeExpenses.monthlyEssential ?? 0) * 12;
    annualDiscretionaryExpenses = (incomeExpenses.monthlyDiscretionary ?? 0) * 12;
  } else {
    // Fallback: derive from income/savings rate, treat all as essential
    const derivedExpenses = deriveAnnualExpenses(
      Number(snapshot.annualIncome),
      Number(snapshot.savingsRate)
    );
    annualEssentialExpenses = derivedExpenses;
    annualDiscretionaryExpenses = 0;
  }

  // For backward compatibility
  const annualExpenses = annualEssentialExpenses + annualDiscretionaryExpenses;

  // Calculate debt payments
  const annualDebtPayments = estimateAnnualDebtPayments(snapshot.debts ?? []);

  // Determine retirement age
  const retirementAge = overrides.retirementAge ?? snapshot.targetRetirementAge;

  // Determine healthcare costs
  const annualHealthcareCosts =
    overrides.annualHealthcareCosts ?? estimateHealthcareCosts(retirementAge);

  // Build income streams with migration for legacy data
  let incomeStreams: IncomeStream[];
  const rawStreams = overrides.incomeStreams ?? snapshot.incomeStreams ?? [];

  if (rawStreams.length > 0) {
    // User has explicit income streams - use them with migration for legacy data
    incomeStreams = rawStreams.map(stream => ({
      ...stream,
      isGuaranteed: stream.isGuaranteed ?? isGuaranteedIncomeType(stream.type as IncomeStreamType),
      isSpouse: stream.isSpouse ?? false,
    }));
  } else {
    // No explicit income streams - auto-generate estimated Social Security
    const ssMonthly = estimateSocialSecurityMonthly(Number(snapshot.annualIncome));
    if (ssMonthly > 0) {
      incomeStreams = [{
        id: 'ss-auto',
        name: 'Social Security (estimated)',
        type: 'social_security',
        annualAmount: ssMonthly * 12,
        startAge: DEFAULT_SS_AGE,
        endAge: undefined,
        inflationAdjusted: true,
        isGuaranteed: true,
        isSpouse: false,
      }];
    } else {
      incomeStreams = [];
    }
  }

  return {
    currentAge,
    retirementAge,
    maxAge: overrides.maxAge ?? DEFAULT_MAX_AGE,
    balancesByType,
    annualContribution,
    contributionAllocation: overrides.contributionAllocation ?? DEFAULT_CONTRIBUTION_ALLOCATION,
    expectedReturn: overrides.expectedReturn ?? DEFAULT_RETURN_RATES[riskTolerance],
    inflationRate: overrides.inflationRate ?? DEFAULT_INFLATION_RATE,
    contributionGrowthRate: overrides.contributionGrowthRate ?? DEFAULT_CONTRIBUTION_GROWTH_RATE,
    annualEssentialExpenses,
    annualDiscretionaryExpenses,
    annualExpenses, // backward compatibility
    annualHealthcareCosts,
    healthcareInflationRate: overrides.healthcareInflationRate ?? DEFAULT_HEALTHCARE_INFLATION_RATE,
    incomeStreams,
    annualDebtPayments,
  };
}

/**
 * Calculate property summary for net worth display.
 * This is for display purposes only - does NOT modify projection calculations.
 */
export function calculatePropertySummary(
  properties: RealEstatePropertyJson[] | null | undefined
): PropertySummary {
  const props = properties ?? [];

  let totalValue = 0;
  let totalMortgage = 0;

  for (const property of props) {
    totalValue += property.estimatedValue ?? 0;
    totalMortgage += property.mortgageBalance ?? 0;
  }

  return {
    totalValue,
    totalMortgage,
    totalEquity: totalValue - totalMortgage,
  };
}
