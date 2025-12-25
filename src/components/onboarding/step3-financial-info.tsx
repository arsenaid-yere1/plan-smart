'use client';

import { useForm } from 'react-hook-form';
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
import { step3Schema } from '@/lib/validation/onboarding';
import type { OnboardingStep3Data } from '@/types/onboarding';

interface Step3Props {
  onNext: (data: OnboardingStep3Data) => void;
  onBack: () => void;
  initialData?: Partial<OnboardingStep3Data>;
  submitLabel?: string;
  cancelLabel?: string;
}

export function Step3FinancialInfo({ onNext, onBack, initialData, submitLabel = 'Continue', cancelLabel = 'Back' }: Step3Props) {
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<OnboardingStep3Data>({
    resolver: zodResolver(step3Schema),
    defaultValues: initialData,
  });

  const annualIncome = watch('annualIncome') || 0;
  const savingsRate = watch('savingsRate') || 0;
  const monthlySavings = (annualIncome * (savingsRate / 100)) / 12;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Financial Information</CardTitle>
        <CardDescription>
          Help us understand your current financial situation
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onNext)} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="annualIncome">
              What is your current annual income?
            </Label>
            <div className="relative">
              <span className="absolute left-3 top-2.5 text-muted-foreground">$</span>
              <Input
                id="annualIncome"
                type="number"
                placeholder="75000"
                className="pl-7"
                {...register('annualIncome', { valueAsNumber: true })}
              />
            </div>
            {errors.annualIncome && (
              <p className="text-sm text-red-500">
                {errors.annualIncome.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="savingsRate">
              What percentage of your income do you save for retirement?
            </Label>
            <div className="relative">
              <Input
                id="savingsRate"
                type="number"
                placeholder="15"
                {...register('savingsRate', { valueAsNumber: true })}
              />
              <span className="absolute right-3 top-2.5 text-muted-foreground">%</span>
            </div>
            {errors.savingsRate && (
              <p className="text-sm text-red-500">
                {errors.savingsRate.message}
              </p>
            )}
            {annualIncome > 0 && savingsRate > 0 && (
              <p className="text-sm text-blue-600 dark:text-blue-400">
                You&apos;re saving approximately ${monthlySavings.toFixed(0)} per
                month
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
