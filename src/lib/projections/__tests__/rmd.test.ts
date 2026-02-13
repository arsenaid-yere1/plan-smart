import { describe, it, expect } from 'vitest';
import {
  calculateRMD,
  getDistributionPeriod,
  UNIFORM_LIFETIME_TABLE,
  DEFAULT_RMD_START_AGE,
} from '../rmd';

describe('RMD Calculations', () => {
  describe('getDistributionPeriod', () => {
    it('returns null for ages below RMD start age', () => {
      expect(getDistributionPeriod(72)).toBeNull();
      expect(getDistributionPeriod(65)).toBeNull();
    });

    it('returns correct distribution period for RMD ages', () => {
      expect(getDistributionPeriod(73)).toBe(26.5);
      expect(getDistributionPeriod(75)).toBe(24.6);
      expect(getDistributionPeriod(85)).toBe(16.0);
    });

    it('handles ages beyond table (120+)', () => {
      expect(getDistributionPeriod(121)).toBe(2.0);
      expect(getDistributionPeriod(130)).toBe(2.0);
    });
  });

  describe('calculateRMD', () => {
    it('returns 0 for ages below RMD start age', () => {
      expect(calculateRMD(500000, 72)).toBe(0);
      expect(calculateRMD(1000000, 65)).toBe(0);
    });

    it('returns 0 for zero or negative balance', () => {
      expect(calculateRMD(0, 75)).toBe(0);
      expect(calculateRMD(-1000, 75)).toBe(0);
    });

    it('calculates correct RMD at age 73', () => {
      // $500,000 / 26.5 = $18,867.92
      const rmd = calculateRMD(500000, 73);
      expect(rmd).toBeCloseTo(18867.92, 2);
    });

    it('calculates correct RMD at age 85', () => {
      // $300,000 / 16.0 = $18,750
      const rmd = calculateRMD(300000, 85);
      expect(rmd).toBe(18750);
    });

    it('RMD percentage increases with age', () => {
      const balance = 100000;
      const rmd73 = calculateRMD(balance, 73);
      const rmd85 = calculateRMD(balance, 85);
      const rmd95 = calculateRMD(balance, 95);

      // RMD percentage: 73 = 3.77%, 85 = 6.25%, 95 = 11.24%
      expect(rmd85).toBeGreaterThan(rmd73);
      expect(rmd95).toBeGreaterThan(rmd85);
    });
  });

  describe('UNIFORM_LIFETIME_TABLE', () => {
    it('has entries from age 73 to 120', () => {
      expect(UNIFORM_LIFETIME_TABLE[73]).toBeDefined();
      expect(UNIFORM_LIFETIME_TABLE[120]).toBeDefined();
    });

    it('distribution periods decrease with age', () => {
      // Distribution period should decrease as age increases (shorter life expectancy)
      expect(UNIFORM_LIFETIME_TABLE[73]).toBeGreaterThan(UNIFORM_LIFETIME_TABLE[80]);
      expect(UNIFORM_LIFETIME_TABLE[80]).toBeGreaterThan(UNIFORM_LIFETIME_TABLE[90]);
      expect(UNIFORM_LIFETIME_TABLE[90]).toBeGreaterThan(UNIFORM_LIFETIME_TABLE[100]);
    });
  });

  describe('DEFAULT_RMD_START_AGE', () => {
    it('is set to 73 per SECURE 2.0 Act', () => {
      expect(DEFAULT_RMD_START_AGE).toBe(73);
    });
  });
});
