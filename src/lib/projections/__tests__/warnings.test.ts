import { describe, it, expect } from 'vitest';
import { generateProjectionWarnings } from '../warnings';
import type { ProjectionInput } from '../types';

describe('generateProjectionWarnings', () => {
  const baseInput: ProjectionInput = {
    currentAge: 35,
    retirementAge: 65,
    maxAge: 90,
    balancesByType: { taxDeferred: 50000, taxFree: 10000, taxable: 5000 },
    annualContribution: 10000,
    contributionAllocation: { taxDeferred: 60, taxFree: 30, taxable: 10 },
    expectedReturn: 0.06,
    inflationRate: 0.025,
    contributionGrowthRate: 0,
    annualExpenses: 50000,
    annualHealthcareCosts: 6500,
    healthcareInflationRate: 0.05,
    incomeStreams: [],
    annualDebtPayments: 0,
  };

  it('should warn for high inflation (> 8%)', () => {
    const input = { ...baseInput, inflationRate: 0.10 };
    const warnings = generateProjectionWarnings(input);
    expect(warnings).toContainEqual(expect.objectContaining({
      field: 'inflationRate',
      severity: 'warning',
    }));
    expect(warnings.find(w => w.field === 'inflationRate')?.message).toContain('10.0%');
  });

  it('should warn for zero savings and zero contributions', () => {
    const input = {
      ...baseInput,
      balancesByType: { taxDeferred: 0, taxFree: 0, taxable: 0 },
      annualContribution: 0,
    };
    const warnings = generateProjectionWarnings(input);
    expect(warnings).toContainEqual(expect.objectContaining({
      field: 'savings',
      severity: 'warning',
    }));
  });

  it('should warn for low expected return (< 2%)', () => {
    const input = { ...baseInput, expectedReturn: 0.01 };
    const warnings = generateProjectionWarnings(input);
    expect(warnings).toContainEqual(expect.objectContaining({
      field: 'expectedReturn',
      severity: 'info',
    }));
    expect(warnings.find(w => w.field === 'expectedReturn')?.message).toContain('1.0%');
  });

  it('should warn when debt payments exceed contributions', () => {
    const input = {
      ...baseInput,
      annualContribution: 5000,
      annualDebtPayments: 10000,
    };
    const warnings = generateProjectionWarnings(input);
    expect(warnings).toContainEqual(expect.objectContaining({
      field: 'debt',
      severity: 'info',
    }));
  });

  it('should warn for short retirement horizon (<= 5 years)', () => {
    const input = {
      ...baseInput,
      currentAge: 62,
      retirementAge: 65,
    };
    const warnings = generateProjectionWarnings(input);
    expect(warnings).toContainEqual(expect.objectContaining({
      field: 'retirementAge',
      severity: 'info',
    }));
    expect(warnings.find(w => w.field === 'retirementAge')?.message).toContain('3 years');
  });

  it('should handle singular year in short retirement warning', () => {
    const input = {
      ...baseInput,
      currentAge: 64,
      retirementAge: 65,
    };
    const warnings = generateProjectionWarnings(input);
    const retirementWarning = warnings.find(w => w.field === 'retirementAge');
    expect(retirementWarning?.message).toContain('1 year');
    expect(retirementWarning?.message).not.toContain('1 years');
  });

  it('should not warn for typical inputs', () => {
    const warnings = generateProjectionWarnings(baseInput);
    expect(warnings).toHaveLength(0);
  });

  it('should not warn for zero expected return at boundary', () => {
    // Zero return should trigger the warning (it's < 2%)
    const input = { ...baseInput, expectedReturn: 0 };
    const warnings = generateProjectionWarnings(input);
    expect(warnings).toContainEqual(expect.objectContaining({
      field: 'expectedReturn',
      severity: 'info',
    }));
  });

  it('should not warn for exactly 2% return', () => {
    const input = { ...baseInput, expectedReturn: 0.02 };
    const warnings = generateProjectionWarnings(input);
    expect(warnings.find(w => w.field === 'expectedReturn')).toBeUndefined();
  });

  it('should not warn for exactly 8% inflation', () => {
    const input = { ...baseInput, inflationRate: 0.08 };
    const warnings = generateProjectionWarnings(input);
    expect(warnings.find(w => w.field === 'inflationRate')).toBeUndefined();
  });

  it('should not warn when contributions exceed debt payments', () => {
    const input = {
      ...baseInput,
      annualContribution: 10000,
      annualDebtPayments: 5000,
    };
    const warnings = generateProjectionWarnings(input);
    expect(warnings.find(w => w.field === 'debt')).toBeUndefined();
  });

  it('should not warn for retirement more than 5 years away', () => {
    const input = {
      ...baseInput,
      currentAge: 35,
      retirementAge: 65,
    };
    const warnings = generateProjectionWarnings(input);
    expect(warnings.find(w => w.field === 'retirementAge')).toBeUndefined();
  });
});
