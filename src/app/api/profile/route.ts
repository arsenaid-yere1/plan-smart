import { NextRequest, NextResponse } from 'next/server';
import { getServerUser } from '@/lib/auth/server';
import { db } from '@/db/client';
import { financialSnapshot } from '@/db/schema';
import { profileUpdateSchema } from '@/lib/validation/profile';
import { eq } from 'drizzle-orm';

export async function PATCH(request: NextRequest) {
  try {
    // Verify authentication
    const user = await getServerUser();
    if (!user) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    // Validate request body
    const body = await request.json();
    const parseResult = profileUpdateSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        { message: 'Invalid data', errors: parseResult.error.flatten() },
        { status: 400 }
      );
    }

    const data = parseResult.data;

    // Build update object with only provided fields
    const updateData: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    // Scalar fields
    if (data.birthYear !== undefined) {
      updateData.birthYear = data.birthYear;
    }
    if (data.targetRetirementAge !== undefined) {
      updateData.targetRetirementAge = data.targetRetirementAge;
    }
    if (data.filingStatus !== undefined) {
      updateData.filingStatus = data.filingStatus;
    }
    if (data.annualIncome !== undefined) {
      updateData.annualIncome = data.annualIncome.toString();
    }
    if (data.savingsRate !== undefined) {
      updateData.savingsRate = data.savingsRate.toString();
    }
    if (data.riskTolerance !== undefined) {
      updateData.riskTolerance = data.riskTolerance;
    }

    // JSONB fields
    if (data.investmentAccounts !== undefined) {
      updateData.investmentAccounts = data.investmentAccounts;
    }
    if (data.primaryResidence !== undefined) {
      updateData.primaryResidence = data.primaryResidence;
    }
    if (data.debts !== undefined) {
      updateData.debts = data.debts;
    }
    if (data.incomeExpenses !== undefined) {
      updateData.incomeExpenses = data.incomeExpenses;
    }

    // Update database
    const result = await db
      .update(financialSnapshot)
      .set(updateData)
      .where(eq(financialSnapshot.userId, user.id))
      .returning();

    if (result.length === 0) {
      return NextResponse.json(
        { message: 'Profile not found. Please complete onboarding.' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      message: 'Profile updated successfully',
    });
  } catch (error) {
    console.error('Profile update error:', error);
    return NextResponse.json(
      { message: 'Failed to update profile' },
      { status: 500 }
    );
  }
}
