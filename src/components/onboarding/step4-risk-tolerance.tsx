'use client';

import { useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { step4Schema } from '@/lib/validation/onboarding';
import { RISK_TOLERANCE_OPTIONS } from '@/types/onboarding';
import type { OnboardingStep4Data } from '@/types/onboarding';

interface Step4Props {
  onNext: (data: OnboardingStep4Data) => void;
  onBack: () => void;
  initialData?: Partial<OnboardingStep4Data>;
  submitLabel?: string;
  cancelLabel?: string;
  onChange?: () => void;
}

export function Step4RiskTolerance({
  onNext,
  onBack,
  initialData,
  submitLabel = 'Continue',
  cancelLabel = 'Back',
  onChange,
}: Step4Props) {
  const {
    handleSubmit,
    control,
    formState: { errors, isDirty },
  } = useForm<OnboardingStep4Data>({
    resolver: zodResolver(step4Schema),
    defaultValues: {
      riskTolerance: 'moderate',
      ...initialData,
    },
  });

  // Report changes to parent
  useEffect(() => {
    if (isDirty && onChange) {
      onChange();
    }
  }, [isDirty, onChange]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Investment Strategy</CardTitle>
        <CardDescription>
          Choose your preferred investment approach
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onNext)} className="space-y-6">
          <div className="space-y-4">
            <Label>What is your risk tolerance?</Label>
            <Controller
              name="riskTolerance"
              control={control}
              render={({ field }) => (
                <RadioGroup
                  value={field.value}
                  onValueChange={field.onChange}
                  className="space-y-3"
                >
                  {RISK_TOLERANCE_OPTIONS.map((option) => (
                    <div
                      key={option.value}
                      className="flex cursor-pointer items-start space-x-3 rounded-lg border p-4 hover:bg-muted"
                    >
                      <RadioGroupItem
                        value={option.value}
                        id={option.value}
                        className="mt-1"
                      />
                      <div className="flex-1">
                        <Label
                          htmlFor={option.value}
                          className="cursor-pointer font-medium"
                        >
                          {option.label}
                        </Label>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {option.description}
                        </p>
                      </div>
                    </div>
                  ))}
                </RadioGroup>
              )}
            />
            {errors.riskTolerance && (
              <p className="text-sm text-red-500">
                {errors.riskTolerance.message}
              </p>
            )}
          </div>

          <div className="flex gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={onBack}
              className="flex-1"
            >
              {cancelLabel}
            </Button>
            <Button type="submit" className="flex-1">
              {submitLabel}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
