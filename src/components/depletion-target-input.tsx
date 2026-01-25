'use client';

import { useState, useCallback, useEffect, useMemo } from 'react';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { AlertCircle, Info } from 'lucide-react';
import type { DepletionTarget, ReserveConfig, ReserveType, ReservePurpose } from '@/lib/projections/types';
import { DEFAULT_DEPLETION_TARGET, RESERVE_PURPOSE_LABELS } from '@/lib/projections/assumptions';
import { validateDepletionTarget, validateReserveConfig } from '@/lib/validation/projections';
import { calculateReserveRunway, calculateGuaranteedIncome } from '@/lib/projections/reserve-runway';
import { cn } from '@/lib/utils';

interface DepletionTargetInputProps {
  target: DepletionTarget | undefined;
  currentAge: number;
  maxAge: number;
  portfolioValue: number;
  onChange: (target: DepletionTarget) => void;
  // Epic 10.2: Optional props for reserve runway calculation
  annualEssentialExpenses?: number;
  annualDiscretionaryExpenses?: number;
  incomeStreams?: { annualAmount: number; isGuaranteed: boolean }[];
  inflationRate?: number;
}

export function DepletionTargetInput({
  target,
  currentAge,
  maxAge,
  portfolioValue,
  onChange,
  annualEssentialExpenses,
  annualDiscretionaryExpenses,
  incomeStreams,
  inflationRate,
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

  // Reserve state
  const [reserveType, setReserveType] = useState<ReserveType>(
    target?.reserve?.type ?? 'derived'
  );
  const [reserveAmount, setReserveAmount] = useState(
    target?.reserve?.amount?.toString() ?? ''
  );
  const [reservePurposes, setReservePurposes] = useState<Set<ReservePurpose>>(
    new Set(target?.reserve?.purposes ?? [])
  );
  const [reserveWarnings, setReserveWarnings] = useState<string[]>([]);

  // Validate when localTarget or constraints change
  useEffect(() => {
    if (localTarget.enabled) {
      const result = validateDepletionTarget(localTarget, currentAge, maxAge);
      setValidationErrors(result.errors);
    } else {
      setValidationErrors([]);
    }
  }, [localTarget, currentAge, maxAge]);

  // Validate reserve config
  useEffect(() => {
    if (localTarget.enabled && localTarget.reserve) {
      const result = validateReserveConfig(
        localTarget.reserve,
        localTarget,
        portfolioValue
      );
      setReserveWarnings(result.warnings);
    } else {
      setReserveWarnings([]);
    }
  }, [localTarget, portfolioValue]);

  const handleEnabledChange = useCallback((enabled: boolean) => {
    const newTarget = { ...localTarget, enabled };
    setLocalTarget(newTarget);
    onChange(newTarget);
  }, [localTarget, onChange]);

  const handleSliderChange = useCallback((field: 'targetPercentageSpent' | 'targetAge', value: number) => {
    // Build reserve config with current state
    const reserve: ReserveConfig | undefined = reserveType === 'derived'
      ? { type: 'derived', purposes: Array.from(reservePurposes) }
      : {
          type: reserveType,
          amount: parseFloat(reserveAmount) || 0,
          purposes: Array.from(reservePurposes),
        };

    const newTarget = { ...localTarget, [field]: value, reserve };
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
  }, [localTarget, currentAge, maxAge, onChange, reserveType, reserveAmount, reservePurposes]);

  const handlePercentageBlur = useCallback(() => {
    const parsed = parseInt(percentageInput, 10);
    if (isNaN(parsed)) {
      setPercentageInput(localTarget.targetPercentageSpent.toString());
      return;
    }
    const clamped = Math.min(Math.max(parsed, 0), 100);
    setPercentageInput(clamped.toString());

    // Build reserve config with current state
    const reserve: ReserveConfig | undefined = reserveType === 'derived'
      ? { type: 'derived', purposes: Array.from(reservePurposes) }
      : {
          type: reserveType,
          amount: parseFloat(reserveAmount) || 0,
          purposes: Array.from(reservePurposes),
        };

    const newTarget = { ...localTarget, targetPercentageSpent: clamped, reserve };
    setLocalTarget(newTarget);

    const result = validateDepletionTarget(newTarget, currentAge, maxAge);
    if (result.valid) {
      onChange(newTarget);
    }
  }, [percentageInput, localTarget, currentAge, maxAge, onChange, reserveType, reserveAmount, reservePurposes]);

  const handleAgeBlur = useCallback(() => {
    const parsed = parseInt(ageInput, 10);
    if (isNaN(parsed)) {
      setAgeInput(localTarget.targetAge.toString());
      return;
    }
    const clamped = Math.min(Math.max(parsed, 50), 120);
    setAgeInput(clamped.toString());

    // Build reserve config with current state
    const reserve: ReserveConfig | undefined = reserveType === 'derived'
      ? { type: 'derived', purposes: Array.from(reservePurposes) }
      : {
          type: reserveType,
          amount: parseFloat(reserveAmount) || 0,
          purposes: Array.from(reservePurposes),
        };

    const newTarget = { ...localTarget, targetAge: clamped, reserve };
    setLocalTarget(newTarget);

    const result = validateDepletionTarget(newTarget, currentAge, maxAge);
    if (result.valid) {
      onChange(newTarget);
    }
  }, [ageInput, localTarget, currentAge, maxAge, onChange, reserveType, reserveAmount, reservePurposes]);

  const handleReserveTypeChange = useCallback((type: ReserveType) => {
    setReserveType(type);

    const reserve: ReserveConfig = {
      type,
      amount: type === 'derived' ? undefined : (parseFloat(reserveAmount) || 0),
      purposes: Array.from(reservePurposes),
    };

    const newTarget = { ...localTarget, reserve };
    setLocalTarget(newTarget);
    onChange(newTarget);
  }, [localTarget, reserveAmount, reservePurposes, onChange]);

  const handleReserveAmountChange = useCallback((value: string) => {
    setReserveAmount(value);
  }, []);

  const handleReserveAmountBlur = useCallback(() => {
    const parsed = parseFloat(reserveAmount);
    if (isNaN(parsed)) {
      setReserveAmount('');
      return;
    }

    const reserve: ReserveConfig = {
      type: reserveType,
      amount: reserveType === 'derived' ? undefined : parsed,
      purposes: Array.from(reservePurposes),
    };

    const newTarget = { ...localTarget, reserve };
    setLocalTarget(newTarget);
    onChange(newTarget);
  }, [reserveAmount, reserveType, reservePurposes, localTarget, onChange]);

  const togglePurpose = useCallback((purpose: ReservePurpose) => {
    const newPurposes = new Set(reservePurposes);
    if (newPurposes.has(purpose)) {
      newPurposes.delete(purpose);
    } else {
      newPurposes.add(purpose);
    }
    setReservePurposes(newPurposes);

    const reserve: ReserveConfig = {
      type: reserveType,
      amount: reserveType === 'derived' ? undefined : (parseFloat(reserveAmount) || 0),
      purposes: Array.from(newPurposes),
    };

    const newTarget = { ...localTarget, reserve };
    setLocalTarget(newTarget);
    onChange(newTarget);
  }, [reservePurposes, reserveType, reserveAmount, localTarget, onChange]);

  // Calculate actual reserve amount for display
  const calculatedReserveAmount = useMemo(() => {
    if (reserveType === 'derived') {
      return portfolioValue * (1 - localTarget.targetPercentageSpent / 100);
    }
    if (reserveType === 'percentage') {
      return portfolioValue * ((parseFloat(reserveAmount) || 0) / 100);
    }
    return parseFloat(reserveAmount) || 0;
  }, [reserveType, portfolioValue, localTarget.targetPercentageSpent, reserveAmount]);

  // Calculate projected reserve (for display without reserve protection)
  const projectedReserve = portfolioValue * (1 - localTarget.targetPercentageSpent / 100);

  // Epic 10.2: Calculate reserve runway if expense data is available
  const runwayResult = useMemo(() => {
    if (!localTarget.enabled || calculatedReserveAmount <= 0) {
      return null;
    }

    // If expense data isn't provided, can't calculate runway
    if (annualEssentialExpenses === undefined) {
      return null;
    }

    const guaranteedIncome = calculateGuaranteedIncome(
      incomeStreams ?? []
    );

    return calculateReserveRunway(
      calculatedReserveAmount,
      annualEssentialExpenses,
      annualDiscretionaryExpenses ?? 0,
      guaranteedIncome,
      inflationRate ?? 0.025
    );
  }, [
    localTarget.enabled,
    calculatedReserveAmount,
    annualEssentialExpenses,
    annualDiscretionaryExpenses,
    incomeStreams,
    currentAge,
    inflationRate,
  ]);

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

          {/* Reserve Protection Section */}
          <div className="space-y-4 pt-4 border-t">
            <h4 className="font-medium text-sm">Reserve Protection</h4>

            {/* Reserve Type Selection */}
            <RadioGroup
              value={reserveType}
              onValueChange={(v) => handleReserveTypeChange(v as ReserveType)}
              className="space-y-2"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="derived" id="reserve-derived" />
                <Label htmlFor="reserve-derived" className="font-normal cursor-pointer">
                  Match spending target ({100 - localTarget.targetPercentageSpent}%)
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="percentage" id="reserve-percentage" />
                <Label htmlFor="reserve-percentage" className="font-normal cursor-pointer">
                  Custom percentage
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="absolute" id="reserve-absolute" />
                <Label htmlFor="reserve-absolute" className="font-normal cursor-pointer">
                  Specific dollar amount
                </Label>
              </div>
            </RadioGroup>

            {/* Conditional Inputs */}
            {reserveType === 'derived' && (
              <div className="p-3 bg-muted rounded-lg text-sm">
                Reserve: {new Intl.NumberFormat('en-US', {
                  style: 'currency',
                  currency: 'USD',
                  maximumFractionDigits: 0,
                }).format(calculatedReserveAmount)} ({100 - localTarget.targetPercentageSpent}% of portfolio)
              </div>
            )}

            {reserveType === 'percentage' && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    value={reserveAmount}
                    onChange={(e) => handleReserveAmountChange(e.target.value)}
                    onBlur={handleReserveAmountBlur}
                    placeholder="25"
                    className="w-24"
                    min={0}
                    max={100}
                  />
                  <span className="text-sm text-muted-foreground">%</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  = {new Intl.NumberFormat('en-US', {
                    style: 'currency',
                    currency: 'USD',
                    maximumFractionDigits: 0,
                  }).format(calculatedReserveAmount)}
                </p>
              </div>
            )}

            {reserveType === 'absolute' && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">$</span>
                  <Input
                    type="number"
                    value={reserveAmount}
                    onChange={(e) => handleReserveAmountChange(e.target.value)}
                    onBlur={handleReserveAmountBlur}
                    placeholder="250,000"
                    className="w-32"
                    min={0}
                  />
                </div>
              </div>
            )}

            {/* Purpose Tags */}
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">
                Reserve purpose (optional)
              </Label>
              <div className="flex flex-wrap gap-2">
                {(Object.entries(RESERVE_PURPOSE_LABELS) as [ReservePurpose, string][]).map(
                  ([purpose, label]) => (
                    <button
                      key={purpose}
                      type="button"
                      onClick={() => togglePurpose(purpose)}
                      className={cn(
                        'px-3 py-1 rounded-full text-xs border transition-colors',
                        reservePurposes.has(purpose)
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'bg-muted hover:bg-muted/80 border-border'
                      )}
                    >
                      {label}
                    </button>
                  )
                )}
              </div>
            </div>

            {/* Reserve Runway */}
            {runwayResult && (
              <div className="p-3 bg-amber-50/50 dark:bg-amber-950/30 rounded-lg text-sm space-y-1">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Reserve Runway</span>
                  <span className="font-medium text-amber-700 dark:text-amber-300">
                    {runwayResult.yearsOfEssentials === Infinity
                      ? '∞ years'
                      : `${runwayResult.yearsOfEssentials} years`}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {runwayResult.description}
                </p>
              </div>
            )}

            {/* Reserve Warnings */}
            {reserveWarnings.length > 0 && (
              <div className="flex gap-2 p-3 bg-amber-50 dark:bg-amber-950 rounded-lg">
                <Info className="h-4 w-4 mt-0.5 text-amber-600 dark:text-amber-400 flex-shrink-0" />
                <div className="text-sm text-amber-800 dark:text-amber-200">
                  {reserveWarnings.map((warning, i) => (
                    <p key={i}>{warning}</p>
                  ))}
                </div>
              </div>
            )}
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
          <div className="p-3 bg-muted/50 rounded-lg text-sm space-y-2">
            <p>
              <strong>Spending goal:</strong> Spend {localTarget.targetPercentageSpent}% by age {localTarget.targetAge}
            </p>
            <p>
              <strong>Reserve protection:</strong> Keep {new Intl.NumberFormat('en-US', {
                style: 'currency',
                currency: 'USD',
                maximumFractionDigits: 0,
              }).format(calculatedReserveAmount)} as a safety buffer
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
