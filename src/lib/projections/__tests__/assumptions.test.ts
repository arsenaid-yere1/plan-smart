import { describe, it, expect } from 'vitest';
import {
  estimateSocialSecurityMonthly,
  deriveAnnualExpenses,
  estimateAnnualDebtPayments,
  estimateHealthcareCosts,
  SSA_MAX_MONTHLY_BENEFIT,
  DEFAULT_HEALTHCARE_COSTS_BY_AGE,
} from '../assumptions';

describe('estimateSocialSecurityMonthly', () => {
  it('should estimate ~55% replacement for low income', () => {
    const monthly = estimateSocialSecurityMonthly(25000);
    const annualized = monthly * 12;
    const replacement = annualized / 25000;

    expect(replacement).toBeGreaterThan(0.40);
    expect(replacement).toBeLessThan(0.50); // After 20% haircut
  });

  it('should estimate ~40% replacement for middle income', () => {
    const monthly = estimateSocialSecurityMonthly(60000);
    const annualized = monthly * 12;
    const replacement = annualized / 60000;

    expect(replacement).toBeGreaterThan(0.25);
    expect(replacement).toBeLessThan(0.40);
  });

  it('should cap at SSA maximum', () => {
    const monthly = estimateSocialSecurityMonthly(500000);

    expect(monthly).toBeLessThanOrEqual(SSA_MAX_MONTHLY_BENEFIT);
  });

  it('should return 0 for 0 income', () => {
    const monthly = estimateSocialSecurityMonthly(0);

    expect(monthly).toBe(0);
  });
});

describe('deriveAnnualExpenses', () => {
  it('should calculate spending as income minus savings', () => {
    const expenses = deriveAnnualExpenses(100000, 20);

    expect(expenses).toBe(80000);
  });

  it('should cap at 80% of income', () => {
    const expenses = deriveAnnualExpenses(100000, 5);

    expect(expenses).toBe(80000); // Capped, not 95000
  });

  it('should handle 0% savings rate', () => {
    const expenses = deriveAnnualExpenses(100000, 0);

    expect(expenses).toBe(80000); // Capped at 80%
  });
});

describe('estimateAnnualDebtPayments', () => {
  it('should calculate payments for single debt', () => {
    const debts = [{ balance: 10000, interestRate: 5 }];
    const annual = estimateAnnualDebtPayments(debts);

    // 10-year amortization at 5%
    expect(annual).toBeGreaterThan(1200);
    expect(annual).toBeLessThan(1400);
  });

  it('should sum payments for multiple debts', () => {
    const debts = [
      { balance: 10000, interestRate: 5 },
      { balance: 20000, interestRate: 7 },
    ];
    const annual = estimateAnnualDebtPayments(debts);

    expect(annual).toBeGreaterThan(3500);
  });

  it('should use default 5% rate when not specified', () => {
    const withRate = estimateAnnualDebtPayments([{ balance: 10000, interestRate: 5 }]);
    const withoutRate = estimateAnnualDebtPayments([{ balance: 10000 }]);

    expect(withRate).toBe(withoutRate);
  });

  it('should return 0 for empty debts', () => {
    const annual = estimateAnnualDebtPayments([]);

    expect(annual).toBe(0);
  });
});

describe('estimateHealthcareCosts', () => {
  it('should return pre-Medicare rate for age under 65', () => {
    expect(estimateHealthcareCosts(50)).toBe(DEFAULT_HEALTHCARE_COSTS_BY_AGE['under65']);
    expect(estimateHealthcareCosts(64)).toBe(DEFAULT_HEALTHCARE_COSTS_BY_AGE['under65']);
  });

  it('should return early Medicare rate for ages 65-74', () => {
    expect(estimateHealthcareCosts(65)).toBe(DEFAULT_HEALTHCARE_COSTS_BY_AGE['65to74']);
    expect(estimateHealthcareCosts(70)).toBe(DEFAULT_HEALTHCARE_COSTS_BY_AGE['65to74']);
    expect(estimateHealthcareCosts(74)).toBe(DEFAULT_HEALTHCARE_COSTS_BY_AGE['65to74']);
  });

  it('should return late retirement rate for ages 75+', () => {
    expect(estimateHealthcareCosts(75)).toBe(DEFAULT_HEALTHCARE_COSTS_BY_AGE['75plus']);
    expect(estimateHealthcareCosts(85)).toBe(DEFAULT_HEALTHCARE_COSTS_BY_AGE['75plus']);
    expect(estimateHealthcareCosts(100)).toBe(DEFAULT_HEALTHCARE_COSTS_BY_AGE['75plus']);
  });

  it('should return higher costs for 75+ than 65-74 (increased medical needs)', () => {
    expect(estimateHealthcareCosts(75)).toBeGreaterThan(estimateHealthcareCosts(65));
  });
});
