import type { ProjectionInput } from './types';
import type { IncomeFloorAnalysis } from './income-floor-types';

/**
 * Result of varying a single lever
 */
export interface LeverImpact {
  lever: keyof ProjectionInput;
  displayName: string;
  currentValue: number;
  testDelta: number;
  testDirection: 'increase' | 'decrease';
  impactOnBalance: number;
  impactOnDepletion: number | null;
  percentImpact: number;
}

/**
 * Complete sensitivity analysis result
 */
export interface SensitivityResult {
  topLevers: LeverImpact[];
  baselineBalance: number;
  baselineDepletion: number | null;
  analysisTimestamp: Date;
}

/**
 * Low-friction win opportunity
 */
export interface LowFrictionWin {
  id: string;
  title: string;
  description: string;
  effortLevel: 'minimal' | 'low' | 'moderate';
  potentialImpact: number;
  impactDescription: string;
  uncertaintyCaveat: string;
  lever: string;
  delta: number;
}

/**
 * Sensitive assumption with review guidance
 */
export interface SensitiveAssumption {
  assumption: string;
  displayName: string;
  currentValue: number;
  formattedValue: string;
  sensitivityScore: number;
  explanation: string;
  reviewSuggestion: string;
}

/**
 * Combined insights response from API
 */
export interface InsightsResponse {
  topLevers: LeverImpact[];
  leverExplanation: string;
  lowFrictionWins: LowFrictionWin[];
  sensitiveAssumptions: SensitiveAssumption[];
  sensitivityExplanation: string;
  baseline: {
    balance: number;
    depletion: number | null;
  };
  // Epic 8: Income Floor Analysis
  incomeFloor: IncomeFloorAnalysis | null;  // null if no income streams
  incomeFloorExplanation: string;
}
