'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { step1Schema } from '@/lib/validation/onboarding';
import { US_STATES, type OnboardingStep1Data } from '@/types/onboarding';

interface Step1Props {
  onNext: (data: OnboardingStep1Data) => void;
  initialData?: Partial<OnboardingStep1Data>;
  submitLabel?: string;
  onChange?: () => void;
}

export function Step1PersonalInfo({ onNext, initialData, submitLabel = 'Continue', onChange }: Step1Props) {
  const {
    register,
    handleSubmit,
    formState: { errors, isDirty },
  } = useForm<OnboardingStep1Data>({
    resolver: zodResolver(step1Schema),
    defaultValues: initialData,
  });

  // Report changes to parent
  useEffect(() => {
    if (isDirty && onChange) {
      onChange();
    }
  }, [isDirty, onChange]);

  const currentYear = new Date().getFullYear();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Let&apos;s get to know you</CardTitle>
        <CardDescription>
          We&apos;ll use this information to personalize your retirement plan
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onNext)} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="birthYear">What year were you born?</Label>
            <Input
              id="birthYear"
              type="number"
              placeholder={String(currentYear - 40)}
              {...register('birthYear', { valueAsNumber: true })}
            />
            {errors.birthYear && (
              <p className="text-sm text-red-500">{errors.birthYear.message}</p>
            )}
            <p className="text-sm text-muted-foreground">
              We use your birth year to calculate your current age and
              retirement timeline
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="stateOfResidence">State of residence (optional)</Label>
            <Select
              id="stateOfResidence"
              options={[...US_STATES]}
              placeholder="Select your state"
              {...register('stateOfResidence')}
            />
            {errors.stateOfResidence && (
              <p className="text-sm text-red-500">{errors.stateOfResidence.message}</p>
            )}
            <p className="text-sm text-muted-foreground">
              Your state helps us estimate state income taxes in retirement
            </p>
          </div>

          <Button type="submit" className="w-full">
            {submitLabel}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
