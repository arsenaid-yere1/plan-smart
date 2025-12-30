'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { RotateCcw } from 'lucide-react';

export interface Assumptions {
  expectedReturn: number;
  inflationRate: number;
  retirementAge: number;
}

interface AssumptionsPanelProps {
  assumptions: Assumptions;
  defaultAssumptions: Assumptions;
  currentAge: number;
  onChange: (assumptions: Assumptions) => void;
  onReset: () => void;
  disabled?: boolean;
}

export function AssumptionsPanel({
  assumptions,
  defaultAssumptions,
  currentAge,
  onChange,
  onReset,
  disabled = false,
}: AssumptionsPanelProps) {
  const hasChanges =
    assumptions.expectedReturn !== defaultAssumptions.expectedReturn ||
    assumptions.inflationRate !== defaultAssumptions.inflationRate ||
    assumptions.retirementAge !== defaultAssumptions.retirementAge;

  const formatPercent = (value: number) => `${(value * 100).toFixed(1)}%`;
  const formatAge = (value: number) => `Age ${value}`;

  const isModified = (key: keyof Assumptions) =>
    assumptions[key] !== defaultAssumptions[key];

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-base font-medium">Assumptions</CardTitle>
        {hasChanges && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onReset}
            disabled={disabled}
            className="h-8 px-2 text-muted-foreground"
          >
            <RotateCcw className="h-4 w-4 mr-1" />
            Reset
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Expected Return */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium">
              Expected Return
              {isModified('expectedReturn') && (
                <span className="ml-2 text-xs text-muted-foreground">(modified)</span>
              )}
            </label>
          </div>
          <Slider
            value={[assumptions.expectedReturn]}
            min={0.01}
            max={0.30}
            step={0.005}
            disabled={disabled}
            formatValue={formatPercent}
            onValueChange={([value]) =>
              onChange({ ...assumptions, expectedReturn: value })
            }
          />
          <p className="text-xs text-muted-foreground">
            Default: {formatPercent(defaultAssumptions.expectedReturn)}
          </p>
        </div>

        {/* Inflation Rate */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium">
              Inflation Rate
              {isModified('inflationRate') && (
                <span className="ml-2 text-xs text-muted-foreground">(modified)</span>
              )}
            </label>
          </div>
          <Slider
            value={[assumptions.inflationRate]}
            min={0.01}
            max={0.15}
            step={0.005}
            disabled={disabled}
            formatValue={formatPercent}
            onValueChange={([value]) =>
              onChange({ ...assumptions, inflationRate: value })
            }
          />
          <p className="text-xs text-muted-foreground">
            Default: {formatPercent(defaultAssumptions.inflationRate)}
          </p>
        </div>

        {/* Retirement Age */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium">
              Retirement Age
              {isModified('retirementAge') && (
                <span className="ml-2 text-xs text-muted-foreground">(modified)</span>
              )}
            </label>
          </div>
          <Slider
            value={[assumptions.retirementAge]}
            min={currentAge + 1}
            max={80}
            step={1}
            disabled={disabled}
            formatValue={formatAge}
            onValueChange={([value]) =>
              onChange({ ...assumptions, retirementAge: value })
            }
          />
          <p className="text-xs text-muted-foreground">
            Default: {formatAge(defaultAssumptions.retirementAge)}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
