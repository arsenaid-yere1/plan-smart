import { runProjection } from './engine';
import type {
  ProjectionInput,
  ProjectionResult,
  SpendingComparison,
} from './types';

/**
 * Default number of years to consider "early years" for bonus calculation
 */
const DEFAULT_EARLY_YEARS_COUNT = 10;

/**
 * Calculate spending comparison between flat and phased strategies
 *
 * @param baseInput - Base projection input with spending phase config
 * @param earlyYearsCount - Number of early retirement years to compare (default: 10)
 * @returns SpendingComparison with metrics for both strategies
 */
export function calculateSpendingComparison(
  baseInput: ProjectionInput,
  earlyYearsCount: number = DEFAULT_EARLY_YEARS_COUNT
): SpendingComparison {
  // Run flat projection (phases disabled)
  const flatInput: ProjectionInput = {
    ...baseInput,
    spendingPhaseConfig: undefined,
  };
  const flatResult = runProjection(flatInput);

  // Run phased projection (phases enabled)
  const phasedInput: ProjectionInput = {
    ...baseInput,
    spendingPhaseConfig: baseInput.spendingPhaseConfig ?? undefined,
  };
  const phasedResult = runProjection(phasedInput);

  // Extract metrics from both results
  const flatMetrics = extractSpendingMetrics(flatResult, baseInput.retirementAge);
  const phasedMetrics = extractSpendingMetrics(phasedResult, baseInput.retirementAge);

  // Calculate early years bonus
  const flatEarlySpending = calculateEarlyYearsSpending(
    flatResult,
    baseInput.retirementAge,
    earlyYearsCount
  );
  const phasedEarlySpending = calculateEarlyYearsSpending(
    phasedResult,
    baseInput.retirementAge,
    earlyYearsCount
  );
  const earlyYearsBonus = phasedEarlySpending - flatEarlySpending;

  // Calculate break-even age
  const breakEvenAge = calculateBreakEvenAge(
    flatResult,
    phasedResult,
    baseInput.retirementAge
  );

  // Calculate longevity difference
  const flatDepletionYears = flatResult.summary.yearsUntilDepletion;
  const phasedDepletionYears = phasedResult.summary.yearsUntilDepletion;
  let longevityDifference = 0;
  if (flatDepletionYears !== null && phasedDepletionYears !== null) {
    longevityDifference = phasedDepletionYears - flatDepletionYears;
  } else if (flatDepletionYears !== null && phasedDepletionYears === null) {
    // Phased never depletes, flat does
    longevityDifference = baseInput.maxAge - baseInput.currentAge - flatDepletionYears;
  } else if (flatDepletionYears === null && phasedDepletionYears !== null) {
    // Flat never depletes, phased does
    longevityDifference = -(baseInput.maxAge - baseInput.currentAge - phasedDepletionYears);
  }

  // Build yearly spending arrays for charts
  const flatYearlySpending = buildYearlySpending(flatResult, baseInput.retirementAge);
  const phasedYearlySpending = buildPhasedYearlySpending(phasedResult, baseInput.retirementAge);

  return {
    flatSpending: {
      totalLifetimeSpending: flatMetrics.totalSpending,
      portfolioDepletionAge: flatMetrics.depletionAge,
      endingBalance: flatResult.summary.endingBalance,
      yearlySpending: flatYearlySpending,
    },
    phasedSpending: {
      totalLifetimeSpending: phasedMetrics.totalSpending,
      portfolioDepletionAge: phasedMetrics.depletionAge,
      endingBalance: phasedResult.summary.endingBalance,
      yearlySpending: phasedYearlySpending,
      earlyYearsBonus,
      earlyYearsCount,
    },
    breakEvenAge,
    longevityDifference,
  };
}

/**
 * Extract spending metrics from a projection result
 */
function extractSpendingMetrics(
  result: ProjectionResult,
  retirementAge: number
): { totalSpending: number; depletionAge: number | null } {
  const retirementRecords = result.records.filter((r) => r.age >= retirementAge);
  const totalSpending = retirementRecords.reduce((sum, r) => sum + r.outflows, 0);

  let depletionAge: number | null = null;
  if (result.summary.yearsUntilDepletion !== null) {
    const startAge = result.records[0]?.age ?? 0;
    depletionAge = startAge + result.summary.yearsUntilDepletion;
  }

  return { totalSpending, depletionAge };
}

/**
 * Calculate spending in early retirement years
 */
function calculateEarlyYearsSpending(
  result: ProjectionResult,
  retirementAge: number,
  yearsCount: number
): number {
  return result.records
    .filter((r) => r.age >= retirementAge && r.age < retirementAge + yearsCount)
    .reduce((sum, r) => sum + r.outflows, 0);
}

/**
 * Calculate break-even age where cumulative spending equals
 */
function calculateBreakEvenAge(
  flatResult: ProjectionResult,
  phasedResult: ProjectionResult,
  retirementAge: number
): number | null {
  let flatCumulative = 0;
  let phasedCumulative = 0;
  let breakEvenAge: number | null = null;

  const flatRecords = flatResult.records.filter((r) => r.age >= retirementAge);
  const phasedRecords = phasedResult.records.filter((r) => r.age >= retirementAge);

  for (let i = 0; i < Math.min(flatRecords.length, phasedRecords.length); i++) {
    const prevFlatCumulative = flatCumulative;
    const prevPhasedCumulative = phasedCumulative;

    flatCumulative += flatRecords[i].outflows;
    phasedCumulative += phasedRecords[i].outflows;

    // Check if we crossed the break-even point
    const prevDiff = prevPhasedCumulative - prevFlatCumulative;
    const currDiff = phasedCumulative - flatCumulative;

    // If sign changed or difference is negligible, we found break-even
    if ((prevDiff > 0 && currDiff <= 0) || (prevDiff < 0 && currDiff >= 0)) {
      breakEvenAge = flatRecords[i].age;
      break;
    }

    // Also check if cumulative values are approximately equal (within $100)
    if (Math.abs(flatCumulative - phasedCumulative) < 100 && i > 0) {
      breakEvenAge = flatRecords[i].age;
      break;
    }
  }

  return breakEvenAge;
}

/**
 * Build yearly spending array for flat spending chart
 */
function buildYearlySpending(
  result: ProjectionResult,
  retirementAge: number
): { age: number; amount: number }[] {
  return result.records
    .filter((r) => r.age >= retirementAge)
    .map((r) => ({
      age: r.age,
      amount: Math.round(r.outflows * 100) / 100,
    }));
}

/**
 * Build yearly spending array with phase info for phased spending chart
 */
function buildPhasedYearlySpending(
  result: ProjectionResult,
  retirementAge: number
): { age: number; amount: number; phase: string | null }[] {
  return result.records
    .filter((r) => r.age >= retirementAge)
    .map((r) => ({
      age: r.age,
      amount: Math.round(r.outflows * 100) / 100,
      phase: r.activePhaseName ?? null,
    }));
}
