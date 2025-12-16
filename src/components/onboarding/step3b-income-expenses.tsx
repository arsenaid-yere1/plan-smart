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
import { step3IncomeExpensesSchema } from '@/lib/validation/onboarding';
import type { OnboardingStep3IncomeExpensesData } from '@/types/onboarding';

interface Step3bProps {
  onNext: (data: OnboardingStep3IncomeExpensesData) => void;
  onBack: () => void;
  initialData?: Partial<OnboardingStep3IncomeExpensesData>;
}

export function Step3bIncomeExpenses({
  onNext,
  onBack,
  initialData,
}: Step3bProps) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<OnboardingStep3IncomeExpensesData>({
    resolver: zodResolver(step3IncomeExpensesSchema),
    defaultValues: initialData,
  });

  const handleSkip = () => {
    onNext({ incomeExpenses: undefined });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Monthly Expenses</CardTitle>
        <CardDescription>
          Help us understand your spending (optional - you can skip this step)
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onNext)} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="monthlyEssential">
              Monthly Essential Expenses ($)
            </Label>
            <Input
              id="monthlyEssential"
              type="number"
              placeholder="e.g., 3000 (rent, utilities, food, insurance)"
              {...register('incomeExpenses.monthlyEssential', {
                valueAsNumber: true,
              })}
            />
            {errors.incomeExpenses?.monthlyEssential && (
              <p className="text-sm text-red-500 dark:text-red-400">
                {errors.incomeExpenses.monthlyEssential.message}
              </p>
            )}
            <p className="text-sm text-muted-foreground">
              Include rent/mortgage, utilities, groceries, insurance, minimum
              debt payments
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="monthlyDiscretionary">
              Monthly Discretionary Expenses ($)
            </Label>
            <Input
              id="monthlyDiscretionary"
              type="number"
              placeholder="e.g., 1000 (dining, entertainment, travel)"
              {...register('incomeExpenses.monthlyDiscretionary', {
                valueAsNumber: true,
              })}
            />
            {errors.incomeExpenses?.monthlyDiscretionary && (
              <p className="text-sm text-red-500 dark:text-red-400">
                {errors.incomeExpenses.monthlyDiscretionary.message}
              </p>
            )}
            <p className="text-sm text-muted-foreground">
              Include dining out, entertainment, subscriptions, travel,
              hobbies
            </p>
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
            <Button
              type="button"
              variant="ghost"
              onClick={handleSkip}
              className="flex-1"
            >
              Skip
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
