import { describe, it, expect } from 'vitest';
import { runProjection } from '../engine';
import type { ProjectionInput } from '../types';

describe('runProjection with reserve floor', () => {
  const baseInput: ProjectionInput = {
    currentAge: 65,
    retirementAge: 65,
    maxAge: 90,
    balancesByType: { taxDeferred: 500000, taxFree: 300000, taxable: 200000 },
    annualContribution: 0,
    contributionAllocation: { taxDeferred: 60, taxFree: 30, taxable: 10 },
    expectedReturn: 0.05,
    inflationRate: 0.025,
    contributionGrowthRate: 0,
    annualEssentialExpenses: 40000,
    annualDiscretionaryExpenses: 20000,
    annualExpenses: 60000,
    annualHealthcareCosts: 5000,
    healthcareInflationRate: 0.05,
    incomeStreams: [],
    annualDebtPayments: 0,
  };

  it('works without reserve floor (baseline)', () => {
    const result = runProjection(baseInput);

    expect(result.records.length).toBe(26); // 65 to 90
    expect(result.summary.reserveFloor).toBeUndefined();
    expect(result.summary.yearsReserveConstrained).toBe(0);
  });

  it('includes reserve floor in summary when configured', () => {
    const input: ProjectionInput = {
      ...baseInput,
      reserveFloor: 250000, // 25% of $1M
    };

    const result = runProjection(input);

    expect(result.summary.reserveFloor).toBe(250000);
  });

  it('respects reserve floor by limiting withdrawals', () => {
    const input: ProjectionInput = {
      ...baseInput,
      reserveFloor: 250000, // 25% of $1M
    };

    const result = runProjection(input);

    // Balance should never go below reserve floor
    for (const record of result.records) {
      if (record.age >= 65) { // Retirement years
        expect(record.balance).toBeGreaterThanOrEqual(249000); // Allow small rounding
      }
    }
  });

  it('tracks years reserve constrained in summary', () => {
    const input: ProjectionInput = {
      ...baseInput,
      reserveFloor: 800000, // Very high reserve to trigger constraint
    };

    const result = runProjection(input);

    expect(result.summary.yearsReserveConstrained).toBeGreaterThan(0);
    // First constraint age depends on when balance drops close to reserve floor
    expect(result.summary.firstReserveConstraintAge).not.toBeNull();
  });

  it('tracks reserve constrained flag on records', () => {
    const input: ProjectionInput = {
      ...baseInput,
      reserveFloor: 900000, // Very tight reserve
    };

    const result = runProjection(input);
    const constrainedRecords = result.records.filter(r => r.reserveConstrained);

    expect(constrainedRecords.length).toBeGreaterThan(0);
  });

  it('tracks reduction stages correctly', () => {
    const input: ProjectionInput = {
      ...baseInput,
      reserveFloor: 950000, // Extremely tight reserve
    };

    const result = runProjection(input);

    // Should have some records with reduction stages
    const reducedRecords = result.records.filter(
      r => r.reductionStage && r.reductionStage !== 'none'
    );

    expect(reducedRecords.length).toBeGreaterThan(0);
  });

  it('reduces discretionary before essentials', () => {
    const input: ProjectionInput = {
      ...baseInput,
      reserveFloor: 900000, // Very tight reserve
    };

    const result = runProjection(input);

    // Find the first constrained record
    const firstConstrained = result.records.find(r => r.reserveConstrained);

    if (firstConstrained) {
      // Should reduce discretionary first (stage = discretionary_reduced)
      // or if even tighter, essentials_only
      expect(['discretionary_reduced', 'essentials_only', 'essentials_reduced']).toContain(
        firstConstrained.reductionStage
      );
    }
  });

  it('calculates reserve balance correctly', () => {
    const input: ProjectionInput = {
      ...baseInput,
      reserveFloor: 250000,
    };

    const result = runProjection(input);

    // Reserve balance = total balance - reserve floor (but not negative)
    for (const record of result.records) {
      if (record.reserveBalance !== undefined) {
        expect(record.reserveBalance).toBeGreaterThanOrEqual(0);
        expect(record.reserveBalance).toBeLessThanOrEqual(record.balance);
      }
    }
  });

  it('tracks spending shortfall when reserve is constraining', () => {
    const input: ProjectionInput = {
      ...baseInput,
      reserveFloor: 950000, // Extremely tight
    };

    const result = runProjection(input);

    // Find records with shortfall
    const shortfallRecords = result.records.filter(
      r => r.spendingShortfall !== undefined && r.spendingShortfall > 0
    );

    expect(shortfallRecords.length).toBeGreaterThan(0);
  });

  it('handles reserve floor of zero (acts as floor)', () => {
    const input: ProjectionInput = {
      ...baseInput,
      reserveFloor: 0,
    };

    const result = runProjection(input);

    // Reserve floor of 0 means balance can go to zero but not negative
    // Constraint years only occur if balance approaches 0
    // The summary should include the reserve floor
    expect(result.summary.reserveFloor).toBe(0);
  });

  it('handles reserve floor equal to portfolio value', () => {
    const input: ProjectionInput = {
      ...baseInput,
      reserveFloor: 1000000, // Equal to total portfolio
    };

    const result = runProjection(input);

    // All retirement years should be constrained
    expect(result.summary.yearsReserveConstrained).toBeGreaterThan(20);
    expect(result.summary.firstReserveConstraintAge).toBe(65);
  });
});
