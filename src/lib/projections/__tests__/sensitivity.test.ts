import { describe, it, expect } from 'vitest';
import { analyzeSensitivity, identifyLowFrictionWins, identifySensitiveAssumptions } from '../sensitivity';
import type { ProjectionInput } from '../types';

describe('sensitivity analysis', () => {
  const baseInput: ProjectionInput = {
    currentAge: 35,
    retirementAge: 65,
    maxAge: 90,
    balancesByType: { taxDeferred: 100000, taxFree: 50000, taxable: 50000 },
    annualContribution: 20000,
    contributionAllocation: { taxDeferred: 60, taxFree: 30, taxable: 10 },
    expectedReturn: 0.07,
    inflationRate: 0.025,
    contributionGrowthRate: 0.02,
    annualEssentialExpenses: 40000,
    annualDiscretionaryExpenses: 20000,
    annualExpenses: 60000,
    annualHealthcareCosts: 8000,
    healthcareInflationRate: 0.05,
    incomeStreams: [],
    annualDebtPayments: 0,
  };

  describe('analyzeSensitivity', () => {
    it('returns exactly 3 top levers', () => {
      const result = analyzeSensitivity(baseInput);
      expect(result.topLevers).toHaveLength(3);
    });

    it('sorts levers by absolute impact', () => {
      const result = analyzeSensitivity(baseInput);
      const impacts = result.topLevers.map(l => Math.abs(l.impactOnBalance));
      expect(impacts).toEqual([...impacts].sort((a, b) => b - a));
    });

    it('includes baseline values', () => {
      const result = analyzeSensitivity(baseInput);
      expect(result.baselineBalance).toBeGreaterThan(0);
    });
  });

  describe('identifyLowFrictionWins', () => {
    it('identifies wins above threshold', () => {
      const sensitivityResult = analyzeSensitivity(baseInput);
      const wins = identifyLowFrictionWins(baseInput, sensitivityResult);

      for (const win of wins) {
        expect(win.potentialImpact).toBeGreaterThan(5000);
      }
    });

    it('returns at most 3 wins', () => {
      const sensitivityResult = analyzeSensitivity(baseInput);
      const wins = identifyLowFrictionWins(baseInput, sensitivityResult);
      expect(wins.length).toBeLessThanOrEqual(3);
    });
  });

  describe('identifySensitiveAssumptions', () => {
    it('returns at most 2 assumptions', () => {
      const sensitivityResult = analyzeSensitivity(baseInput);
      const assumptions = identifySensitiveAssumptions(baseInput, sensitivityResult);
      expect(assumptions.length).toBeLessThanOrEqual(2);
    });

    it('includes sensitivity scores', () => {
      const sensitivityResult = analyzeSensitivity(baseInput);
      const assumptions = identifySensitiveAssumptions(baseInput, sensitivityResult);

      for (const assumption of assumptions) {
        expect(assumption.sensitivityScore).toBeGreaterThanOrEqual(0);
        expect(assumption.sensitivityScore).toBeLessThanOrEqual(100);
      }
    });
  });
});
