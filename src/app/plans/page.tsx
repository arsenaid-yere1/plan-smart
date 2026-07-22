import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { db } from '@/db/client';
import { userProfile, financialSnapshot } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { createSecureQuery } from '@/db/secure-query';
import { PageContainer } from '@/components/layout';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { AlertCircle } from 'lucide-react';
import { runProjection } from '@/lib/projections';
import { calculateDepletionFeedback } from '@/lib/projections/depletion-feedback';
import type { DepletionTarget } from '@/lib/projections/types';
import {
  DEFAULT_INFLATION_RATE,
  DEFAULT_RETURN_RATES,
} from '@/lib/projections/assumptions';
import type { RiskTolerance } from '@/types/database';
import type { SpendingPhaseConfigJson } from '@/db/schema/financial-snapshot';
import type { SpendingPhaseConfig } from '@/lib/projections/types';
import { buildProjectionInputFromSnapshot } from '@/lib/projections/input-builder';
import {
  buildProjectionAssumptions,
  getStoredProjectionOverrides,
} from '@/lib/projections/saved-overrides';
import { shouldRecalculateProjection } from '@/lib/projections/staleness';
import { generateProjectionWarnings } from '@/lib/projections/warnings';
import { CURRENT_PROJECTION_CALCULATION_VERSION } from '@/lib/projections/version';
import { PlansClient } from './plans-client';

export const metadata: Metadata = {
  title: 'Your Retirement Projection - Plan Smart',
  description: 'View your personalized retirement projection with asset growth visualization and key financial metrics.',
};

async function getUser() {
  const cookieStore = await cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  return user;
}

export default async function PlansPage() {
  const user = await getUser();

  if (!user) {
    redirect('/auth/login');
  }

  // Check if user has completed onboarding
  const profiles = await db
    .select({ onboardingCompleted: userProfile.onboardingCompleted })
    .from(userProfile)
    .where(eq(userProfile.id, user.id))
    .limit(1);

  const profile = profiles[0];

  if (!profile || !profile.onboardingCompleted) {
    redirect('/onboarding');
  }

  // Fetch financial snapshot
  const snapshots = await db
    .select()
    .from(financialSnapshot)
    .where(eq(financialSnapshot.userId, user.id))
    .limit(1);

  const snapshot = snapshots[0];

  if (!snapshot) {
    return (
      <PageContainer>
        <Card>
          <CardHeader>
            <CardTitle>No Financial Data</CardTitle>
            <CardDescription>
              We couldn&apos;t find your financial information.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Missing Data</AlertTitle>
              <AlertDescription>
                Please complete the onboarding process to see your retirement
                projection.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      </PageContainer>
    );
  }

  // Get or create a default plan
  const secureQuery = createSecureQuery(user.id);
  const userPlans = await secureQuery.getUserPlans();
  let plan = userPlans[0];

  if (!plan) {
    plan = await secureQuery.createPlan({
      name: 'My Retirement Plan',
      description: 'Default retirement projection plan',
      config: {},
    });
  }

  // Check for existing saved projection
  const savedProjection = await secureQuery.getProjectionForPlan(plan.id);

  // Default assumptions from profile data
  const riskTolerance = snapshot.riskTolerance as RiskTolerance;
  const profileExpectedReturn = DEFAULT_RETURN_RATES[riskTolerance];
  const profileRetirementAge = snapshot.targetRetirementAge;

  const defaultAssumptions = {
    expectedReturn: profileExpectedReturn,
    inflationRate: DEFAULT_INFLATION_RATE,
    retirementAge: profileRetirementAge,
  };

  const resolvedOverrides = getStoredProjectionOverrides(savedProjection?.assumptions);
  const projectionInput = buildProjectionInputFromSnapshot(snapshot, resolvedOverrides);
  const currentAge = projectionInput.currentAge;
  const monthlySpending = Math.round(projectionInput.annualExpenses / 12);
  const currentAssumptions = {
    expectedReturn: projectionInput.expectedReturn,
    inflationRate: projectionInput.inflationRate,
    retirementAge: projectionInput.retirementAge,
  };
  const spendingPhaseConfig = snapshot.spendingPhases as SpendingPhaseConfigJson | null;
  const depletionTarget = projectionInput.depletionTarget as DepletionTarget | undefined;

  // Run projection with error handling
  let projection: ReturnType<typeof runProjection>;
  let projectionError = false;

  try {
    projection = runProjection(projectionInput);
    if (shouldRecalculateProjection(savedProjection, projectionInput)) {
      await secureQuery.saveProjectionResult(plan.id, {
        inputs: projectionInput,
        assumptions: buildProjectionAssumptions(projectionInput, resolvedOverrides),
        records: projection.records,
        summary: projection.summary,
        calculationVersion: CURRENT_PROJECTION_CALCULATION_VERSION,
      });
    }
  } catch {
    projectionError = true;
  }

  // Epic 10.3: Calculate depletion feedback if depletion target enabled
  const depletionFeedback = !projectionError && projectionInput.depletionTarget?.enabled
    ? calculateDepletionFeedback(projectionInput, projection!.records)
    : null;

  // Handle projection error
  if (projectionError) {
    return (
      <PageContainer>
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <AlertCircle className="h-12 w-12 text-destructive mb-4" />
          <h2 className="text-xl font-semibold mb-2">
            We couldn&apos;t generate your plan yet
          </h2>
          <p className="text-muted-foreground mb-6 max-w-md">
            Something went wrong while calculating your projection.
            Please try editing your inputs or contact support if the issue persists.
          </p>
          <Button asChild>
            <a href="/onboarding">Edit Inputs</a>
          </Button>
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <PlansClient
        initialProjection={projection!}
        currentAge={currentAge}
        defaultAssumptions={defaultAssumptions}
        currentAssumptions={currentAssumptions}
        monthlySpending={monthlySpending}
        planId={plan.id}
        initialSpendingConfig={spendingPhaseConfig as SpendingPhaseConfig | null}
        initialDepletionFeedback={depletionFeedback}
        depletionTarget={depletionTarget}
        initialInputWarnings={generateProjectionWarnings(projectionInput)}
        calculationVersion={CURRENT_PROJECTION_CALCULATION_VERSION}
      />
    </PageContainer>
  );
}
