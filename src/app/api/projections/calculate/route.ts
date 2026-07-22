import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { getServerUser } from '@/lib/auth/server';
import { db } from '@/db/client';
import { financialSnapshot } from '@/db/schema';
import { createSecureQuery } from '@/db/secure-query';
import {
  projectionCalculateRequestSchema,
  type ProjectionRequestInput,
} from '@/lib/validation/projections';
import {
  buildProjectionInputFromSnapshot,
  collectProjectionInputWarnings,
} from '@/lib/projections/input-builder';
import { runProjection } from '@/lib/projections/engine';
import { calculateDepletionFeedback } from '@/lib/projections/depletion-feedback';
import {
  buildProjectionAssumptions,
  getStoredProjectionOverrides,
} from '@/lib/projections/saved-overrides';
import type { ProjectionOverrides } from '@/lib/projections/types';
import { generateProjectionWarnings } from '@/lib/projections/warnings';
import { CURRENT_PROJECTION_CALCULATION_VERSION } from '@/lib/projections/version';
import { createTimer } from '@/lib/monitoring/performance';

function validateAgeRelationships(
  currentAge: number,
  retirementAge: number,
  maxAge: number
): { valid: false; message: string } | { valid: true } {
  if (maxAge <= currentAge) {
    return {
      valid: false,
      message: `Life expectancy (${maxAge}) must be greater than your current age (${currentAge}).`,
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

async function calculateProjection(
  userId: string,
  requestOverrides: ProjectionRequestInput = {},
  planId?: string
) {
  const [snapshot] = await db
    .select()
    .from(financialSnapshot)
    .where(eq(financialSnapshot.userId, userId))
    .limit(1);

  if (!snapshot) {
    return { error: 'Financial snapshot not found. Please complete onboarding.', status: 404 };
  }

  const secureQuery = createSecureQuery(userId);
  let resolvedOverrides: ProjectionOverrides = { ...requestOverrides };

  if (planId) {
    const plan = await secureQuery.getPlanById(planId);
    if (!plan) {
      return { error: 'Plan not found or access denied', status: 404 };
    }

    const savedProjection = await secureQuery.getProjectionForPlan(planId);
    resolvedOverrides = {
      ...getStoredProjectionOverrides(savedProjection?.assumptions),
      ...requestOverrides,
    };
  }

  const projectionInput = buildProjectionInputFromSnapshot(snapshot, resolvedOverrides);
  const ageValidation = validateAgeRelationships(
    projectionInput.currentAge,
    projectionInput.retirementAge,
    projectionInput.maxAge
  );
  if (!ageValidation.valid) {
    return { error: ageValidation.message, status: 400 };
  }

  const diagnosticWarnings = collectProjectionInputWarnings(snapshot);
  const inputWarnings = generateProjectionWarnings(projectionInput);
  const timer = createTimer();
  const result = runProjection(projectionInput);
  const calculationTimeMs = timer.getElapsed();
  const depletionFeedback = projectionInput.depletionTarget?.enabled
    ? calculateDepletionFeedback(projectionInput, result.records)
    : null;

  if (planId) {
    await secureQuery.saveProjectionResult(planId, {
      inputs: projectionInput,
      assumptions: buildProjectionAssumptions(projectionInput, resolvedOverrides),
      records: result.records,
      summary: result.summary,
      calculationTimeMs,
      calculationVersion: CURRENT_PROJECTION_CALCULATION_VERSION,
    });
  }

  return {
    projection: result,
    inputs: {
      currentAge: projectionInput.currentAge,
      birthYear: projectionInput.birthYear,
      retirementAge: projectionInput.retirementAge,
      maxAge: projectionInput.maxAge,
      expectedReturn: projectionInput.expectedReturn,
      inflationRate: projectionInput.inflationRate,
      contributionGrowthRate: projectionInput.contributionGrowthRate,
      incomeStreams: projectionInput.incomeStreams,
      spendingPhaseConfig: projectionInput.spendingPhaseConfig,
      depletionTarget: projectionInput.depletionTarget,
      reserveFloor: projectionInput.reserveFloor,
      rmdConfig: projectionInput.rmdConfig,
      annualExpenses: projectionInput.annualExpenses,
      annualDebtPayments: projectionInput.annualDebtPayments,
      annualContribution: projectionInput.annualContribution,
      annualContributionsByType: projectionInput.annualContributionsByType,
      startingBalancesByType: projectionInput.balancesByType,
    },
    depletionFeedback,
    meta: {
      calculationTimeMs,
      calculationVersion: CURRENT_PROJECTION_CALCULATION_VERSION,
      rmdConfig: projectionInput.rmdConfig,
      warnings: [...diagnosticWarnings, ...inputWarnings.map((warning) => warning.message)],
      inputWarnings: inputWarnings.length > 0 ? inputWarnings : undefined,
    },
  };
}

/** GET - Run an ad-hoc projection with snapshot defaults. */
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
    return NextResponse.json({ message: 'Failed to calculate projection' }, { status: 500 });
  }
}

/** POST - Run a validated ad-hoc or plan-persisted projection. */
export async function POST(request: NextRequest) {
  try {
    const user = await getServerUser();
    if (!user) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const body: unknown = await request.json();
    const parseResult = projectionCalculateRequestSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        { message: 'Invalid data', errors: parseResult.error.flatten() },
        { status: 400 }
      );
    }

    const { planId, ...requestOverrides } = parseResult.data;
    const result = await calculateProjection(user.id, requestOverrides, planId);
    if ('error' in result) {
      return NextResponse.json({ message: result.error }, { status: result.status });
    }
    return NextResponse.json(result);
  } catch (error) {
    console.error('Projection calculation error:', error);
    return NextResponse.json({ message: 'Failed to calculate projection' }, { status: 500 });
  }
}
