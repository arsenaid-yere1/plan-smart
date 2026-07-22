import type { ProjectionInput, ProjectionResult } from './types';

export interface ProjectionWarning {
  field: string;
  message: string;
  severity: 'info' | 'warning';
}

/**
 * Generate warnings for unusual but valid projection inputs
 */
export function generateProjectionWarnings(
  input: ProjectionInput,
  result?: ProjectionResult
): ProjectionWarning[] {
  const warnings: ProjectionWarning[] = [];

  // Very high inflation warning (> 8%)
  if (input.inflationRate > 0.08) {
    warnings.push({
      field: 'inflationRate',
      message: `Inflation rate of ${(input.inflationRate * 100).toFixed(1)}% is higher than historical averages. Consider using a more conservative estimate (2-4% is typical).`,
      severity: 'warning',
    });
  }

  // Very low expected return warning (< 2%)
  if (input.expectedReturn < 0.02 && input.expectedReturn >= 0) {
    warnings.push({
      field: 'expectedReturn',
      message: `Expected return of ${(input.expectedReturn * 100).toFixed(1)}% is quite conservative. Historical stock market returns average 7-10% before inflation.`,
      severity: 'info',
    });
  }

  // Zero savings with zero contributions warning
  const totalBalance = input.balancesByType.taxDeferred + input.balancesByType.taxFree + input.balancesByType.taxable;
  if (totalBalance === 0 && input.annualContribution === 0) {
    warnings.push({
      field: 'savings',
      message: 'Starting with no savings and no contributions will result in relying entirely on other income sources in retirement.',
      severity: 'warning',
    });
  }

  // High debt relative to contributions warning
  if (input.annualDebtPayments > 0 && input.annualContribution > 0) {
    const netContribution = input.annualContribution - input.annualDebtPayments;
    if (netContribution <= 0) {
      warnings.push({
        field: 'debt',
        message: 'Your debt payments exceed your retirement contributions. Consider prioritizing debt reduction.',
        severity: 'info',
      });
    }
  }

  // Very short retirement horizon warning
  const yearsToRetirement = input.retirementAge - input.currentAge;
  if (yearsToRetirement <= 5 && yearsToRetirement > 0) {
    warnings.push({
      field: 'retirementAge',
      message: `You're ${yearsToRetirement} year${yearsToRetirement === 1 ? '' : 's'} from retirement. Focus on preserving capital and finalizing your income strategy.`,
      severity: 'info',
    });
  }

  // RMD approaching warning based on the user's birth cohort.
  const taxDeferredBalance = input.balancesByType.taxDeferred;
  const rmdStartAge = input.rmdConfig?.startAge ?? 73;
  const rmdEnabled = input.rmdConfig?.enabled ?? true;
  if (
    rmdEnabled &&
    input.currentAge >= rmdStartAge - 3 &&
    input.currentAge < rmdStartAge &&
    taxDeferredBalance > 100000
  ) {
    const formatCurrency = (value: number) =>
      new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value);

    warnings.push({
      field: 'rmd',
      message: `You're approaching age ${rmdStartAge} when Required Minimum Distributions (RMDs) begin. With ${formatCurrency(taxDeferredBalance)} in tax-deferred accounts, you'll be required to withdraw a minimum amount each year starting at age ${rmdStartAge}.`,
      severity: 'info',
    });
  }

  if (rmdEnabled && input.retirementAge > rmdStartAge && taxDeferredBalance > 0) {
    warnings.push({
      field: 'rmd',
      message: `Your projection applies aggregate RMDs beginning at age ${rmdStartAge}, before your planned retirement age. It does not model the exception that may apply to some current-employer retirement plans.`,
      severity: 'info',
    });
  }

  // Large projected RMD warning
  if (result?.records.some(record => (record.rmd?.rmdRequired ?? 0) > 50000)) {
    warnings.push({
      field: 'rmd',
      message: 'Your projected RMDs exceed $50,000/year. Consider Roth conversions before age 73 to reduce future RMDs and tax burden.',
      severity: 'info',
    });
  }

  return warnings;
}
