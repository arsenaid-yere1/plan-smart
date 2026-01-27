import type {
  ProjectionInput,
  ProjectionRecord,
  DepletionFeedback,
  PhaseSpendingBreakdown,
  TrajectoryStatus,
  SpendingPhase,
  SpendingPhaseConfig,
} from './types';

/**
 * Calculate sustainable spending rate and trajectory status for depletion target
 */
export function calculateDepletionFeedback(
  input: ProjectionInput,
  records: ProjectionRecord[]
): DepletionFeedback | null {
  const { depletionTarget, reserveFloor, spendingPhaseConfig, retirementAge } = input;

  // Return null if depletion target not enabled
  if (!depletionTarget?.enabled) {
    return null;
  }

  const targetAge = depletionTarget.targetAge;

  // Validate required fields are present
  if (targetAge == null || Number.isNaN(targetAge)) {
    return createDisabledFeedback('Target age is not configured');
  }

  const targetReserve = reserveFloor ?? 0;
  const currentPortfolio = calculateTotalPortfolio(input.balancesByType);
  const retirementYears = Math.max(0, targetAge - retirementAge);

  // Only calculate for retirement period
  if (Number.isNaN(retirementYears) || retirementYears <= 0) {
    return createDisabledFeedback('Target age must be after retirement');
  }

  // Calculate real return (adjusted for inflation)
  const realReturn = calculateRealReturn(input.expectedReturn, input.inflationRate);

  // Calculate sustainable annual withdrawal
  const sustainableAnnual = calculateSustainableWithdrawal(
    currentPortfolio,
    targetReserve,
    retirementYears,
    realReturn
  );

  // Get current planned spending (phase-adjusted average)
  const currentPlannedSpending = calculateCurrentPlannedSpending(input, records);

  // Assess trajectory status
  const trajectoryStatus = assessTrajectoryStatus(
    sustainableAnnual,
    currentPlannedSpending,
    0.05 // 5% tolerance band
  );

  // Calculate phase breakdown if phases enabled
  const phaseBreakdown = spendingPhaseConfig?.enabled
    ? calculatePhaseBreakdown(sustainableAnnual, spendingPhaseConfig, input)
    : undefined;

  // Find projected values at target age
  const targetAgeRecord = records.find(r => r.age === targetAge);
  const projectedReserveAtTarget = targetAgeRecord?.balance ?? 0;
  const projectedDepletionAge = findDepletionAge(records);

  // Generate warnings
  const warningMessages = generateWarnings(
    trajectoryStatus,
    currentPlannedSpending,
    sustainableAnnual,
    projectedReserveAtTarget,
    targetReserve,
    records,
    targetAge
  );

  // Generate status message
  const statusMessage = generateStatusMessage(
    trajectoryStatus,
    sustainableAnnual,
    depletionTarget.targetAge,
    depletionTarget.targetPercentageSpent
  );

  return {
    sustainableMonthlySpending: sustainableAnnual / 12,
    sustainableAnnualSpending: sustainableAnnual,
    phaseBreakdown,
    trajectoryStatus,
    statusMessage,
    warningMessages,
    projectedReserveAtTarget,
    projectedDepletionAge,
  };
}

/**
 * Calculate total portfolio value from balances by type
 */
function calculateTotalPortfolio(balancesByType: { taxDeferred: number; taxFree: number; taxable: number }): number {
  return balancesByType.taxDeferred + balancesByType.taxFree + balancesByType.taxable;
}

/**
 * Calculate real return (nominal return adjusted for inflation)
 */
function calculateRealReturn(nominalReturn: number, inflationRate: number): number {
  // Use safe defaults if values are undefined/NaN
  const safeNominal = nominalReturn ?? 0.07;
  const safeInflation = inflationRate ?? 0.025;
  return (1 + safeNominal) / (1 + safeInflation) - 1;
}

/**
 * Calculate sustainable withdrawal using present value of annuity formula
 * This determines annual spending that depletes to targetReserve over years
 */
function calculateSustainableWithdrawal(
  currentPortfolio: number,
  targetReserve: number,
  years: number,
  realReturn: number
): number {
  // Handle NaN or invalid inputs
  if (Number.isNaN(years) || Number.isNaN(realReturn) || Number.isNaN(currentPortfolio)) {
    return 0;
  }

  // Amount available for spending over the period
  const spendablePortfolio = currentPortfolio - targetReserve;

  if (spendablePortfolio <= 0 || years <= 0) {
    return 0;
  }

  // Simple case: no real growth
  if (Math.abs(realReturn) < 0.0001) {
    return spendablePortfolio / years;
  }

  // Use annuity formula: PMT = PV * [r(1+r)^n] / [(1+r)^n - 1]
  const r = realReturn;
  const n = years;
  const factor = Math.pow(1 + r, n);
  const numerator = r * factor;
  const denominator = factor - 1;

  return spendablePortfolio * (numerator / denominator);
}

/**
 * Calculate current planned spending as phase-adjusted average over retirement
 */
function calculateCurrentPlannedSpending(
  input: ProjectionInput,
  records: ProjectionRecord[]
): number {
  const { retirementAge, depletionTarget, annualEssentialExpenses, annualDiscretionaryExpenses } = input;
  const targetAge = depletionTarget?.targetAge ?? input.maxAge;

  // Filter to retirement years up to target
  const retirementRecords = records.filter(
    r => r.age >= retirementAge && r.age <= targetAge
  );

  if (retirementRecords.length === 0) {
    return (annualEssentialExpenses ?? 0) + (annualDiscretionaryExpenses ?? 0);
  }

  // Calculate average actual spending (uses phase-adjusted values from engine)
  const totalSpending = retirementRecords.reduce((sum, r) => {
    const essential = r.actualEssentialSpending ?? r.essentialExpenses ?? 0;
    const discretionary = r.actualDiscretionarySpending ?? r.discretionaryExpenses ?? 0;
    return sum + essential + discretionary;
  }, 0);

  return totalSpending / retirementRecords.length;
}

/**
 * Assess trajectory status comparing current vs sustainable spending
 */
function assessTrajectoryStatus(
  sustainableAnnual: number,
  currentPlannedAnnual: number,
  toleranceBand: number
): TrajectoryStatus {
  if (sustainableAnnual <= 0) {
    return 'overspending';
  }

  const ratio = currentPlannedAnnual / sustainableAnnual;

  if (ratio <= 1 - toleranceBand) {
    return 'underspending';
  } else if (ratio >= 1 + toleranceBand) {
    return 'overspending';
  }
  return 'on_track';
}

/**
 * Calculate phase-based spending breakdown
 */
function calculatePhaseBreakdown(
  sustainableAnnual: number,
  config: SpendingPhaseConfig,
  input: ProjectionInput
): PhaseSpendingBreakdown[] {
  const { phases } = config;
  const { retirementAge, depletionTarget } = input;
  const targetAge = depletionTarget?.targetAge ?? input.maxAge;

  // Build phase periods with years in each
  const phaseYears: Array<{ phase: SpendingPhase; startAge: number; endAge: number; years: number }> = [];

  for (let i = 0; i < phases.length; i++) {
    const phase = phases[i];
    const startAge = Math.max(phase.startAge, retirementAge);
    const endAge = i < phases.length - 1
      ? Math.min(phases[i + 1].startAge, targetAge)
      : targetAge;

    if (startAge < targetAge && startAge < endAge) {
      phaseYears.push({
        phase,
        startAge,
        endAge,
        years: endAge - startAge,
      });
    }
  }

  if (phaseYears.length === 0) {
    return [];
  }

  // Calculate weighted average multiplier
  const totalYears = phaseYears.reduce((sum, p) => sum + p.years, 0);
  const weightedMultiplier = phaseYears.reduce((sum, p) => {
    const avgMultiplier = (p.phase.essentialMultiplier + p.phase.discretionaryMultiplier) / 2;
    return sum + (avgMultiplier * p.years / totalYears);
  }, 0);

  // Base spending that, when weighted, equals sustainable total
  const baseSpending = weightedMultiplier > 0 ? sustainableAnnual / weightedMultiplier : sustainableAnnual;

  // Generate breakdown
  return phaseYears.map(({ phase, startAge, endAge, years }) => {
    const avgMultiplier = (phase.essentialMultiplier + phase.discretionaryMultiplier) / 2;
    const annualSpending = baseSpending * avgMultiplier;

    return {
      phaseName: phase.name,
      startAge,
      endAge,
      monthlySpending: annualSpending / 12,
      annualSpending,
      yearsInPhase: years,
    };
  });
}

/**
 * Find age when portfolio depletes (balance <= 0)
 */
function findDepletionAge(records: ProjectionRecord[]): number | null {
  const depletionRecord = records.find(r => r.balance <= 0);
  return depletionRecord?.age ?? null;
}

/**
 * Generate warning messages for edge cases
 */
function generateWarnings(
  status: TrajectoryStatus,
  currentSpending: number,
  sustainableSpending: number,
  projectedReserve: number,
  targetReserve: number,
  records: ProjectionRecord[],
  targetAge: number
): string[] {
  const warnings: string[] = [];
  const formatCurrency = (v: number) => `$${Math.round(v).toLocaleString()}`;

  // Overspending warning
  if (status === 'overspending' && sustainableSpending > 0) {
    const overagePercent = Math.round(((currentSpending - sustainableSpending) / sustainableSpending) * 100);
    warnings.push(
      `Current spending exceeds sustainable rate by ${overagePercent}%. Consider reducing to ${formatCurrency(sustainableSpending / 12)}/month.`
    );
  }

  // Underspending message (framed positively)
  if (status === 'underspending' && currentSpending > 0) {
    const extraMonthly = Math.round((sustainableSpending - currentSpending) / 12);
    warnings.push(
      `You could enjoy ${formatCurrency(extraMonthly)}/month more without risking your goals!`
    );
  }

  // Reserve breach warning
  if (projectedReserve < targetReserve) {
    const shortfall = targetReserve - projectedReserve;
    warnings.push(
      `Current trajectory shows reserve shortfall of ${formatCurrency(shortfall)} at age ${targetAge}.`
    );
  }

  // Early depletion warning
  const depletionRecord = records.find(r => r.balance <= 0);
  if (depletionRecord && depletionRecord.age < targetAge) {
    warnings.push(
      `Warning: Portfolio depletes at age ${depletionRecord.age}, before reaching your target age ${targetAge}.`
    );
  }

  return warnings;
}

/**
 * Generate human-readable status message
 */
function generateStatusMessage(
  status: TrajectoryStatus,
  sustainableAnnual: number,
  targetAge: number,
  targetPercentageSpent: number
): string {
  switch (status) {
    case 'on_track':
      return `You're on track to spend ${targetPercentageSpent}% of your portfolio by age ${targetAge}.`;
    case 'underspending':
      return `You're spending below your sustainable rate. You could enjoy more now while still meeting your goals.`;
    case 'overspending':
      return `Your current spending exceeds what's sustainable for your depletion target. Consider adjustments to stay on track.`;
  }
}

/**
 * Create feedback for disabled/invalid states
 */
function createDisabledFeedback(message: string): DepletionFeedback {
  return {
    sustainableMonthlySpending: 0,
    sustainableAnnualSpending: 0,
    phaseBreakdown: undefined,
    trajectoryStatus: 'on_track',
    statusMessage: message,
    warningMessages: [],
    projectedReserveAtTarget: 0,
    projectedDepletionAge: null,
  };
}
