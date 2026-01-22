import { NextRequest, NextResponse } from 'next/server';
import { getServerUser } from '@/lib/auth/server';
import { db } from '@/db/client';
import { financialSnapshot } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { buildProjectionInputFromSnapshot } from '@/lib/projections/input-builder';
import { calculateSpendingComparison } from '@/lib/projections/spending-comparison';
import type { SpendingComparisonResponse, SpendingPhaseConfig } from '@/lib/projections/types';
import { createTimer } from '@/lib/monitoring/performance';

/**
 * POST - Calculate spending comparison (flat vs phased)
 *
 * Request body:
 * {
 *   earlyYearsCount?: number; // Default 10
 *   spendingPhaseConfig?: SpendingPhaseConfig; // Override stored phases
 *   retirementAge?: number; // Override retirement age
 *   inflationRate?: number; // Override inflation rate
 *   expectedReturn?: number; // Override expected return
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getServerUser();
    if (!user) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    // Parse request body
    const body = await request.json().catch(() => ({}));
    const earlyYearsCount = body.earlyYearsCount ?? 10;
    const spendingPhaseConfigOverride = body.spendingPhaseConfig as
      | SpendingPhaseConfig
      | undefined;
    const retirementAgeOverride = body.retirementAge as number | undefined;
    const inflationRateOverride = body.inflationRate as number | undefined;
    const expectedReturnOverride = body.expectedReturn as number | undefined;

    // Fetch financial snapshot
    const [snapshot] = await db
      .select()
      .from(financialSnapshot)
      .where(eq(financialSnapshot.userId, user.id))
      .limit(1);

    if (!snapshot) {
      return NextResponse.json(
        { message: 'Financial snapshot not found. Please complete onboarding.' },
        { status: 404 }
      );
    }

    // Build projection input from snapshot
    const timer = createTimer();

    // Apply spending phase config (override or from snapshot)
    const spendingPhaseConfig =
      spendingPhaseConfigOverride ??
      (snapshot.spendingPhases as SpendingPhaseConfig | null) ??
      undefined;

    // Ensure phases are enabled for comparison
    if (!spendingPhaseConfig || !spendingPhaseConfig.enabled) {
      return NextResponse.json(
        {
          message:
            'Spending phases must be configured and enabled for comparison. Configure spending phases in your profile first.',
        },
        { status: 400 }
      );
    }

    // Build projection input with spending phases and assumption overrides
    const projectionInput = buildProjectionInputFromSnapshot(snapshot, {
      spendingPhaseConfig,
      retirementAge: retirementAgeOverride,
      inflationRate: inflationRateOverride,
      expectedReturn: expectedReturnOverride,
    });

    // Calculate comparison
    const comparison = calculateSpendingComparison(projectionInput, earlyYearsCount);
    const calculationTimeMs = timer.getElapsed();

    const response: SpendingComparisonResponse = {
      comparison,
      inputs: {
        retirementAge: projectionInput.retirementAge,
        maxAge: projectionInput.maxAge,
        baseEssentialExpenses: projectionInput.annualEssentialExpenses,
        baseDiscretionaryExpenses: projectionInput.annualDiscretionaryExpenses,
        phases: spendingPhaseConfig.phases,
      },
      meta: {
        calculationTimeMs,
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Spending comparison error:', error);
    return NextResponse.json(
      { message: 'Failed to calculate spending comparison' },
      { status: 500 }
    );
  }
}
