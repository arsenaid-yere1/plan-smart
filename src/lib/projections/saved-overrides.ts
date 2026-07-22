import type {
  ProjectionAssumptions,
  ProjectionInput,
  ProjectionOverrides,
} from './types';

/**
 * Resolve the scenario choices that must survive a snapshot-driven refresh.
 * New rows retain their exact overrides; legacy rows can only recover the six
 * assumption fields that were historically persisted.
 */
export function getStoredProjectionOverrides(
  assumptions: ProjectionAssumptions | null | undefined
): ProjectionOverrides {
  if (!assumptions) {
    return {};
  }

  if (assumptions.overrides) {
    return { ...assumptions.overrides };
  }

  return {
    expectedReturn: assumptions.expectedReturn,
    inflationRate: assumptions.inflationRate,
    healthcareInflationRate: assumptions.healthcareInflationRate,
    contributionGrowthRate: assumptions.contributionGrowthRate,
    retirementAge: assumptions.retirementAge,
    maxAge: assumptions.maxAge,
  };
}

/** Build the human-readable assumption snapshot and exact override provenance. */
export function buildProjectionAssumptions(
  input: ProjectionInput,
  resolvedOverrides: ProjectionOverrides
): ProjectionAssumptions {
  return {
    expectedReturn: input.expectedReturn,
    inflationRate: input.inflationRate,
    healthcareInflationRate: input.healthcareInflationRate,
    contributionGrowthRate: input.contributionGrowthRate,
    retirementAge: input.retirementAge,
    maxAge: input.maxAge,
    overrides: { ...resolvedOverrides },
  };
}
