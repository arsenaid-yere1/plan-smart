import { describe, it, expect } from 'vitest';
import {
  runProjection,
  withdrawFromAccounts,
  calculatePhaseAdjustedExpenses,
} from '../engine';
import type { ProjectionInput, BalanceByType, SpendingPhaseConfig } from '../types';

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
    annualEssentialExpenses: 35000,
    annualDiscretionaryExpenses: 15000,
    annualExpenses: 50000,
    annualHealthcareCosts: 6500, // Medicare-age estimate
    healthcareInflationRate: 0.05, // 5% healthcare inflation
    incomeStreams: [
      {
        id: 'ss',
        name: 'Social Security',
        type: 'social_security',
        annualAmount: 24000, // 2000 * 12
        startAge: 67,
        endAge: undefined,
        inflationAdjusted: true,
        isGuaranteed: true,
      },
    ],
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
      annualEssentialExpenses: 60000,
      annualDiscretionaryExpenses: 20000,
      annualExpenses: 80000, // Very high expenses
      annualHealthcareCosts: 6500,
      healthcareInflationRate: 0.05,
      incomeStreams: [
        {
          id: 'ss',
          name: 'Social Security',
          type: 'social_security',
          annualAmount: 18000, // 1500 * 12
          startAge: 67,
          endAge: undefined,
          inflationAdjusted: true,
          isGuaranteed: true,
        },
      ],
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
      annualEssentialExpenses: 35000,
      annualDiscretionaryExpenses: 15000,
      annualExpenses: 50000, // High expenses
      annualHealthcareCosts: 6500,
      healthcareInflationRate: 0.05,
      incomeStreams: [
        {
          id: 'ss',
          name: 'Social Security',
          type: 'social_security',
          annualAmount: 12000, // 1000 * 12
          startAge: 67,
          endAge: undefined,
          inflationAdjusted: true,
          isGuaranteed: true,
        },
      ],
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

describe('runProjection - Income Streams', () => {
  const baseInputForIncomeTests: ProjectionInput = {
    currentAge: 60,
    retirementAge: 65,
    maxAge: 85,
    balancesByType: { taxDeferred: 500000, taxFree: 200000, taxable: 100000 },
    annualContribution: 20000,
    contributionAllocation: { taxDeferred: 60, taxFree: 30, taxable: 10 },
    expectedReturn: 0.05,
    inflationRate: 0.025,
    contributionGrowthRate: 0,
    annualEssentialExpenses: 40000,
    annualDiscretionaryExpenses: 20000,
    annualExpenses: 60000,
    annualHealthcareCosts: 8000,
    healthcareInflationRate: 0.05,
    incomeStreams: [],
    annualDebtPayments: 0,
  };

  it('should handle multiple income streams with different start ages', () => {
    const inputWithMultipleStreams: ProjectionInput = {
      ...baseInputForIncomeTests,
      incomeStreams: [
        {
          id: 'ss',
          name: 'Social Security',
          type: 'social_security',
          annualAmount: 24000,
          startAge: 67,
          endAge: undefined,
          inflationAdjusted: true,
          isGuaranteed: true,
        },
        {
          id: 'pension',
          name: 'Corporate Pension',
          type: 'pension',
          annualAmount: 30000,
          startAge: 65,
          endAge: undefined,
          inflationAdjusted: false,
          isGuaranteed: true,
        },
      ],
    };

    const result = runProjection(inputWithMultipleStreams);

    // At age 65, only pension should be active
    const ageAt65 = result.records.find(r => r.age === 65)!;
    expect(ageAt65.inflows).toBe(30000); // Only pension

    // At age 67, both streams should be active
    const ageAt67 = result.records.find(r => r.age === 67)!;
    // SS is inflation-adjusted after 2 years (65->67), pension is not
    // SS base = 24000, inflation = 1.025^2 = 1.050625, so SS ~= 25215
    expect(ageAt67.inflows).toBeGreaterThan(50000); // Both SS and pension
    expect(ageAt67.inflows).toBeLessThan(60000); // But not too much more
  });

  it('should handle income streams with end ages', () => {
    const inputWithEndAge: ProjectionInput = {
      ...baseInputForIncomeTests,
      incomeStreams: [
        {
          id: 'part-time',
          name: 'Part-Time Consulting',
          type: 'part_time',
          annualAmount: 40000,
          startAge: 65,
          endAge: 70,
          inflationAdjusted: false,
          isGuaranteed: false,
        },
        {
          id: 'ss',
          name: 'Social Security',
          type: 'social_security',
          annualAmount: 24000,
          startAge: 70,
          endAge: undefined,
          inflationAdjusted: true,
          isGuaranteed: true,
        },
      ],
    };

    const result = runProjection(inputWithEndAge);

    // At age 65-70, part-time work should be active
    const ageAt66 = result.records.find(r => r.age === 66)!;
    expect(ageAt66.inflows).toBe(40000); // Part-time only

    // At age 70, both should be active (last year of part-time + SS starts)
    const ageAt70 = result.records.find(r => r.age === 70)!;
    expect(ageAt70.inflows).toBeGreaterThan(40000); // Part-time + SS

    // At age 71, only SS should be active (part-time ended)
    const ageAt71 = result.records.find(r => r.age === 71)!;
    expect(ageAt71.inflows).toBeLessThan(40000); // Only SS (inflation-adjusted)
    expect(ageAt71.inflows).toBeGreaterThan(24000); // More than base due to inflation
  });

  it('should correctly apply inflation adjustment only to marked streams', () => {
    const inputWithMixedInflation: ProjectionInput = {
      ...baseInputForIncomeTests,
      inflationRate: 0.03, // 3% inflation for easier calculation
      incomeStreams: [
        {
          id: 'ss',
          name: 'Social Security',
          type: 'social_security',
          annualAmount: 20000,
          startAge: 65,
          endAge: undefined,
          inflationAdjusted: true, // Will grow with inflation
          isGuaranteed: true,
        },
        {
          id: 'pension',
          name: 'Fixed Pension',
          type: 'pension',
          annualAmount: 20000,
          startAge: 65,
          endAge: undefined,
          inflationAdjusted: false, // Will stay fixed
          isGuaranteed: true,
        },
      ],
    };

    const result = runProjection(inputWithMixedInflation);

    // At age 65, both should be base amounts
    const ageAt65 = result.records.find(r => r.age === 65)!;
    expect(ageAt65.inflows).toBe(40000);

    // At age 75 (10 years later), inflation should have increased SS
    const ageAt75 = result.records.find(r => r.age === 75)!;
    // Pension stays 20000, SS grows: 20000 * (1.03)^10 ≈ 26878
    // Total should be around 46878
    expect(ageAt75.inflows).toBeGreaterThan(45000);
    expect(ageAt75.inflows).toBeLessThan(50000);
    // Fixed pension (20000) + inflation-adjusted SS (~26878) ≈ 46878
  });

  it('should handle empty income streams array', () => {
    const inputWithNoStreams: ProjectionInput = {
      ...baseInputForIncomeTests,
      incomeStreams: [],
    };

    const result = runProjection(inputWithNoStreams);

    // All retirement years should have 0 income
    const ageAt70 = result.records.find(r => r.age === 70)!;
    expect(ageAt70.inflows).toBe(0);

    // Should still generate valid projection
    expect(result.records.length).toBeGreaterThan(0);
    expect(result.summary.totalWithdrawals).toBeGreaterThan(0);
  });

  it('should handle rental income with end age', () => {
    const inputWithRental: ProjectionInput = {
      ...baseInputForIncomeTests,
      incomeStreams: [
        {
          id: 'rental',
          name: 'Rental Property',
          type: 'rental',
          annualAmount: 36000, // $3000/month
          startAge: 65,
          endAge: 75, // Sell property at 75
          inflationAdjusted: true,
          isGuaranteed: false,
        },
        {
          id: 'ss',
          name: 'Social Security',
          type: 'social_security',
          annualAmount: 24000,
          startAge: 67,
          endAge: undefined,
          inflationAdjusted: true,
          isGuaranteed: true,
        },
      ],
    };

    const result = runProjection(inputWithRental);

    // At age 74, rental should still be active
    const ageAt74 = result.records.find(r => r.age === 74)!;
    expect(ageAt74.inflows).toBeGreaterThan(55000); // Rental + SS (both inflation-adjusted)

    // At age 76, rental should have ended
    const ageAt76 = result.records.find(r => r.age === 76)!;
    expect(ageAt76.inflows).toBeLessThan(40000); // Only SS
    expect(ageAt76.inflows).toBeGreaterThan(24000); // But more than base due to inflation
  });

  it('should reduce withdrawals when income streams cover expenses', () => {
    // High income streams should reduce need to withdraw from savings
    const inputHighIncome: ProjectionInput = {
      ...baseInputForIncomeTests,
      annualEssentialExpenses: 35000,
      annualDiscretionaryExpenses: 15000,
      annualExpenses: 50000,
      annualHealthcareCosts: 5000,
      incomeStreams: [
        {
          id: 'pension',
          name: 'Generous Pension',
          type: 'pension',
          annualAmount: 60000, // Covers expenses + healthcare
          startAge: 65,
          endAge: undefined,
          inflationAdjusted: true,
          isGuaranteed: true,
        },
      ],
    };

    const inputNoIncome: ProjectionInput = {
      ...baseInputForIncomeTests,
      annualEssentialExpenses: 35000,
      annualDiscretionaryExpenses: 15000,
      annualExpenses: 50000,
      annualHealthcareCosts: 5000,
      incomeStreams: [],
    };

    const resultHighIncome = runProjection(inputHighIncome);
    const resultNoIncome = runProjection(inputNoIncome);

    // With high income, should have lower total withdrawals
    expect(resultHighIncome.summary.totalWithdrawals).toBeLessThan(
      resultNoIncome.summary.totalWithdrawals
    );

    // With generous pension covering all expenses, withdrawals should be minimal
    // (only for any gap or healthcare inflation exceeding pension growth)
    expect(resultHighIncome.summary.totalWithdrawals).toBeLessThan(100000);
  });

  it('should handle annuity income type', () => {
    const inputWithAnnuity: ProjectionInput = {
      ...baseInputForIncomeTests,
      incomeStreams: [
        {
          id: 'annuity',
          name: 'Fixed Annuity',
          type: 'annuity',
          annualAmount: 25000,
          startAge: 70, // Deferred annuity
          endAge: undefined,
          inflationAdjusted: false,
          isGuaranteed: true,
        },
      ],
    };

    const result = runProjection(inputWithAnnuity);

    // Before annuity starts (age 65-69), no income
    const ageAt68 = result.records.find(r => r.age === 68)!;
    expect(ageAt68.inflows).toBe(0);

    // After annuity starts, should have fixed income
    const ageAt72 = result.records.find(r => r.age === 72)!;
    expect(ageAt72.inflows).toBe(25000); // Fixed amount, no inflation
  });
});

describe('calculatePhaseAdjustedExpenses', () => {
  const baseEssential = 40000;
  const baseDiscretionary = 20000;

  it('should return base amounts when config is undefined', () => {
    const result = calculatePhaseAdjustedExpenses(
      70,
      baseEssential,
      baseDiscretionary,
      undefined
    );

    expect(result.essential).toBe(baseEssential);
    expect(result.discretionary).toBe(baseDiscretionary);
    expect(result.activePhase).toBeNull();
  });

  it('should return base amounts when config is disabled', () => {
    const config: SpendingPhaseConfig = {
      enabled: false,
      phases: [
        {
          id: 'phase-1',
          name: 'Go-Go',
          startAge: 65,
          essentialMultiplier: 1.0,
          discretionaryMultiplier: 1.5,
        },
      ],
    };

    const result = calculatePhaseAdjustedExpenses(70, baseEssential, baseDiscretionary, config);

    expect(result.essential).toBe(baseEssential);
    expect(result.discretionary).toBe(baseDiscretionary);
    expect(result.activePhase).toBeNull();
  });

  it('should apply multipliers for active phase', () => {
    const config: SpendingPhaseConfig = {
      enabled: true,
      phases: [
        {
          id: 'go-go',
          name: 'Go-Go Years',
          startAge: 65,
          essentialMultiplier: 1.0,
          discretionaryMultiplier: 1.5,
        },
      ],
    };

    const result = calculatePhaseAdjustedExpenses(70, baseEssential, baseDiscretionary, config);

    expect(result.essential).toBe(40000); // 40000 * 1.0
    expect(result.discretionary).toBe(30000); // 20000 * 1.5
    expect(result.activePhase?.id).toBe('go-go');
    expect(result.activePhase?.name).toBe('Go-Go Years');
  });

  it('should select correct phase based on age', () => {
    const config: SpendingPhaseConfig = {
      enabled: true,
      phases: [
        {
          id: 'go-go',
          name: 'Go-Go Years',
          startAge: 65,
          essentialMultiplier: 1.0,
          discretionaryMultiplier: 1.5,
        },
        {
          id: 'slow-go',
          name: 'Slow-Go Years',
          startAge: 75,
          essentialMultiplier: 1.0,
          discretionaryMultiplier: 1.0,
        },
        {
          id: 'no-go',
          name: 'No-Go Years',
          startAge: 85,
          essentialMultiplier: 1.1,
          discretionaryMultiplier: 0.5,
        },
      ],
    };

    // Age 70 - should be in Go-Go phase
    const goGoResult = calculatePhaseAdjustedExpenses(70, baseEssential, baseDiscretionary, config);
    expect(goGoResult.activePhase?.id).toBe('go-go');
    expect(goGoResult.discretionary).toBe(30000); // 20000 * 1.5

    // Age 80 - should be in Slow-Go phase
    const slowGoResult = calculatePhaseAdjustedExpenses(80, baseEssential, baseDiscretionary, config);
    expect(slowGoResult.activePhase?.id).toBe('slow-go');
    expect(slowGoResult.discretionary).toBe(20000); // 20000 * 1.0

    // Age 90 - should be in No-Go phase
    const noGoResult = calculatePhaseAdjustedExpenses(90, baseEssential, baseDiscretionary, config);
    expect(noGoResult.activePhase?.id).toBe('no-go');
    expect(noGoResult.essential).toBe(44000); // 40000 * 1.1
    expect(noGoResult.discretionary).toBe(10000); // 20000 * 0.5
  });

  it('should use absolute amounts when specified (override multipliers)', () => {
    const config: SpendingPhaseConfig = {
      enabled: true,
      phases: [
        {
          id: 'go-go',
          name: 'Go-Go Years',
          startAge: 65,
          essentialMultiplier: 1.0,
          discretionaryMultiplier: 1.5,
          absoluteEssential: 50000,
          absoluteDiscretionary: 35000,
        },
      ],
    };

    const result = calculatePhaseAdjustedExpenses(70, baseEssential, baseDiscretionary, config);

    // Absolute amounts should take precedence
    expect(result.essential).toBe(50000);
    expect(result.discretionary).toBe(35000);
  });

  it('should handle discretionary multiplier of 0 (no discretionary spending)', () => {
    const config: SpendingPhaseConfig = {
      enabled: true,
      phases: [
        {
          id: 'no-go',
          name: 'No-Go Years',
          startAge: 85,
          essentialMultiplier: 1.0,
          discretionaryMultiplier: 0,
        },
      ],
    };

    const result = calculatePhaseAdjustedExpenses(90, baseEssential, baseDiscretionary, config);

    expect(result.essential).toBe(40000);
    expect(result.discretionary).toBe(0);
  });

  it('should return base amounts when age is before all phases', () => {
    const config: SpendingPhaseConfig = {
      enabled: true,
      phases: [
        {
          id: 'go-go',
          name: 'Go-Go Years',
          startAge: 65,
          essentialMultiplier: 1.0,
          discretionaryMultiplier: 1.5,
        },
      ],
    };

    // Age 60 is before retirement/phase start
    const result = calculatePhaseAdjustedExpenses(60, baseEssential, baseDiscretionary, config);

    expect(result.essential).toBe(baseEssential);
    expect(result.discretionary).toBe(baseDiscretionary);
    expect(result.activePhase).toBeNull();
  });
});

describe('runProjection - Phase-Based Spending', () => {
  const baseInputForPhaseTests: ProjectionInput = {
    currentAge: 65,
    retirementAge: 65,
    maxAge: 75,
    balancesByType: { taxDeferred: 500000, taxFree: 200000, taxable: 100000 },
    annualContribution: 0,
    contributionAllocation: { taxDeferred: 60, taxFree: 30, taxable: 10 },
    expectedReturn: 0.05,
    inflationRate: 0.025,
    contributionGrowthRate: 0,
    annualEssentialExpenses: 40000,
    annualDiscretionaryExpenses: 20000,
    annualExpenses: 60000,
    annualHealthcareCosts: 8000,
    healthcareInflationRate: 0.05,
    incomeStreams: [],
    annualDebtPayments: 0,
  };

  it('should produce different outflows with phases enabled vs disabled', () => {
    // Without phases (flat spending)
    const flatResult = runProjection(baseInputForPhaseTests);

    // With phases (higher discretionary in early years)
    const phasedInput: ProjectionInput = {
      ...baseInputForPhaseTests,
      spendingPhaseConfig: {
        enabled: true,
        phases: [
          {
            id: 'go-go',
            name: 'Go-Go Years',
            startAge: 65,
            essentialMultiplier: 1.0,
            discretionaryMultiplier: 1.5, // 50% more discretionary spending
          },
        ],
      },
    };
    const phasedResult = runProjection(phasedInput);

    // First year outflows should differ
    const flatFirstYear = flatResult.records[0];
    const phasedFirstYear = phasedResult.records[0];

    // Phased spending should have higher outflows
    // Flat: 40000 + 20000 + 8000 = 68000
    // Phased: 40000 + 30000 + 8000 = 78000
    expect(phasedFirstYear.outflows).toBeGreaterThan(flatFirstYear.outflows);

    // Ending balance should be lower with higher early spending
    expect(phasedResult.summary.endingBalance).toBeLessThan(flatResult.summary.endingBalance);
  });

  it('should transition between phases at correct ages', () => {
    const input: ProjectionInput = {
      ...baseInputForPhaseTests,
      maxAge: 90,
      balancesByType: { taxDeferred: 1000000, taxFree: 500000, taxable: 500000 },
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
          {
            id: 'no-go',
            name: 'No-Go',
            startAge: 85,
            essentialMultiplier: 1.0,
            discretionaryMultiplier: 0.5,
          },
        ],
      },
    };

    const result = runProjection(input);

    // Age 65-74 should be Go-Go phase
    const age70Record = result.records.find(r => r.age === 70);
    expect(age70Record?.activePhaseId).toBe('go-go');
    expect(age70Record?.activePhaseName).toBe('Go-Go');

    // Age 75-84 should be Slow-Go phase
    const age80Record = result.records.find(r => r.age === 80);
    expect(age80Record?.activePhaseId).toBe('slow-go');
    expect(age80Record?.activePhaseName).toBe('Slow-Go');

    // Age 85+ should be No-Go phase
    const age88Record = result.records.find(r => r.age === 88);
    expect(age88Record?.activePhaseId).toBe('no-go');
    expect(age88Record?.activePhaseName).toBe('No-Go');
  });

  it('should record expense breakdown in records', () => {
    const input: ProjectionInput = {
      ...baseInputForPhaseTests,
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
    };

    const result = runProjection(input);
    const firstRecord = result.records[0];

    // Should have expense breakdown
    expect(firstRecord.essentialExpenses).toBeDefined();
    expect(firstRecord.discretionaryExpenses).toBeDefined();

    // Essential should be base amount (no multiplier change)
    expect(firstRecord.essentialExpenses).toBe(40000);

    // Discretionary should have 1.5x multiplier
    expect(firstRecord.discretionaryExpenses).toBe(30000);
  });

  it('should fall back to flat spending when phases disabled', () => {
    const input: ProjectionInput = {
      ...baseInputForPhaseTests,
      spendingPhaseConfig: {
        enabled: false, // Disabled
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
    };

    const result = runProjection(input);
    const firstRecord = result.records[0];

    // Should NOT have phase info
    expect(firstRecord.activePhaseId).toBeUndefined();
    expect(firstRecord.activePhaseName).toBeUndefined();

    // Expenses should be base amounts (no multiplier)
    expect(firstRecord.essentialExpenses).toBe(40000);
    expect(firstRecord.discretionaryExpenses).toBe(20000);
  });

  it('should apply inflation to phase-adjusted expenses', () => {
    const input: ProjectionInput = {
      ...baseInputForPhaseTests,
      inflationRate: 0.03, // 3% inflation
      annualHealthcareCosts: 0, // Zero healthcare to simplify test
      spendingPhaseConfig: {
        enabled: true,
        phases: [
          {
            id: 'go-go',
            name: 'Go-Go',
            startAge: 65,
            essentialMultiplier: 1.0,
            discretionaryMultiplier: 1.0,
          },
        ],
      },
    };

    const result = runProjection(input);

    // Year 0 (age 65): no inflation yet
    expect(result.records[0].outflows).toBe(60000);

    // Year 1 (age 66): 3% inflation
    const expectedYear1 = 60000 * 1.03;
    expect(result.records[1].outflows).toBeCloseTo(expectedYear1, 0);

    // Year 2 (age 67): 3% compounded
    const expectedYear2 = 60000 * Math.pow(1.03, 2);
    expect(result.records[2].outflows).toBeCloseTo(expectedYear2, 0);
  });

  it('should not apply spending phases during accumulation', () => {
    const input: ProjectionInput = {
      ...baseInputForPhaseTests,
      currentAge: 30,
      retirementAge: 65,
      maxAge: 70,
      balancesByType: { taxDeferred: 50000, taxFree: 25000, taxable: 25000 },
      annualContribution: 20000,
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
    };

    const result = runProjection(input);

    // Check accumulation years (before retirement)
    const age40Record = result.records.find(r => r.age === 40);
    expect(age40Record?.activePhaseId).toBeUndefined();
    expect(age40Record?.activePhaseName).toBeUndefined();
    expect(age40Record?.outflows).toBe(0); // No expenses during accumulation
  });
});
