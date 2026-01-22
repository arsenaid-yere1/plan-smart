import { describe, it, expect } from 'vitest';
import { calculateSpendingComparison } from '../spending-comparison';
import type { ProjectionInput, SpendingPhaseConfig } from '../types';

// Helper to create base input
function createBaseInput(overrides: Partial<ProjectionInput> = {}): ProjectionInput {
  return {
    currentAge: 40,
    retirementAge: 65,
    maxAge: 90,
    balancesByType: { taxDeferred: 500000, taxFree: 100000, taxable: 50000 },
    annualContribution: 20000,
    contributionAllocation: { taxDeferred: 60, taxFree: 20, taxable: 20 },
    expectedReturn: 0.06,
    inflationRate: 0.025,
    contributionGrowthRate: 0.02,
    annualEssentialExpenses: 40000,
    annualDiscretionaryExpenses: 20000,
    annualExpenses: 60000,
    annualHealthcareCosts: 5000,
    healthcareInflationRate: 0.04,
    incomeStreams: [
      {
        id: 'ss',
        name: 'Social Security',
        type: 'social_security',
        annualAmount: 24000,
        startAge: 67,
        inflationAdjusted: true,
        isGuaranteed: true,
        isSpouse: false,
      },
    ],
    annualDebtPayments: 0,
    ...overrides,
  };
}

const defaultPhases: SpendingPhaseConfig = {
  enabled: true,
  phases: [
    {
      id: 'gogo',
      name: 'Go-Go Years',
      startAge: 65,
      essentialMultiplier: 1.0,
      discretionaryMultiplier: 1.1,
    },
    {
      id: 'slowgo',
      name: 'Slow-Go',
      startAge: 75,
      essentialMultiplier: 0.95,
      discretionaryMultiplier: 0.75,
    },
    {
      id: 'nogo',
      name: 'No-Go',
      startAge: 85,
      essentialMultiplier: 0.9,
      discretionaryMultiplier: 0.5,
    },
  ],
};

describe('calculateSpendingComparison', () => {
  it('returns valid comparison structure', () => {
    const input = createBaseInput({ spendingPhaseConfig: defaultPhases });
    const result = calculateSpendingComparison(input);

    expect(result).toHaveProperty('flatSpending');
    expect(result).toHaveProperty('phasedSpending');
    expect(result).toHaveProperty('breakEvenAge');
    expect(result).toHaveProperty('longevityDifference');

    expect(result.flatSpending).toHaveProperty('totalLifetimeSpending');
    expect(result.flatSpending).toHaveProperty('portfolioDepletionAge');
    expect(result.flatSpending).toHaveProperty('endingBalance');
    expect(result.flatSpending).toHaveProperty('yearlySpending');

    expect(result.phasedSpending).toHaveProperty('totalLifetimeSpending');
    expect(result.phasedSpending).toHaveProperty('portfolioDepletionAge');
    expect(result.phasedSpending).toHaveProperty('endingBalance');
    expect(result.phasedSpending).toHaveProperty('yearlySpending');
    expect(result.phasedSpending).toHaveProperty('earlyYearsBonus');
    expect(result.phasedSpending).toHaveProperty('earlyYearsCount');
  });

  it('calculates positive early years bonus with front-loaded spending', () => {
    const input = createBaseInput({ spendingPhaseConfig: defaultPhases });
    const result = calculateSpendingComparison(input);

    // Go-Go phase has 110% discretionary multiplier, so early spending should be higher
    expect(result.phasedSpending.earlyYearsBonus).toBeGreaterThan(0);
  });

  it('calculates break-even age when spending patterns cross', () => {
    const input = createBaseInput({ spendingPhaseConfig: defaultPhases });
    const result = calculateSpendingComparison(input);

    // With front-loaded spending, there should be a break-even point
    // where cumulative phased spending equals cumulative flat spending
    if (result.breakEvenAge !== null) {
      expect(result.breakEvenAge).toBeGreaterThan(input.retirementAge);
      expect(result.breakEvenAge).toBeLessThanOrEqual(input.maxAge);
    }
  });

  it('returns correct yearlySpending array length', () => {
    const input = createBaseInput({ spendingPhaseConfig: defaultPhases });
    const result = calculateSpendingComparison(input);

    const retirementYears = input.maxAge - input.retirementAge + 1;
    expect(result.flatSpending.yearlySpending.length).toBe(retirementYears);
    expect(result.phasedSpending.yearlySpending.length).toBe(retirementYears);
  });

  it('includes phase info in phased yearly spending', () => {
    const input = createBaseInput({ spendingPhaseConfig: defaultPhases });
    const result = calculateSpendingComparison(input);

    // First year should be Go-Go
    expect(result.phasedSpending.yearlySpending[0].phase).toBe('Go-Go Years');

    // Year 10 (age 75) should be Slow-Go
    const slowGoEntry = result.phasedSpending.yearlySpending.find(
      (y) => y.age === 75
    );
    expect(slowGoEntry?.phase).toBe('Slow-Go');
  });

  it('respects custom earlyYearsCount parameter', () => {
    const input = createBaseInput({ spendingPhaseConfig: defaultPhases });
    const result5 = calculateSpendingComparison(input, 5);
    const result15 = calculateSpendingComparison(input, 15);

    expect(result5.phasedSpending.earlyYearsCount).toBe(5);
    expect(result15.phasedSpending.earlyYearsCount).toBe(15);

    // Different early years counts should produce different bonuses
    expect(result5.phasedSpending.earlyYearsBonus).not.toBe(
      result15.phasedSpending.earlyYearsBonus
    );
  });

  it('handles phases disabled gracefully', () => {
    const input = createBaseInput({
      spendingPhaseConfig: { enabled: false, phases: defaultPhases.phases },
    });
    const result = calculateSpendingComparison(input);

    // Both strategies should be essentially the same when phases are disabled
    expect(result.phasedSpending.earlyYearsBonus).toBe(0);
    expect(result.flatSpending.totalLifetimeSpending).toBeCloseTo(
      result.phasedSpending.totalLifetimeSpending,
      -2
    );
  });

  it('handles no spending phases configured', () => {
    const input = createBaseInput({ spendingPhaseConfig: undefined });
    const result = calculateSpendingComparison(input);

    // Both strategies should be the same
    expect(result.phasedSpending.earlyYearsBonus).toBe(0);
    expect(Math.abs(result.flatSpending.totalLifetimeSpending - result.phasedSpending.totalLifetimeSpending)).toBeLessThan(100);
  });

  it('calculates correct spending amounts in yearly arrays', () => {
    const input = createBaseInput({ spendingPhaseConfig: defaultPhases });
    const result = calculateSpendingComparison(input);

    // All spending amounts should be positive
    result.flatSpending.yearlySpending.forEach((entry) => {
      expect(entry.amount).toBeGreaterThan(0);
      expect(entry.age).toBeGreaterThanOrEqual(input.retirementAge);
    });

    result.phasedSpending.yearlySpending.forEach((entry) => {
      expect(entry.amount).toBeGreaterThan(0);
      expect(entry.age).toBeGreaterThanOrEqual(input.retirementAge);
    });
  });

  it('properly calculates longevity difference', () => {
    const input = createBaseInput({ spendingPhaseConfig: defaultPhases });
    const result = calculateSpendingComparison(input);

    // Longevity difference should be a reasonable number
    expect(typeof result.longevityDifference).toBe('number');
    // With typical phase configuration, the difference shouldn't be extreme
    expect(Math.abs(result.longevityDifference)).toBeLessThan(30);
  });

  it('returns null depletion age when portfolio never depletes', () => {
    // Create a high-savings scenario where portfolio never runs out
    const input = createBaseInput({
      spendingPhaseConfig: defaultPhases,
      balancesByType: { taxDeferred: 5000000, taxFree: 1000000, taxable: 500000 },
      annualEssentialExpenses: 20000,
      annualDiscretionaryExpenses: 10000,
      annualExpenses: 30000,
    });
    const result = calculateSpendingComparison(input);

    // With such high savings and low expenses, portfolio should never deplete
    expect(result.flatSpending.portfolioDepletionAge).toBeNull();
    expect(result.phasedSpending.portfolioDepletionAge).toBeNull();
  });
});
