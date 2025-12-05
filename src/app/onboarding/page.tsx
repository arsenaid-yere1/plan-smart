'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Step1PersonalInfo,
  Step2RetirementInfo,
  Step3FinancialInfo,
  Step4RiskTolerance,
} from '@/components/onboarding';
import type { CompleteOnboardingData } from '@/types/onboarding';

export default function OnboardingPage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState<Partial<CompleteOnboardingData>>({});

  const handleStep1 = (data: Partial<CompleteOnboardingData>) => {
    setFormData((prev) => ({ ...prev, ...data }));
    setCurrentStep(2);
  };

  const handleStep2 = (data: Partial<CompleteOnboardingData>) => {
    setFormData((prev) => ({ ...prev, ...data }));
    setCurrentStep(3);
  };

  const handleStep3 = (data: Partial<CompleteOnboardingData>) => {
    setFormData((prev) => ({ ...prev, ...data }));
    setCurrentStep(4);
  };

  const handleStep4 = async (data: Partial<CompleteOnboardingData>) => {
    const completeData = { ...formData, ...data };
    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch('/api/onboarding/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(completeData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to complete onboarding');
      }

      // Redirect to plans page
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
            <span className="text-sm font-medium text-foreground">Step {currentStep} of 4</span>
            <span className="text-sm text-muted-foreground">
              {currentStep * 25}% complete
            </span>
          </div>
          <div className="h-2 w-full rounded-full bg-muted">
            <div
              className="h-2 rounded-full bg-primary transition-all duration-300"
              style={{ width: `${currentStep * 25}%` }}
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
        {currentStep === 1 && (
          <Step1PersonalInfo onNext={handleStep1} initialData={formData} />
        )}
        {currentStep === 2 && (
          <Step2RetirementInfo
            onNext={handleStep2}
            onBack={() => setCurrentStep(1)}
            initialData={formData}
          />
        )}
        {currentStep === 3 && (
          <Step3FinancialInfo
            onNext={handleStep3}
            onBack={() => setCurrentStep(2)}
            initialData={formData}
          />
        )}
        {currentStep === 4 && (
          <Step4RiskTolerance
            onNext={handleStep4}
            onBack={() => setCurrentStep(3)}
            initialData={formData}
            isSubmitting={isSubmitting}
          />
        )}
      </div>
    </div>
  );
}
