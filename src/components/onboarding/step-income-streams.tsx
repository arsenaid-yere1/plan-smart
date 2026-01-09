'use client';

import { useEffect } from 'react';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  stepIncomeStreamsSchema,
  type OnboardingStepIncomeStreamsData,
} from '@/lib/validation/onboarding';
import { INCOME_STREAM_TYPE_OPTIONS } from '@/types/onboarding';

interface StepIncomeStreamsProps {
  onNext: (data: OnboardingStepIncomeStreamsData) => void;
  onBack: () => void;
  initialData?: Partial<OnboardingStepIncomeStreamsData>;
  submitLabel?: string;
  cancelLabel?: string;
  onChange?: () => void;
}

export function StepIncomeStreams({
  onNext,
  onBack,
  initialData,
  submitLabel = 'Continue',
  cancelLabel = 'Back',
  onChange,
}: StepIncomeStreamsProps) {
  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isDirty },
  } = useForm<OnboardingStepIncomeStreamsData>({
    resolver: zodResolver(stepIncomeStreamsSchema),
    defaultValues: {
      incomeStreams: initialData?.incomeStreams || [],
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
    name: 'incomeStreams',
  });

  const addIncomeStream = () => {
    append({
      id: crypto.randomUUID(),
      name: '',
      type: 'social_security',
      annualAmount: 0,
      startAge: 67,
      endAge: undefined,
      inflationAdjusted: true,
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Expected Retirement Income</CardTitle>
        <CardDescription>
          Add any income sources you expect during retirement (Social Security,
          pensions, rental income, etc.). You can skip this step if you
          don&apos;t have any planned income sources yet.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onNext)} className="space-y-6">
          {fields.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4 border rounded-lg bg-muted/50">
              No income sources added yet. Click below to add your first income
              source, or continue to skip this step.
            </p>
          )}

          {fields.map((field, index) => (
            <div
              key={field.id}
              className="space-y-4 p-4 border rounded-lg relative"
            >
              <button
                type="button"
                onClick={() => remove(index)}
                className="absolute top-2 right-2 text-muted-foreground hover:text-red-500 dark:hover:text-red-400"
                aria-label="Remove income source"
              >
                <Trash2 className="h-4 w-4" />
              </button>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor={`incomeStreams.${index}.name`}>Name</Label>
                  <Input
                    id={`incomeStreams.${index}.name`}
                    placeholder="e.g., Social Security"
                    {...register(`incomeStreams.${index}.name`)}
                  />
                  {errors.incomeStreams?.[index]?.name && (
                    <p className="text-sm text-red-500 dark:text-red-400">
                      {errors.incomeStreams[index]?.name?.message}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor={`incomeStreams.${index}.type`}>Type</Label>
                  <Controller
                    name={`incomeStreams.${index}.type`}
                    control={control}
                    render={({ field }) => (
                      <Select
                        options={[...INCOME_STREAM_TYPE_OPTIONS]}
                        value={field.value}
                        onChange={(e) => field.onChange(e.target.value)}
                      />
                    )}
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor={`incomeStreams.${index}.annualAmount`}>
                    Annual Amount ($)
                  </Label>
                  <Input
                    id={`incomeStreams.${index}.annualAmount`}
                    type="number"
                    placeholder="24000"
                    {...register(`incomeStreams.${index}.annualAmount`, {
                      valueAsNumber: true,
                    })}
                  />
                  {errors.incomeStreams?.[index]?.annualAmount && (
                    <p className="text-sm text-red-500 dark:text-red-400">
                      {errors.incomeStreams[index]?.annualAmount?.message}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor={`incomeStreams.${index}.startAge`}>
                    Start Age
                  </Label>
                  <Input
                    id={`incomeStreams.${index}.startAge`}
                    type="number"
                    placeholder="67"
                    {...register(`incomeStreams.${index}.startAge`, {
                      valueAsNumber: true,
                    })}
                  />
                  {errors.incomeStreams?.[index]?.startAge && (
                    <p className="text-sm text-red-500 dark:text-red-400">
                      {errors.incomeStreams[index]?.startAge?.message}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor={`incomeStreams.${index}.endAge`}>
                    End Age (optional)
                  </Label>
                  <Input
                    id={`incomeStreams.${index}.endAge`}
                    type="number"
                    placeholder="Lifetime"
                    {...register(`incomeStreams.${index}.endAge`, {
                      setValueAs: (v) =>
                        v === '' || v === undefined ? undefined : Number(v),
                    })}
                  />
                  {errors.incomeStreams?.[index]?.endAge && (
                    <p className="text-sm text-red-500 dark:text-red-400">
                      {errors.incomeStreams[index]?.endAge?.message}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <Controller
                  name={`incomeStreams.${index}.inflationAdjusted`}
                  control={control}
                  render={({ field }) => (
                    <Checkbox
                      id={`incomeStreams.${index}.inflationAdjusted`}
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  )}
                />
                <Label
                  htmlFor={`incomeStreams.${index}.inflationAdjusted`}
                  className="text-sm font-normal cursor-pointer"
                >
                  Adjusts for inflation (COLA)
                </Label>
              </div>
            </div>
          ))}

          <Button
            type="button"
            variant="outline"
            onClick={addIncomeStream}
            className="w-full"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Income Source
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
