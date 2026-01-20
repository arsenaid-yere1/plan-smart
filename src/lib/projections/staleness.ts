import type { ProjectionInput, BalanceByType, IncomeStream, SpendingPhaseConfig } from './types';

export interface StalenessResult {
  isStale: boolean;
  changedFields: string[];
  changes: Record<string, { previous: unknown; current: unknown }>;
}

/**
 * Check if stored projection inputs differ from current inputs.
 * Returns details about what changed for UI display and AI narrative.
 */
export function checkProjectionStaleness(
  storedInputs: ProjectionInput,
  currentInputs: ProjectionInput
): StalenessResult {
  const changedFields: string[] = [];
  const changes: Record<string, { previous: unknown; current: unknown }> = {};

  // Check primitive fields that affect projection outcomes
  const fieldsToCheck: (keyof ProjectionInput)[] = [
    'currentAge',
    'retirementAge',
    'maxAge',
    'annualContribution',
    'expectedReturn',
    'inflationRate',
    'healthcareInflationRate',
    'annualExpenses',
    'annualHealthcareCosts',
    'annualDebtPayments',
    'contributionGrowthRate',
  ];

  for (const field of fieldsToCheck) {
    const storedValue = storedInputs[field];
    const currentValue = currentInputs[field];

    if (storedValue !== currentValue) {
      changedFields.push(field);
      changes[field] = {
        previous: storedValue,
        current: currentValue,
      };
    }
  }

  // Deep compare balances
  if (!deepEqualBalances(storedInputs.balancesByType, currentInputs.balancesByType)) {
    changedFields.push('balancesByType');
    changes['balancesByType'] = {
      previous: storedInputs.balancesByType,
      current: currentInputs.balancesByType,
    };
  }

  // Deep compare contribution allocation
  if (!deepEqualBalances(storedInputs.contributionAllocation, currentInputs.contributionAllocation)) {
    changedFields.push('contributionAllocation');
    changes['contributionAllocation'] = {
      previous: storedInputs.contributionAllocation,
      current: currentInputs.contributionAllocation,
    };
  }

  // Deep compare income streams
  if (!deepEqualIncomeStreams(storedInputs.incomeStreams, currentInputs.incomeStreams)) {
    changedFields.push('incomeStreams');
    changes['incomeStreams'] = {
      previous: storedInputs.incomeStreams,
      current: currentInputs.incomeStreams,
    };
  }

  // Epic 9: Deep compare spending phase config
  if (!deepEqualSpendingPhases(storedInputs.spendingPhaseConfig, currentInputs.spendingPhaseConfig)) {
    changedFields.push('spendingPhaseConfig');
    changes['spendingPhaseConfig'] = {
      previous: storedInputs.spendingPhaseConfig,
      current: currentInputs.spendingPhaseConfig,
    };
  }

  return {
    isStale: changedFields.length > 0,
    changedFields,
    changes,
  };
}

function deepEqualBalances(a: BalanceByType, b: BalanceByType): boolean {
  return (
    a.taxDeferred === b.taxDeferred &&
    a.taxFree === b.taxFree &&
    a.taxable === b.taxable
  );
}

function deepEqualIncomeStreams(a: IncomeStream[], b: IncomeStream[]): boolean {
  if (a.length !== b.length) return false;

  // Sort by ID for consistent comparison
  const sortedA = [...a].sort((x, y) => x.id.localeCompare(y.id));
  const sortedB = [...b].sort((x, y) => x.id.localeCompare(y.id));

  return JSON.stringify(sortedA) === JSON.stringify(sortedB);
}

function deepEqualSpendingPhases(
  a: SpendingPhaseConfig | undefined,
  b: SpendingPhaseConfig | undefined
): boolean {
  // Both undefined or null
  if (!a && !b) return true;
  // One defined, other not
  if (!a || !b) return false;
  // Both disabled
  if (!a.enabled && !b.enabled) return true;
  // One enabled, other not
  if (a.enabled !== b.enabled) return false;

  // Both enabled - compare phases
  if (a.phases.length !== b.phases.length) return false;

  // Sort by ID for consistent comparison
  const sortedA = [...a.phases].sort((x, y) => x.id.localeCompare(y.id));
  const sortedB = [...b.phases].sort((x, y) => x.id.localeCompare(y.id));

  return JSON.stringify(sortedA) === JSON.stringify(sortedB);
}
