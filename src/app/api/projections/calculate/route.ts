import { NextRequest, NextResponse } from 'next/server';
import { getServerUser } from '@/lib/auth/server';
import { db } from '@/db/client';
import { financialSnapshot } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { projectionRequestSchema } from '@/lib/validation/projections';
import { runProjection } from '@/lib/projections/engine';
import {
  DEFAULT_RETURN_RATES,
  DEFAULT_INFLATION_RATE,
  DEFAULT_MAX_AGE,
  DEFAULT_SS_AGE,
  DEFAULT_CONTRIBUTION_ALLOCATION,
  DEFAULT_CONTRIBUTION_GROWTH_RATE,
  DEFAULT_HEALTHCARE_INFLATION_RATE,
  estimateSocialSecurityMonthly,
  deriveAnnualExpenses,
  estimateAnnualDebtPayments,
  estimateHealthcareCosts,
} from '@/lib/projections/assumptions';
import { ACCOUNT_TAX_CATEGORY, type BalanceByType, type ProjectionInput, type IncomeStream, type ProjectionAssumptions } from '@/lib/projections/types';
import { generateProjectionWarnings, type ProjectionWarning } from '@/lib/projections/warnings';
import { createSecureQuery } from '@/db/secure-query';
import type { RiskTolerance } from '@/types/database';
import type { InvestmentAccountJson, DebtJson, IncomeExpensesJson, IncomeStreamJson, IncomeSourceJson } from '@/db/schema/financial-snapshot';
import { createTimer } from '@/lib/monitoring/performance';

/**
 * Validate age relationships for projection input
 * Returns error message if invalid, null if valid
 */
function validateAgeRelationships(
  currentAge: number,
  retirementAge: number,
  maxAge: number
): { valid: false; message: string } | { valid: true } {
  if (currentAge >= retirementAge) {
    return {
      valid: false,
      message: `Retirement age (${retirementAge}) must be greater than your current age (${currentAge}). Please adjust your retirement age or update your birth year in your profile.`,
    };
  }

  if (retirementAge >= maxAge) {
    return {
      valid: false,
      message: `Life expectancy (${maxAge}) must be greater than your retirement age (${retirementAge}). Please increase life expectancy or reduce retirement age.`,
    };
  }

  return { valid: true };
}

/**
 * Calculate total annual income from income sources with variability adjustments.
 * Falls back to annualIncome if no income sources are defined.
 */
function calculateTotalIncome(
  incomeSources: IncomeSourceJson[] | null | undefined,
  annualIncome: string
): number {
  if (incomeSources && incomeSources.length > 0) {
    return incomeSources.reduce((sum, source) => {
      // Apply variability adjustment for conservative estimates
      const adjustmentFactor =
        source.variability === 'variable'
          ? 0.85
          : source.variability === 'seasonal'
          ? 0.9
          : 1.0;
      return sum + source.annualAmount * adjustmentFactor;
    }, 0);
  }
  return parseFloat(annualIncome);
}

/**
 * Build income streams from snapshot with backward compatibility
 * If incomeStreams exists, use it. Otherwise, generate SS stream from legacy fields.
 */
function buildIncomeStreams(
  snapshot: {
    incomeStreams?: IncomeStreamJson[] | null;
    incomeSources?: IncomeSourceJson[] | null;
    annualIncome: string;
  },
  overrides?: {
    incomeStreams?: IncomeStream[];
    socialSecurityAge?: number;
    socialSecurityMonthly?: number;
  }
): IncomeStream[] {
  // If overrides provide income streams, use those
  if (overrides?.incomeStreams && overrides.incomeStreams.length > 0) {
    return overrides.incomeStreams;
  }

  // If snapshot has income streams, use those
  if (snapshot.incomeStreams && snapshot.incomeStreams.length > 0) {
    return snapshot.incomeStreams;
  }

  // Backward compatibility: generate Social Security stream from legacy approach
  // Use aggregated income from income sources if available, otherwise fall back to annualIncome
  const incomeForSS = snapshot.incomeSources && snapshot.incomeSources.length > 0
    ? snapshot.incomeSources.reduce((sum, s) => sum + s.annualAmount, 0)
    : parseFloat(snapshot.annualIncome);

  const ssAge = overrides?.socialSecurityAge ?? DEFAULT_SS_AGE;
  const ssMonthly = overrides?.socialSecurityMonthly ??
    estimateSocialSecurityMonthly(incomeForSS);

  if (ssMonthly <= 0) {
    return [];
  }

  return [{
    id: 'ss-auto',
    name: 'Social Security',
    type: 'social_security' as const,
    annualAmount: ssMonthly * 12,
    startAge: ssAge,
    endAge: undefined,
    inflationAdjusted: true,
    isGuaranteed: true,
    isSpouse: false,
  }];
}

/**
 * Helper to run projection and return response
 */
async function calculateProjection(
  userId: string,
  overrides: Record<string, unknown> = {},
  planId?: string
) {
  // Fetch financial snapshot
  const [snapshot] = await db
    .select()
    .from(financialSnapshot)
    .where(eq(financialSnapshot.userId, userId))
    .limit(1);

  if (!snapshot) {
    return { error: 'Financial snapshot not found. Please complete onboarding.', status: 404 };
  }

  // Map financial snapshot to projection input
  const currentYear = new Date().getFullYear();
  const currentAge = currentYear - snapshot.birthYear;
  const riskTolerance = snapshot.riskTolerance as RiskTolerance;

  // Calculate balances by tax category (with warning for unknown types)
  const accounts = (snapshot.investmentAccounts || []) as InvestmentAccountJson[];
  const balancesByType: BalanceByType = {
    taxDeferred: 0,
    taxFree: 0,
    taxable: 0,
  };
  const warnings: string[] = [];

  accounts.forEach((account) => {
    const knownType = account.type as keyof typeof ACCOUNT_TAX_CATEGORY;
    if (!(knownType in ACCOUNT_TAX_CATEGORY)) {
      warnings.push(`Unknown account type "${account.type}" for "${account.label}" - treating as taxable`);
    }
    const category = ACCOUNT_TAX_CATEGORY[knownType] || 'taxable';
    balancesByType[category] += account.balance;
  });

  // Calculate annual contribution from monthly contributions
  const annualContribution = accounts.reduce(
    (sum, account) => sum + (account.monthlyContribution || 0) * 12,
    0
  );

  // Calculate annual expenses
  const incomeExpenses = snapshot.incomeExpenses as IncomeExpensesJson | null;
  const incomeSources = snapshot.incomeSources as IncomeSourceJson[] | null;
  let annualExpenses: number;

  if (incomeExpenses?.monthlyEssential || incomeExpenses?.monthlyDiscretionary) {
    // Use actual expense data if available
    const monthly = (incomeExpenses.monthlyEssential || 0) + (incomeExpenses.monthlyDiscretionary || 0);
    annualExpenses = monthly * 12;
  } else {
    // Derive from income and savings rate
    // Use aggregated income from income sources if available (with variability adjustments)
    const totalIncome = calculateTotalIncome(incomeSources, snapshot.annualIncome);
    annualExpenses = deriveAnnualExpenses(
      totalIncome,
      parseFloat(snapshot.savingsRate)
    );
  }

  // Estimate debt payments
  const debts = (snapshot.debts || []) as DebtJson[];
  const annualDebtPayments = estimateAnnualDebtPayments(debts);

  // Determine retirement age (allow override)
  const retirementAge = (overrides.retirementAge as number) ?? snapshot.targetRetirementAge;

  // Estimate healthcare costs based on retirement age (use retirement age for initial estimate)
  const annualHealthcareCosts = (overrides.annualHealthcareCosts as number) ??
    estimateHealthcareCosts(retirementAge);

  // Build income streams with backward compatibility
  const incomeStreams = buildIncomeStreams(snapshot, overrides as {
    incomeStreams?: IncomeStream[];
    socialSecurityAge?: number;
    socialSecurityMonthly?: number;
  });

  // Build projection input with defaults and overrides
  const projectionInput: ProjectionInput = {
    currentAge,
    retirementAge,
    maxAge: (overrides.maxAge as number) ?? DEFAULT_MAX_AGE,
    balancesByType,
    annualContribution,
    contributionAllocation: (overrides.contributionAllocation as BalanceByType) ?? DEFAULT_CONTRIBUTION_ALLOCATION,
    expectedReturn: (overrides.expectedReturn as number) ?? DEFAULT_RETURN_RATES[riskTolerance],
    inflationRate: (overrides.inflationRate as number) ?? DEFAULT_INFLATION_RATE,
    contributionGrowthRate: (overrides.contributionGrowthRate as number) ?? DEFAULT_CONTRIBUTION_GROWTH_RATE,
    annualExpenses,
    annualHealthcareCosts,
    healthcareInflationRate: (overrides.healthcareInflationRate as number) ?? DEFAULT_HEALTHCARE_INFLATION_RATE,
    incomeStreams, // New: replaces socialSecurityAge/socialSecurityMonthly
    annualDebtPayments,
  };

  // Validate age relationships
  const ageValidation = validateAgeRelationships(
    currentAge,
    projectionInput.retirementAge,
    projectionInput.maxAge
  );

  if (!ageValidation.valid) {
    return {
      error: ageValidation.message,
      status: 400,
    };
  }

  // Generate warnings for unusual inputs
  const inputWarnings: ProjectionWarning[] = generateProjectionWarnings(projectionInput);
  warnings.push(...inputWarnings.map(w => w.message));

  // Run projection with performance timing
  const timer = createTimer();
  const result = runProjection(projectionInput);
  const calculationTimeMs = timer.getElapsed();

  if (process.env.NODE_ENV === 'development') {
    console.log(`Projection calculated in ${calculationTimeMs}ms`);
  }

  // Save projection if planId provided
  if (planId) {
    const secureQuery = createSecureQuery(userId);

    const assumptions: ProjectionAssumptions = {
      expectedReturn: projectionInput.expectedReturn,
      inflationRate: projectionInput.inflationRate,
      healthcareInflationRate: projectionInput.healthcareInflationRate,
      contributionGrowthRate: projectionInput.contributionGrowthRate,
      retirementAge: projectionInput.retirementAge,
      maxAge: projectionInput.maxAge,
    };

    await secureQuery.saveProjectionResult(planId, {
      inputs: projectionInput,
      assumptions,
      records: result.records,
      summary: result.summary,
      calculationTimeMs,
    });
  }

  return {
    projection: result,
    // Enhanced input echo for debugging
    inputs: {
      currentAge,
      retirementAge: projectionInput.retirementAge,
      maxAge: projectionInput.maxAge,
      expectedReturn: projectionInput.expectedReturn,
      inflationRate: projectionInput.inflationRate,
      contributionGrowthRate: projectionInput.contributionGrowthRate,
      incomeStreams: projectionInput.incomeStreams, // New field
      // Derived values for transparency
      annualExpenses,
      annualDebtPayments,
      annualContribution,
      startingBalancesByType: balancesByType,
    },
    meta: {
      calculationTimeMs,
      warnings: warnings.length > 0 ? warnings : undefined,
      inputWarnings: inputWarnings.length > 0 ? inputWarnings : undefined,
    },
  };
}

/**
 * GET - Run projection with all defaults
 */
export async function GET() {
  try {
    const user = await getServerUser();
    if (!user) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const result = await calculateProjection(user.id);

    if ('error' in result) {
      return NextResponse.json({ message: result.error }, { status: result.status });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Projection calculation error:', error);
    return NextResponse.json(
      { message: 'Failed to calculate projection' },
      { status: 500 }
    );
  }
}

/**
 * POST - Run projection with optional overrides
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getServerUser();
    if (!user) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    // Validate request body (optional overrides)
    const body = await request.json();
    const { planId, ...overridesBody } = body;
    const parseResult = projectionRequestSchema.safeParse(overridesBody);

    if (!parseResult.success) {
      return NextResponse.json(
        { message: 'Invalid data', errors: parseResult.error.flatten() },
        { status: 400 }
      );
    }

    const result = await calculateProjection(user.id, parseResult.data, planId);

    if ('error' in result) {
      return NextResponse.json({ message: result.error }, { status: result.status });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Projection calculation error:', error);
    return NextResponse.json(
      { message: 'Failed to calculate projection' },
      { status: 500 }
    );
  }
}
