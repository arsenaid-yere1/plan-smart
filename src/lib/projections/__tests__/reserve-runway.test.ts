import { describe, it, expect } from 'vitest';
import { calculateReserveRunway, calculateGuaranteedIncome } from '../reserve-runway';

describe('calculateReserveRunway', () => {
  it('returns infinity when income covers all essentials', () => {
    const result = calculateReserveRunway(
      100000, // reserve
      50000,  // essential expenses
      20000,  // discretionary
      60000,  // guaranteed income (covers essentials)
      0.025
    );

    expect(result.yearsOfEssentials).toBe(Infinity);
    expect(result.description).toContain('income covers');
  });

  it('calculates finite runway when income does not cover essentials', () => {
    const result = calculateReserveRunway(
      200000, // reserve
      60000,  // essential expenses
      20000,  // discretionary
      30000,  // guaranteed income (leaves $30k gap)
      0.025
    );

    // $200k / $30k gap = ~6-7 years with inflation
    expect(result.yearsOfEssentials).toBeGreaterThan(5);
    expect(result.yearsOfEssentials).toBeLessThan(10);
  });

  it('handles zero reserve', () => {
    const result = calculateReserveRunway(0, 50000, 20000, 30000, 0.025);
    expect(result.yearsOfEssentials).toBe(0);
  });

  it('handles zero expenses', () => {
    const result = calculateReserveRunway(100000, 0, 0, 0, 0.025);
    expect(result.yearsOfEssentials).toBe(Infinity);
    expect(result.yearsOfFullSpending).toBe(Infinity);
  });

  it('calculates full spending runway correctly', () => {
    const result = calculateReserveRunway(
      200000, // reserve
      40000,  // essential expenses
      20000,  // discretionary
      20000,  // guaranteed income (covers half of essentials)
      0.025
    );

    // Essential gap = $20k, discretionary = $20k
    // Full spending gap = $40k
    // $200k / $40k = ~5 years with inflation
    expect(result.yearsOfFullSpending).toBeGreaterThan(4);
    expect(result.yearsOfFullSpending).toBeLessThan(7);

    // Essential runway should be longer than full spending runway
    expect(result.yearsOfEssentials).toBeGreaterThan(result.yearsOfFullSpending);
  });

  it('generates appropriate description for long runway', () => {
    const result = calculateReserveRunway(
      2000000, // $2M reserve to ensure 30+ years
      30000,   // essential expenses
      10000,   // discretionary
      0,       // no guaranteed income
      0.025
    );

    // With $2M and $30k/year expenses, should get 30+ years
    expect(result.yearsOfEssentials).toBeGreaterThanOrEqual(30);
    expect(result.description).toContain('30+');
  });

  it('generates appropriate description for medium runway', () => {
    const result = calculateReserveRunway(
      300000, // reserve
      30000,  // essential expenses
      10000,  // discretionary
      0,      // no guaranteed income
      0.025
    );

    // ~8-9 years
    expect(result.description).toContain('years');
    expect(result.description).toContain('essential');
  });

  it('handles high inflation rate', () => {
    // Use larger reserve to see inflation effect more clearly
    const lowInflation = calculateReserveRunway(500000, 20000, 0, 0, 0.02);
    const highInflation = calculateReserveRunway(500000, 20000, 0, 0, 0.10);

    // Higher inflation should result in shorter runway
    expect(highInflation.yearsOfEssentials).toBeLessThan(lowInflation.yearsOfEssentials);
  });
});

describe('calculateGuaranteedIncome', () => {
  it('sums only guaranteed income streams', () => {
    const streams = [
      { annualAmount: 30000, isGuaranteed: true },  // SS
      { annualAmount: 20000, isGuaranteed: true },  // Pension
      { annualAmount: 10000, isGuaranteed: false }, // Rental
    ];

    const result = calculateGuaranteedIncome(streams);
    expect(result).toBe(50000); // Only guaranteed streams
  });

  it('returns zero for empty streams', () => {
    const result = calculateGuaranteedIncome([]);
    expect(result).toBe(0);
  });

  it('returns zero when all streams are non-guaranteed', () => {
    const streams = [
      { annualAmount: 10000, isGuaranteed: false },
      { annualAmount: 20000, isGuaranteed: false },
    ];

    const result = calculateGuaranteedIncome(streams);
    expect(result).toBe(0);
  });

  it('handles single guaranteed stream', () => {
    const streams = [
      { annualAmount: 36000, isGuaranteed: true },
    ];

    const result = calculateGuaranteedIncome(streams);
    expect(result).toBe(36000);
  });
});
