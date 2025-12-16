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
import { step1Schema } from '@/lib/validation/onboarding';
import type { OnboardingStep1Data } from '@/types/onboarding';

interface Step1Props {
  onNext: (data: OnboardingStep1Data) => void;
  initialData?: Partial<OnboardingStep1Data>;
}

export function Step1PersonalInfo({ onNext, initialData }: Step1Props) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<OnboardingStep1Data>({
    resolver: zodResolver(step1Schema),
    defaultValues: initialData,
  });

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

          <Button type="submit" className="w-full">
            Continue
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
