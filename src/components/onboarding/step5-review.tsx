'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Collapsible } from '@/components/ui/collapsible';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { CompleteOnboardingDataV2 } from '@/types/onboarding';

// Import individual step components for editing
import { Step1PersonalInfo } from './step1-personal-info';
import { Step2RetirementInfo } from './step2-retirement-info';
import { Step3FinancialInfo } from './step3-financial-info';
import { Step4RiskTolerance } from './step4-risk-tolerance';
import { Step2bSavingsContributions } from './step2b-savings-contributions';
import { Step3bIncomeExpenses } from './step3b-income-expenses';
import { Step4bAssetsDebts } from './step4b-assets-debts';

interface Step5Props {
  onSubmit: () => void;
  onBack: () => void;
  formData: Partial<CompleteOnboardingDataV2>;
  onUpdateData: (data: Partial<CompleteOnboardingDataV2>) => void;
  isSubmitting: boolean;
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

export function Step5Review({
  onSubmit,
  onBack,
  formData,
  onUpdateData,
  isSubmitting,
}: Step5Props) {
  const [editSection, setEditSection] = useState<EditSection>(null);

  const formatCurrency = (value?: number) => {
    if (value === undefined || value === null) return 'Not provided';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatPercent = (value?: number) => {
    if (value === undefined || value === null) return 'Not provided';
    return `${value}%`;
  };

  const currentYear = new Date().getFullYear();
  const currentAge = formData.birthYear
    ? currentYear - formData.birthYear
    : undefined;

  const handleEditClose = () => setEditSection(null);

  const handleEditSave = (data: Partial<CompleteOnboardingDataV2>) => {
    onUpdateData(data);
    setEditSection(null);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Review Your Information</CardTitle>
        <CardDescription>
          Please review your financial profile before generating your
          retirement plan
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Basics Section */}
        <Collapsible
          title="Basics"
          onEdit={() => setEditSection('basics')}
        >
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-gray-600">Current Age</dt>
              <dd className="font-medium">{currentAge || 'Not provided'}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-600">Target Retirement Age</dt>
              <dd className="font-medium">
                {formData.targetRetirementAge || 'Not provided'}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-600">Filing Status</dt>
              <dd className="font-medium capitalize">
                {formData.filingStatus?.replace('_', ' ') || 'Not provided'}
              </dd>
            </div>
          </dl>
        </Collapsible>

        {/* Income Section */}
        <Collapsible
          title="Income & Savings Rate"
          onEdit={() => setEditSection('income')}
        >
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-gray-600">Annual Income</dt>
              <dd className="font-medium">
                {formatCurrency(formData.annualIncome)}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-600">Savings Rate</dt>
              <dd className="font-medium">
                {formatPercent(formData.savingsRate)}
              </dd>
            </div>
          </dl>
        </Collapsible>

        {/* Investment Accounts Section */}
        <Collapsible
          title="Investment Accounts"
          onEdit={() => setEditSection('savings')}
        >
          {formData.investmentAccounts && formData.investmentAccounts.length > 0 ? (
            <div className="space-y-3">
              {formData.investmentAccounts.map((account) => (
                <div
                  key={account.id}
                  className="flex justify-between items-center text-sm border-b pb-2 last:border-0"
                >
                  <div>
                    <p className="font-medium">{account.label}</p>
                    <p className="text-gray-500 text-xs">
                      {account.type} • {formatCurrency(account.monthlyContribution)}/mo
                    </p>
                  </div>
                  <span className="font-medium">
                    {formatCurrency(account.balance)}
                  </span>
                </div>
              ))}
              <div className="flex justify-between pt-2 font-medium">
                <span>Total</span>
                <span>
                  {formatCurrency(
                    formData.investmentAccounts.reduce(
                      (sum, a) => sum + a.balance,
                      0
                    )
                  )}
                </span>
              </div>
            </div>
          ) : (
            <p className="text-gray-500 text-sm">No accounts added</p>
          )}
        </Collapsible>

        {/* Monthly Expenses Section */}
        <Collapsible
          title="Monthly Expenses"
          onEdit={() => setEditSection('expenses')}
        >
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-gray-600">Essential Expenses</dt>
              <dd className="font-medium">
                {formatCurrency(formData.incomeExpenses?.monthlyEssential)}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-600">Discretionary Expenses</dt>
              <dd className="font-medium">
                {formatCurrency(formData.incomeExpenses?.monthlyDiscretionary)}
              </dd>
            </div>
          </dl>
        </Collapsible>

        {/* Assets & Debts Section */}
        <Collapsible
          title="Assets & Debts"
          onEdit={() => setEditSection('assets')}
        >
          <div className="space-y-4 text-sm">
            {formData.primaryResidence?.estimatedValue && (
              <div>
                <h4 className="font-medium mb-2">Primary Residence</h4>
                <dl className="space-y-1 pl-4">
                  <div className="flex justify-between">
                    <dt className="text-gray-600">Home Value</dt>
                    <dd>{formatCurrency(formData.primaryResidence.estimatedValue)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-gray-600">Mortgage Balance</dt>
                    <dd>{formatCurrency(formData.primaryResidence.mortgageBalance)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-gray-600">Interest Rate</dt>
                    <dd>{formatPercent(formData.primaryResidence.interestRate)}</dd>
                  </div>
                </dl>
              </div>
            )}

            {formData.debts && formData.debts.length > 0 && (
              <div>
                <h4 className="font-medium mb-2">Debts</h4>
                {formData.debts.map((debt) => (
                  <div
                    key={debt.id}
                    className="flex justify-between items-center pl-4 border-b pb-2 last:border-0"
                  >
                    <div>
                      <p>{debt.label}</p>
                      <p className="text-gray-500 text-xs">
                        {debt.type} • {formatPercent(debt.interestRate)} APR
                      </p>
                    </div>
                    <span className="font-medium text-red-600">
                      {formatCurrency(debt.balance)}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {!formData.primaryResidence?.estimatedValue &&
              (!formData.debts || formData.debts.length === 0) && (
                <p className="text-gray-500">No assets or debts recorded</p>
              )}
          </div>
        </Collapsible>

        {/* Risk Tolerance Section */}
        <Collapsible
          title="Risk Tolerance"
          onEdit={() => setEditSection('risk')}
        >
          <p className="text-sm capitalize">
            {formData.riskTolerance || 'Not provided'}
          </p>
        </Collapsible>

        {/* Action Buttons */}
        <div className="flex gap-3 pt-4">
          <Button
            type="button"
            variant="outline"
            onClick={onBack}
            className="flex-1"
            disabled={isSubmitting}
          >
            Back
          </Button>
          <Button
            type="button"
            onClick={onSubmit}
            className="flex-1"
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Generating Plan...' : 'Generate My Plan'}
          </Button>
        </div>
      </CardContent>

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
            isSubmitting={false}
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
    </Card>
  );
}
