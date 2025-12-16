'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Step1PersonalInfo,
  Step2RetirementInfo,
  Step3FinancialInfo,
  Step4RiskTolerance,
  Step2bSavingsContributions,
  Step3bIncomeExpenses,
  Step4bAssetsDebts,
  Step5Review,
  SmartIntake,
} from '@/components/onboarding';
import type { CompleteOnboardingDataV2 } from '@/types/onboarding';

type WizardStep =
  | 'smart-intake'
  | 'basics'
  | 'retirement'
  | 'income-savings'
  | 'savings-accounts'
  | 'expenses'
  | 'assets-debts'
  | 'risk'
  | 'review';

const STEP_ORDER: WizardStep[] = [
  'smart-intake',
  'basics',
  'retirement',
  'income-savings',
  'savings-accounts',
  'expenses',
  'assets-debts',
  'risk',
  'review',
];

const STEP_LABELS: Record<WizardStep, string> = {
  'smart-intake': 'Quick Start',
  basics: 'Basics',
  retirement: 'Retirement Goals',
  'income-savings': 'Income & Savings',
  'savings-accounts': 'Investment Accounts',
  expenses: 'Monthly Expenses',
  'assets-debts': 'Assets & Debts',
  risk: 'Risk Tolerance',
  review: 'Review',
};

export default function OnboardingPage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState<WizardStep>('smart-intake');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState<Partial<CompleteOnboardingDataV2>>(
    {}
  );

  const currentStepIndex = STEP_ORDER.indexOf(currentStep);
  const totalSteps = STEP_ORDER.length;
  const progressPercent = Math.round(
    ((currentStepIndex + 1) / totalSteps) * 100
  );

  const goNext = () => {
    const nextIndex = currentStepIndex + 1;
    if (nextIndex < totalSteps) {
      setCurrentStep(STEP_ORDER[nextIndex]);
    }
  };
  const goBack = () => {
    const prevIndex = currentStepIndex - 1;
    if (prevIndex >= 0) {
      setCurrentStep(STEP_ORDER[prevIndex]);
    }
  };

  const updateFormData = (data: Partial<CompleteOnboardingDataV2>) => {
    setFormData((prev) => ({ ...prev, ...data }));
  };

  const handleStepComplete = (data: Partial<CompleteOnboardingDataV2>) => {
    updateFormData(data);
    goNext();
  };

  const handleSmartIntakeApply = (data: Partial<CompleteOnboardingDataV2>) => {
    updateFormData(data);
    goNext();
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch('/api/onboarding/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to complete onboarding');
      }

      router.push('/plans');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen py-12">
      <div className="mx-auto max-w-2xl px-4">
        {/* Progress indicator */}
        <div className="mb-8">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-medium text-foreground">
              {STEP_LABELS[currentStep]}
            </span>
            <span className="text-sm text-muted-foreground">
              Step {currentStepIndex + 1} of {totalSteps}
            </span>
          </div>
          <div className="h-2 w-full rounded-full bg-muted">
            <div
              className="h-2 rounded-full bg-primary transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {/* Error message */}
        {error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
            {error}
          </div>
        )}

        {/* Steps */}
        {currentStep === 'smart-intake' && (
          <SmartIntake onApply={handleSmartIntakeApply} onSkip={goNext} />
        )}

        {currentStep === 'basics' && (
          <Step1PersonalInfo
            onNext={handleStepComplete}
            initialData={formData}
          />
        )}

        {currentStep === 'retirement' && (
          <Step2RetirementInfo
            onNext={handleStepComplete}
            onBack={goBack}
            initialData={formData}
          />
        )}

        {currentStep === 'income-savings' && (
          <Step3FinancialInfo
            onNext={handleStepComplete}
            onBack={goBack}
            initialData={formData}
          />
        )}

        {currentStep === 'savings-accounts' && (
          <Step2bSavingsContributions
            onNext={handleStepComplete}
            onBack={goBack}
            initialData={formData}
          />
        )}

        {currentStep === 'expenses' && (
          <Step3bIncomeExpenses
            onNext={handleStepComplete}
            onBack={goBack}
            initialData={formData}
          />
        )}

        {currentStep === 'assets-debts' && (
          <Step4bAssetsDebts
            onNext={handleStepComplete}
            onBack={goBack}
            initialData={formData}
          />
        )}

        {currentStep === 'risk' && (
          <Step4RiskTolerance
            onNext={handleStepComplete}
            onBack={goBack}
            initialData={formData}
            isSubmitting={false}
          />
        )}

        {currentStep === 'review' && (
          <Step5Review
            onSubmit={handleSubmit}
            onBack={goBack}
            formData={formData}
            onUpdateData={updateFormData}
            isSubmitting={isSubmitting}
          />
        )}
      </div>
    </div>
  );
}
