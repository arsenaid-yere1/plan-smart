'use client';

import type { FilingStatus, RiskTolerance } from '@/types/database';
import type {
  InvestmentAccountJson,
  PrimaryResidenceJson,
  DebtJson,
  IncomeExpensesJson,
} from '@/db/schema/financial-snapshot';

// Profile data structure matching what we fetch from the database
export interface ProfileData {
  birthYear: number;
  targetRetirementAge: number;
  filingStatus: FilingStatus;
  annualIncome: number;
  savingsRate: number;
  riskTolerance: RiskTolerance;
  investmentAccounts: InvestmentAccountJson[];
  primaryResidence: PrimaryResidenceJson | null;
  debts: DebtJson[];
  incomeExpenses: IncomeExpensesJson | null;
}

interface ProfileClientProps {
  initialData: ProfileData;
}

export function ProfileClient({ initialData }: ProfileClientProps) {
  return (
    <div className="space-y-4">
      <p className="text-muted-foreground">
        Profile data loaded. UI coming in Phase 3.
      </p>
      <pre className="text-xs bg-muted p-4 rounded overflow-auto">
        {JSON.stringify(initialData, null, 2)}
      </pre>
    </div>
  );
}