import type {
  ProjectionInput,
  ProjectionOverrides,
  BalanceByType,
  IncomeStream,
  IncomeStreamOverride,
  TaxCategory,
  PropertySummary,
  SpendingPhaseConfig,
  ReserveConfig,
  DepletionTarget,
} from './types';
import { ACCOUNT_TAX_CATEGORY, isGuaranteedIncomeType } from './types';
import type {
  IncomeSourceJson,
  RealEstatePropertyJson,
} from '@/db/schema/financial-snapshot';
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
import { getRmdStartAge } from './rmd';
import type { RiskTolerance } from '@/types/database';

export type { ProjectionOverrides } from './types';

type FinancialSnapshotRow = typeof financialSnapshot.$inferSelect;

/**
 * Calculate the absolute reserve floor from reserve configuration
 */
function calculateReserveFloor(
  reserve: ReserveConfig | undefined,
  initialPortfolio: number,
  depletionTarget: DepletionTarget
): number | undefined {
  if (!reserve || !depletionTarget.enabled) {
    return undefined;
  }

  switch (reserve.type) {
    case 'derived':
      // Reserve = 100% - targetPercentageSpent
      return initialPortfolio * (1 - depletionTarget.targetPercentageSpent / 100);
    case 'percentage':
      return initialPortfolio * ((reserve.amount ?? 0) / 100);
    case 'absolute':
      return reserve.amount ?? 0;
    default:
      return undefined;
  }
}

const EARNED_INCOME_TYPES = new Set<IncomeSourceJson['type']>([
  'w2_employment',
  'self_employed',
  'business_owner',
  'contract_1099',
]);

function isKnownAccountType(type: string): type is keyof typeof ACCOUNT_TAX_CATEGORY {
  return Object.prototype.hasOwnProperty.call(ACCOUNT_TAX_CATEGORY, type);
}

function getVariabilityAdjustedIncome(sources: IncomeSourceJson[]): number {
  return sources.reduce((sum, source) => {
    const factor = source.variability === 'variable'
      ? 0.85
      : source.variability === 'seasonal'
        ? 0.9
        : 1;
    return sum + source.annualAmount * factor;
  }, 0);
}

function getSocialSecurityEarnings(
  sources: IncomeSourceJson[],
  fallbackAnnualIncome: number
): number {
  if (sources.length === 0) {
    return fallbackAnnualIncome;
  }

  return sources.reduce(
    (sum, source) => EARNED_INCOME_TYPES.has(source.type) ? sum + source.annualAmount : sum,
    0
  );
}

function normalizeIncomeStreams(streams: IncomeStreamOverride[]): IncomeStream[] {
  return streams.map((stream) => ({
    ...stream,
    isGuaranteed: stream.isGuaranteed ?? isGuaranteedIncomeType(stream.type),
    isSpouse: stream.isSpouse ?? false,
  }));
}

/** Preserve the calculate route's diagnostic warning for unknown account types. */
export function collectProjectionInputWarnings(snapshot: FinancialSnapshotRow): string[] {
  return (snapshot.investmentAccounts ?? [])
    .filter((account) => !isKnownAccountType(account.type))
    .map(
      (account) =>
        `Unknown account type "${account.type}" for "${account.label}" - treating as taxable`
    );
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
  const annualContributionsFromAccounts: BalanceByType = {
    taxDeferred: 0,
    taxFree: 0,
    taxable: 0,
  };

  const accounts = snapshot.investmentAccounts ?? [];
  for (const account of accounts) {
    const category: TaxCategory = isKnownAccountType(account.type)
      ? ACCOUNT_TAX_CATEGORY[account.type]
      : 'taxable';
    balancesByType[category] += account.balance;
    annualContributionsFromAccounts[category] += (account.monthlyContribution ?? 0) * 12;
  }

  // Calculate annual contribution
  const annualContribution = accounts.reduce(
    (sum, acc) => sum + (acc.monthlyContribution ?? 0) * 12,
    0
  );

  const contributionAllocation = overrides.contributionAllocation
    ?? (annualContribution > 0
      ? {
          taxDeferred: annualContributionsFromAccounts.taxDeferred / annualContribution * 100,
          taxFree: annualContributionsFromAccounts.taxFree / annualContribution * 100,
          taxable: annualContributionsFromAccounts.taxable / annualContribution * 100,
        }
      : DEFAULT_CONTRIBUTION_ALLOCATION);

  const annualContributionsByType = overrides.contributionAllocation
    ? {
        taxDeferred: annualContribution * overrides.contributionAllocation.taxDeferred / 100,
        taxFree: annualContribution * overrides.contributionAllocation.taxFree / 100,
        taxable: annualContribution * overrides.contributionAllocation.taxable / 100,
      }
    : annualContributionsFromAccounts;

  // Calculate annual expenses - preserve essential vs discretionary (Epic 8)
  let annualEssentialExpenses: number;
  let annualDiscretionaryExpenses: number;

  const incomeExpenses = snapshot.incomeExpenses;
  if (incomeExpenses?.monthlyEssential != null || incomeExpenses?.monthlyDiscretionary != null) {
    annualEssentialExpenses = (incomeExpenses.monthlyEssential ?? 0) * 12;
    annualDiscretionaryExpenses = (incomeExpenses.monthlyDiscretionary ?? 0) * 12;
  } else {
    // Fallback: derive from income/savings rate, treat all as essential
    const incomeSources = snapshot.incomeSources ?? [];
    const fallbackIncome = incomeSources.length > 0
      ? getVariabilityAdjustedIncome(incomeSources)
      : Number(snapshot.annualIncome);
    const derivedExpenses = deriveAnnualExpenses(
      fallbackIncome,
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

  if (overrides.incomeStreams !== undefined) {
    // An explicit empty array intentionally disables retirement income streams.
    incomeStreams = normalizeIncomeStreams(overrides.incomeStreams);
  } else if ((snapshot.incomeStreams ?? []).length > 0) {
    incomeStreams = normalizeIncomeStreams(snapshot.incomeStreams ?? []);
  } else {
    // No explicit income streams - auto-generate estimated Social Security
    const incomeSources = snapshot.incomeSources ?? [];
    const earningsForSocialSecurity = getSocialSecurityEarnings(
      incomeSources,
      Number(snapshot.annualIncome)
    );
    const ssMonthly = overrides.socialSecurityMonthly
      ?? estimateSocialSecurityMonthly(earningsForSocialSecurity);
    if (ssMonthly > 0) {
      incomeStreams = [{
        id: 'ss-auto',
        name: 'Social Security (estimated)',
        type: 'social_security',
        annualAmount: ssMonthly * 12,
        startAge: overrides.socialSecurityAge ?? DEFAULT_SS_AGE,
        endAge: undefined,
        inflationAdjusted: true,
        isGuaranteed: true,
        isSpouse: false,
      }];
    } else {
      incomeStreams = [];
    }
  }

  // Epic 9: Build spending phase config from overrides or snapshot
  // Override takes precedence over snapshot
  const spendingPhaseConfig = overrides.spendingPhaseConfig
    ?? (snapshot.spendingPhases as SpendingPhaseConfig | null)
    ?? undefined;

  // Epic 10.2: Calculate reserve floor from depletion target
  const depletionTarget = overrides.depletionTarget
    ?? (snapshot.depletionTarget as DepletionTarget | null)
    ?? undefined;

  const totalPortfolio = balancesByType.taxDeferred + balancesByType.taxFree + balancesByType.taxable;
  const reserveFloor = depletionTarget?.reserve
    ? calculateReserveFloor(depletionTarget.reserve, totalPortfolio, depletionTarget)
    : undefined;

  return {
    currentAge,
    birthYear: snapshot.birthYear,
    retirementAge,
    maxAge: overrides.maxAge ?? DEFAULT_MAX_AGE,
    balancesByType,
    annualContribution,
    annualContributionsByType,
    contributionAllocation,
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
    spendingPhaseConfig,
    depletionTarget,
    reserveFloor,
    rmdConfig: overrides.rmdConfig ?? {
      enabled: true,
      startAge: getRmdStartAge(snapshot.birthYear),
    },
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
