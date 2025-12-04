import { NextRequest, NextResponse } from 'next/server';
import { getServerUser } from '@/lib/auth/server';
import { db } from '@/db/client';
import { financialSnapshot, plans, userProfile } from '@/db/schema';
import { completeOnboardingSchema } from '@/lib/validation/onboarding';
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
    const parseResult = completeOnboardingSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        { message: 'Invalid data', errors: parseResult.error.flatten() },
        { status: 400 }
      );
    }

    const data = parseResult.data;

    // Create financial snapshot
    await db.insert(financialSnapshot).values({
      userId: user.id,
      birthYear: data.birthYear,
      targetRetirementAge: data.targetRetirementAge,
      filingStatus: data.filingStatus,
      annualIncome: data.annualIncome.toString(),
      savingsRate: data.savingsRate.toString(),
      riskTolerance: data.riskTolerance,
    });

    // Create default retirement plan
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
        createdViaOnboarding: true,
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
