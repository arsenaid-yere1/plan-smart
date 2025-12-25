import { describe, it, expect } from 'vitest';
import { getRetirementStatus } from '../status';
import type { ProjectionSummary } from '../types';

describe('getRetirementStatus', () => {
  const baseSummary: ProjectionSummary = {
    startingBalance: 100000,
    endingBalance: 500000,
    totalContributions: 200000,
    totalWithdrawals: 0,
    yearsUntilDepletion: null,
    projectedRetirementBalance: 400000,
  };

  describe('On Track status', () => {
    it('returns on-track when funds last through max age', () => {
      const result = getRetirementStatus(
        { ...baseSummary, yearsUntilDepletion: null },
        30
      );

      expect(result.status).toBe('on-track');
      expect(result.label).toBe('On Track');
      expect(result.description).toContain('projected to last through age 90');
    });
  });

  describe('Needs Adjustment status', () => {
    it('returns needs-adjustment when depletes after 20+ years', () => {
      const result = getRetirementStatus(
        { ...baseSummary, yearsUntilDepletion: 25 },
        35
      );

      expect(result.status).toBe('needs-adjustment');
      expect(result.label).toBe('Needs Adjustment');
      expect(result.description).toContain('age 60'); // 35 + 25
      expect(result.description).toContain('Consider increasing savings');
    });

    it('returns needs-adjustment at exactly 21 years', () => {
      const result = getRetirementStatus(
        { ...baseSummary, yearsUntilDepletion: 21 },
        40
      );

      expect(result.status).toBe('needs-adjustment');
    });
  });

  describe('At Risk status', () => {
    it('returns at-risk when depletes within 20 years', () => {
      const result = getRetirementStatus(
        { ...baseSummary, yearsUntilDepletion: 15 },
        50
      );

      expect(result.status).toBe('at-risk');
      expect(result.label).toBe('At Risk of Shortfall');
      expect(result.description).toContain('age 65'); // 50 + 15
      expect(result.description).toContain('Action recommended');
    });

    it('returns at-risk at exactly 20 years', () => {
      const result = getRetirementStatus(
        { ...baseSummary, yearsUntilDepletion: 20 },
        45
      );

      expect(result.status).toBe('at-risk');
    });

    it('returns at-risk when depletes very soon', () => {
      const result = getRetirementStatus(
        { ...baseSummary, yearsUntilDepletion: 5 },
        60
      );

      expect(result.status).toBe('at-risk');
      expect(result.description).toContain('age 65'); // 60 + 5
    });
  });
});
