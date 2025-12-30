import { NextRequest, NextResponse } from 'next/server';
import { getServerUser } from '@/lib/auth/server';
import { createSecureQuery } from '@/db/secure-query';
import { checkProjectionStaleness } from '@/lib/projections/staleness';
import { buildProjectionInputFromSnapshot } from '@/lib/projections/input-builder';

interface RouteParams {
  params: Promise<{ planId: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  const user = await getServerUser();
  if (!user) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const { planId } = await params;

  const secureQuery = createSecureQuery(user.id);

  // Verify user owns the plan
  const plan = await secureQuery.getPlanById(planId);
  if (!plan) {
    return NextResponse.json(
      { message: 'Plan not found or access denied' },
      { status: 404 }
    );
  }

  // Get stored projection
  const projectionResult = await secureQuery.getProjectionForPlan(planId);
  if (!projectionResult) {
    return NextResponse.json(
      { message: 'No projection found for this plan', isStale: true },
      { status: 200 }
    );
  }

  // Get current snapshot and build current inputs
  const snapshot = await secureQuery.getFinancialSnapshot();
  if (!snapshot) {
    return NextResponse.json(
      { message: 'No financial snapshot found' },
      { status: 404 }
    );
  }

  const currentInputs = buildProjectionInputFromSnapshot(snapshot, {});
  const staleness = checkProjectionStaleness(projectionResult.inputs, currentInputs);

  return NextResponse.json({
    ...staleness,
    lastCalculated: projectionResult.updatedAt,
  });
}
