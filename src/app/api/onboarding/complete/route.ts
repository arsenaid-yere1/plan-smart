import { NextRequest, NextResponse } from 'next/server';
import { getServerUser } from '@/lib/auth/server';
import { db } from '@/db/client';
import { financialSnapshot, plans, userProfile } from '@/db/schema';
import { completeOnboardingSchemaV2 } from '@/lib/validation/onboarding';
import { eq } from 'drizzle-orm';

export async function POST(request: NextRequest) {
  try {
    // Verify authentication
    const user = await getServerUser();
    if (!user) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    // Validate onboarding data
    const body = await request.json();
    const parseResult = completeOnboardingSchemaV2.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        { message: 'Invalid data', errors: parseResult.error.flatten() },
        { status: 400 }
      );
    }

    const data = parseResult.data;

    // Create financial snapshot with new JSONB fields
    await db.insert(financialSnapshot).values({
      userId: user.id,
      birthYear: data.birthYear,
      targetRetirementAge: data.targetRetirementAge,
      filingStatus: data.filingStatus,
      annualIncome: data.annualIncome.toString(),
      savingsRate: data.savingsRate.toString(),
      riskTolerance: data.riskTolerance,
      // Epic 2: New JSONB fields
      investmentAccounts: data.investmentAccounts || [],
      primaryResidence: data.primaryResidence || null,
      debts: data.debts || [],
      incomeExpenses: data.incomeExpenses || null,
    });

    // Calculate total savings for plan config
    const totalSavings = (data.investmentAccounts || []).reduce(
      (sum, account) => sum + account.balance,
      0
    );

    const totalMonthlyContributions = (data.investmentAccounts || []).reduce(
      (sum, account) => sum + (account.monthlyContribution || 0),
      0
    );

    // Create default retirement plan with enhanced config
    await db.insert(plans).values({
      userId: user.id,
      name: 'Personal Plan v1',
      description: 'Your personalized retirement plan',
      config: {
        birthYear: data.birthYear,
        targetRetirementAge: data.targetRetirementAge,
        annualIncome: data.annualIncome,
        savingsRate: data.savingsRate,
        riskTolerance: data.riskTolerance,
        // Epic 2: Enhanced config
        totalSavings,
        totalMonthlyContributions,
        investmentAccountCount: data.investmentAccounts?.length || 0,
        hasHomeEquity: !!data.primaryResidence?.estimatedValue,
        totalDebt: (data.debts || []).reduce((sum, d) => sum + d.balance, 0),
        createdViaOnboarding: true,
        onboardingVersion: 2,
      },
    });

    // Mark onboarding as complete
    await db
      .update(userProfile)
      .set({
        onboardingCompleted: true,
        birthYear: data.birthYear.toString(),
        filingStatus: data.filingStatus,
      })
      .where(eq(userProfile.id, user.id));

    return NextResponse.json({
      message: 'Onboarding completed successfully',
    });
  } catch (error) {
    console.error('Onboarding completion error:', error);
    return NextResponse.json(
      { message: 'Failed to complete onboarding' },
      { status: 500 }
    );
  }
}
