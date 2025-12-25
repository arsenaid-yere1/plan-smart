'use client';

import { useState } from 'react';
import { Collapsible } from '@/components/ui/collapsible';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Step1PersonalInfo } from '@/components/onboarding/step1-personal-info';
import { Step2RetirementInfo } from '@/components/onboarding/step2-retirement-info';
import { Step3FinancialInfo } from '@/components/onboarding/step3-financial-info';
import { Step4RiskTolerance } from '@/components/onboarding/step4-risk-tolerance';
import { Step2bSavingsContributions } from '@/components/onboarding/step2b-savings-contributions';
import { Step3bIncomeExpenses } from '@/components/onboarding/step3b-income-expenses';
import { Step4bAssetsDebts } from '@/components/onboarding/step4b-assets-debts';
import { useToast } from '@/hooks/use-toast';
import type { FilingStatus, RiskTolerance } from '@/types/database';
import type {
  InvestmentAccountJson,
  PrimaryResidenceJson,
  DebtJson,
  IncomeExpensesJson,
} from '@/db/schema/financial-snapshot';
import type { CompleteOnboardingDataV2 } from '@/types/onboarding';

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

type EditSection =
  | 'basics'
  | 'retirement'
  | 'income'
  | 'risk'
  | 'savings'
  | 'expenses'
  | 'assets'
  | null;

interface ProfileClientProps {
  initialData: ProfileData;
}

export function ProfileClient({ initialData }: ProfileClientProps) {
  const [profileData, setProfileData] = useState(initialData);
  const [editSection, setEditSection] = useState<EditSection>(null);
  const { toast } = useToast();

  const handleEditClose = () => setEditSection(null);

  const handleEditSave = async (data: Partial<CompleteOnboardingDataV2>) => {
    try {
      const response = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to update profile');
      }

      // Merge updated data into local state
      setProfileData((prev) => ({ ...prev, ...data } as ProfileData));
      setEditSection(null);
      toast({
        title: 'Profile updated',
        description: 'Your financial information has been saved.',
      });
    } catch (error) {
      toast({
        title: 'Update failed',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'destructive',
      });
    }
  };

  // Format helpers
  const formatCurrency = (value: number | undefined) =>
    value !== undefined
      ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value)
      : '—';

  const formatPercent = (value: number | undefined) =>
    value !== undefined ? `${value}%` : '—';

  const currentYear = new Date().getFullYear();
  const currentAge = profileData.birthYear ? currentYear - profileData.birthYear : undefined;
  const yearsToRetirement = profileData.targetRetirementAge && currentAge
    ? profileData.targetRetirementAge - currentAge
    : undefined;

  // Transform ProfileData to format expected by step components
  const formData: Partial<CompleteOnboardingDataV2> = {
    ...profileData,
    investmentAccounts: profileData.investmentAccounts.map((acc) => ({
      ...acc,
      type: acc.type as CompleteOnboardingDataV2['investmentAccounts'][0]['type'],
    })),
    primaryResidence: profileData.primaryResidence ?? undefined,
    debts: profileData.debts.map((debt) => ({
      ...debt,
      type: debt.type as CompleteOnboardingDataV2['debts'][0]['type'],
    })),
    incomeExpenses: profileData.incomeExpenses ?? undefined,
  };

  return (
    <div className="space-y-4">
      {/* Basics Section */}
      <Collapsible
        title="Basics"
        defaultOpen
        onEdit={() => setEditSection('basics')}
      >
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-muted-foreground">Birth Year:</span>
            <span className="ml-2 font-medium">{profileData.birthYear}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Current Age:</span>
            <span className="ml-2 font-medium">{currentAge}</span>
          </div>
        </div>
      </Collapsible>

      {/* Retirement Goals Section */}
      <Collapsible
        title="Retirement Goals"
        defaultOpen
        onEdit={() => setEditSection('retirement')}
      >
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-muted-foreground">Target Retirement Age:</span>
            <span className="ml-2 font-medium">{profileData.targetRetirementAge}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Years to Retirement:</span>
            <span className="ml-2 font-medium">{yearsToRetirement}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Filing Status:</span>
            <span className="ml-2 font-medium capitalize">
              {profileData.filingStatus?.replace('_', ' ')}
            </span>
          </div>
        </div>
      </Collapsible>

      {/* Income & Savings Section */}
      <Collapsible
        title="Income & Savings"
        defaultOpen
        onEdit={() => setEditSection('income')}
      >
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-muted-foreground">Annual Income:</span>
            <span className="ml-2 font-medium">{formatCurrency(profileData.annualIncome)}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Savings Rate:</span>
            <span className="ml-2 font-medium">{formatPercent(profileData.savingsRate)}</span>
          </div>
        </div>
      </Collapsible>

      {/* Risk Tolerance Section */}
      <Collapsible
        title="Risk Tolerance"
        defaultOpen
        onEdit={() => setEditSection('risk')}
      >
        <div className="text-sm">
          <span className="text-muted-foreground">Risk Level:</span>
          <span className="ml-2 font-medium capitalize">{profileData.riskTolerance}</span>
        </div>
      </Collapsible>

      {/* Investment Accounts Section */}
      <Collapsible
        title="Investment Accounts"
        defaultOpen
        onEdit={() => setEditSection('savings')}
      >
        {profileData.investmentAccounts && profileData.investmentAccounts.length > 0 ? (
          <div className="space-y-3">
            {profileData.investmentAccounts.map((account) => (
              <div key={account.id} className="flex justify-between text-sm border-b pb-2 last:border-0">
                <div>
                  <span className="font-medium">{account.label || account.type}</span>
                  <span className="text-muted-foreground ml-2">({account.type.replace('_', ' ')})</span>
                </div>
                <div className="text-right">
                  <div>{formatCurrency(account.balance)}</div>
                  {account.monthlyContribution && account.monthlyContribution > 0 && (
                    <div className="text-muted-foreground text-xs">
                      +{formatCurrency(account.monthlyContribution)}/mo
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No investment accounts added.</p>
        )}
      </Collapsible>

      {/* Monthly Expenses Section */}
      <Collapsible
        title="Monthly Expenses"
        defaultOpen
        onEdit={() => setEditSection('expenses')}
      >
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-muted-foreground">Essential:</span>
            <span className="ml-2 font-medium">
              {formatCurrency(profileData.incomeExpenses?.monthlyEssential)}
            </span>
          </div>
          <div>
            <span className="text-muted-foreground">Discretionary:</span>
            <span className="ml-2 font-medium">
              {formatCurrency(profileData.incomeExpenses?.monthlyDiscretionary)}
            </span>
          </div>
        </div>
      </Collapsible>

      {/* Assets & Debts Section */}
      <Collapsible
        title="Assets & Debts"
        defaultOpen
        onEdit={() => setEditSection('assets')}
      >
        <div className="space-y-4 text-sm">
          {profileData.primaryResidence?.estimatedValue && (
            <div>
              <h4 className="font-medium mb-2">Primary Residence</h4>
              <div className="grid grid-cols-2 gap-2 pl-4">
                <div>
                  <span className="text-muted-foreground">Value:</span>
                  <span className="ml-2">{formatCurrency(profileData.primaryResidence.estimatedValue)}</span>
                </div>
                {profileData.primaryResidence.mortgageBalance && (
                  <div>
                    <span className="text-muted-foreground">Mortgage:</span>
                    <span className="ml-2">{formatCurrency(profileData.primaryResidence.mortgageBalance)}</span>
                  </div>
                )}
              </div>
            </div>
          )}
          {profileData.debts && profileData.debts.length > 0 && (
            <div>
              <h4 className="font-medium mb-2">Debts</h4>
              {profileData.debts.map((debt) => (
                <div key={debt.id} className="flex justify-between pl-4 border-b pb-2 last:border-0">
                  <span>{debt.label || debt.type}</span>
                  <span>{formatCurrency(debt.balance)}</span>
                </div>
              ))}
            </div>
          )}
          {!profileData.primaryResidence?.estimatedValue && (!profileData.debts || profileData.debts.length === 0) && (
            <p className="text-muted-foreground">No assets or debts added.</p>
          )}
        </div>
      </Collapsible>

      {/* Edit Dialogs */}
      <Dialog open={editSection === 'basics'} onOpenChange={handleEditClose}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Basic Information</DialogTitle>
          </DialogHeader>
          <Step1PersonalInfo
            onNext={(data) => handleEditSave(data)}
            initialData={formData}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={editSection === 'retirement'} onOpenChange={handleEditClose}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Retirement Goals</DialogTitle>
          </DialogHeader>
          <Step2RetirementInfo
            onNext={(data) => handleEditSave(data)}
            onBack={handleEditClose}
            initialData={formData}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={editSection === 'income'} onOpenChange={handleEditClose}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Income & Savings</DialogTitle>
          </DialogHeader>
          <Step3FinancialInfo
            onNext={(data) => handleEditSave(data)}
            onBack={handleEditClose}
            initialData={formData}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={editSection === 'risk'} onOpenChange={handleEditClose}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Risk Tolerance</DialogTitle>
          </DialogHeader>
          <Step4RiskTolerance
            onNext={(data) => handleEditSave(data)}
            onBack={handleEditClose}
            initialData={formData}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={editSection === 'savings'} onOpenChange={handleEditClose}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Investment Accounts</DialogTitle>
          </DialogHeader>
          <Step2bSavingsContributions
            onNext={(data) => handleEditSave(data)}
            onBack={handleEditClose}
            initialData={formData}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={editSection === 'expenses'} onOpenChange={handleEditClose}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Monthly Expenses</DialogTitle>
          </DialogHeader>
          <Step3bIncomeExpenses
            onNext={(data) => handleEditSave(data)}
            onBack={handleEditClose}
            initialData={formData}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={editSection === 'assets'} onOpenChange={handleEditClose}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Assets & Debts</DialogTitle>
          </DialogHeader>
          <Step4bAssetsDebts
            onNext={(data) => handleEditSave(data)}
            onBack={handleEditClose}
            initialData={formData}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
