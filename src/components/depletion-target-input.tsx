'use client';

import { useState, useCallback, useEffect } from 'react';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import { AlertCircle, Info } from 'lucide-react';
import type { DepletionTarget } from '@/lib/projections/types';
import { DEFAULT_DEPLETION_TARGET } from '@/lib/projections/assumptions';
import { validateDepletionTarget } from '@/lib/validation/projections';

interface DepletionTargetInputProps {
  target: DepletionTarget | undefined;
  currentAge: number;
  maxAge: number;
  portfolioValue: number;
  onChange: (target: DepletionTarget) => void;
}

export function DepletionTargetInput({
  target,
  currentAge,
  maxAge,
  portfolioValue,
  onChange,
}: DepletionTargetInputProps) {
  // Initialize with defaults if no target
  const [localTarget, setLocalTarget] = useState<DepletionTarget>(() => {
    if (target) return target;
    return {
      ...DEFAULT_DEPLETION_TARGET,
      targetAge: Math.min(85, maxAge - 5),
    };
  });

  // Local state for text inputs (allows typing without immediate validation)
  const [percentageInput, setPercentageInput] = useState(
    localTarget.targetPercentageSpent.toString()
  );
  const [ageInput, setAgeInput] = useState(localTarget.targetAge.toString());

  // Validation errors
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  // Validate when localTarget or constraints change
  useEffect(() => {
    if (localTarget.enabled) {
      const result = validateDepletionTarget(localTarget, currentAge, maxAge);
      setValidationErrors(result.errors);
    } else {
      setValidationErrors([]);
    }
  }, [localTarget, currentAge, maxAge]);

  const handleEnabledChange = useCallback((enabled: boolean) => {
    const newTarget = { ...localTarget, enabled };
    setLocalTarget(newTarget);
    onChange(newTarget);
  }, [localTarget, onChange]);

  const handleSliderChange = useCallback((field: 'targetPercentageSpent' | 'targetAge', value: number) => {
    const newTarget = { ...localTarget, [field]: value };
    setLocalTarget(newTarget);

    // Sync text input
    if (field === 'targetPercentageSpent') {
      setPercentageInput(value.toString());
    } else {
      setAgeInput(value.toString());
    }

    // Only save if valid
    const result = validateDepletionTarget(newTarget, currentAge, maxAge);
    if (result.valid) {
      onChange(newTarget);
    }
  }, [localTarget, currentAge, maxAge, onChange]);

  const handlePercentageBlur = useCallback(() => {
    const parsed = parseInt(percentageInput, 10);
    if (isNaN(parsed)) {
      setPercentageInput(localTarget.targetPercentageSpent.toString());
      return;
    }
    const clamped = Math.min(Math.max(parsed, 0), 100);
    setPercentageInput(clamped.toString());

    const newTarget = { ...localTarget, targetPercentageSpent: clamped };
    setLocalTarget(newTarget);

    const result = validateDepletionTarget(newTarget, currentAge, maxAge);
    if (result.valid) {
      onChange(newTarget);
    }
  }, [percentageInput, localTarget, currentAge, maxAge, onChange]);

  const handleAgeBlur = useCallback(() => {
    const parsed = parseInt(ageInput, 10);
    if (isNaN(parsed)) {
      setAgeInput(localTarget.targetAge.toString());
      return;
    }
    const clamped = Math.min(Math.max(parsed, 50), 120);
    setAgeInput(clamped.toString());

    const newTarget = { ...localTarget, targetAge: clamped };
    setLocalTarget(newTarget);

    const result = validateDepletionTarget(newTarget, currentAge, maxAge);
    if (result.valid) {
      onChange(newTarget);
    }
  }, [ageInput, localTarget, currentAge, maxAge, onChange]);

  // Calculate projected reserve
  const projectedReserve = portfolioValue * (1 - localTarget.targetPercentageSpent / 100);

  return (
    <div className="space-y-4">
      {/* Enable/Disable Toggle */}
      <div className="flex items-center justify-between">
        <div>
          <Label htmlFor="depletion-enabled" className="font-medium">
            Set a Spending Target
          </Label>
          <p className="text-sm text-muted-foreground">
            Plan how much of your portfolio you want to spend by a certain age
          </p>
        </div>
        <Switch
          id="depletion-enabled"
          checked={localTarget.enabled}
          onCheckedChange={handleEnabledChange}
        />
      </div>

      {/* Target Configuration */}
      {localTarget.enabled && (
        <div className="space-y-6 pt-4 border-t">
          {/* Info Banner */}
          <div className="flex gap-2 p-3 bg-blue-50 dark:bg-blue-950 rounded-lg text-sm">
            <Info className="h-4 w-4 mt-0.5 text-blue-600 dark:text-blue-400 flex-shrink-0" />
            <p className="text-blue-800 dark:text-blue-200">
              This is your <strong>spending goal</strong>, not a failure threshold.
              Setting a target helps you plan to enjoy your money intentionally.
            </p>
          </div>

          {/* Percentage Input */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <Label>Target spending by age {localTarget.targetAge}</Label>
              <div className="flex items-center gap-1">
                <Input
                  type="text"
                  value={percentageInput}
                  onChange={(e) => setPercentageInput(e.target.value)}
                  onBlur={handlePercentageBlur}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handlePercentageBlur();
                      (e.target as HTMLInputElement).blur();
                    }
                  }}
                  className="w-16 h-7 text-right text-sm px-2"
                />
                <span className="text-sm text-muted-foreground">%</span>
              </div>
            </div>
            <Slider
              value={[localTarget.targetPercentageSpent]}
              min={0}
              max={100}
              step={5}
              onValueChange={([value]) => handleSliderChange('targetPercentageSpent', value)}
              formatValue={(v) => `${v}%`}
            />
            <p className="text-xs text-muted-foreground">
              Projected reserve: {new Intl.NumberFormat('en-US', {
                style: 'currency',
                currency: 'USD',
                maximumFractionDigits: 0,
              }).format(projectedReserve)} ({100 - localTarget.targetPercentageSpent}% of current portfolio)
            </p>
          </div>

          {/* Age Input */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <Label>Target age</Label>
              <div className="flex items-center gap-1">
                <Input
                  type="text"
                  value={ageInput}
                  onChange={(e) => setAgeInput(e.target.value)}
                  onBlur={handleAgeBlur}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleAgeBlur();
                      (e.target as HTMLInputElement).blur();
                    }
                  }}
                  className="w-16 h-7 text-right text-sm px-2"
                />
              </div>
            </div>
            <Slider
              value={[localTarget.targetAge]}
              min={currentAge + 1}
              max={maxAge}
              step={1}
              onValueChange={([value]) => handleSliderChange('targetAge', value)}
              formatValue={(v) => `Age ${v}`}
            />
            <p className="text-xs text-muted-foreground">
              Must be between age {currentAge + 1} and {maxAge} (your life expectancy setting)
            </p>
          </div>

          {/* Validation Errors */}
          {validationErrors.length > 0 && (
            <div className="flex gap-2 p-3 bg-red-50 dark:bg-red-950 rounded-lg">
              <AlertCircle className="h-4 w-4 mt-0.5 text-red-600 dark:text-red-400 flex-shrink-0" />
              <div className="text-sm text-red-800 dark:text-red-200">
                {validationErrors.map((error, i) => (
                  <p key={i}>{error}</p>
                ))}
              </div>
            </div>
          )}

          {/* Summary */}
          <div className="p-3 bg-muted/50 rounded-lg text-sm">
            <p>
              <strong>Your goal:</strong> Spend {localTarget.targetPercentageSpent}% of your portfolio
              by age {localTarget.targetAge}, keeping {100 - localTarget.targetPercentageSpent}% in reserve.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
