'use client';

import { useEffect } from 'react';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Plus, Trash2 } from 'lucide-react';
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
import { step2SavingsSchema } from '@/lib/validation/onboarding';
import {
  ACCOUNT_TYPE_OPTIONS,
  type OnboardingStep2SavingsData,
} from '@/types/onboarding';

interface Step2bProps {
  onNext: (data: OnboardingStep2SavingsData) => void;
  onBack: () => void;
  initialData?: Partial<OnboardingStep2SavingsData>;
  submitLabel?: string;
  cancelLabel?: string;
  onChange?: () => void;
}

export function Step2bSavingsContributions({
  onNext,
  onBack,
  initialData,
  submitLabel = 'Continue',
  cancelLabel = 'Back',
  onChange,
}: Step2bProps) {
  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isDirty },
  } = useForm<OnboardingStep2SavingsData>({
    resolver: zodResolver(step2SavingsSchema),
    defaultValues: {
      investmentAccounts: initialData?.investmentAccounts || [
        {
          id: crypto.randomUUID(),
          label: '',
          type: '401k',
          balance: 0,
          monthlyContribution: 0,
        },
      ],
    },
  });

  // Report changes to parent
  useEffect(() => {
    if (isDirty && onChange) {
      onChange();
    }
  }, [isDirty, onChange]);

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'investmentAccounts',
  });

  const addAccount = () => {
    append({
      id: crypto.randomUUID(),
      label: '',
      type: '401k',
      balance: 0,
      monthlyContribution: 0,
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Savings & Contributions</CardTitle>
        <CardDescription>
          Tell us about your retirement and investment accounts
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onNext)} className="space-y-6">
          {fields.map((field, index) => (
            <div
              key={field.id}
              className="space-y-4 p-4 border rounded-lg relative"
            >
              {fields.length > 1 && (
                <button
                  type="button"
                  onClick={() => remove(index)}
                  className="absolute top-2 right-2 text-muted-foreground hover:text-red-500 dark:hover:text-red-400"
                  aria-label="Remove account"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor={`investmentAccounts.${index}.label`}>
                    Account Name
                  </Label>
                  <Input
                    id={`investmentAccounts.${index}.label`}
                    placeholder="e.g., Company 401(k)"
                    {...register(`investmentAccounts.${index}.label`)}
                  />
                  {errors.investmentAccounts?.[index]?.label && (
                    <p className="text-sm text-red-500 dark:text-red-400">
                      {errors.investmentAccounts[index]?.label?.message}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor={`investmentAccounts.${index}.type`}>
                    Account Type
                  </Label>
                  <Controller
                    name={`investmentAccounts.${index}.type`}
                    control={control}
                    render={({ field }) => (
                      <Select
                        options={[...ACCOUNT_TYPE_OPTIONS]}
                        value={field.value}
                        onChange={(e) => field.onChange(e.target.value)}
                      />
                    )}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor={`investmentAccounts.${index}.balance`}>
                    Current Balance ($)
                  </Label>
                  <Input
                    id={`investmentAccounts.${index}.balance`}
                    type="number"
                    placeholder="0"
                    {...register(`investmentAccounts.${index}.balance`, {
                      valueAsNumber: true,
                    })}
                  />
                  {errors.investmentAccounts?.[index]?.balance && (
                    <p className="text-sm text-red-500 dark:text-red-400">
                      {errors.investmentAccounts[index]?.balance?.message}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label
                    htmlFor={`investmentAccounts.${index}.monthlyContribution`}
                  >
                    Monthly Contribution ($)
                  </Label>
                  <Input
                    id={`investmentAccounts.${index}.monthlyContribution`}
                    type="number"
                    placeholder="0"
                    {...register(
                      `investmentAccounts.${index}.monthlyContribution`,
                      { valueAsNumber: true }
                    )}
                  />
                </div>
              </div>
            </div>
          ))}

          {errors.investmentAccounts?.message && (
            <p className="text-sm text-red-500 dark:text-red-400">
              {errors.investmentAccounts.message}
            </p>
          )}

          <Button
            type="button"
            variant="outline"
            onClick={addAccount}
            className="w-full"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Another Account
          </Button>

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
