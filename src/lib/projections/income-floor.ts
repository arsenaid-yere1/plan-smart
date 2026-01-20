/**
 * Income Floor Calculator (Epic 8)
 *
 * Calculates whether guaranteed income covers essential expenses,
 * implementing the "Safety-First" philosophy.
 */

import type { IncomeStream, ProjectionInput } from './types';
import type { IncomeFloorAnalysis, YearlyCoverage } from './income-floor-types';
import { COVERAGE_THRESHOLDS } from './income-floor-types';
import { calculatePhaseAdjustedExpenses } from './engine';

/**
 * Calculate total guaranteed income for a given age
 */
export function calculateGuaranteedIncome(
  streams: IncomeStream[],
  age: number,
  inflationMultiplier: number
): number {
  return streams
    .filter(stream => stream.isGuaranteed)
    .reduce((total, stream) => {
      // Check if stream is active this year
      if (age >= stream.startAge && (stream.endAge === undefined || age <= stream.endAge)) {
        const streamInflation = stream.inflationAdjusted ? inflationMultiplier : 1;
        return total + stream.annualAmount * streamInflation;
      }
      return total;
    }, 0);
}

/**
 * Calculate income floor analysis for a projection
 */
export function calculateIncomeFloor(input: ProjectionInput): IncomeFloorAnalysis {
  const coverageByAge: YearlyCoverage[] = [];
  const currentYear = new Date().getFullYear();

  let floorEstablishedAge: number | null = null;
  let guaranteedIncomeAtRetirement = 0;
  let essentialExpensesAtRetirement = 0;

  // Calculate coverage for each retirement year
  for (let age = input.retirementAge; age <= input.maxAge; age++) {
    const year = currentYear + (age - input.currentAge);
    const yearsFromRetirement = age - input.retirementAge;

    // Calculate inflation multiplier
    const inflationMultiplier = Math.pow(1 + input.inflationRate, yearsFromRetirement);

    // Epic 9: Calculate phase-adjusted essential expenses
    const baseEssential = input.annualEssentialExpenses;
    const baseDiscretionary = input.annualDiscretionaryExpenses ?? 0;

    const phaseResult = calculatePhaseAdjustedExpenses(
      age,
      baseEssential,
      baseDiscretionary,
      input.spendingPhaseConfig
    );

    // Apply inflation to phase-adjusted essential expenses only
    const essentialExpenses = phaseResult.essential * inflationMultiplier;

    // Calculate guaranteed income for this age
    const guaranteedIncome = calculateGuaranteedIncome(
      input.incomeStreams,
      age,
      inflationMultiplier
    );

    // Calculate coverage ratio (handle zero expenses edge case)
    const coverageRatio = essentialExpenses > 0
      ? guaranteedIncome / essentialExpenses
      : guaranteedIncome > 0 ? Infinity : 1;

    const isFullyCovered = coverageRatio >= COVERAGE_THRESHOLDS.FULL;

    // Track first age where floor is established
    if (isFullyCovered && floorEstablishedAge === null) {
      floorEstablishedAge = age;
    }

    // Capture retirement age values
    if (age === input.retirementAge) {
      guaranteedIncomeAtRetirement = guaranteedIncome;
      essentialExpensesAtRetirement = essentialExpenses;
    }

    coverageByAge.push({
      age,
      year,
      guaranteedIncome: Math.round(guaranteedIncome * 100) / 100,
      essentialExpenses: Math.round(essentialExpenses * 100) / 100,
      coverageRatio: Math.round(coverageRatio * 1000) / 1000,
      isFullyCovered,
    });
  }

  // Determine coverage ratio at retirement (handle zero expenses edge case)
  const coverageRatioAtRetirement = essentialExpensesAtRetirement > 0
    ? guaranteedIncomeAtRetirement / essentialExpensesAtRetirement
    : guaranteedIncomeAtRetirement > 0 ? Infinity : 1;

  // Determine status
  const status = determineStatus(coverageRatioAtRetirement, floorEstablishedAge);

  // Generate insight statement
  const insightStatement = generateInsightStatement(
    status,
    floorEstablishedAge,
    coverageRatioAtRetirement,
    input.retirementAge
  );

  return {
    guaranteedIncomeAtRetirement: Math.round(guaranteedIncomeAtRetirement * 100) / 100,
    essentialExpensesAtRetirement: Math.round(essentialExpensesAtRetirement * 100) / 100,
    coverageRatioAtRetirement: Math.round(coverageRatioAtRetirement * 1000) / 1000,
    isFloorEstablished: floorEstablishedAge !== null,
    floorEstablishedAge,
    status,
    coverageByAge,
    insightStatement,
  };
}

/**
 * Determine coverage status based on ratio and floor establishment
 */
function determineStatus(
  coverageRatio: number,
  floorEstablishedAge: number | null
): IncomeFloorAnalysis['status'] {
  if (floorEstablishedAge !== null) {
    return 'fully-covered';
  }
  if (coverageRatio >= COVERAGE_THRESHOLDS.PARTIAL) {
    return 'partial';
  }
  return 'insufficient';
}

/**
 * Generate human-readable insight statement
 */
function generateInsightStatement(
  status: IncomeFloorAnalysis['status'],
  floorEstablishedAge: number | null,
  coverageRatio: number,
  retirementAge: number
): string {
  const percentCovered = Math.round(coverageRatio * 100);

  switch (status) {
    case 'fully-covered':
      if (floorEstablishedAge === retirementAge) {
        return `Your essential lifestyle is fully covered by guaranteed income from retirement.`;
      }
      return `Your essential lifestyle is fully covered by guaranteed income starting at age ${floorEstablishedAge}.`;

    case 'partial':
      return `Guaranteed income covers ${percentCovered}% of essential expenses at retirement.`;

    case 'insufficient':
      return `Essential expenses exceed guaranteed income throughout retirement. Guaranteed income covers ${percentCovered}% of essential expenses.`;
  }
}

/**
 * Check if any guaranteed income streams exist
 */
export function hasGuaranteedIncome(streams: IncomeStream[]): boolean {
  return streams.some(stream => stream.isGuaranteed);
}

/**
 * Get summary of guaranteed income streams
 */
export function getGuaranteedIncomeSummary(streams: IncomeStream[]): {
  count: number;
  totalAnnual: number;
  types: string[];
} {
  const guaranteedStreams = streams.filter(stream => stream.isGuaranteed);
  return {
    count: guaranteedStreams.length,
    totalAnnual: guaranteedStreams.reduce((sum, s) => sum + s.annualAmount, 0),
    types: [...new Set(guaranteedStreams.map(s => s.type))],
  };
}
