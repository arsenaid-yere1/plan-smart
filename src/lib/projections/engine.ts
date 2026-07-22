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
  healthcareWithdrawal: number;
  discretionaryWithdrawal: number;
  totalWithdrawal: number;
  actualEssentialSpending: number;
  actualHealthcareSpending: number;
  actualDiscretionarySpending: number;
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
 * Add resolved contribution dollars by tax category.
 */
function addContributions(
  balances: BalanceByType,
  contributions: BalanceByType
): BalanceByType {
  return {
    taxDeferred: balances.taxDeferred + contributions.taxDeferred,
    taxFree: balances.taxFree + contributions.taxFree,
    taxable: balances.taxable + contributions.taxable,
  };
}

function resolveAnnualContributions(
  input: ProjectionInput,
  yearsFromStart: number
): BalanceByType {
  const growthMultiplier = Math.pow(1 + input.contributionGrowthRate, yearsFromStart);
  const gross = input.annualContributionsByType
    ? {
        taxDeferred: input.annualContributionsByType.taxDeferred * growthMultiplier,
        taxFree: input.annualContributionsByType.taxFree * growthMultiplier,
        taxable: input.annualContributionsByType.taxable * growthMultiplier,
      }
    : {
        taxDeferred: input.annualContribution * growthMultiplier * input.contributionAllocation.taxDeferred / 100,
        taxFree: input.annualContribution * growthMultiplier * input.contributionAllocation.taxFree / 100,
        taxable: input.annualContribution * growthMultiplier * input.contributionAllocation.taxable / 100,
      };

  const grossTotal = totalBalance(gross);
  if (grossTotal <= 0) {
    return { taxDeferred: 0, taxFree: 0, taxable: 0 };
  }

  const effectiveTotal = Math.max(0, grossTotal - input.annualDebtPayments);
  const scale = effectiveTotal / grossTotal;
  return {
    taxDeferred: gross.taxDeferred * scale,
    taxFree: gross.taxFree * scale,
    taxable: gross.taxable * scale,
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
  healthcareExpenses: number,
  discretionaryExpenses: number,
  totalIncome: number,
  reserveFloor: number | undefined
): ReserveConstrainedSpending {
  const currentTotal = totalBalance(balances);
  const protectedExpenses = essentialExpenses + healthcareExpenses;
  const incomeForProtected = Math.min(totalIncome, protectedExpenses);
  const remainingIncome = Math.max(0, totalIncome - incomeForProtected);
  const incomeForDiscretionary = Math.min(remainingIncome, discretionaryExpenses);

  const essentialShare = protectedExpenses > 0 ? essentialExpenses / protectedExpenses : 0;
  const healthcareShare = protectedExpenses > 0 ? healthcareExpenses / protectedExpenses : 0;
  const essentialIncome = incomeForProtected * essentialShare;
  const healthcareIncome = incomeForProtected * healthcareShare;

  const essentialNeed = Math.max(0, essentialExpenses - essentialIncome);
  const healthcareNeed = Math.max(0, healthcareExpenses - healthcareIncome);
  const protectedNeed = essentialNeed + healthcareNeed;
  const discretionaryNeed = Math.max(0, discretionaryExpenses - incomeForDiscretionary);
  const totalNeeded = protectedNeed + discretionaryNeed;

  const reserveAvailable = reserveFloor === undefined
    ? currentTotal
    : Math.max(0, currentTotal - reserveFloor);
  const available = Math.min(currentTotal, reserveAvailable);
  const portfolioForProtected = Math.min(available, protectedNeed);
  const remainingPortfolio = Math.max(0, available - portfolioForProtected);
  const portfolioForDiscretionary = Math.min(remainingPortfolio, discretionaryNeed);

  const essentialWithdrawal = protectedNeed > 0
    ? portfolioForProtected * essentialNeed / protectedNeed
    : 0;
  const healthcareWithdrawal = protectedNeed > 0
    ? portfolioForProtected * healthcareNeed / protectedNeed
    : 0;
  const totalWithdrawal = essentialWithdrawal + healthcareWithdrawal + portfolioForDiscretionary;

  const actualEssentialSpending = essentialIncome + essentialWithdrawal;
  const actualHealthcareSpending = healthcareIncome + healthcareWithdrawal;
  const actualDiscretionarySpending = incomeForDiscretionary + portfolioForDiscretionary;
  const actualTotal = actualEssentialSpending + actualHealthcareSpending + actualDiscretionarySpending;
  const plannedTotal = essentialExpenses + healthcareExpenses + discretionaryExpenses;
  const shortfall = Math.max(0, plannedTotal - actualTotal);
  const reserveConstrained = reserveFloor !== undefined && totalNeeded > reserveAvailable;

  let reductionStage: ReserveConstrainedSpending['reductionStage'] = 'none';
  if (shortfall > 0) {
    if (actualEssentialSpending < essentialExpenses || actualHealthcareSpending < healthcareExpenses) {
      reductionStage = 'essentials_reduced';
    } else if (actualDiscretionarySpending <= incomeForDiscretionary) {
      reductionStage = 'essentials_only';
    } else {
      reductionStage = 'discretionary_reduced';
    }
  }

  return {
    essentialWithdrawal,
    healthcareWithdrawal,
    discretionaryWithdrawal: portfolioForDiscretionary,
    totalWithdrawal,
    actualEssentialSpending,
    actualHealthcareSpending,
    actualDiscretionarySpending,
    reductionStage,
    shortfall,
    reserveConstrained,
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
  let totalRmdSurplusReinvested = 0;
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
    let currentHealthcareExpenses: number | undefined;
    let currentActivePhaseId: string | undefined;
    let currentActivePhaseName: string | undefined;

    // Epic 10.2: Reserve tracking variables for this year
    let currentReserveConstrained: boolean | undefined;
    let currentReductionStage: 'none' | 'discretionary_reduced' | 'essentials_only' | 'essentials_reduced' | undefined;
    let currentActualEssential: number | undefined;
    let currentActualDiscretionary: number | undefined;
    let currentActualHealthcare: number | undefined;
    let currentShortfall: number | undefined;

    // RMD tracking for this year
    let currentRmd: RMDTracking | undefined;
    const rmdConfig = input.rmdConfig ?? DEFAULT_RMD_CONFIG;
    let rmdRequired = 0;
    if (rmdConfig.enabled && age >= rmdConfig.startAge) {
      const priorYearDeferredBalance = age === input.currentAge
        ? input.balancesByType.taxDeferred
        : records[records.length - 1]?.balanceByType.taxDeferred ?? 0;
      rmdRequired = calculateRMD(priorYearDeferredBalance, age);
    }

    let portfolioSpendingNeed = 0;
    let spendingResult: ReserveConstrainedSpending | undefined;

    if (!isRetired) {
      // ACCUMULATION PHASE
      const contributions = resolveAnnualContributions(input, yearsFromStart);
      const effectiveContribution = totalBalance(contributions);
      balances = addContributions(balances, contributions);
      inflows = effectiveContribution;
      totalContributions += effectiveContribution;
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

      // Epic 10.2: Calculate reserve-constrained spending
      spendingResult = calculateReserveConstrainedSpending(
        balances,
        essentialExpenses,
        healthcareExpenses,
        discretionaryExpenses,
        totalIncome,
        input.reserveFloor
      );
      portfolioSpendingNeed = spendingResult.totalWithdrawal;

      inflows = totalIncome;
      outflows = essentialExpenses + discretionaryExpenses + healthcareExpenses; // Original planned

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

      // Store expense breakdown and phase info in record
      currentEssentialExpenses = Math.round(essentialExpenses * 100) / 100;
      currentDiscretionaryExpenses = Math.round(discretionaryExpenses * 100) / 100;
      currentHealthcareExpenses = Math.round(healthcareExpenses * 100) / 100;
      currentActivePhaseId = phaseResult.activePhase?.id;
      currentActivePhaseName = phaseResult.activePhase?.name;

      // Set reserve tracking fields for record
      currentReserveConstrained = spendingResult.reserveConstrained;
      currentReductionStage = spendingResult.reductionStage;
      currentActualEssential = spendingResult.actualEssentialSpending;
      currentActualHealthcare = spendingResult.actualHealthcareSpending;
      currentActualDiscretionary = spendingResult.actualDiscretionarySpending;
      currentShortfall = spendingResult.shortfall;
    }

    if (isRetired || rmdRequired > 0) {
      const withdrawalResult = withdrawFromAccountsWithRMD(
        portfolioSpendingNeed,
        balances,
        rmdRequired
      );
      withdrawalsByType = withdrawalResult.withdrawals;

      const actualWithdrawal = totalBalance(withdrawalResult.withdrawals);
      const actualPortfolioSpending = Math.min(portfolioSpendingNeed, actualWithdrawal);
      const rmdTaken = withdrawalResult.rmdTracking?.rmdTaken ?? 0;
      const rmdUsedForSpending = Math.min(rmdTaken, actualPortfolioSpending);
      const surplusReinvested = Math.max(0, rmdTaken - rmdUsedForSpending);

      currentRmd = withdrawalResult.rmdTracking
        ? { ...withdrawalResult.rmdTracking, surplusReinvested }
        : undefined;

      balances = subtractWithdrawals(balances, withdrawalResult.withdrawals);
      balances.taxable += surplusReinvested;
      totalWithdrawals += actualWithdrawal;
      totalRmdSurplusReinvested += surplusReinvested;
    }

    // Contributions, withdrawals, and internal RMD transfers occur before returns.
    balances = applyReturns(balances, input.expectedReturn);

    const currentReserveBalance = isRetired && input.reserveFloor !== undefined
      ? Math.max(0, totalBalance(balances) - input.reserveFloor)
      : undefined;

    if (isRetired && yearsUntilDepletion === null && totalBalance(balances) <= 0) {
      yearsUntilDepletion = yearsFromStart;
    }

    if (isAlreadyRetired && age === input.currentAge) {
      projectedRetirementBalance = totalBalance(input.balancesByType);
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
      healthcareExpenses: currentHealthcareExpenses,
      activePhaseId: currentActivePhaseId,
      activePhaseName: currentActivePhaseName,
      // Epic 10.2: Reserve tracking
      reserveBalance: currentReserveBalance,
      reserveConstrained: currentReserveConstrained,
      reductionStage: currentReductionStage,
      actualEssentialSpending: currentActualEssential,
      actualDiscretionarySpending: currentActualDiscretionary,
      actualHealthcareSpending: currentActualHealthcare,
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
      totalRmdSurplusReinvested: Math.round(totalRmdSurplusReinvested * 100) / 100,
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
