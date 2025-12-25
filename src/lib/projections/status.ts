import type { ProjectionSummary } from './types';

export type RetirementStatus = 'on-track' | 'needs-adjustment' | 'at-risk';

export interface RetirementStatusResult {
  status: RetirementStatus;
  label: string;
  description: string;
}

/**
 * Determines retirement status based on projection summary.
 *
 * Thresholds:
 * - On Track: Funds last through max age (yearsUntilDepletion === null)
 * - Needs Adjustment: Depletes but >20 years runway
 * - At Risk: Depletes within ≤20 years
 */
export function getRetirementStatus(
  summary: ProjectionSummary,
  currentAge: number
): RetirementStatusResult {
  const { yearsUntilDepletion } = summary;

  // Sustainable through max age
  if (yearsUntilDepletion === null) {
    return {
      status: 'on-track',
      label: 'On Track',
      description: 'Your retirement savings are projected to last through age 90.',
    };
  }

  // Depletes but not urgent (>20 years runway)
  if (yearsUntilDepletion > 20) {
    return {
      status: 'needs-adjustment',
      label: 'Needs Adjustment',
      description: `Funds may run out at age ${currentAge + yearsUntilDepletion}. Consider increasing savings.`,
    };
  }

  // Urgent action needed (≤20 years runway)
  return {
    status: 'at-risk',
    label: 'At Risk of Shortfall',
    description: `Funds projected to run out at age ${currentAge + yearsUntilDepletion}. Action recommended.`,
  };
}
