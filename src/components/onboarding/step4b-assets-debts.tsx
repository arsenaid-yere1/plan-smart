'use client';

import { useState } from 'react';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Plus, Trash2, Home, ChevronDown, ChevronUp } from 'lucide-react';
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
import { step4AssetsDebtsSchema } from '@/lib/validation/onboarding';
import {
  DEBT_TYPE_OPTIONS,
  PROPERTY_TYPE_OPTIONS,
  type OnboardingStep4AssetsDebtsData,
} from '@/types/onboarding';

interface Step4bProps {
  onNext: (data: OnboardingStep4AssetsDebtsData) => void;
  onBack: () => void;
  initialData?: Partial<OnboardingStep4AssetsDebtsData>;
  submitLabel?: string;
  cancelLabel?: string;
}

export function Step4bAssetsDebts({
  onNext,
  onBack,
  initialData,
  submitLabel = 'Continue',
  cancelLabel = 'Back',
}: Step4bProps) {
  // Track which properties have mortgage section expanded
  const [expandedMortgages, setExpandedMortgages] = useState<Set<number>>(new Set());

  const toggleMortgage = (index: number) => {
    setExpandedMortgages((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
    watch,
  } = useForm<OnboardingStep4AssetsDebtsData>({
    resolver: zodResolver(step4AssetsDebtsSchema),
    defaultValues: {
      primaryResidence: initialData?.primaryResidence || {},
      realEstateProperties: initialData?.realEstateProperties || [],
      debts: initialData?.debts || [],
    },
  });

  // Watch properties to check for mortgage values
  const properties = watch('realEstateProperties');

  const { fields: propertyFields, append: appendProperty, remove: removeProperty } = useFieldArray({
    control,
    name: 'realEstateProperties',
  });

  const { fields: debtFields, append: appendDebt, remove: removeDebt } = useFieldArray({
    control,
    name: 'debts',
  });

  const addProperty = () => {
    appendProperty({
      id: crypto.randomUUID(),
      name: '',
      type: 'primary',
      estimatedValue: 0,
      mortgageBalance: undefined,
      mortgageInterestRate: undefined,
    });
  };

  const addDebt = () => {
    appendDebt({
      id: crypto.randomUUID(),
      label: '',
      type: 'CreditCard',
      balance: 0,
      interestRate: undefined,
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Assets & Debts</CardTitle>
        <CardDescription>
          Tell us about your real estate properties and any outstanding debts
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onNext)} className="space-y-6">
          {/* Real Estate Properties Section */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Home className="h-5 w-5" />
              <h3 className="font-medium">Real Estate Properties</h3>
            </div>
            <p className="text-sm text-muted-foreground">
              Add your properties to track their value for net worth calculations.
              Rental income should be added separately in the Income Streams section.
            </p>

            {propertyFields.map((field, index) => (
              <div
                key={field.id}
                className="space-y-4 p-4 border rounded-lg relative"
              >
                <button
                  type="button"
                  onClick={() => removeProperty(index)}
                  className="absolute top-2 right-2 text-muted-foreground hover:text-red-500 dark:hover:text-red-400"
                  aria-label="Remove property"
                >
                  <Trash2 className="h-4 w-4" />
                </button>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor={`realEstateProperties.${index}.name`}>
                      Property Name
                    </Label>
                    <Input
                      id={`realEstateProperties.${index}.name`}
                      placeholder="e.g., Main Home, Beach House"
                      {...register(`realEstateProperties.${index}.name`)}
                    />
                    {errors.realEstateProperties?.[index]?.name && (
                      <p className="text-sm text-red-500 dark:text-red-400">
                        {errors.realEstateProperties[index]?.name?.message}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor={`realEstateProperties.${index}.type`}>
                      Property Type
                    </Label>
                    <Controller
                      name={`realEstateProperties.${index}.type`}
                      control={control}
                      render={({ field: selectField }) => (
                        <Select
                          options={[...PROPERTY_TYPE_OPTIONS]}
                          value={selectField.value}
                          onChange={(e) => selectField.onChange(e.target.value)}
                        />
                      )}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor={`realEstateProperties.${index}.estimatedValue`}>
                    Estimated Value ($)
                  </Label>
                  <Input
                    id={`realEstateProperties.${index}.estimatedValue`}
                    type="number"
                    placeholder="e.g., 500000"
                    {...register(`realEstateProperties.${index}.estimatedValue`, {
                      valueAsNumber: true,
                    })}
                  />
                  {errors.realEstateProperties?.[index]?.estimatedValue && (
                    <p className="text-sm text-red-500 dark:text-red-400">
                      {errors.realEstateProperties[index]?.estimatedValue?.message}
                    </p>
                  )}
                </div>

                {/* Mortgage Toggle */}
                <button
                  type="button"
                  onClick={() => toggleMortgage(index)}
                  className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
                >
                  {expandedMortgages.has(index) ||
                  (properties?.[index]?.mortgageBalance && properties[index].mortgageBalance! > 0) ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                  {expandedMortgages.has(index) ||
                  (properties?.[index]?.mortgageBalance && properties[index].mortgageBalance! > 0)
                    ? 'Hide mortgage details'
                    : 'Add mortgage details (optional)'}
                </button>

                {/* Mortgage Fields (collapsible) */}
                {(expandedMortgages.has(index) ||
                  (properties?.[index]?.mortgageBalance && properties[index].mortgageBalance! > 0)) && (
                  <div className="grid grid-cols-2 gap-4 pl-4 border-l-2 border-muted">
                    <div className="space-y-2">
                      <Label htmlFor={`realEstateProperties.${index}.mortgageBalance`}>
                        Mortgage Balance ($)
                      </Label>
                      <Input
                        id={`realEstateProperties.${index}.mortgageBalance`}
                        type="number"
                        placeholder="e.g., 350000"
                        {...register(`realEstateProperties.${index}.mortgageBalance`, {
                          valueAsNumber: true,
                        })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={`realEstateProperties.${index}.mortgageInterestRate`}>
                        Interest Rate (%)
                      </Label>
                      <Input
                        id={`realEstateProperties.${index}.mortgageInterestRate`}
                        type="number"
                        step="0.1"
                        placeholder="e.g., 6.5"
                        {...register(`realEstateProperties.${index}.mortgageInterestRate`, {
                          valueAsNumber: true,
                        })}
                      />
                    </div>
                  </div>
                )}
              </div>
            ))}

            <Button
              type="button"
              variant="outline"
              onClick={addProperty}
              className="w-full"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Property
            </Button>
          </div>

          {/* Debts Section */}
          <div className="space-y-4">
            <h3 className="font-medium">Other Debts</h3>
            <p className="text-sm text-muted-foreground">
              Add debts like student loans, credit cards, auto loans. Do not include mortgages here - those are tracked with properties above.
            </p>

            {debtFields.map((field, index) => (
              <div
                key={field.id}
                className="space-y-4 p-4 border rounded-lg relative"
              >
                <button
                  type="button"
                  onClick={() => removeDebt(index)}
                  className="absolute top-2 right-2 text-muted-foreground hover:text-red-500 dark:hover:text-red-400"
                  aria-label="Remove debt"
                >
                  <Trash2 className="h-4 w-4" />
                </button>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor={`debts.${index}.label`}>Description</Label>
                    <Input
                      id={`debts.${index}.label`}
                      placeholder="e.g., Student Loans"
                      {...register(`debts.${index}.label`)}
                    />
                    {errors.debts?.[index]?.label && (
                      <p className="text-sm text-red-500 dark:text-red-400">
                        {errors.debts[index]?.label?.message}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor={`debts.${index}.type`}>Type</Label>
                    <Controller
                      name={`debts.${index}.type`}
                      control={control}
                      render={({ field }) => (
                        <Select
                          options={[...DEBT_TYPE_OPTIONS]}
                          value={field.value}
                          onChange={(e) => field.onChange(e.target.value)}
                        />
                      )}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor={`debts.${index}.balance`}>
                      Balance ($)
                    </Label>
                    <Input
                      id={`debts.${index}.balance`}
                      type="number"
                      placeholder="0"
                      {...register(`debts.${index}.balance`, {
                        valueAsNumber: true,
                      })}
                    />
                    {errors.debts?.[index]?.balance && (
                      <p className="text-sm text-red-500 dark:text-red-400">
                        {errors.debts[index]?.balance?.message}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor={`debts.${index}.interestRate`}>
                      Interest Rate (%)
                    </Label>
                    <Input
                      id={`debts.${index}.interestRate`}
                      type="number"
                      step="0.1"
                      placeholder="e.g., 18.5"
                      {...register(`debts.${index}.interestRate`, {
                        valueAsNumber: true,
                      })}
                    />
                  </div>
                </div>
              </div>
            ))}

            <Button
              type="button"
              variant="outline"
              onClick={addDebt}
              className="w-full"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Debt
            </Button>
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
