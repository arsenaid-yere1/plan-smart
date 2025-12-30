import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getServerUser } from '@/lib/auth/server';
import { createSecureQuery } from '@/db/secure-query';
import type {
  ProjectionInput,
  ProjectionRecord,
} from '@/lib/projections/types';

const saveProjectionSchema = z.object({
  planId: z.string().uuid(),
  inputs: z.custom<ProjectionInput>((val) => val !== null && typeof val === 'object'),
  assumptions: z.object({
    expectedReturn: z.number(),
    inflationRate: z.number(),
    healthcareInflationRate: z.number(),
    contributionGrowthRate: z.number(),
    retirementAge: z.number(),
    maxAge: z.number(),
  }),
  records: z.custom<ProjectionRecord[]>((val) => Array.isArray(val)),
  summary: z.object({
    startingBalance: z.number(),
    endingBalance: z.number(),
    totalContributions: z.number(),
    totalWithdrawals: z.number(),
    yearsUntilDepletion: z.number().nullable(),
    projectedRetirementBalance: z.number(),
  }),
  calculationTimeMs: z.number().optional(),
});

export async function POST(request: NextRequest) {
  const user = await getServerUser();
  if (!user) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: 'Invalid JSON' }, { status: 400 });
  }

  const parseResult = saveProjectionSchema.safeParse(body);
  if (!parseResult.success) {
    return NextResponse.json(
      { message: 'Invalid request', errors: parseResult.error.flatten() },
      { status: 400 }
    );
  }

  const { planId, inputs, assumptions, records, summary, calculationTimeMs } = parseResult.data;

  const secureQuery = createSecureQuery(user.id);

  // Verify user owns the plan
  const plan = await secureQuery.getPlanById(planId);
  if (!plan) {
    return NextResponse.json(
      { message: 'Plan not found or access denied' },
      { status: 404 }
    );
  }

  const result = await secureQuery.saveProjectionResult(planId, {
    inputs,
    assumptions,
    records,
    summary,
    calculationTimeMs,
  });

  return NextResponse.json({ projectionResult: result }, { status: 200 });
}
