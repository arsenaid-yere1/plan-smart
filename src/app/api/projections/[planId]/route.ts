import { NextRequest, NextResponse } from 'next/server';
import { getServerUser } from '@/lib/auth/server';
import { createSecureQuery } from '@/db/secure-query';
import { buildProjectionInputFromSnapshot } from '@/lib/projections/input-builder';
import { getStoredProjectionOverrides } from '@/lib/projections/saved-overrides';
import { checkProjectionStaleness } from '@/lib/projections/staleness';
import { CURRENT_PROJECTION_CALCULATION_VERSION } from '@/lib/projections/version';

interface RouteParams {
  params: Promise<{ planId: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  const user = await getServerUser();
  if (!user) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const { planId } = await params;

  if (!planId) {
    return NextResponse.json({ message: 'Plan ID is required' }, { status: 400 });
  }

  const secureQuery = createSecureQuery(user.id);

  // Verify user owns the plan
  const plan = await secureQuery.getPlanById(planId);
  if (!plan) {
    return NextResponse.json(
      { message: 'Plan not found or access denied' },
      { status: 404 }
    );
  }

  const projectionResult = await secureQuery.getProjectionForPlan(planId);

  if (!projectionResult) {
    return NextResponse.json(
      { message: 'No projection found for this plan' },
      { status: 404 }
    );
  }

  const snapshot = await secureQuery.getFinancialSnapshot();
  if (!snapshot) {
    return NextResponse.json({ message: 'No financial snapshot found' }, { status: 404 });
  }

  const currentInputs = buildProjectionInputFromSnapshot(
    snapshot,
    getStoredProjectionOverrides(projectionResult.assumptions)
  );
  const staleness = checkProjectionStaleness(
    projectionResult.inputs,
    currentInputs,
    projectionResult.calculationVersion,
    CURRENT_PROJECTION_CALCULATION_VERSION
  );

  return NextResponse.json({
    projectionResult,
    isStale: staleness.isStale,
    changedFields: staleness.changedFields,
    storedCalculationVersion: projectionResult.calculationVersion,
    currentCalculationVersion: CURRENT_PROJECTION_CALCULATION_VERSION,
  }, { status: 200 });
}
