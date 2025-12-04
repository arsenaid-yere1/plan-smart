'use client';

import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { step2Schema } from '@/lib/validation/onboarding';
import { FILING_STATUS_OPTIONS } from '@/types/onboarding';
import type { OnboardingStep2Data } from '@/types/onboarding';

interface Step2Props {
  onNext: (data: OnboardingStep2Data) => void;
  onBack: () => void;
  initialData?: Partial<OnboardingStep2Data>;
}

export function Step2RetirementInfo({ onNext, onBack, initialData }: Step2Props) {
  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<OnboardingStep2Data>({
    resolver: zodResolver(step2Schema),
    defaultValues: {
      filingStatus: 'single',
      ...initialData,
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Retirement Goals</CardTitle>
        <CardDescription>
          Tell us about your retirement timeline and tax status
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onNext)} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="targetRetirementAge">
              At what age do you plan to retire?
            </Label>
            <Input
              id="targetRetirementAge"
              type="number"
              placeholder="65"
              {...register('targetRetirementAge', { valueAsNumber: true })}
            />
            {errors.targetRetirementAge && (
              <p className="text-sm text-red-500">
                {errors.targetRetirementAge.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label>What is your tax filing status?</Label>
            <Controller
              name="filingStatus"
              control={control}
              render={({ field }) => (
                <RadioGroup
                  value={field.value}
                  onValueChange={field.onChange}
                  className="space-y-2"
                >
                  {FILING_STATUS_OPTIONS.map((option) => (
                    <div
                      key={option.value}
                      className="flex items-center space-x-2"
                    >
                      <RadioGroupItem value={option.value} id={option.value} />
                      <Label
                        htmlFor={option.value}
                        className="cursor-pointer font-normal"
                      >
                        {option.label}
                      </Label>
                    </div>
                  ))}
                </RadioGroup>
              )}
            />
            {errors.filingStatus && (
              <p className="text-sm text-red-500">
                {errors.filingStatus.message}
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
              Back
            </Button>
            <Button type="submit" className="flex-1">
              Continue
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
