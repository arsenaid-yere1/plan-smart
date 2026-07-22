import { describe, expect, it } from 'vitest';
import type { ProjectionInput } from '@/lib/projections/types';
import { hashProjectionInputs } from '../hash-inputs';

function input(): ProjectionInput {
  return {
    currentAge: 60,
    birthYear: 1966,
    retirementAge: 67,
    maxAge: 95,
    balancesByType: { taxDeferred: 100000, taxFree: 20000, taxable: 10000 },
    annualContribution: 12000,
    annualContributionsByType: { taxDeferred: 6000, taxFree: 4000, taxable: 2000 },
    contributionAllocation: { taxDeferred: 50, taxFree: 30, taxable: 20 },
    expectedReturn: 0.06,
    inflationRate: 0.025,
    contributionGrowthRate: 0.02,
    annualEssentialExpenses: 40000,
    annualDiscretionaryExpenses: 10000,
    annualExpenses: 50000,
    annualHealthcareCosts: 8000,
    healthcareInflationRate: 0.05,
    incomeStreams: [{
      id: 'ss', name: 'Social Security', type: 'social_security', annualAmount: 24000,
      startAge: 67, inflationAdjusted: true, isGuaranteed: true, isSpouse: false,
    }],
    annualDebtPayments: 0,
    spendingPhaseConfig: { enabled: false, phases: [] },
    depletionTarget: { enabled: false, targetAge: 90, targetPercentageSpent: 80 },
    reserveFloor: 10000,
    rmdConfig: { enabled: true, startAge: 75 },
  };
}

describe('hashProjectionInputs', () => {
  it('is stable across nested object insertion order', () => {
    const first = input();
    const second = {
      ...first,
      balancesByType: { taxable: 10000, taxFree: 20000, taxDeferred: 100000 },
    } as ProjectionInput;
    expect(hashProjectionInputs(first, 2)).toBe(hashProjectionInputs(second, 2));
  });

  it('changes for the calculation version and nested outcome inputs', () => {
    const baseline = input();
    const hash = hashProjectionInputs(baseline, 2);
    expect(hashProjectionInputs(baseline, 1)).not.toBe(hash);

    const variants: ProjectionInput[] = [
      { ...baseline, balancesByType: { ...baseline.balancesByType, taxDeferred: 99999 } },
      { ...baseline, annualContributionsByType: { ...baseline.annualContributionsByType!, taxFree: 4001 } },
      { ...baseline, rmdConfig: { enabled: true, startAge: 73 } },
      { ...baseline, incomeStreams: [{ ...baseline.incomeStreams[0], annualAmount: 25000 }] },
      { ...baseline, spendingPhaseConfig: { enabled: true, phases: [{ id: 'go', name: 'Go', startAge: 67, essentialMultiplier: 1, discretionaryMultiplier: 1 }] } },
      { ...baseline, depletionTarget: { enabled: true, targetAge: 90, targetPercentageSpent: 75 } },
      { ...baseline, reserveFloor: 12000 },
    ];

    for (const variant of variants) {
      expect(hashProjectionInputs(variant, 2)).not.toBe(hash);
    }
  });
});
