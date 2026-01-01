import type {
  ProjectionInput,
  ProjectionRecord,
  ProjectionResult,
  BalanceByType,
  WithdrawalResult,
  IncomeStream,
} from './types';

/**
 * Execute tax-aware withdrawal strategy
 * Order: taxable → taxDeferred → taxFree (preserve tax-free growth longest)
 */
export function withdrawFromAccounts(
  amountNeeded: number,
  balances: BalanceByType
): WithdrawalResult {
  const withdrawals: BalanceByType = { taxDeferred: 0, taxFree: 0, taxable: 0 };
  let remaining = amountNeeded;

  // 1. Withdraw from taxable accounts first (capital gains treatment)
  if (remaining > 0 && balances.taxable > 0) {
    const fromTaxable = Math.min(remaining, balances.taxable);
    withdrawals.taxable = fromTaxable;
    remaining -= fromTaxable;
  }

  // 2. Withdraw from tax-deferred accounts (ordinary income)
  if (remaining > 0 && balances.taxDeferred > 0) {
    const fromDeferred = Math.min(remaining, balances.taxDeferred);
    withdrawals.taxDeferred = fromDeferred;
    remaining -= fromDeferred;
  }

  // 3. Withdraw from tax-free accounts last (preserve tax-free growth)
  if (remaining > 0 && balances.taxFree > 0) {
    const fromTaxFree = Math.min(remaining, balances.taxFree);
    withdrawals.taxFree = fromTaxFree;
    remaining -= fromTaxFree;
  }

  return { withdrawals, shortfall: remaining };
}

/**
 * Apply investment returns to all account types
 */
function applyReturns(balances: BalanceByType, returnRate: number): BalanceByType {
  return {
    taxDeferred: balances.taxDeferred * (1 + returnRate),
    taxFree: balances.taxFree * (1 + returnRate),
    taxable: balances.taxable * (1 + returnRate),
  };
}

/**
 * Add contributions allocated by percentage
 */
function addContributions(
  balances: BalanceByType,
  annualContribution: number,
  allocation: BalanceByType
): BalanceByType {
  return {
    taxDeferred: balances.taxDeferred + (annualContribution * allocation.taxDeferred / 100),
    taxFree: balances.taxFree + (annualContribution * allocation.taxFree / 100),
    taxable: balances.taxable + (annualContribution * allocation.taxable / 100),
  };
}

/**
 * Subtract withdrawals from balances
 */
function subtractWithdrawals(
  balances: BalanceByType,
  withdrawals: BalanceByType
): BalanceByType {
  return {
    taxDeferred: Math.max(0, balances.taxDeferred - withdrawals.taxDeferred),
    taxFree: Math.max(0, balances.taxFree - withdrawals.taxFree),
    taxable: Math.max(0, balances.taxable - withdrawals.taxable),
  };
}

/**
 * Calculate total balance across all account types
 */
function totalBalance(balances: BalanceByType): number {
  return balances.taxDeferred + balances.taxFree + balances.taxable;
}

/**
 * Calculate total income from all active streams for a given age
 */
function calculateTotalIncome(
  streams: IncomeStream[],
  age: number,
  inflationMultiplier: number
): number {
  return streams.reduce((total, stream) => {
    // Check if stream is active this year
    if (age >= stream.startAge && (stream.endAge === undefined || age <= stream.endAge)) {
      const streamInflation = stream.inflationAdjusted ? inflationMultiplier : 1;
      return total + stream.annualAmount * streamInflation;
    }
    return total;
  }, 0);
}

/**
 * Run the complete retirement projection
 *
 * Uses end-of-year model:
 * - Accumulation: (balance + contribution - debtPayments) × (1 + return)
 * - Drawdown: (balance - withdrawal) × (1 + return)
 */
export function runProjection(input: ProjectionInput): ProjectionResult {
  const records: ProjectionRecord[] = [];
  const currentYear = new Date().getFullYear();

  let balances = { ...input.balancesByType };
  let totalContributions = 0;
  let totalWithdrawals = 0;
  let yearsUntilDepletion: number | null = null;
  let projectedRetirementBalance = 0;

  // Handle already-retired case: skip accumulation if currentAge >= retirementAge
  const isAlreadyRetired = input.currentAge >= input.retirementAge;

  for (let age = input.currentAge; age <= input.maxAge; age++) {
    const year = currentYear + (age - input.currentAge);
    const yearsFromStart = age - input.currentAge;
    const yearsFromRetirement = age - input.retirementAge;
    const isRetired = age >= input.retirementAge;

    let inflows = 0;
    let outflows = 0;
    let withdrawalsByType: BalanceByType | undefined;

    if (!isRetired) {
      // ACCUMULATION PHASE
      // Calculate contribution with growth rate applied
      const growthMultiplier = Math.pow(1 + input.contributionGrowthRate, yearsFromStart);
      const grownContribution = input.annualContribution * growthMultiplier;

      // Effective contribution = grown contribution - debt payments
      const effectiveContribution = Math.max(
        0,
        grownContribution - input.annualDebtPayments
      );

      // Add contributions first
      balances = addContributions(balances, effectiveContribution, input.contributionAllocation);
      inflows = effectiveContribution;
      totalContributions += effectiveContribution;

      // Then apply returns (end of year model)
      balances = applyReturns(balances, input.expectedReturn);

    } else {
      // DRAWDOWN PHASE
      // Capture retirement balance at start of retirement (before first withdrawal)
      if (age === input.retirementAge) {
        projectedRetirementBalance = totalBalance(balances);
      }
      // Calculate inflation-adjusted general expenses
      const inflationMultiplier = Math.pow(1 + input.inflationRate, yearsFromRetirement);
      const generalExpenses = input.annualExpenses * inflationMultiplier;

      // Calculate healthcare costs with separate (higher) inflation
      const healthcareInflationMultiplier = Math.pow(1 + input.healthcareInflationRate, yearsFromRetirement);
      const healthcareExpenses = input.annualHealthcareCosts * healthcareInflationMultiplier;

      // Total expenses = general + healthcare
      const expensesNeeded = generalExpenses + healthcareExpenses;

      // Calculate total income from all active streams
      const totalIncome = calculateTotalIncome(input.incomeStreams, age, inflationMultiplier);

      // Net withdrawal needed from portfolio
      const withdrawalNeeded = Math.max(0, expensesNeeded - totalIncome);

      // Execute tax-aware withdrawal
      const withdrawalResult = withdrawFromAccounts(withdrawalNeeded, balances);
      withdrawalsByType = withdrawalResult.withdrawals;

      // Update balances
      balances = subtractWithdrawals(balances, withdrawalResult.withdrawals);

      // Apply returns to remaining balance
      balances = applyReturns(balances, input.expectedReturn);

      // Track totals
      const actualWithdrawal = withdrawalResult.withdrawals.taxDeferred +
        withdrawalResult.withdrawals.taxFree +
        withdrawalResult.withdrawals.taxable;

      inflows = totalIncome;
      outflows = expensesNeeded;
      totalWithdrawals += actualWithdrawal;

      // Track depletion year
      if (yearsUntilDepletion === null && totalBalance(balances) <= 0) {
        yearsUntilDepletion = yearsFromStart;
      }

      // Set retirement balance for already-retired case
      if (isAlreadyRetired && age === input.currentAge) {
        projectedRetirementBalance = totalBalance(input.balancesByType);
      }
    }

    records.push({
      age,
      year,
      balance: Math.max(0, totalBalance(balances)),
      inflows: Math.round(inflows * 100) / 100,
      outflows: Math.round(outflows * 100) / 100,
      balanceByType: {
        taxDeferred: Math.max(0, Math.round(balances.taxDeferred * 100) / 100),
        taxFree: Math.max(0, Math.round(balances.taxFree * 100) / 100),
        taxable: Math.max(0, Math.round(balances.taxable * 100) / 100),
      },
      withdrawalsByType,
    });
  }

  return {
    records,
    summary: {
      startingBalance: totalBalance(input.balancesByType),
      endingBalance: Math.max(0, totalBalance(balances)),
      totalContributions: Math.round(totalContributions * 100) / 100,
      totalWithdrawals: Math.round(totalWithdrawals * 100) / 100,
      yearsUntilDepletion,
      projectedRetirementBalance: Math.round(projectedRetirementBalance * 100) / 100,
    },
  };
}