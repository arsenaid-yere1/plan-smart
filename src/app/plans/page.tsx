import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { db } from '@/db/client';
import { userProfile, financialSnapshot } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { createSecureQuery } from '@/db/secure-query';
import type { ProjectionAssumptions } from '@/lib/projections/types';
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
import type { ProjectionInput } from '@/lib/projections/types';
import {
  DEFAULT_INFLATION_RATE,
  DEFAULT_MAX_AGE,
  DEFAULT_RETURN_RATES,
  DEFAULT_SS_AGE,
  DEFAULT_CONTRIBUTION_ALLOCATION,
  DEFAULT_CONTRIBUTION_GROWTH_RATE,
  DEFAULT_HEALTHCARE_INFLATION_RATE,
  estimateHealthcareCosts,
  estimateSocialSecurityMonthly,
  deriveAnnualExpenses,
  estimateAnnualDebtPayments,
} from '@/lib/projections/assumptions';
import type { RiskTolerance } from '@/types/database';
import {
  ACCOUNT_TAX_CATEGORY,
  type BalanceByType,
} from '@/lib/projections/types';
import type {
  InvestmentAccountJson,
  DebtJson,
  IncomeExpensesJson,
  IncomeStreamJson,
} from '@/db/schema/financial-snapshot';
import type { IncomeStream } from '@/lib/projections/types';
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

  // Calculate current age from birth year
  const currentYear = new Date().getFullYear();
  const currentAge = currentYear - snapshot.birthYear;
  const retirementAge = snapshot.targetRetirementAge;

  // Calculate balances by tax category
  const balancesByType: BalanceByType = {
    taxDeferred: 0,
    taxFree: 0,
    taxable: 0,
  };

  const accounts = (snapshot.investmentAccounts || []) as InvestmentAccountJson[];

  for (const account of accounts) {
    const category =
      ACCOUNT_TAX_CATEGORY[account.type as keyof typeof ACCOUNT_TAX_CATEGORY] ||
      'taxable';
    balancesByType[category] += account.balance;
  }

  // Calculate annual contribution from monthly contributions
  const annualContribution = accounts.reduce(
    (sum, account) => sum + (account.monthlyContribution || 0) * 12,
    0
  );

  // Calculate annual expenses
  const incomeExpenses = snapshot.incomeExpenses as IncomeExpensesJson | null;
  let annualExpenses: number;

  if (incomeExpenses?.monthlyEssential || incomeExpenses?.monthlyDiscretionary) {
    const monthly =
      (incomeExpenses.monthlyEssential || 0) +
      (incomeExpenses.monthlyDiscretionary || 0);
    annualExpenses = monthly * 12;
  } else {
    annualExpenses = deriveAnnualExpenses(
      parseFloat(snapshot.annualIncome),
      parseFloat(snapshot.savingsRate)
    );
  }

  // Estimate debt payments
  const debts = (snapshot.debts || []) as DebtJson[];
  const annualDebtPayments = estimateAnnualDebtPayments(debts);

  // Build income streams with backward compatibility
  let incomeStreams: IncomeStream[];
  const storedStreams = snapshot.incomeStreams as IncomeStreamJson[] | null;

  if (storedStreams && storedStreams.length > 0) {
    incomeStreams = storedStreams;
  } else {
    // Backward compatibility: generate Social Security stream
    const ssMonthly = estimateSocialSecurityMonthly(parseFloat(snapshot.annualIncome));
    if (ssMonthly > 0) {
      incomeStreams = [{
        id: 'ss-auto',
        name: 'Social Security',
        type: 'social_security' as const,
        annualAmount: ssMonthly * 12,
        startAge: DEFAULT_SS_AGE,
        endAge: undefined,
        inflationAdjusted: true,
      }];
    } else {
      incomeStreams = [];
    }
  }

  // Build projection input
  const riskTolerance = snapshot.riskTolerance as RiskTolerance;
  const expectedReturn = DEFAULT_RETURN_RATES[riskTolerance];

  const projectionInput: ProjectionInput = {
    currentAge,
    retirementAge,
    maxAge: DEFAULT_MAX_AGE,
    balancesByType,
    annualContribution,
    contributionAllocation: DEFAULT_CONTRIBUTION_ALLOCATION,
    expectedReturn,
    inflationRate: DEFAULT_INFLATION_RATE,
    contributionGrowthRate: DEFAULT_CONTRIBUTION_GROWTH_RATE,
    annualExpenses,
    annualHealthcareCosts: estimateHealthcareCosts(retirementAge),
    healthcareInflationRate: DEFAULT_HEALTHCARE_INFLATION_RATE,
    incomeStreams,
    annualDebtPayments,
  };

  // Run projection with error handling
  let projection: ReturnType<typeof runProjection>;
  let projectionError = false;

  try {
    projection = runProjection(projectionInput);
  } catch {
    projectionError = true;
  }

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

  // Build default assumptions from profile data
  const defaultAssumptions = {
    expectedReturn,
    inflationRate: DEFAULT_INFLATION_RATE,
    retirementAge,
  };

  // Calculate monthly spending for display
  const monthlySpending = Math.round(annualExpenses / 12);

  // Get or create default plan and save projection for AI summary
  let projectionResultId: string | null = null;
  try {
    const secureQuery = createSecureQuery(user.id);

    // Get or create a default plan
    const userPlans = await secureQuery.getUserPlans();
    let plan = userPlans[0];

    if (!plan) {
      // Create a default plan
      plan = await secureQuery.createPlan({
        name: 'My Retirement Plan',
        description: 'Default retirement projection plan',
        config: {},
      });
    }

    // Build assumptions object for storage
    const assumptions: ProjectionAssumptions = {
      expectedReturn: projectionInput.expectedReturn,
      inflationRate: projectionInput.inflationRate,
      healthcareInflationRate: projectionInput.healthcareInflationRate,
      contributionGrowthRate: projectionInput.contributionGrowthRate,
      retirementAge: projectionInput.retirementAge,
      maxAge: projectionInput.maxAge,
    };

    // Save projection result
    const savedProjection = await secureQuery.saveProjectionResult(plan.id, {
      inputs: projectionInput,
      assumptions,
      records: projection!.records,
      summary: projection!.summary,
    });

    projectionResultId = savedProjection.id;
  } catch (error) {
    // Log but don't fail - AI summary is optional
    console.error('Failed to save projection for AI summary:', error);
  }

  return (
    <PageContainer>
      <PlansClient
        initialProjection={projection!}
        currentAge={currentAge}
        defaultAssumptions={defaultAssumptions}
        monthlySpending={monthlySpending}
        projectionResultId={projectionResultId}
      />
    </PageContainer>
  );
}
