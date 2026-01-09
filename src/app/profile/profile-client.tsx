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
import { StepIncomeStreams } from '@/components/onboarding/step-income-streams';
import { useToast } from '@/hooks/use-toast';
import type { FilingStatus, RiskTolerance } from '@/types/database';
import type {
  InvestmentAccountJson,
  PrimaryResidenceJson,
  DebtJson,
  IncomeExpensesJson,
  IncomeStreamJson,
  RealEstatePropertyJson,
} from '@/db/schema/financial-snapshot';
import type { CompleteOnboardingDataV2 } from '@/types/onboarding';
import { calculateNetWorth } from '@/lib/utils/net-worth';
import { NetWorthSummary } from '@/components/dashboard/NetWorthSummary';

// Helper to get state label from code
const getStateLabel = (code: string | null): string => {
  if (!code) return '—';
  const states: Record<string, string> = {
    'AL': 'Alabama', 'AK': 'Alaska', 'AZ': 'Arizona', 'AR': 'Arkansas',
    'CA': 'California', 'CO': 'Colorado', 'CT': 'Connecticut', 'DE': 'Delaware',
    'FL': 'Florida', 'GA': 'Georgia', 'HI': 'Hawaii', 'ID': 'Idaho',
    'IL': 'Illinois', 'IN': 'Indiana', 'IA': 'Iowa', 'KS': 'Kansas',
    'KY': 'Kentucky', 'LA': 'Louisiana', 'ME': 'Maine', 'MD': 'Maryland',
    'MA': 'Massachusetts', 'MI': 'Michigan', 'MN': 'Minnesota', 'MS': 'Mississippi',
    'MO': 'Missouri', 'MT': 'Montana', 'NE': 'Nebraska', 'NV': 'Nevada',
    'NH': 'New Hampshire', 'NJ': 'New Jersey', 'NM': 'New Mexico', 'NY': 'New York',
    'NC': 'North Carolina', 'ND': 'North Dakota', 'OH': 'Ohio', 'OK': 'Oklahoma',
    'OR': 'Oregon', 'PA': 'Pennsylvania', 'RI': 'Rhode Island', 'SC': 'South Carolina',
    'SD': 'South Dakota', 'TN': 'Tennessee', 'TX': 'Texas', 'UT': 'Utah',
    'VT': 'Vermont', 'VA': 'Virginia', 'WA': 'Washington', 'WV': 'West Virginia',
    'WI': 'Wisconsin', 'WY': 'Wyoming', 'DC': 'District of Columbia',
  };
  return states[code] || code;
};

// Profile data structure matching what we fetch from the database
export interface ProfileData {
  birthYear: number;
  stateOfResidence: string | null;
  targetRetirementAge: number;
  filingStatus: FilingStatus;
  annualIncome: number;
  savingsRate: number;
  riskTolerance: RiskTolerance;
  investmentAccounts: InvestmentAccountJson[];
  primaryResidence: PrimaryResidenceJson | null; // Keep for backward compatibility
  realEstateProperties: RealEstatePropertyJson[];
  debts: DebtJson[];
  incomeExpenses: IncomeExpensesJson | null;
  incomeStreams: IncomeStreamJson[];
}

type EditSection =
  | 'basics'
  | 'retirement'
  | 'income'
  | 'risk'
  | 'savings'
  | 'expenses'
  | 'assets'
  | 'income-streams'
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
  // Destructure to exclude fields that need null-to-undefined conversion (they are handled explicitly below)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { stateOfResidence: _sor, primaryResidence: _pr, incomeExpenses: _ie, ...restProfileData } = profileData;
  const formData: Partial<CompleteOnboardingDataV2> = {
    ...restProfileData,
    stateOfResidence: (profileData.stateOfResidence ?? undefined) as CompleteOnboardingDataV2['stateOfResidence'], // Convert null to undefined for react-hook-form
    investmentAccounts: profileData.investmentAccounts.map((acc) => ({
      ...acc,
      type: acc.type as CompleteOnboardingDataV2['investmentAccounts'][0]['type'],
    })),
    primaryResidence: profileData.primaryResidence ?? undefined,
    realEstateProperties: (profileData.realEstateProperties ?? []).map((prop) => ({
      ...prop,
      type: prop.type as 'primary' | 'rental' | 'vacation' | 'land',
    })),
    debts: profileData.debts.map((debt) => ({
      ...debt,
      type: debt.type as CompleteOnboardingDataV2['debts'][0]['type'],
    })),
    incomeExpenses: profileData.incomeExpenses ?? undefined,
    incomeStreams: profileData.incomeStreams ?? [],
  };

  // Helper to format income stream type for display
  const formatIncomeStreamType = (type: string) => {
    const typeMap: Record<string, string> = {
      social_security: 'Social Security',
      pension: 'Pension',
      rental: 'Rental Income',
      annuity: 'Annuity',
      part_time: 'Part-Time Work',
      other: 'Other',
    };
    return typeMap[type] || type;
  };

  // Calculate net worth breakdown
  const netWorthBreakdown = calculateNetWorth(
    profileData.investmentAccounts,
    profileData.realEstateProperties,
    profileData.debts
  );

  return (
    <div className="space-y-4">
      {/* Net Worth Summary */}
      <NetWorthSummary breakdown={netWorthBreakdown} variant="detailed" />

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
          <div>
            <span className="text-muted-foreground">State of Residence:</span>
            <span className="ml-2 font-medium">{getStateLabel(profileData.stateOfResidence)}</span>
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
                  {account.monthlyContribution !== undefined && account.monthlyContribution > 0 && (
                    <div className="text-muted-foreground text-xs">
                      +{formatCurrency(account.monthlyContribution)}/mo
                      {profileData.annualIncome > 0 && (
                        <span className="ml-1">
                          ({((account.monthlyContribution * 12 / profileData.annualIncome) * 100).toFixed(1)}% of income)
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
            {/* Total contributions summary */}
            {(() => {
              const totalMonthlyContribution = profileData.investmentAccounts.reduce(
                (sum, acc) => sum + (acc.monthlyContribution ?? 0),
                0
              );
              const totalBalance = profileData.investmentAccounts.reduce(
                (sum, acc) => sum + acc.balance,
                0
              );
              return (
                <div className="flex justify-between pt-2 font-medium border-t">
                  <span>Total</span>
                  <div className="text-right">
                    <div>{formatCurrency(totalBalance)}</div>
                    {totalMonthlyContribution > 0 && (
                      <div className="text-muted-foreground text-xs font-normal">
                        +{formatCurrency(totalMonthlyContribution)}/mo
                        {profileData.annualIncome > 0 && (
                          <span className="ml-1">
                            ({((totalMonthlyContribution * 12 / profileData.annualIncome) * 100).toFixed(1)}% of income)
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}
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
        <div className="space-y-3 text-sm">
          <div className="grid grid-cols-2 gap-4">
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
          {(profileData.incomeExpenses?.monthlyEssential || profileData.incomeExpenses?.monthlyDiscretionary) && (
            <div className="flex justify-between pt-2 font-medium border-t">
              <span>Total Monthly Spending</span>
              <span>
                {formatCurrency(
                  (profileData.incomeExpenses?.monthlyEssential ?? 0) +
                  (profileData.incomeExpenses?.monthlyDiscretionary ?? 0)
                )}
              </span>
            </div>
          )}
        </div>
      </Collapsible>

      {/* Assets & Debts Section */}
      <Collapsible
        title="Assets & Debts"
        defaultOpen
        onEdit={() => setEditSection('assets')}
      >
        <div className="space-y-4 text-sm">
          {/* Real Estate Properties */}
          {profileData.realEstateProperties && profileData.realEstateProperties.length > 0 && (
            <div>
              <h4 className="font-medium mb-2">Real Estate Properties</h4>
              {profileData.realEstateProperties.map((property) => {
                const equity = property.estimatedValue - (property.mortgageBalance ?? 0);
                return (
                  <div key={property.id} className="pl-4 border-b pb-2 last:border-0 mb-2">
                    <div className="flex justify-between">
                      <div>
                        <span className="font-medium">{property.name}</span>
                        <span className="text-muted-foreground ml-2 capitalize">
                          ({property.type === 'primary' ? 'Primary Residence' : property.type})
                        </span>
                      </div>
                      <span>{formatCurrency(property.estimatedValue)}</span>
                    </div>
                    {property.mortgageBalance && property.mortgageBalance > 0 && (
                      <div className="flex justify-between text-muted-foreground text-xs mt-1">
                        <span>Mortgage: {formatCurrency(property.mortgageBalance)}</span>
                        <span>Equity: {formatCurrency(equity)}</span>
                      </div>
                    )}
                  </div>
                );
              })}
              {/* Property totals */}
              {(() => {
                const totalValue = profileData.realEstateProperties.reduce(
                  (sum, prop) => sum + prop.estimatedValue,
                  0
                );
                const totalMortgage = profileData.realEstateProperties.reduce(
                  (sum, prop) => sum + (prop.mortgageBalance ?? 0),
                  0
                );
                const totalEquity = totalValue - totalMortgage;
                return (
                  <div className="flex justify-between pt-2 font-medium border-t pl-4">
                    <span>Total Real Estate</span>
                    <div className="text-right">
                      <div>{formatCurrency(totalValue)}</div>
                      {totalMortgage > 0 && (
                        <div className="text-muted-foreground text-xs font-normal">
                          Equity: {formatCurrency(totalEquity)}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}
            </div>
          )}
          {/* Legacy: Primary Residence (backward compatibility) */}
          {profileData.primaryResidence?.estimatedValue && (!profileData.realEstateProperties || profileData.realEstateProperties.length === 0) && (
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
              <h4 className="font-medium mb-2">Other Debts</h4>
              {profileData.debts.map((debt) => (
                <div key={debt.id} className="flex justify-between pl-4 border-b pb-2 last:border-0">
                  <span>{debt.label || debt.type}</span>
                  <span>{formatCurrency(debt.balance)}</span>
                </div>
              ))}
            </div>
          )}
          {(!profileData.realEstateProperties || profileData.realEstateProperties.length === 0) &&
           !profileData.primaryResidence?.estimatedValue &&
           (!profileData.debts || profileData.debts.length === 0) && (
            <p className="text-muted-foreground">No assets or debts added.</p>
          )}
        </div>
      </Collapsible>

      {/* Retirement Income Streams Section */}
      <Collapsible
        title="Retirement Income Streams"
        defaultOpen
        onEdit={() => setEditSection('income-streams')}
      >
        {profileData.incomeStreams && profileData.incomeStreams.length > 0 ? (
          <div className="space-y-3">
            {profileData.incomeStreams.map((stream) => (
              <div key={stream.id} className="flex justify-between text-sm border-b pb-2 last:border-0">
                <div>
                  <span className="font-medium">{stream.name}</span>
                  <span className="text-muted-foreground ml-2">
                    ({formatIncomeStreamType(stream.type)})
                  </span>
                  <div className="text-xs text-muted-foreground mt-1">
                    Ages {stream.startAge}{stream.endAge ? ` - ${stream.endAge}` : '+'}
                    {stream.inflationAdjusted && ' • Inflation-adjusted'}
                  </div>
                </div>
                <div className="text-right">
                  <div>{formatCurrency(stream.annualAmount)}/yr</div>
                  <div className="text-muted-foreground text-xs">
                    {formatCurrency(Math.round(stream.annualAmount / 12))}/mo
                  </div>
                </div>
              </div>
            ))}
            {/* Total annual income summary */}
            {(() => {
              const totalAnnualIncome = profileData.incomeStreams.reduce(
                (sum, stream) => sum + stream.annualAmount,
                0
              );
              return (
                <div className="flex justify-between pt-2 font-medium border-t">
                  <span>Total Annual</span>
                  <div className="text-right">
                    <div>{formatCurrency(totalAnnualIncome)}/yr</div>
                    <div className="text-muted-foreground text-xs font-normal">
                      {formatCurrency(Math.round(totalAnnualIncome / 12))}/mo
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            No retirement income streams configured. Add Social Security, pensions, or other income sources.
          </p>
        )}
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
            submitLabel="Save"
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
            submitLabel="Save"
            cancelLabel="Cancel"
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
            submitLabel="Save"
            cancelLabel="Cancel"
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
            submitLabel="Save"
            cancelLabel="Cancel"
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
            submitLabel="Save"
            cancelLabel="Cancel"
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
            submitLabel="Save"
            cancelLabel="Cancel"
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
            submitLabel="Save"
            cancelLabel="Cancel"
          />
        </DialogContent>
      </Dialog>

      <Dialog open={editSection === 'income-streams'} onOpenChange={handleEditClose}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Retirement Income Streams</DialogTitle>
          </DialogHeader>
          <StepIncomeStreams
            onNext={(data) => handleEditSave(data)}
            onBack={handleEditClose}
            initialData={formData}
            submitLabel="Save"
            cancelLabel="Cancel"
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
