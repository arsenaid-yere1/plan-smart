import { describe, it, expect } from 'vitest';
import { runProjection, withdrawFromAccounts } from '../engine';
import type { ProjectionInput, BalanceByType } from '../types';

describe('withdrawFromAccounts', () => {
  it('should withdraw from taxable first', () => {
    const balances: BalanceByType = {
      taxable: 50000,
      taxDeferred: 100000,
      taxFree: 50000,
    };

    const result = withdrawFromAccounts(30000, balances);

    expect(result.withdrawals.taxable).toBe(30000);
    expect(result.withdrawals.taxDeferred).toBe(0);
    expect(result.withdrawals.taxFree).toBe(0);
    expect(result.shortfall).toBe(0);
  });

  it('should cascade to taxDeferred when taxable exhausted', () => {
    const balances: BalanceByType = {
      taxable: 20000,
      taxDeferred: 100000,
      taxFree: 50000,
    };

    const result = withdrawFromAccounts(50000, balances);

    expect(result.withdrawals.taxable).toBe(20000);
    expect(result.withdrawals.taxDeferred).toBe(30000);
    expect(result.withdrawals.taxFree).toBe(0);
    expect(result.shortfall).toBe(0);
  });

  it('should report shortfall when all accounts exhausted', () => {
    const balances: BalanceByType = {
      taxable: 10000,
      taxDeferred: 10000,
      taxFree: 10000,
    };

    const result = withdrawFromAccounts(50000, balances);

    expect(result.withdrawals.taxable).toBe(10000);
    expect(result.withdrawals.taxDeferred).toBe(10000);
    expect(result.withdrawals.taxFree).toBe(10000);
    expect(result.shortfall).toBe(20000);
  });
});

describe('runProjection', () => {
  const baseInput: ProjectionInput = {
    currentAge: 30,
    retirementAge: 65,
    maxAge: 90,
    balancesByType: { taxDeferred: 50000, taxFree: 25000, taxable: 25000 },
    annualContribution: 20000,
    contributionAllocation: { taxDeferred: 60, taxFree: 30, taxable: 10 },
    expectedReturn: 0.06,
    inflationRate: 0.025,
    contributionGrowthRate: 0,
    annualExpenses: 50000,
    annualHealthcareCosts: 6500, // Medicare-age estimate
    healthcareInflationRate: 0.05, // 5% healthcare inflation
    socialSecurityAge: 67,
    socialSecurityMonthly: 2000,
    annualDebtPayments: 0,
  };

  it('should generate correct number of records', () => {
    const result = runProjection(baseInput);

    // 30 to 90 = 61 years of records
    expect(result.records.length).toBe(61);
    expect(result.records[0].age).toBe(30);
    expect(result.records[60].age).toBe(90);
  });

  it('should accumulate during pre-retirement', () => {
    const result = runProjection(baseInput);

    // Balance should grow during accumulation phase
    const ageAt30 = result.records.find(r => r.age === 30)!;
    const ageAt64 = result.records.find(r => r.age === 64)!;

    expect(ageAt64.balance).toBeGreaterThan(ageAt30.balance);
    expect(ageAt30.inflows).toBeGreaterThan(0); // Contributions
    expect(ageAt30.outflows).toBe(0); // No withdrawals yet
  });

  it('should draw down during retirement', () => {
    const result = runProjection(baseInput);

    const ageAt65 = result.records.find(r => r.age === 65)!;
    const ageAt66 = result.records.find(r => r.age === 66)!;

    expect(ageAt65.outflows).toBeGreaterThan(0); // Expenses
    expect(ageAt66.withdrawalsByType).toBeDefined();
  });

  it('should include Social Security income after SS age', () => {
    const result = runProjection(baseInput);

    const ageAt66 = result.records.find(r => r.age === 66)!;
    const ageAt67 = result.records.find(r => r.age === 67)!;

    expect(ageAt66.inflows).toBe(0); // Before SS age
    expect(ageAt67.inflows).toBeGreaterThan(0); // After SS age
  });

  it('should reduce contributions by debt payments', () => {
    const inputWithDebt = {
      ...baseInput,
      annualDebtPayments: 10000,
    };

    const withDebt = runProjection(inputWithDebt);
    const withoutDebt = runProjection(baseInput);

    // With debt should have lower ending balance
    expect(withDebt.summary.totalContributions).toBeLessThan(withoutDebt.summary.totalContributions);
  });

  it('should handle already retired case', () => {
    const retiredInput = {
      ...baseInput,
      currentAge: 70,
      retirementAge: 65,
    };

    const result = runProjection(retiredInput);

    // Should skip accumulation, start drawdown immediately
    expect(result.records[0].age).toBe(70);
    expect(result.records[0].outflows).toBeGreaterThan(0);
    expect(result.summary.totalContributions).toBe(0);
  });

  it('should track balance by account type', () => {
    const result = runProjection(baseInput);

    const firstRecord = result.records[0];
    expect(firstRecord.balanceByType).toBeDefined();
    expect(firstRecord.balanceByType.taxDeferred).toBeGreaterThan(0);
    expect(firstRecord.balanceByType.taxFree).toBeGreaterThan(0);
    expect(firstRecord.balanceByType.taxable).toBeGreaterThan(0);
  });

  it('should provide summary statistics', () => {
    const result = runProjection(baseInput);

    expect(result.summary.startingBalance).toBe(100000);
    expect(result.summary.totalContributions).toBeGreaterThan(0);
    expect(result.summary.totalWithdrawals).toBeGreaterThan(0);
    expect(result.summary.projectedRetirementBalance).toBeGreaterThan(0);
  });

  it('should complete in under 100ms', () => {
    const start = performance.now();
    runProjection(baseInput);
    const elapsed = performance.now() - start;

    expect(elapsed).toBeLessThan(100);
  });

  it('should track yearsUntilDepletion when balance runs out', () => {
    // Create scenario where user will run out of money
    const depletingInput: ProjectionInput = {
      currentAge: 60,
      retirementAge: 65,
      maxAge: 90,
      balancesByType: { taxDeferred: 50000, taxFree: 25000, taxable: 25000 }, // Only 100k
      annualContribution: 5000,
      contributionAllocation: { taxDeferred: 60, taxFree: 30, taxable: 10 },
      expectedReturn: 0.04,
      inflationRate: 0.03,
      contributionGrowthRate: 0,
      annualExpenses: 80000, // Very high expenses
      annualHealthcareCosts: 6500,
      healthcareInflationRate: 0.05,
      socialSecurityAge: 67,
      socialSecurityMonthly: 1500,
      annualDebtPayments: 0,
    };

    const result = runProjection(depletingInput);

    // Should run out of money at some point
    expect(result.summary.yearsUntilDepletion).not.toBeNull();
    expect(result.summary.yearsUntilDepletion).toBeGreaterThan(0);

    // Verify balance goes to 0 at depletion
    const depletionYear = result.summary.yearsUntilDepletion!;
    const recordAtDepletion = result.records.find(
      r => r.age === depletingInput.currentAge + depletionYear
    );
    expect(recordAtDepletion?.balance).toBe(0);
  });

  it('should grow contributions with contributionGrowthRate', () => {
    const inputWithGrowth = {
      ...baseInput,
      contributionGrowthRate: 0.03, // 3% annual growth
    };

    const withGrowth = runProjection(inputWithGrowth);
    const withoutGrowth = runProjection(baseInput);

    // With contribution growth should have higher total contributions
    expect(withGrowth.summary.totalContributions).toBeGreaterThan(
      withoutGrowth.summary.totalContributions
    );

    // And higher retirement balance
    expect(withGrowth.summary.projectedRetirementBalance).toBeGreaterThan(
      withoutGrowth.summary.projectedRetirementBalance
    );
  });

  it('should not have negative balances even when depleted', () => {
    const depletingInput: ProjectionInput = {
      currentAge: 65,
      retirementAge: 65,
      maxAge: 90,
      balancesByType: { taxDeferred: 10000, taxFree: 5000, taxable: 5000 }, // Only 20k
      annualContribution: 0,
      contributionAllocation: { taxDeferred: 60, taxFree: 30, taxable: 10 },
      expectedReturn: 0.04,
      inflationRate: 0.02,
      contributionGrowthRate: 0,
      annualExpenses: 50000, // High expenses
      annualHealthcareCosts: 6500,
      healthcareInflationRate: 0.05,
      socialSecurityAge: 67,
      socialSecurityMonthly: 1000,
      annualDebtPayments: 0,
    };

    const result = runProjection(depletingInput);

    // All balances should be >= 0
    result.records.forEach(record => {
      expect(record.balance).toBeGreaterThanOrEqual(0);
      expect(record.balanceByType.taxDeferred).toBeGreaterThanOrEqual(0);
      expect(record.balanceByType.taxFree).toBeGreaterThanOrEqual(0);
      expect(record.balanceByType.taxable).toBeGreaterThanOrEqual(0);
    });
  });
});
