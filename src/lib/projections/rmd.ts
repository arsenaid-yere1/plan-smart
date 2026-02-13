import type { RMDConfig } from './types';

/**
 * IRS Uniform Lifetime Table (2024)
 * Used for RMD calculations when account owner is the sole beneficiary
 * or beneficiary is not more than 10 years younger than owner
 *
 * Table shows life expectancy (distribution period) by age
 * RMD = Prior year-end balance / Distribution period
 */
export const UNIFORM_LIFETIME_TABLE: Record<number, number> = {
  73: 26.5,
  74: 25.5,
  75: 24.6,
  76: 23.7,
  77: 22.9,
  78: 22.0,
  79: 21.1,
  80: 20.2,
  81: 19.4,
  82: 18.5,
  83: 17.7,
  84: 16.8,
  85: 16.0,
  86: 15.2,
  87: 14.4,
  88: 13.7,
  89: 12.9,
  90: 12.2,
  91: 11.5,
  92: 10.8,
  93: 10.1,
  94: 9.5,
  95: 8.9,
  96: 8.4,
  97: 7.8,
  98: 7.3,
  99: 6.8,
  100: 6.4,
  101: 6.0,
  102: 5.6,
  103: 5.2,
  104: 4.9,
  105: 4.6,
  106: 4.3,
  107: 4.1,
  108: 3.9,
  109: 3.7,
  110: 3.5,
  111: 3.4,
  112: 3.3,
  113: 3.1,
  114: 3.0,
  115: 2.9,
  116: 2.8,
  117: 2.7,
  118: 2.5,
  119: 2.3,
  120: 2.0,
};

/**
 * Default RMD start age (SECURE 2.0 Act)
 * - 73 for those turning 72 after Dec 31, 2022
 * - 75 for those turning 74 after Dec 31, 2032
 */
export const DEFAULT_RMD_START_AGE = 73;

/**
 * Get the distribution period (life expectancy factor) for a given age
 * @param age - Account owner's age
 * @returns Distribution period, or null if age is below RMD start age
 */
export function getDistributionPeriod(age: number): number | null {
  if (age < DEFAULT_RMD_START_AGE) {
    return null;
  }
  // For ages beyond table (120+), use minimum
  return UNIFORM_LIFETIME_TABLE[Math.min(age, 120)] ?? 2.0;
}

/**
 * Calculate Required Minimum Distribution
 * @param priorYearEndBalance - Tax-deferred account balance at end of prior year
 * @param age - Account owner's age in the distribution year
 * @returns RMD amount, or 0 if age is below RMD start age
 */
export function calculateRMD(priorYearEndBalance: number, age: number): number {
  const distributionPeriod = getDistributionPeriod(age);

  if (distributionPeriod === null || priorYearEndBalance <= 0) {
    return 0;
  }

  return priorYearEndBalance / distributionPeriod;
}

/**
 * Default RMD configuration
 */
export const DEFAULT_RMD_CONFIG: RMDConfig = {
  enabled: true,
  startAge: DEFAULT_RMD_START_AGE,
};
