/**
 * Epic 10.2: Reserve Runway Calculation
 * Calculates how many years the reserve would cover essential expenses
 */

export interface ReserveRunwayResult {
  /** Years reserve covers essential expenses (inflation-adjusted) */
  yearsOfEssentials: number;
  /** Years reserve covers full spending (inflation-adjusted) */
  yearsOfFullSpending: number;
  /** Human-readable description */
  description: string;
}

/**
 * Calculate reserve runway with inflation adjustment
 */
export function calculateReserveRunway(
  reserveAmount: number,
  annualEssentialExpenses: number,
  annualDiscretionaryExpenses: number,
  guaranteedAnnualIncome: number,
  inflationRate: number = 0.025
): ReserveRunwayResult {
  // Essential gap = expenses not covered by guaranteed income
  const essentialGap = Math.max(0, annualEssentialExpenses - guaranteedAnnualIncome);
  const fullSpendingGap = essentialGap + annualDiscretionaryExpenses;

  // Calculate inflation-adjusted runway for essentials
  const yearsOfEssentials = essentialGap > 0
    ? calculateInflationAdjustedYears(reserveAmount, essentialGap, inflationRate)
    : Infinity;

  // Calculate inflation-adjusted runway for full spending
  const yearsOfFullSpending = fullSpendingGap > 0
    ? calculateInflationAdjustedYears(reserveAmount, fullSpendingGap, inflationRate)
    : Infinity;

  return {
    yearsOfEssentials: Math.floor(yearsOfEssentials),
    yearsOfFullSpending: Math.floor(yearsOfFullSpending),
    description: generateDescription(yearsOfEssentials, essentialGap),
  };
}

/**
 * Calculate years until reserve depleted accounting for inflation
 */
function calculateInflationAdjustedYears(
  reserve: number,
  annualNeed: number,
  inflationRate: number
): number {
  if (annualNeed <= 0) return Infinity;

  let remaining = reserve;
  let years = 0;
  let currentNeed = annualNeed;

  while (remaining > 0 && years < 100) {
    remaining -= currentNeed;
    currentNeed *= (1 + inflationRate);
    years++;
  }

  return years;
}

/**
 * Generate human-readable runway description
 */
function generateDescription(years: number, essentialGap: number): string {
  if (essentialGap <= 0) {
    return 'Guaranteed income covers all essential expenses';
  }
  if (years >= 30) {
    return 'Reserve provides 30+ years of essential expense coverage';
  }
  if (years >= 10) {
    return `Reserve covers ~${Math.floor(years)} years of essential expenses`;
  }
  if (years >= 1) {
    return `Reserve covers ${Math.floor(years)} year${years >= 2 ? 's' : ''} of essential expenses`;
  }
  return `Reserve covers ${Math.floor(years * 12)} months of essential expenses`;
}

/**
 * Calculate guaranteed income from income streams
 */
export function calculateGuaranteedIncome(
  incomeStreams: { annualAmount: number; isGuaranteed: boolean }[]
): number {
  return incomeStreams
    .filter(stream => stream.isGuaranteed)
    .reduce((sum, stream) => sum + stream.annualAmount, 0);
}
