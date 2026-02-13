import type {
  ProjectionInput,
  ProjectionRecord,
  ProjectionResult,
  BalanceByType,
  WithdrawalResult,
  IncomeStream,
  SpendingPhaseConfig,
  SpendingPhase,
  RMDTracking,
} from './types';
import { calculateRMD, DEFAULT_RMD_CONFIG } from './rmd';

/**
 * Epic 10.2: Result of reserve-constrained spending calculation
 */
interface ReserveConstrainedSpending {
  essentialWithdrawal: number;
  discretionaryWithdrawal: number;
  totalWithdrawal: number;
  reductionStage: 'none' | 'discretionary_reduced' | 'essentials_only' | 'essentials_reduced';
  shortfall: number;
  reserveConstrained: boolean;
}

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
 * Execute tax-aware withdrawal strategy with RMD enforcement
 *
 * When RMD applies (age 73+):
 * 1. Calculate and withdraw RMD from tax-deferred first
 * 2. If more needed, continue with normal order (taxable -> remaining taxDeferred -> taxFree)
 *
 * @param amountNeeded - Total withdrawal needed for expenses
 * @param balances - Current account balances by tax type
 * @param rmdRequired - Required minimum distribution for this year (0 if not applicable)
 * @returns Withdrawal result with amounts by type and any shortfall
 */
export function withdrawFromAccountsWithRMD(
  amountNeeded: number,
  balances: BalanceByType,
  rmdRequired: number
): WithdrawalResult & { rmdTracking?: RMDTracking } {
  const withdrawals: BalanceByType = { taxDeferred: 0, taxFree: 0, taxable: 0 };
  let remaining = amountNeeded;

  // Track RMD specifics
  let rmdTaken = 0;
  const rmdApplies = rmdRequired > 0;

  // Step 1: If RMD applies, withdraw RMD from tax-deferred first
  if (rmdApplies && balances.taxDeferred > 0) {
    // Take the full RMD (or whatever is available if less)
    const rmdWithdrawal = Math.min(rmdRequired, balances.taxDeferred);
    withdrawals.taxDeferred = rmdWithdrawal;
    rmdTaken = rmdWithdrawal;

    // RMD may cover some or all of the needed amount
    remaining = Math.max(0, remaining - rmdWithdrawal);
  }

  // Step 2: If more needed, continue with normal ordering
  // (taxable first, then any remaining tax-deferred, then tax-free)

  // 2a. Withdraw from taxable accounts
  if (remaining > 0 && balances.taxable > 0) {
    const fromTaxable = Math.min(remaining, balances.taxable);
    withdrawals.taxable = fromTaxable;
    remaining -= fromTaxable;
  }

  // 2b. Withdraw additional from tax-deferred (beyond RMD)
  if (remaining > 0 && balances.taxDeferred > withdrawals.taxDeferred) {
    const availableDeferred = balances.taxDeferred - withdrawals.taxDeferred;
    const fromDeferred = Math.min(remaining, availableDeferred);
    withdrawals.taxDeferred += fromDeferred;
    remaining -= fromDeferred;
  }

  // 2c. Withdraw from tax-free accounts last
  if (remaining > 0 && balances.taxFree > 0) {
    const fromTaxFree = Math.min(remaining, balances.taxFree);
    withdrawals.taxFree = fromTaxFree;
    remaining -= fromTaxFree;
  }

  // Calculate excess over RMD
  const excessOverRmd = rmdApplies
    ? Math.max(0, withdrawals.taxDeferred - rmdRequired)
    : 0;

  return {
    withdrawals,
    shortfall: remaining,
    rmdTracking: rmdApplies ? {
      rmdApplies: true,
      rmdRequired,
      rmdTaken,
      excessOverRmd,
    } : undefined,
  };
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
 * Get the active spending phase for a given age
 */
function getActivePhaseForAge(
  age: number,
  config?: SpendingPhaseConfig
): SpendingPhase | null {
  if (!config?.enabled || !config.phases.length) {
    return null;
  }

  // Sort phases by startAge descending to find the active one
  const sortedPhases = [...config.phases].sort((a, b) => b.startAge - a.startAge);

  for (const phase of sortedPhases) {
    if (age >= phase.startAge) {
      return phase;
    }
  }

  return null;
}

/**
 * Calculate phase-adjusted expenses for a given age
 * Returns expenses before inflation adjustment
 */
export function calculatePhaseAdjustedExpenses(
  age: number,
  baseEssential: number,
  baseDiscretionary: number,
  config?: SpendingPhaseConfig
): { essential: number; discretionary: number; activePhase: SpendingPhase | null } {
  const activePhase = getActivePhaseForAge(age, config);

  if (!activePhase) {
    // No phase active, return base amounts (flat spending)
    return {
      essential: baseEssential,
      discretionary: baseDiscretionary,
      activePhase: null,
    };
  }

  // Absolute amounts take precedence over multipliers
  const essential = activePhase.absoluteEssential !== undefined
    ? activePhase.absoluteEssential
    : baseEssential * activePhase.essentialMultiplier;

  const discretionary = activePhase.absoluteDiscretionary !== undefined
    ? activePhase.absoluteDiscretionary
    : baseDiscretionary * activePhase.discretionaryMultiplier;

  return { essential, discretionary, activePhase };
}

/**
 * Epic 10.2: Calculate spending constrained by reserve floor
 *
 * Two-stage reduction:
 * 1. Reduce discretionary proportionally, preserve essentials
 * 2. If still insufficient, reduce to essentials only
 * 3. If even essentials can't be covered, reduce essentials
 */
function calculateReserveConstrainedSpending(
  balances: BalanceByType,
  essentialExpenses: number,
  discretionaryExpenses: number,
  totalIncome: number,
  reserveFloor: number | undefined
): ReserveConstrainedSpending {
  const currentTotal = totalBalance(balances);

  // No reserve configured - no constraint
  if (reserveFloor === undefined) {
    const totalNeeded = Math.max(0, essentialExpenses + discretionaryExpenses - totalIncome);
    return {
      essentialWithdrawal: Math.max(0, essentialExpenses - totalIncome),
      discretionaryWithdrawal: discretionaryExpenses,
      totalWithdrawal: totalNeeded,
      reductionStage: 'none',
      shortfall: 0,
      reserveConstrained: false,
    };
  }

  const availableAboveReserve = Math.max(0, currentTotal - reserveFloor);

  // Calculate what's needed from portfolio (after income)
  const essentialFromPortfolio = Math.max(0, essentialExpenses - totalIncome);
  const discretionaryFromPortfolio = discretionaryExpenses; // Discretionary fully from portfolio
  const totalNeeded = essentialFromPortfolio + discretionaryFromPortfolio;

  // Stage 1: No constraint needed
  if (availableAboveReserve >= totalNeeded) {
    return {
      essentialWithdrawal: essentialFromPortfolio,
      discretionaryWithdrawal: discretionaryFromPortfolio,
      totalWithdrawal: totalNeeded,
      reductionStage: 'none',
      shortfall: 0,
      reserveConstrained: false,
    };
  }

  // Stage 2: Reduce discretionary proportionally, preserve essentials
  if (availableAboveReserve >= essentialFromPortfolio) {
    const remainingForDiscretionary = availableAboveReserve - essentialFromPortfolio;
    return {
      essentialWithdrawal: essentialFromPortfolio,
      discretionaryWithdrawal: remainingForDiscretionary,
      totalWithdrawal: availableAboveReserve,
      reductionStage: 'discretionary_reduced',
      shortfall: discretionaryFromPortfolio - remainingForDiscretionary,
      reserveConstrained: true,
    };
  }

  // Stage 3: Essentials only (no discretionary)
  if (availableAboveReserve > 0) {
    return {
      essentialWithdrawal: availableAboveReserve,
      discretionaryWithdrawal: 0,
      totalWithdrawal: availableAboveReserve,
      reductionStage: 'essentials_only',
      shortfall: essentialFromPortfolio - availableAboveReserve + discretionaryFromPortfolio,
      reserveConstrained: true,
    };
  }

  // Stage 4: Reserve depleted - nothing available
  return {
    essentialWithdrawal: 0,
    discretionaryWithdrawal: 0,
    totalWithdrawal: 0,
    reductionStage: 'essentials_reduced',
    shortfall: totalNeeded,
    reserveConstrained: true,
  };
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

  // Epic 10.2: Reserve tracking
  let yearsReserveConstrained = 0;
  let firstReserveConstraintAge: number | null = null;
  let firstEssentialsOnlyAge: number | null = null;

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
    let currentEssentialExpenses: number | undefined;
    let currentDiscretionaryExpenses: number | undefined;
    let currentActivePhaseId: string | undefined;
    let currentActivePhaseName: string | undefined;

    // Epic 10.2: Reserve tracking variables for this year
    let currentReserveBalance: number | undefined;
    let currentReserveConstrained: boolean | undefined;
    let currentReductionStage: 'none' | 'discretionary_reduced' | 'essentials_only' | 'essentials_reduced' | undefined;
    let currentActualEssential: number | undefined;
    let currentActualDiscretionary: number | undefined;
    let currentShortfall: number | undefined;

    // RMD tracking for this year
    let currentRmd: RMDTracking | undefined;

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
      const inflationMultiplier = Math.pow(1 + input.inflationRate, yearsFromRetirement);

      // Epic 9: Calculate phase-adjusted base expenses (before inflation)
      const baseEssential = input.annualEssentialExpenses ?? input.annualExpenses;
      const baseDiscretionary = input.annualDiscretionaryExpenses ?? 0;

      const phaseResult = calculatePhaseAdjustedExpenses(
        age,
        baseEssential,
        baseDiscretionary,
        input.spendingPhaseConfig
      );

      // Apply inflation to phase-adjusted amounts
      const essentialExpenses = phaseResult.essential * inflationMultiplier;
      const discretionaryExpenses = phaseResult.discretionary * inflationMultiplier;

      // Calculate healthcare costs with separate (higher) inflation
      const healthcareInflationMultiplier = Math.pow(1 + input.healthcareInflationRate, yearsFromRetirement);
      const healthcareExpenses = input.annualHealthcareCosts * healthcareInflationMultiplier;

      // Calculate total income from all active streams
      const totalIncome = calculateTotalIncome(input.incomeStreams, age, inflationMultiplier);

      // Calculate RMD if applicable
      const rmdConfig = input.rmdConfig ?? DEFAULT_RMD_CONFIG;
      let rmdRequired = 0;

      if (rmdConfig.enabled && age >= rmdConfig.startAge) {
        // RMD is based on PRIOR year-end balance
        // For first year, use current balance; otherwise use previous record
        const priorYearDeferredBalance = age === input.currentAge
          ? input.balancesByType.taxDeferred
          : records[records.length - 1]?.balanceByType.taxDeferred ?? 0;

        rmdRequired = calculateRMD(priorYearDeferredBalance, age);
      }

      // Epic 10.2: Calculate reserve-constrained spending
      const spendingResult = calculateReserveConstrainedSpending(
        balances,
        essentialExpenses,
        discretionaryExpenses,
        totalIncome,
        input.reserveFloor
      );

      // Determine total withdrawal needed
      // If RMD is greater than spending needs, we still must withdraw the RMD
      const withdrawalNeeded = Math.max(spendingResult.totalWithdrawal, rmdRequired);

      // Execute RMD-aware withdrawal
      const withdrawalResult = withdrawFromAccountsWithRMD(withdrawalNeeded, balances, rmdRequired);
      withdrawalsByType = withdrawalResult.withdrawals;

      // Track RMD in record
      currentRmd = withdrawalResult.rmdTracking;

      // Update balances
      balances = subtractWithdrawals(balances, withdrawalResult.withdrawals);

      // Apply returns to remaining balance
      balances = applyReturns(balances, input.expectedReturn);

      // Track totals
      const actualWithdrawal = withdrawalResult.withdrawals.taxDeferred +
        withdrawalResult.withdrawals.taxFree +
        withdrawalResult.withdrawals.taxable;

      inflows = totalIncome;
      outflows = essentialExpenses + discretionaryExpenses + healthcareExpenses; // Original planned
      totalWithdrawals += actualWithdrawal;

      // Epic 10.2: Track reserve constraints
      if (spendingResult.reserveConstrained) {
        yearsReserveConstrained++;
        if (firstReserveConstraintAge === null) {
          firstReserveConstraintAge = age;
        }
        if (spendingResult.reductionStage === 'essentials_only' ||
            spendingResult.reductionStage === 'essentials_reduced') {
          if (firstEssentialsOnlyAge === null) {
            firstEssentialsOnlyAge = age;
          }
        }
      }

      // Track depletion year
      if (yearsUntilDepletion === null && totalBalance(balances) <= 0) {
        yearsUntilDepletion = yearsFromStart;
      }

      // Set retirement balance for already-retired case
      if (isAlreadyRetired && age === input.currentAge) {
        projectedRetirementBalance = totalBalance(input.balancesByType);
      }

      // Store expense breakdown and phase info in record
      currentEssentialExpenses = Math.round(essentialExpenses * 100) / 100;
      currentDiscretionaryExpenses = Math.round(discretionaryExpenses * 100) / 100;
      currentActivePhaseId = phaseResult.activePhase?.id;
      currentActivePhaseName = phaseResult.activePhase?.name;

      // Set reserve tracking fields for record
      currentReserveBalance = input.reserveFloor !== undefined
        ? Math.max(0, totalBalance(balances) - input.reserveFloor)
        : undefined;
      currentReserveConstrained = spendingResult.reserveConstrained;
      currentReductionStage = spendingResult.reductionStage;
      currentActualEssential = spendingResult.essentialWithdrawal + Math.min(totalIncome, essentialExpenses);
      currentActualDiscretionary = spendingResult.discretionaryWithdrawal;
      currentShortfall = spendingResult.shortfall;
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
      essentialExpenses: currentEssentialExpenses,
      discretionaryExpenses: currentDiscretionaryExpenses,
      activePhaseId: currentActivePhaseId,
      activePhaseName: currentActivePhaseName,
      // Epic 10.2: Reserve tracking
      reserveBalance: currentReserveBalance,
      reserveConstrained: currentReserveConstrained,
      reductionStage: currentReductionStage,
      actualEssentialSpending: currentActualEssential,
      actualDiscretionarySpending: currentActualDiscretionary,
      spendingShortfall: currentShortfall,
      // RMD tracking
      rmd: currentRmd,
    });

    // Capture retirement balance to match chart data point at retirement age
    if (age === input.retirementAge && !isAlreadyRetired) {
      projectedRetirementBalance = Math.max(0, totalBalance(balances));
    }
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
      // Epic 10.2: Reserve summary
      reserveFloor: input.reserveFloor,
      yearsReserveConstrained,
      firstReserveConstraintAge,
      firstEssentialsOnlyAge,
    },
  };
}