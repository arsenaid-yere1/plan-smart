import { describe, it, expect } from 'vitest';
import {
  calculateGuaranteedIncome,
  calculateIncomeFloor,
  hasGuaranteedIncome,
} from '../income-floor';
import type { IncomeStream, ProjectionInput } from '../types';

describe('calculateGuaranteedIncome', () => {
  const baseStreams: IncomeStream[] = [
    {
      id: '1',
      name: 'Social Security',
      type: 'social_security',
      annualAmount: 24000,
      startAge: 67,
      inflationAdjusted: true,
      isGuaranteed: true,
    },
    {
      id: '2',
      name: 'Rental Income',
      type: 'rental',
      annualAmount: 12000,
      startAge: 65,
      inflationAdjusted: false,
      isGuaranteed: false,
    },
    {
      id: '3',
      name: 'Pension',
      type: 'pension',
      annualAmount: 18000,
      startAge: 65,
      inflationAdjusted: true,
      isGuaranteed: true,
    },
  ];

  it('should sum only guaranteed income streams', () => {
    const result = calculateGuaranteedIncome(baseStreams, 67, 1.0);
    // SS ($24,000) + Pension ($18,000) = $42,000
    expect(result).toBe(42000);
  });

  it('should exclude streams not yet started', () => {
    const result = calculateGuaranteedIncome(baseStreams, 65, 1.0);
    // Only Pension ($18,000) is active at 65, SS starts at 67
    expect(result).toBe(18000);
  });

  it('should apply inflation to inflation-adjusted streams', () => {
    const result = calculateGuaranteedIncome(baseStreams, 67, 1.1); // 10% inflation
    // SS: $24,000 * 1.1 = $26,400, Pension: $18,000 * 1.1 = $19,800
    expect(result).toBe(46200);
  });

  it('should return 0 when no guaranteed streams exist', () => {
    const variableOnly = baseStreams.filter(s => !s.isGuaranteed);
    const result = calculateGuaranteedIncome(variableOnly, 67, 1.0);
    expect(result).toBe(0);
  });
});

describe('calculateIncomeFloor', () => {
  const baseInput: ProjectionInput = {
    currentAge: 55,
    retirementAge: 65,
    maxAge: 90,
    balancesByType: { taxDeferred: 500000, taxFree: 100000, taxable: 50000 },
    annualContribution: 20000,
    contributionAllocation: { taxDeferred: 60, taxFree: 30, taxable: 10 },
    expectedReturn: 0.06,
    inflationRate: 0.025,
    contributionGrowthRate: 0,
    annualEssentialExpenses: 36000,
    annualDiscretionaryExpenses: 12000,
    annualExpenses: 48000,
    annualHealthcareCosts: 6000,
    healthcareInflationRate: 0.05,
    incomeStreams: [
      {
        id: '1',
        name: 'Social Security',
        type: 'social_security',
        annualAmount: 24000,
        startAge: 67,
        inflationAdjusted: true,
        isGuaranteed: true,
      },
      {
        id: '2',
        name: 'Pension',
        type: 'pension',
        annualAmount: 18000,
        startAge: 65,
        inflationAdjusted: true,
        isGuaranteed: true,
      },
    ],
    annualDebtPayments: 0,
  };

  it('should calculate floor established when guaranteed exceeds essential', () => {
    const result = calculateIncomeFloor(baseInput);

    // At age 67: SS ($24k) + Pension ($18k) = $42k guaranteed
    // Essential expenses at 65 (retirement): $36k
    // Floor should be established at 65 when pension starts ($18k < $36k)
    // Actually floor established at 67 when SS starts
    expect(result.isFloorEstablished).toBe(true);
    expect(result.floorEstablishedAge).toBe(67);
    expect(result.status).toBe('fully-covered');
  });

  it('should return partial when guaranteed covers 50-99% of essential', () => {
    const partialInput = {
      ...baseInput,
      annualEssentialExpenses: 60000, // Increase essential expenses
      incomeStreams: [
        {
          id: '1',
          name: 'Pension',
          type: 'pension' as const,
          annualAmount: 36000, // 60% coverage
          startAge: 65,
          inflationAdjusted: true,
          isGuaranteed: true,
        },
      ],
    };

    const result = calculateIncomeFloor(partialInput);
    expect(result.status).toBe('partial');
    expect(result.coverageRatioAtRetirement).toBeCloseTo(0.6, 1);
  });

  it('should return insufficient when guaranteed covers <50% of essential', () => {
    const insufficientInput = {
      ...baseInput,
      annualEssentialExpenses: 100000, // High essential expenses
      incomeStreams: [
        {
          id: '1',
          name: 'Small Pension',
          type: 'pension' as const,
          annualAmount: 20000, // 20% coverage
          startAge: 65,
          inflationAdjusted: true,
          isGuaranteed: true,
        },
      ],
    };

    const result = calculateIncomeFloor(insufficientInput);
    expect(result.status).toBe('insufficient');
    expect(result.isFloorEstablished).toBe(false);
  });

  it('should handle zero essential expenses gracefully', () => {
    const zeroExpenses = {
      ...baseInput,
      annualEssentialExpenses: 0,
    };

    const result = calculateIncomeFloor(zeroExpenses);
    expect(result.status).toBe('fully-covered');
    expect(result.coverageRatioAtRetirement).toBe(Infinity);
  });
});

describe('hasGuaranteedIncome', () => {
  it('should return true when guaranteed streams exist', () => {
    const streams: IncomeStream[] = [
      { id: '1', name: 'SS', type: 'social_security', annualAmount: 24000, startAge: 67, inflationAdjusted: true, isGuaranteed: true },
    ];
    expect(hasGuaranteedIncome(streams)).toBe(true);
  });

  it('should return false when no guaranteed streams exist', () => {
    const streams: IncomeStream[] = [
      { id: '1', name: 'Rental', type: 'rental', annualAmount: 12000, startAge: 65, inflationAdjusted: false, isGuaranteed: false },
    ];
    expect(hasGuaranteedIncome(streams)).toBe(false);
  });

  it('should return false for empty streams', () => {
    expect(hasGuaranteedIncome([])).toBe(false);
  });
});
