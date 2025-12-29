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
import { ACCOUNT_TAX_CATEGORY, type BalanceByType, type ProjectionInput, type IncomeStream } from '@/lib/projections/types';
import type { RiskTolerance } from '@/types/database';
import type { InvestmentAccountJson, DebtJson, IncomeExpensesJson, IncomeStreamJson } from '@/db/schema/financial-snapshot';
import { createTimer } from '@/lib/monitoring/performance';

/**
 * Build income streams from snapshot with backward compatibility
 * If incomeStreams exists, use it. Otherwise, generate SS stream from legacy fields.
 */
function buildIncomeStreams(
  snapshot: {
    incomeStreams?: IncomeStreamJson[] | null;
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
  const ssAge = overrides?.socialSecurityAge ?? DEFAULT_SS_AGE;
  const ssMonthly = overrides?.socialSecurityMonthly ??
    estimateSocialSecurityMonthly(parseFloat(snapshot.annualIncome));

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
  }];
}

/**
 * Helper to run projection and return response
 */
async function calculateProjection(userId: string, overrides: Record<string, unknown> = {}) {
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
  let annualExpenses: number;

  if (incomeExpenses?.monthlyEssential || incomeExpenses?.monthlyDiscretionary) {
    // Use actual expense data if available
    const monthly = (incomeExpenses.monthlyEssential || 0) + (incomeExpenses.monthlyDiscretionary || 0);
    annualExpenses = monthly * 12;
  } else {
    // Derive from income and savings rate
    annualExpenses = deriveAnnualExpenses(
      parseFloat(snapshot.annualIncome),
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

  // Run projection with performance timing
  const timer = createTimer();
  const result = runProjection(projectionInput);
  const calculationTimeMs = timer.getElapsed();

  if (process.env.NODE_ENV === 'development') {
    console.log(`Projection calculated in ${calculationTimeMs}ms`);
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
    const parseResult = projectionRequestSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        { message: 'Invalid data', errors: parseResult.error.flatten() },
        { status: 400 }
      );
    }

    const result = await calculateProjection(user.id, parseResult.data);

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
