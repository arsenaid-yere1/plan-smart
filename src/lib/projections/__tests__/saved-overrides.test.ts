import { describe, expect, it } from 'vitest';
import type { ProjectionAssumptions, ProjectionInput } from '../types';
import {
  buildProjectionAssumptions,
  getStoredProjectionOverrides,
} from '../saved-overrides';

const legacyAssumptions: ProjectionAssumptions = {
  expectedReturn: 0.06,
  inflationRate: 0.03,
  healthcareInflationRate: 0.05,
  contributionGrowthRate: 0,
  retirementAge: 67,
  maxAge: 95,
};

describe('saved projection overrides', () => {
  it('prefers exact new-row overrides and returns a copy', () => {
    const assumptions: ProjectionAssumptions = {
      ...legacyAssumptions,
      overrides: {
        expectedReturn: 0,
        annualHealthcareCosts: 0,
        socialSecurityAge: 70,
      },
    };

    const resolved = getStoredProjectionOverrides(assumptions);

    expect(resolved).toEqual(assumptions.overrides);
    expect(resolved).not.toBe(assumptions.overrides);
  });

  it('reconstructs only the six historically persisted fields', () => {
    expect(getStoredProjectionOverrides(legacyAssumptions)).toEqual({
      expectedReturn: 0.06,
      inflationRate: 0.03,
      healthcareInflationRate: 0.05,
      contributionGrowthRate: 0,
      retirementAge: 67,
      maxAge: 95,
    });
  });

  it('returns no overrides when assumptions are absent', () => {
    expect(getStoredProjectionOverrides(undefined)).toEqual({});
    expect(getStoredProjectionOverrides(null)).toEqual({});
  });

  it('builds display assumptions with exact override provenance', () => {
    const input = {
      expectedReturn: 0.07,
      inflationRate: 0.025,
      healthcareInflationRate: 0.05,
      contributionGrowthRate: 0.01,
      retirementAge: 68,
      maxAge: 94,
    } as ProjectionInput;
    const overrides = { expectedReturn: 0.07, retirementAge: 68 };

    expect(buildProjectionAssumptions(input, overrides)).toEqual({
      expectedReturn: 0.07,
      inflationRate: 0.025,
      healthcareInflationRate: 0.05,
      contributionGrowthRate: 0.01,
      retirementAge: 68,
      maxAge: 94,
      overrides,
    });
  });
});
