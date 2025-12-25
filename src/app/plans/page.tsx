import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { db } from '@/db/client';
import { userProfile, financialSnapshot } from '@/db/schema';
import { eq } from 'drizzle-orm';
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
import { AlertCircle, CheckCircle2, AlertTriangle, XCircle } from 'lucide-react';
import { ProjectionChart, ProjectionTable } from '@/components/projections';
import { runProjection, getRetirementStatus, type RetirementStatus } from '@/lib/projections';
import { cn } from '@/lib/utils';
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
} from '@/db/schema/financial-snapshot';

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
    socialSecurityAge: DEFAULT_SS_AGE,
    socialSecurityMonthly: estimateSocialSecurityMonthly(
      parseFloat(snapshot.annualIncome)
    ),
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

  // Get retirement status
  const statusResult = getRetirementStatus(projection!.summary, currentAge);

  // Calculate monthly spending (inflation-adjusted to retirement)
  const monthlySpending = incomeExpenses
    ? (incomeExpenses.monthlyEssential || 0) + (incomeExpenses.monthlyDiscretionary || 0)
    : annualExpenses / 12;
  const yearsToRetirement = retirementAge - currentAge;
  const inflationFactor = Math.pow(1 + DEFAULT_INFLATION_RATE, yearsToRetirement);
  const monthlySpendingAtRetirement = Math.round(monthlySpending * inflationFactor);

  // Format currency helper
  const formatCurrency = (value: number) => {
    if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
    if (value >= 1_000) return `$${Math.round(value / 1_000)}K`;
    return `$${Math.round(value)}`;
  };

  const formatFullCurrency = (value: number) =>
    new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    }).format(value);

  // Status icon component
  const StatusIcon = ({ status }: { status: RetirementStatus }) => {
    switch (status) {
      case 'on-track':
        return <CheckCircle2 className="h-6 w-6" />;
      case 'needs-adjustment':
        return <AlertTriangle className="h-6 w-6" />;
      case 'at-risk':
        return <XCircle className="h-6 w-6" />;
    }
  };

  return (
    <PageContainer>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Your Retirement Projection
          </h1>
          <p className="text-muted-foreground">
            Based on your financial information, here&apos;s where you stand.
          </p>
        </div>

        {/* Screen Reader Summary */}
        <div className="sr-only" role="status" aria-live="polite">
          Your retirement projection shows {statusResult.label}.
          Estimated assets at retirement: {formatFullCurrency(projection!.summary.projectedRetirementBalance)}.
          {projection!.summary.yearsUntilDepletion
            ? `Funds may run out at age ${currentAge + projection!.summary.yearsUntilDepletion}.`
            : 'Funds are projected to last through age 90.'}
        </div>

        {/* Status Badge - Most Important Info First */}
        <div
          className={cn(
            'inline-flex items-center gap-2 rounded-full px-4 py-2 text-lg font-semibold',
            statusResult.status === 'on-track' && 'bg-success/10 text-success',
            statusResult.status === 'needs-adjustment' && 'bg-warning/10 text-warning',
            statusResult.status === 'at-risk' && 'bg-destructive/10 text-destructive'
          )}
        >
          <StatusIcon status={statusResult.status} />
          {statusResult.label}
        </div>

        {/* Snapshot Cards - 4 Column Grid */}
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
          {/* Assets at Retirement */}
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>At Retirement (Age {retirementAge})</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-foreground">
                {formatCurrency(projection!.summary.projectedRetirementBalance)}
              </p>
            </CardContent>
          </Card>

          {/* Monthly Spending Supported */}
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Monthly Spending</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-foreground">
                {formatCurrency(monthlySpendingAtRetirement)}
                <span className="text-sm font-normal text-muted-foreground">/mo</span>
              </p>
            </CardContent>
          </Card>

          {/* Retirement Age */}
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Retirement Age</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-foreground">
                {retirementAge}
              </p>
            </CardContent>
          </Card>

          {/* Shortfall Year */}
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Funds Last Until</CardDescription>
            </CardHeader>
            <CardContent>
              {projection!.summary.yearsUntilDepletion === null ? (
                <p className="text-2xl font-bold text-success">Age 90+</p>
              ) : (
                <p className="text-2xl font-bold text-destructive">
                  Age {currentAge + projection!.summary.yearsUntilDepletion}
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Chart - No Card Wrapper, Reduced Height */}
        <div>
          <h2 className="text-lg font-semibold mb-2">Assets Over Time</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Your projected balance from age {currentAge} to {DEFAULT_MAX_AGE}
          </p>
          <ProjectionChart
            records={projection!.records}
            retirementAge={retirementAge}
            currentAge={currentAge}
            inflationRate={DEFAULT_INFLATION_RATE}
            shortfallAge={
              projection!.summary.yearsUntilDepletion !== null
                ? currentAge + projection!.summary.yearsUntilDepletion
                : undefined
            }
          />
        </div>

        {/* Collapsible Table */}
        <ProjectionTable
          records={projection!.records}
          retirementAge={retirementAge}
        />
      </div>
    </PageContainer>
  );
}
