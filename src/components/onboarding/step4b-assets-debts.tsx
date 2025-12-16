'use client';

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
import { step4AssetsDebtsSchema } from '@/lib/validation/onboarding';
import {
  DEBT_TYPE_OPTIONS,
  type OnboardingStep4AssetsDebtsData,
} from '@/types/onboarding';

interface Step4bProps {
  onNext: (data: OnboardingStep4AssetsDebtsData) => void;
  onBack: () => void;
  initialData?: Partial<OnboardingStep4AssetsDebtsData>;
}

export function Step4bAssetsDebts({
  onNext,
  onBack,
  initialData,
}: Step4bProps) {
  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<OnboardingStep4AssetsDebtsData>({
    resolver: zodResolver(step4AssetsDebtsSchema),
    defaultValues: {
      primaryResidence: initialData?.primaryResidence || {},
      debts: initialData?.debts || [],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'debts',
  });

  const addDebt = () => {
    append({
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
          Tell us about your home and any outstanding debts
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onNext)} className="space-y-6">
          {/* Primary Residence Section */}
          <div className="space-y-4">
            <h3 className="font-medium">Primary Residence (Optional)</h3>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="estimatedValue">Home Value ($)</Label>
                <Input
                  id="estimatedValue"
                  type="number"
                  placeholder="e.g., 500000"
                  {...register('primaryResidence.estimatedValue', {
                    valueAsNumber: true,
                  })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="mortgageBalance">Mortgage Balance ($)</Label>
                <Input
                  id="mortgageBalance"
                  type="number"
                  placeholder="e.g., 350000"
                  {...register('primaryResidence.mortgageBalance', {
                    valueAsNumber: true,
                  })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="mortgageRate">Interest Rate (%)</Label>
                <Input
                  id="mortgageRate"
                  type="number"
                  step="0.1"
                  placeholder="e.g., 6.5"
                  {...register('primaryResidence.interestRate', {
                    valueAsNumber: true,
                  })}
                />
              </div>
            </div>
          </div>

          {/* Debts Section */}
          <div className="space-y-4">
            <h3 className="font-medium">Other Debts</h3>

            {fields.map((field, index) => (
              <div
                key={field.id}
                className="space-y-4 p-4 border rounded-lg relative"
              >
                <button
                  type="button"
                  onClick={() => remove(index)}
                  className="absolute top-2 right-2 text-gray-400 hover:text-red-500"
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
                      <p className="text-sm text-red-500">
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
                      <p className="text-sm text-red-500">
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
