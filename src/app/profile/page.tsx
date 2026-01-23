import { redirect } from 'next/navigation';
import { getServerUser } from '@/lib/auth/server';
import { db } from '@/db/client';
import { financialSnapshot } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { ProfileClient } from './profile-client';
import type { FilingStatus, RiskTolerance } from '@/types/database';

export default async function ProfilePage() {
  const user = await getServerUser();

  if (!user) {
    redirect('/auth/login');
  }

  const snapshot = await db.query.financialSnapshot.findFirst({
    where: eq(financialSnapshot.userId, user.id),
  });

  if (!snapshot) {
    redirect('/onboarding');
  }

  // Transform DB types to client-safe format
  const profileData = {
    birthYear: snapshot.birthYear,
    stateOfResidence: snapshot.stateOfResidence ?? null,
    targetRetirementAge: snapshot.targetRetirementAge,
    filingStatus: snapshot.filingStatus as FilingStatus,
    annualIncome: Number(snapshot.annualIncome),
    savingsRate: Number(snapshot.savingsRate),
    riskTolerance: snapshot.riskTolerance as RiskTolerance,
    investmentAccounts: snapshot.investmentAccounts ?? [],
    primaryResidence: snapshot.primaryResidence ?? null,
    realEstateProperties: snapshot.realEstateProperties ?? [],
    debts: snapshot.debts ?? [],
    incomeExpenses: snapshot.incomeExpenses ?? null,
    incomeStreams: snapshot.incomeStreams ?? [],
    incomeSources: snapshot.incomeSources ?? null,
    spendingPhases: snapshot.spendingPhases ?? null, // Epic 9
    depletionTarget: snapshot.depletionTarget ?? null, // Epic 10
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      <h1 className="text-2xl font-bold text-foreground mb-6">
        Financial Profile
      </h1>
      <p className="text-muted-foreground mb-8">
        Review and update your financial information. Changes will be reflected in your retirement projections.
      </p>
      <ProfileClient initialData={profileData} />
    </div>
  );
}