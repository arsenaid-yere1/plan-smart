'use client';

import { useEffect, useState } from 'react';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ChevronDown, Trash2, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { step3Schema } from '@/lib/validation/onboarding';
import type { OnboardingStep3Data } from '@/types/onboarding';
import {
  INCOME_SOURCE_OPTIONS,
  INCOME_VARIABILITY_OPTIONS,
  getDefaultFlexibility,
  type IncomeSourceType,
} from '@/types/income-sources';

interface Step3Props {
  onNext: (data: OnboardingStep3Data) => void;
  onBack: () => void;
  initialData?: Partial<OnboardingStep3Data>;
  submitLabel?: string;
  cancelLabel?: string;
  onChange?: () => void;
}

export function Step3FinancialInfo({
  onNext,
  onBack,
  initialData,
  submitLabel = 'Continue',
  cancelLabel = 'Back',
  onChange,
}: Step3Props) {
  const [selectedTypes, setSelectedTypes] = useState<Set<IncomeSourceType>>(
    new Set(initialData?.incomeSources?.map((s) => s.type) ?? [])
  );
  const [expandedSources, setExpandedSources] = useState<Set<string>>(new Set());

  const {
    register,
    handleSubmit,
    watch,
    control,
    formState: { errors, isDirty },
  } = useForm<OnboardingStep3Data>({
    resolver: zodResolver(step3Schema),
    defaultValues: {
      annualIncome: initialData?.annualIncome,
      savingsRate: initialData?.savingsRate,
      incomeSources: initialData?.incomeSources ?? [],
    },
  });

  const { fields, append, remove, update } = useFieldArray({
    control,
    name: 'incomeSources',
  });

  // Report changes to parent
  useEffect(() => {
    if (isDirty && onChange) {
      onChange();
    }
  }, [isDirty, onChange]);

  // Auto-expand newly added sources
  useEffect(() => {
    const newSet = new Set<string>();
    fields.forEach((f) => newSet.add(f.id));
    setExpandedSources(newSet);
  }, [fields.length]);

  const annualIncome = watch('annualIncome') || 0;
  const savingsRate = watch('savingsRate') || 0;
  const incomeSources = watch('incomeSources') || [];
  const monthlySavings = (annualIncome * (savingsRate / 100)) / 12;

  // Calculate remaining income to allocate
  const allocatedIncome = incomeSources.reduce((sum, s) => sum + (s.annualAmount || 0), 0);
  const remainingIncome = annualIncome - allocatedIncome;

  // Toggle income type selection
  const toggleIncomeType = (type: IncomeSourceType) => {
    const newSelected = new Set(selectedTypes);
    const option = INCOME_SOURCE_OPTIONS.find((o) => o.value === type);

    if (selectedTypes.has(type)) {
      // Remove this type
      newSelected.delete(type);
      const index = fields.findIndex((f) => f.type === type);
      if (index !== -1) {
        remove(index);
      }
    } else {
      // Add this type
      newSelected.add(type);
      const isFirst = fields.length === 0;
      const newId = crypto.randomUUID();
      append({
        id: newId,
        type,
        label: option?.label ?? type,
        annualAmount: isFirst ? annualIncome : 0,
        variability: 'recurring',
        flexibility: getDefaultFlexibility(type),
        isPrimary: isFirst,
        notes: '',
      });
      // Auto-expand the new source
      setExpandedSources((prev) => new Set([...prev, newId]));
    }
    setSelectedTypes(newSelected);
  };

  // Set primary income source
  const setPrimary = (index: number) => {
    fields.forEach((field, i) => {
      if (i === index) {
        update(i, { ...field, isPrimary: true });
      } else if (field.isPrimary) {
        update(i, { ...field, isPrimary: false });
      }
    });
  };

  // Toggle expand/collapse for an income source
  const toggleExpand = (id: string) => {
    setExpandedSources((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Income & Savings</CardTitle>
        <CardDescription>Tell us about your income and how much you save</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onNext)} className="space-y-8">
          {/* Part 1: Total Income & Savings Rate */}
          <div className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="annualIncome">What is your total annual income?</Label>
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
                <p className="text-sm text-red-500">{errors.annualIncome.message}</p>
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
                <p className="text-sm text-red-500">{errors.savingsRate.message}</p>
              )}
              {annualIncome > 0 && savingsRate > 0 && (
                <p className="text-sm text-blue-600 dark:text-blue-400">
                  You&apos;re saving approximately ${monthlySavings.toFixed(0)} per month
                </p>
              )}
            </div>
          </div>

          {/* Part 2: Income Source Classification */}
          {annualIncome > 0 && (
            <div className="space-y-4 pt-4 border-t">
              <div>
                <Label className="text-base font-semibold">How do you earn this income?</Label>
                <p className="text-sm text-muted-foreground mt-1">
                  Select all that apply. This helps us understand your tax situation.
                </p>
              </div>

              {/* Income Type Selection Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {INCOME_SOURCE_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => toggleIncomeType(option.value)}
                    className={cn(
                      'p-4 rounded-lg border-2 text-left transition-colors',
                      selectedTypes.has(option.value)
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-primary/50'
                    )}
                  >
                    <div className="font-medium">{option.label}</div>
                    <div className="text-sm text-muted-foreground mt-1">{option.description}</div>
                  </button>
                ))}
              </div>

              {/* Income Source Details */}
              {fields.length > 0 && (
                <div className="space-y-4 mt-6">
                  <div className="flex items-center justify-between">
                    <Label className="text-base font-semibold">Income Breakdown</Label>
                    {remainingIncome !== 0 && (
                      <span
                        className={cn(
                          'text-sm font-medium',
                          remainingIncome > 0 ? 'text-amber-600' : 'text-red-600'
                        )}
                      >
                        {remainingIncome > 0
                          ? `$${remainingIncome.toLocaleString()} remaining`
                          : `$${Math.abs(remainingIncome).toLocaleString()} over`}
                      </span>
                    )}
                  </div>

                  {fields.map((field, index) => {
                    const option = INCOME_SOURCE_OPTIONS.find((o) => o.value === field.type);
                    const isExpanded = expandedSources.has(field.id);

                    return (
                      <div key={field.id} className="border rounded-lg">
                        <button
                          type="button"
                          onClick={() => toggleExpand(field.id)}
                          className="flex items-center justify-between w-full p-4 hover:bg-muted/50 transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            {field.isPrimary && (
                              <Star className="h-4 w-4 text-amber-500 fill-amber-500" />
                            )}
                            <span className="font-medium">{option?.label}</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-sm text-muted-foreground">
                              ${(incomeSources[index]?.annualAmount || 0).toLocaleString()}
                            </span>
                            <ChevronDown
                              className={cn(
                                'h-4 w-4 transition-transform',
                                isExpanded && 'rotate-180'
                              )}
                            />
                          </div>
                        </button>

                        {isExpanded && (
                          <div className="p-4 pt-0 space-y-4">
                            {/* Amount */}
                            <div className="space-y-2">
                              <Label>Annual amount from this source</Label>
                              <div className="relative">
                                <span className="absolute left-3 top-2.5 text-muted-foreground">
                                  $
                                </span>
                                <Input
                                  type="number"
                                  className="pl-7"
                                  {...register(`incomeSources.${index}.annualAmount`, {
                                    valueAsNumber: true,
                                  })}
                                />
                              </div>
                            </div>

                            {/* Variability */}
                            <div className="space-y-2">
                              <Label>How predictable is this income?</Label>
                              <Controller
                                control={control}
                                name={`incomeSources.${index}.variability`}
                                render={({ field: radioField }) => (
                                  <RadioGroup
                                    value={radioField.value}
                                    onValueChange={radioField.onChange}
                                    className="flex flex-wrap gap-4"
                                  >
                                    {INCOME_VARIABILITY_OPTIONS.map((opt) => (
                                      <div key={opt.value} className="flex items-center space-x-2">
                                        <RadioGroupItem
                                          value={opt.value}
                                          id={`${field.id}-${opt.value}`}
                                        />
                                        <Label
                                          htmlFor={`${field.id}-${opt.value}`}
                                          className="font-normal cursor-pointer"
                                        >
                                          {opt.label}
                                        </Label>
                                      </div>
                                    ))}
                                  </RadioGroup>
                                )}
                              />
                            </div>

                            {/* Primary & Remove */}
                            <div className="flex items-center justify-between pt-2">
                              <div className="flex items-center space-x-2">
                                <Checkbox
                                  id={`primary-${field.id}`}
                                  checked={field.isPrimary}
                                  onCheckedChange={() => setPrimary(index)}
                                />
                                <Label
                                  htmlFor={`primary-${field.id}`}
                                  className="font-normal cursor-pointer"
                                >
                                  This is my primary income source
                                </Label>
                              </div>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  const newSelected = new Set(selectedTypes);
                                  newSelected.delete(field.type);
                                  setSelectedTypes(newSelected);
                                  remove(index);
                                }}
                                className="text-destructive hover:text-destructive"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>

                            {/* Flexibility badges (read-only info) */}
                            <div className="flex flex-wrap gap-2 pt-2 border-t">
                              <span className="text-xs text-muted-foreground">Tax flexibility:</span>
                              {option?.defaultFlexibility.canDefer && (
                                <span className="text-xs bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 px-2 py-0.5 rounded">
                                  Deferrable
                                </span>
                              )}
                              {option?.defaultFlexibility.canReduce && (
                                <span className="text-xs bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 px-2 py-0.5 rounded">
                                  Deductible
                                </span>
                              )}
                              {option?.defaultFlexibility.canRestructure && (
                                <span className="text-xs bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200 px-2 py-0.5 rounded">
                                  Restructurable
                                </span>
                              )}
                              {!option?.defaultFlexibility.canDefer &&
                                !option?.defaultFlexibility.canReduce &&
                                !option?.defaultFlexibility.canRestructure && (
                                  <span className="text-xs bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400 px-2 py-0.5 rounded">
                                    Fixed
                                  </span>
                                )}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {errors.incomeSources && (
                    <p className="text-sm text-red-500">
                      {typeof errors.incomeSources.message === 'string'
                        ? errors.incomeSources.message
                        : 'Please check your income sources'}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          <div className="flex gap-3 pt-4">
            <Button type="button" variant="outline" onClick={onBack} className="flex-1">
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
