/**
 * Types for Income Floor Analysis (Epic 8)
 */

/**
 * Coverage data for a single year
 */
export interface YearlyCoverage {
  age: number;
  year: number;
  guaranteedIncome: number;
  essentialExpenses: number;
  coverageRatio: number;  // guaranteedIncome / essentialExpenses
  isFullyCovered: boolean;  // coverageRatio >= 1.0
}

/**
 * Complete income floor analysis result
 */
export interface IncomeFloorAnalysis {
  /** Sum of guaranteed income at retirement age */
  guaranteedIncomeAtRetirement: number;

  /** Essential expenses at retirement age (inflation-adjusted) */
  essentialExpensesAtRetirement: number;

  /** Coverage ratio at retirement (guaranteed / essential) */
  coverageRatioAtRetirement: number;

  /** Whether income floor is established at any point */
  isFloorEstablished: boolean;

  /** First age where guaranteed income >= essential expenses (null if never) */
  floorEstablishedAge: number | null;

  /** Coverage status category */
  status: 'fully-covered' | 'partial' | 'insufficient';

  /** Year-by-year coverage data */
  coverageByAge: YearlyCoverage[];

  /** Human-readable insight statement */
  insightStatement: string;
}

/**
 * Coverage status thresholds
 */
export const COVERAGE_THRESHOLDS = {
  FULL: 1.0,      // >= 100% = fully covered
  PARTIAL: 0.5,   // >= 50% = partial coverage
  // < 50% = insufficient
} as const;
