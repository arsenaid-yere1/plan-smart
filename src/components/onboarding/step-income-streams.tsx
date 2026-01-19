'use client';

import { useEffect } from 'react';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Plus, Trash2, Shield, TrendingUp } from 'lucide-react';
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
import type { IncomeStreamType } from '@/types/onboarding';
import { isGuaranteedIncomeType } from '@/lib/projections/types';

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
  // Ensure all initial income streams have isGuaranteed set (migration for legacy data)
  const migratedIncomeStreams = (initialData?.incomeStreams || []).map(stream => ({
    ...stream,
    isGuaranteed: stream.isGuaranteed ?? isGuaranteedIncomeType(stream.type),
    isSpouse: stream.isSpouse ?? false,
  }));

  const {
    register,
    control,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isDirty },
  } = useForm<OnboardingStepIncomeStreamsData>({
    resolver: zodResolver(stepIncomeStreamsSchema),
    defaultValues: {
      incomeStreams: migratedIncomeStreams,
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
    const defaultType: IncomeStreamType = 'social_security';
    append({
      id: crypto.randomUUID(),
      name: '',
      type: defaultType,
      annualAmount: 0,
      startAge: 67,
      endAge: undefined,
      inflationAdjusted: true,
      isGuaranteed: isGuaranteedIncomeType(defaultType),
      isSpouse: false,
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
                        onChange={(e) => {
                          const newType = e.target.value as IncomeStreamType;
                          field.onChange(newType);
                          // Auto-update isGuaranteed based on new type
                          setValue(`incomeStreams.${index}.isGuaranteed`, isGuaranteedIncomeType(newType));
                        }}
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

              <div className="flex flex-wrap items-center gap-4">
                {/* COLA checkbox */}
                <div className="flex items-center space-x-2">
                  <Controller
                    name={`incomeStreams.${index}.inflationAdjusted`}
                    control={control}
                    render={({ field: colaField }) => (
                      <Checkbox
                        id={`incomeStreams.${index}.inflationAdjusted`}
                        checked={colaField.value}
                        onCheckedChange={colaField.onChange}
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

                {/* Spouse toggle - only for SS and pension */}
                {(watch(`incomeStreams.${index}.type`) === 'social_security' ||
                  watch(`incomeStreams.${index}.type`) === 'pension') && (
                  <div className="flex items-center space-x-2">
                    <Controller
                      name={`incomeStreams.${index}.isSpouse`}
                      control={control}
                      render={({ field: spouseField }) => (
                        <Checkbox
                          id={`incomeStreams.${index}.isSpouse`}
                          checked={spouseField.value ?? false}
                          onCheckedChange={spouseField.onChange}
                        />
                      )}
                    />
                    <Label
                      htmlFor={`incomeStreams.${index}.isSpouse`}
                      className="text-sm font-normal cursor-pointer"
                    >
                      Spouse&apos;s benefit
                    </Label>
                  </div>
                )}

                {/* Guaranteed indicator */}
                <div className="flex items-center gap-2 text-sm ml-auto">
                  {watch(`incomeStreams.${index}.isGuaranteed`) ? (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                      <Shield className="h-3 w-3 mr-1" />
                      Guaranteed
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">
                      <TrendingUp className="h-3 w-3 mr-1" />
                      Variable
                    </span>
                  )}
                </div>
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
