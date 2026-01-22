import { describe, it, expect } from 'vitest';
import { checkProjectionStaleness } from '../staleness';
import type { ProjectionInput } from '../types';

// Helper to create a minimal projection input
function createBaseInput(overrides: Partial<ProjectionInput> = {}): ProjectionInput {
  return {
    currentAge: 30,
    retirementAge: 65,
    maxAge: 95,
    balancesByType: {
      taxDeferred: 100000,
      taxFree: 50000,
      taxable: 50000,
    },
    annualContribution: 20000,
    contributionAllocation: {
      taxDeferred: 60,
      taxFree: 20,
      taxable: 20,
    },
    expectedReturn: 0.07,
    inflationRate: 0.025,
    contributionGrowthRate: 0.02,
    annualExpenses: 60000,
    annualEssentialExpenses: 40000,
    annualDiscretionaryExpenses: 20000,
    annualHealthcareCosts: 8000,
    healthcareInflationRate: 0.05,
    incomeStreams: [],
    annualDebtPayments: 0,
    ...overrides,
  };
}

describe('checkProjectionStaleness', () => {
  describe('basic field changes', () => {
    it('should detect no changes when inputs are identical', () => {
      const input = createBaseInput();
      const result = checkProjectionStaleness(input, { ...input });

      expect(result.isStale).toBe(false);
      expect(result.changedFields).toHaveLength(0);
    });

    it('should detect currentAge change', () => {
      const stored = createBaseInput({ currentAge: 30 });
      const current = createBaseInput({ currentAge: 31 });

      const result = checkProjectionStaleness(stored, current);

      expect(result.isStale).toBe(true);
      expect(result.changedFields).toContain('currentAge');
      expect(result.changes['currentAge']).toEqual({ previous: 30, current: 31 });
    });

    it('should detect retirementAge change', () => {
      const stored = createBaseInput({ retirementAge: 65 });
      const current = createBaseInput({ retirementAge: 67 });

      const result = checkProjectionStaleness(stored, current);

      expect(result.isStale).toBe(true);
      expect(result.changedFields).toContain('retirementAge');
    });

    it('should detect expectedReturn change', () => {
      const stored = createBaseInput({ expectedReturn: 0.07 });
      const current = createBaseInput({ expectedReturn: 0.06 });

      const result = checkProjectionStaleness(stored, current);

      expect(result.isStale).toBe(true);
      expect(result.changedFields).toContain('expectedReturn');
    });

    it('should detect annualContribution change', () => {
      const stored = createBaseInput({ annualContribution: 20000 });
      const current = createBaseInput({ annualContribution: 25000 });

      const result = checkProjectionStaleness(stored, current);

      expect(result.isStale).toBe(true);
      expect(result.changedFields).toContain('annualContribution');
    });

    it('should detect multiple field changes', () => {
      const stored = createBaseInput({
        retirementAge: 65,
        expectedReturn: 0.07,
        annualExpenses: 60000,
      });
      const current = createBaseInput({
        retirementAge: 67,
        expectedReturn: 0.06,
        annualExpenses: 70000,
      });

      const result = checkProjectionStaleness(stored, current);

      expect(result.isStale).toBe(true);
      expect(result.changedFields).toContain('retirementAge');
      expect(result.changedFields).toContain('expectedReturn');
      expect(result.changedFields).toContain('annualExpenses');
      expect(result.changedFields.length).toBe(3);
    });
  });

  describe('balances changes', () => {
    it('should detect balance changes', () => {
      const stored = createBaseInput({
        balancesByType: { taxDeferred: 100000, taxFree: 50000, taxable: 50000 },
      });
      const current = createBaseInput({
        balancesByType: { taxDeferred: 120000, taxFree: 50000, taxable: 50000 },
      });

      const result = checkProjectionStaleness(stored, current);

      expect(result.isStale).toBe(true);
      expect(result.changedFields).toContain('balancesByType');
    });

    it('should not flag identical balances', () => {
      const balances = { taxDeferred: 100000, taxFree: 50000, taxable: 50000 };
      const stored = createBaseInput({ balancesByType: { ...balances } });
      const current = createBaseInput({ balancesByType: { ...balances } });

      const result = checkProjectionStaleness(stored, current);

      expect(result.changedFields).not.toContain('balancesByType');
    });
  });

  describe('income streams changes', () => {
    it('should detect added income stream', () => {
      const stored = createBaseInput({ incomeStreams: [] });
      const current = createBaseInput({
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
      });

      const result = checkProjectionStaleness(stored, current);

      expect(result.isStale).toBe(true);
      expect(result.changedFields).toContain('incomeStreams');
    });

    it('should detect removed income stream', () => {
      const stored = createBaseInput({
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
      });
      const current = createBaseInput({ incomeStreams: [] });

      const result = checkProjectionStaleness(stored, current);

      expect(result.isStale).toBe(true);
      expect(result.changedFields).toContain('incomeStreams');
    });

    it('should detect modified income stream', () => {
      const stored = createBaseInput({
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
      });
      const current = createBaseInput({
        incomeStreams: [
          {
            id: 'ss',
            name: 'Social Security',
            type: 'social_security',
            annualAmount: 30000, // Changed amount
            startAge: 67,
            inflationAdjusted: true,
            isGuaranteed: true,
            isSpouse: false,
          },
        ],
      });

      const result = checkProjectionStaleness(stored, current);

      expect(result.isStale).toBe(true);
      expect(result.changedFields).toContain('incomeStreams');
    });

    it('should not flag identical income streams regardless of array order', () => {
      const stream1 = {
        id: 'ss',
        name: 'Social Security',
        type: 'social_security' as const,
        annualAmount: 24000,
        startAge: 67,
        inflationAdjusted: true,
        isGuaranteed: true,
        isSpouse: false,
      };
      const stream2 = {
        id: 'pension',
        name: 'Pension',
        type: 'pension' as const,
        annualAmount: 30000,
        startAge: 65,
        inflationAdjusted: false,
        isGuaranteed: true,
        isSpouse: false,
      };

      const stored = createBaseInput({ incomeStreams: [stream1, stream2] });
      const current = createBaseInput({ incomeStreams: [stream2, stream1] }); // Different order

      const result = checkProjectionStaleness(stored, current);

      expect(result.changedFields).not.toContain('incomeStreams');
    });
  });

  describe('spending phase config changes', () => {
    it('should detect when phases added (undefined to defined)', () => {
      const stored = createBaseInput({ spendingPhaseConfig: undefined });
      const current = createBaseInput({
        spendingPhaseConfig: {
          enabled: true,
          phases: [
            {
              id: 'go-go',
              name: 'Go-Go',
              startAge: 65,
              essentialMultiplier: 1.0,
              discretionaryMultiplier: 1.5,
            },
          ],
        },
      });

      const result = checkProjectionStaleness(stored, current);

      expect(result.isStale).toBe(true);
      expect(result.changedFields).toContain('spendingPhaseConfig');
    });

    it('should detect when phases removed (defined to undefined)', () => {
      const stored = createBaseInput({
        spendingPhaseConfig: {
          enabled: true,
          phases: [
            {
              id: 'go-go',
              name: 'Go-Go',
              startAge: 65,
              essentialMultiplier: 1.0,
              discretionaryMultiplier: 1.5,
            },
          ],
        },
      });
      const current = createBaseInput({ spendingPhaseConfig: undefined });

      const result = checkProjectionStaleness(stored, current);

      expect(result.isStale).toBe(true);
      expect(result.changedFields).toContain('spendingPhaseConfig');
    });

    it('should detect when phases enabled', () => {
      const phases = [
        {
          id: 'go-go',
          name: 'Go-Go',
          startAge: 65,
          essentialMultiplier: 1.0,
          discretionaryMultiplier: 1.5,
        },
      ];

      const stored = createBaseInput({
        spendingPhaseConfig: { enabled: false, phases },
      });
      const current = createBaseInput({
        spendingPhaseConfig: { enabled: true, phases },
      });

      const result = checkProjectionStaleness(stored, current);

      expect(result.isStale).toBe(true);
      expect(result.changedFields).toContain('spendingPhaseConfig');
    });

    it('should detect when phases disabled', () => {
      const phases = [
        {
          id: 'go-go',
          name: 'Go-Go',
          startAge: 65,
          essentialMultiplier: 1.0,
          discretionaryMultiplier: 1.5,
        },
      ];

      const stored = createBaseInput({
        spendingPhaseConfig: { enabled: true, phases },
      });
      const current = createBaseInput({
        spendingPhaseConfig: { enabled: false, phases },
      });

      const result = checkProjectionStaleness(stored, current);

      expect(result.isStale).toBe(true);
      expect(result.changedFields).toContain('spendingPhaseConfig');
    });

    it('should detect phase multiplier changes', () => {
      const stored = createBaseInput({
        spendingPhaseConfig: {
          enabled: true,
          phases: [
            {
              id: 'go-go',
              name: 'Go-Go',
              startAge: 65,
              essentialMultiplier: 1.0,
              discretionaryMultiplier: 1.5,
            },
          ],
        },
      });
      const current = createBaseInput({
        spendingPhaseConfig: {
          enabled: true,
          phases: [
            {
              id: 'go-go',
              name: 'Go-Go',
              startAge: 65,
              essentialMultiplier: 1.0,
              discretionaryMultiplier: 1.3, // Changed
            },
          ],
        },
      });

      const result = checkProjectionStaleness(stored, current);

      expect(result.isStale).toBe(true);
      expect(result.changedFields).toContain('spendingPhaseConfig');
    });

    it('should detect phase startAge changes', () => {
      const stored = createBaseInput({
        spendingPhaseConfig: {
          enabled: true,
          phases: [
            {
              id: 'go-go',
              name: 'Go-Go',
              startAge: 65,
              essentialMultiplier: 1.0,
              discretionaryMultiplier: 1.5,
            },
          ],
        },
      });
      const current = createBaseInput({
        spendingPhaseConfig: {
          enabled: true,
          phases: [
            {
              id: 'go-go',
              name: 'Go-Go',
              startAge: 67, // Changed
              essentialMultiplier: 1.0,
              discretionaryMultiplier: 1.5,
            },
          ],
        },
      });

      const result = checkProjectionStaleness(stored, current);

      expect(result.isStale).toBe(true);
      expect(result.changedFields).toContain('spendingPhaseConfig');
    });

    it('should detect added phase', () => {
      const stored = createBaseInput({
        spendingPhaseConfig: {
          enabled: true,
          phases: [
            {
              id: 'go-go',
              name: 'Go-Go',
              startAge: 65,
              essentialMultiplier: 1.0,
              discretionaryMultiplier: 1.5,
            },
          ],
        },
      });
      const current = createBaseInput({
        spendingPhaseConfig: {
          enabled: true,
          phases: [
            {
              id: 'go-go',
              name: 'Go-Go',
              startAge: 65,
              essentialMultiplier: 1.0,
              discretionaryMultiplier: 1.5,
            },
            {
              id: 'slow-go',
              name: 'Slow-Go',
              startAge: 75,
              essentialMultiplier: 1.0,
              discretionaryMultiplier: 1.0,
            },
          ],
        },
      });

      const result = checkProjectionStaleness(stored, current);

      expect(result.isStale).toBe(true);
      expect(result.changedFields).toContain('spendingPhaseConfig');
    });

    it('should not flag when both configs are disabled (ignores phase details)', () => {
      const stored = createBaseInput({
        spendingPhaseConfig: {
          enabled: false,
          phases: [
            {
              id: 'go-go',
              name: 'Go-Go',
              startAge: 65,
              essentialMultiplier: 1.0,
              discretionaryMultiplier: 1.5,
            },
          ],
        },
      });
      const current = createBaseInput({
        spendingPhaseConfig: {
          enabled: false,
          phases: [
            {
              id: 'go-go',
              name: 'Go-Go',
              startAge: 67, // Different but doesn't matter - disabled
              essentialMultiplier: 1.0,
              discretionaryMultiplier: 1.3,
            },
          ],
        },
      });

      const result = checkProjectionStaleness(stored, current);

      expect(result.changedFields).not.toContain('spendingPhaseConfig');
    });

    it('should not flag when both configs are undefined', () => {
      const stored = createBaseInput({ spendingPhaseConfig: undefined });
      const current = createBaseInput({ spendingPhaseConfig: undefined });

      const result = checkProjectionStaleness(stored, current);

      expect(result.changedFields).not.toContain('spendingPhaseConfig');
    });

    it('should not flag identical enabled configs regardless of phase order', () => {
      const phase1 = {
        id: 'go-go',
        name: 'Go-Go',
        startAge: 65,
        essentialMultiplier: 1.0,
        discretionaryMultiplier: 1.5,
      };
      const phase2 = {
        id: 'slow-go',
        name: 'Slow-Go',
        startAge: 75,
        essentialMultiplier: 1.0,
        discretionaryMultiplier: 1.0,
      };

      const stored = createBaseInput({
        spendingPhaseConfig: {
          enabled: true,
          phases: [phase1, phase2],
        },
      });
      const current = createBaseInput({
        spendingPhaseConfig: {
          enabled: true,
          phases: [phase2, phase1], // Different order
        },
      });

      const result = checkProjectionStaleness(stored, current);

      expect(result.changedFields).not.toContain('spendingPhaseConfig');
    });
  });
});
