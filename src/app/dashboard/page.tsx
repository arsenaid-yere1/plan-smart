import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { db } from '@/db/client';
import { userProfile, financialSnapshot } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { createSecureQuery } from '@/db/secure-query';
import { PageContainer } from '@/components/layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle2, AlertTriangle, XCircle, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { runProjection, getRetirementStatus } from '@/lib/projections';
import { CURRENT_PROJECTION_CALCULATION_VERSION } from '@/lib/projections/version';
import { buildProjectionInputFromSnapshot } from '@/lib/projections/input-builder';
import { buildProjectionAssumptions, getStoredProjectionOverrides } from '@/lib/projections/saved-overrides';
import { shouldRecalculateProjection } from '@/lib/projections/staleness';
import type {
  InvestmentAccountJson,
  DebtJson,
  RealEstatePropertyJson,
} from '@/db/schema/financial-snapshot';
import { DashboardClient } from './dashboard-client';
import { cn } from '@/lib/utils';
import { calculateNetWorth } from '@/lib/utils/net-worth';
import { NetWorthSummary } from '@/components/dashboard/NetWorthSummary';

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

export default async function DashboardPage() {
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

  // Redirect to onboarding if not completed
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

  // If no snapshot, show minimal dashboard
  if (!snapshot) {
    return (
      <PageContainer>
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Welcome to Plan Smart
            </h1>
            <p className="text-muted-foreground">
              Complete your financial profile to see your retirement outlook.
            </p>
          </div>
          <Card>
            <CardHeader>
              <CardTitle>Get Started</CardTitle>
              <CardDescription>Complete onboarding to see your projections</CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild>
                <Link href="/onboarding">Complete Setup</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </PageContainer>
    );
  }

  // Get current age for display
  const currentYear = new Date().getFullYear();
  const currentAge = currentYear - snapshot.birthYear;

  // Initialize projection data
  const secureQuery = createSecureQuery(user.id);
  let projectionResultId: string | null = null;
  let status: 'on-track' | 'needs-adjustment' | 'at-risk' = 'on-track';
  let projectedBalance = 0;
  let yearsUntilDepletion: number | null = null;
  let retirementAge = snapshot.targetRetirementAge;

  try {
    // Get or create a default plan
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

    const resolvedOverrides = getStoredProjectionOverrides(savedProjection?.assumptions);
    const projectionInput = buildProjectionInputFromSnapshot(snapshot, resolvedOverrides);
    const needsRefresh = shouldRecalculateProjection(savedProjection, projectionInput);

    const freshProjection = needsRefresh
      ? runProjection(projectionInput)
      : {
          records: savedProjection!.records,
          summary: savedProjection!.summary,
        };

    if (needsRefresh) {
      const saved = await secureQuery.saveProjectionResult(plan.id, {
        inputs: projectionInput,
        assumptions: buildProjectionAssumptions(projectionInput, resolvedOverrides),
        records: freshProjection.records,
        summary: freshProjection.summary,
        calculationVersion: CURRENT_PROJECTION_CALCULATION_VERSION,
      });
      projectionResultId = saved.id;
    } else {
      projectionResultId = savedProjection!.id;
    }

    retirementAge = projectionInput.retirementAge;
    projectedBalance = freshProjection.summary.projectedRetirementBalance;
    yearsUntilDepletion = freshProjection.summary.yearsUntilDepletion;
    status = getRetirementStatus(freshProjection.summary, currentAge).status;
  } catch (error) {
    console.error('Failed to load/run projection:', error);
  }

  const StatusIcon = status === 'on-track'
    ? CheckCircle2
    : status === 'needs-adjustment'
      ? AlertTriangle
      : XCircle;

  const statusLabel = status === 'on-track'
    ? 'On Track'
    : status === 'needs-adjustment'
      ? 'Needs Adjustment'
      : 'At Risk';

  const formatCurrency = (value: number) => {
    if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
    if (value >= 1_000) return `$${Math.round(value / 1_000)}K`;
    return `$${Math.round(value)}`;
  };

  // Calculate net worth
  const netWorthBreakdown = calculateNetWorth(
    snapshot.investmentAccounts as InvestmentAccountJson[] | null,
    snapshot.realEstateProperties as RealEstatePropertyJson[] | null,
    snapshot.debts as DebtJson[] | null
  );

  return (
    <PageContainer>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Welcome to Plan Smart
          </h1>
          <p className="text-muted-foreground">
            Your personalized retirement planning dashboard.
          </p>
        </div>

        {/* Status Overview */}
        <div className="flex items-center gap-4">
          <div
            className={cn(
              'inline-flex items-center gap-2 rounded-full px-4 py-2 text-lg font-semibold',
              status === 'on-track' && 'bg-success/10 text-success',
              status === 'needs-adjustment' && 'bg-warning/10 text-warning',
              status === 'at-risk' && 'bg-destructive/10 text-destructive'
            )}
          >
            <StatusIcon className="h-6 w-6" />
            {statusLabel}
          </div>
        </div>

        {/* Net Worth Summary */}
        <NetWorthSummary breakdown={netWorthBreakdown} variant="compact" />

        {/* AI Summary */}
        <DashboardClient
          projectionResultId={projectionResultId}
          status={status}
          projectedRetirementBalance={projectedBalance}
          yearsUntilDepletion={yearsUntilDepletion}
        />

        {/* Quick Stats */}
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>At Retirement (Age {retirementAge})</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-foreground">
                {formatCurrency(projectedBalance)}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Current Age</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-foreground">{currentAge}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Retirement Age</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-foreground">{retirementAge}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Funds Last Until</CardDescription>
            </CardHeader>
            <CardContent>
              {yearsUntilDepletion === null ? (
                <p className="text-2xl font-bold text-success">Age 90+</p>
              ) : (
                <p className="text-2xl font-bold text-destructive">
                  Age {currentAge + yearsUntilDepletion}
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* View Full Plan Link */}
        <Card>
          <CardHeader>
            <CardTitle>Detailed Projection</CardTitle>
            <CardDescription>
              View charts, adjust assumptions, and explore your retirement plan in detail.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link href="/plans" className="inline-flex items-center gap-2">
                View Full Plan
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </PageContainer>
  );
}
