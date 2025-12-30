'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
  // Local state for input fields to allow typing without immediate validation
  const [expectedReturnInput, setExpectedReturnInput] = useState(
    (assumptions.expectedReturn * 100).toFixed(1)
  );
  const [inflationRateInput, setInflationRateInput] = useState(
    (assumptions.inflationRate * 100).toFixed(1)
  );
  const [retirementAgeInput, setRetirementAgeInput] = useState(
    assumptions.retirementAge.toString()
  );

  const hasChanges =
    assumptions.expectedReturn !== defaultAssumptions.expectedReturn ||
    assumptions.inflationRate !== defaultAssumptions.inflationRate ||
    assumptions.retirementAge !== defaultAssumptions.retirementAge;

  const formatPercent = (value: number) => `${(value * 100).toFixed(1)}%`;
  const formatAge = (value: number) => `Age ${value}`;

  const isModified = (key: keyof Assumptions) =>
    assumptions[key] !== defaultAssumptions[key];

  // Handle percentage input blur - validate and apply
  const handlePercentBlur = (
    field: 'expectedReturn' | 'inflationRate',
    inputValue: string,
    min: number,
    max: number
  ) => {
    const parsed = parseFloat(inputValue);
    if (isNaN(parsed)) {
      // Reset to current value
      if (field === 'expectedReturn') {
        setExpectedReturnInput((assumptions.expectedReturn * 100).toFixed(1));
      } else {
        setInflationRateInput((assumptions.inflationRate * 100).toFixed(1));
      }
      return;
    }

    // Clamp to valid range
    const clamped = Math.min(Math.max(parsed, min * 100), max * 100);
    const decimalValue = clamped / 100;

    if (field === 'expectedReturn') {
      setExpectedReturnInput(clamped.toFixed(1));
      onChange({ ...assumptions, expectedReturn: decimalValue });
    } else {
      setInflationRateInput(clamped.toFixed(1));
      onChange({ ...assumptions, inflationRate: decimalValue });
    }
  };

  // Handle age input blur - validate and apply
  const handleAgeBlur = () => {
    const parsed = parseInt(retirementAgeInput, 10);
    if (isNaN(parsed)) {
      setRetirementAgeInput(assumptions.retirementAge.toString());
      return;
    }

    // Clamp to valid range
    const minAge = currentAge + 1;
    const maxAge = 80;
    const clamped = Math.min(Math.max(parsed, minAge), maxAge);

    setRetirementAgeInput(clamped.toString());
    onChange({ ...assumptions, retirementAge: clamped });
  };

  // Sync input fields when slider changes
  const handleSliderChange = (
    field: keyof Assumptions,
    value: number
  ) => {
    if (field === 'expectedReturn') {
      setExpectedReturnInput((value * 100).toFixed(1));
      onChange({ ...assumptions, expectedReturn: value });
    } else if (field === 'inflationRate') {
      setInflationRateInput((value * 100).toFixed(1));
      onChange({ ...assumptions, inflationRate: value });
    } else {
      setRetirementAgeInput(value.toString());
      onChange({ ...assumptions, retirementAge: value });
    }
  };

  // Handle reset - also reset input fields
  const handleReset = () => {
    setExpectedReturnInput((defaultAssumptions.expectedReturn * 100).toFixed(1));
    setInflationRateInput((defaultAssumptions.inflationRate * 100).toFixed(1));
    setRetirementAgeInput(defaultAssumptions.retirementAge.toString());
    onReset();
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-base font-medium">Assumptions</CardTitle>
        {hasChanges && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleReset}
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
            <div className="flex items-center gap-1">
              <Input
                type="text"
                value={expectedReturnInput}
                onChange={(e) => setExpectedReturnInput(e.target.value)}
                onBlur={() => handlePercentBlur('expectedReturn', expectedReturnInput, 0.01, 0.30)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handlePercentBlur('expectedReturn', expectedReturnInput, 0.01, 0.30);
                    (e.target as HTMLInputElement).blur();
                  }
                }}
                disabled={disabled}
                className="w-16 h-7 text-right text-sm px-2"
              />
              <span className="text-sm text-muted-foreground">%</span>
            </div>
          </div>
          <Slider
            value={[assumptions.expectedReturn]}
            min={0.01}
            max={0.30}
            step={0.005}
            disabled={disabled}
            formatValue={formatPercent}
            onValueChange={([value]) => handleSliderChange('expectedReturn', value)}
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
            <div className="flex items-center gap-1">
              <Input
                type="text"
                value={inflationRateInput}
                onChange={(e) => setInflationRateInput(e.target.value)}
                onBlur={() => handlePercentBlur('inflationRate', inflationRateInput, 0.01, 0.10)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handlePercentBlur('inflationRate', inflationRateInput, 0.01, 0.10);
                    (e.target as HTMLInputElement).blur();
                  }
                }}
                disabled={disabled}
                className="w-16 h-7 text-right text-sm px-2"
              />
              <span className="text-sm text-muted-foreground">%</span>
            </div>
          </div>
          <Slider
            value={[assumptions.inflationRate]}
            min={0.01}
            max={0.10}
            step={0.005}
            disabled={disabled}
            formatValue={formatPercent}
            onValueChange={([value]) => handleSliderChange('inflationRate', value)}
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
            <div className="flex items-center gap-1">
              <Input
                type="text"
                value={retirementAgeInput}
                onChange={(e) => setRetirementAgeInput(e.target.value)}
                onBlur={handleAgeBlur}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleAgeBlur();
                    (e.target as HTMLInputElement).blur();
                  }
                }}
                disabled={disabled}
                className="w-14 h-7 text-right text-sm px-2"
              />
            </div>
          </div>
          <Slider
            value={[assumptions.retirementAge]}
            min={currentAge + 1}
            max={80}
            step={1}
            disabled={disabled}
            formatValue={formatAge}
            onValueChange={([value]) => handleSliderChange('retirementAge', value)}
          />
          <p className="text-xs text-muted-foreground">
            Default: {formatAge(defaultAssumptions.retirementAge)}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
