import type { ProjectionInput, BalanceByType, IncomeStream, TaxCategory } from './types';
import { ACCOUNT_TAX_CATEGORY } from './types';
import type { financialSnapshot } from '@/db/schema/financial-snapshot';
import {
  DEFAULT_MAX_AGE,
  DEFAULT_INFLATION_RATE,
  DEFAULT_HEALTHCARE_INFLATION_RATE,
  DEFAULT_CONTRIBUTION_GROWTH_RATE,
  DEFAULT_CONTRIBUTION_ALLOCATION,
  DEFAULT_RETURN_RATES,
  deriveAnnualExpenses,
  estimateAnnualDebtPayments,
  estimateHealthcareCosts,
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

  // Calculate annual expenses
  let annualExpenses: number;
  const incomeExpenses = snapshot.incomeExpenses;
  if (incomeExpenses?.monthlyEssential != null || incomeExpenses?.monthlyDiscretionary != null) {
    annualExpenses =
      ((incomeExpenses.monthlyEssential ?? 0) + (incomeExpenses.monthlyDiscretionary ?? 0)) * 12;
  } else {
    annualExpenses = deriveAnnualExpenses(
      Number(snapshot.annualIncome),
      Number(snapshot.savingsRate)
    );
  }

  // Calculate debt payments
  const annualDebtPayments = estimateAnnualDebtPayments(snapshot.debts ?? []);

  // Determine retirement age
  const retirementAge = overrides.retirementAge ?? snapshot.targetRetirementAge;

  // Determine healthcare costs
  const annualHealthcareCosts =
    overrides.annualHealthcareCosts ?? estimateHealthcareCosts(retirementAge);

  // Build income streams
  const incomeStreams = overrides.incomeStreams ?? snapshot.incomeStreams ?? [];

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
    annualExpenses,
    annualHealthcareCosts,
    healthcareInflationRate: overrides.healthcareInflationRate ?? DEFAULT_HEALTHCARE_INFLATION_RATE,
    incomeStreams,
    annualDebtPayments,
  };
}
