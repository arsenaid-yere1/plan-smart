import type { ProjectionInput } from './types';
import {
  CURRENT_PROJECTION_CALCULATION_VERSION,
  LEGACY_PROJECTION_CALCULATION_VERSION,
} from './version';

export interface StalenessResult {
  isStale: boolean;
  changedFields: string[];
  changes: Record<string, { previous: unknown; current: unknown }>;
}

type StoredProjectionFreshness = {
  inputs: ProjectionInput;
  calculationVersion?: number;
};

const PRIMITIVE_FIELDS: (keyof ProjectionInput)[] = [
  'currentAge',
  'birthYear',
  'retirementAge',
  'maxAge',
  'annualContribution',
  'expectedReturn',
  'inflationRate',
  'contributionGrowthRate',
  'annualEssentialExpenses',
  'annualDiscretionaryExpenses',
  'annualExpenses',
  'annualHealthcareCosts',
  'healthcareInflationRate',
  'annualDebtPayments',
  'reserveFloor',
];

const STRUCTURED_FIELDS: (keyof ProjectionInput)[] = [
  'balancesByType',
  'annualContributionsByType',
  'contributionAllocation',
  'incomeStreams',
  'spendingPhaseConfig',
  'depletionTarget',
  'rmdConfig',
];

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) {
    const normalized = value.map(canonicalize);
    if (normalized.every((item) => item && typeof item === 'object' && 'id' in item)) {
      return [...normalized].sort((a, b) => {
        const left = String((a as { id: unknown }).id);
        const right = String((b as { id: unknown }).id);
        return left.localeCompare(right);
      });
    }
    return normalized;
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, entry]) => entry !== undefined)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entry]) => [key, canonicalize(entry)])
    );
  }

  return value;
}

function structuredEqual(left: unknown, right: unknown): boolean {
  return JSON.stringify(canonicalize(left)) === JSON.stringify(canonicalize(right));
}

function normalizeStructuredField(field: keyof ProjectionInput, value: unknown): unknown {
  if (
    (field === 'spendingPhaseConfig' || field === 'depletionTarget' || field === 'rmdConfig') &&
    value &&
    typeof value === 'object' &&
    'enabled' in value &&
    (value as { enabled: unknown }).enabled === false
  ) {
    return { enabled: false };
  }

  return value;
}

/** Compare all projection inputs that can affect engine output. */
export function checkProjectionStaleness(
  storedInputs: ProjectionInput,
  currentInputs: ProjectionInput,
  storedCalculationVersion?: number,
  currentCalculationVersion?: number
): StalenessResult {
  const changedFields: string[] = [];
  const changes: Record<string, { previous: unknown; current: unknown }> = {};

  const recordChange = (field: string, previous: unknown, current: unknown) => {
    changedFields.push(field);
    changes[field] = { previous, current };
  };

  if (
    storedCalculationVersion !== undefined &&
    currentCalculationVersion !== undefined &&
    storedCalculationVersion !== currentCalculationVersion
  ) {
    recordChange('calculationVersion', storedCalculationVersion, currentCalculationVersion);
  }

  for (const field of PRIMITIVE_FIELDS) {
    if (storedInputs[field] !== currentInputs[field]) {
      recordChange(field, storedInputs[field], currentInputs[field]);
    }
  }

  for (const field of STRUCTURED_FIELDS) {
    if (!structuredEqual(
      normalizeStructuredField(field, storedInputs[field]),
      normalizeStructuredField(field, currentInputs[field])
    )) {
      recordChange(field, storedInputs[field], currentInputs[field]);
    }
  }

  return {
    isStale: changedFields.length > 0,
    changedFields,
    changes,
  };
}

/** Decide whether a missing, legacy, or input-stale projection must be rebuilt. */
export function shouldRecalculateProjection(
  storedProjection: StoredProjectionFreshness | null | undefined,
  currentInputs: ProjectionInput,
  currentCalculationVersion = CURRENT_PROJECTION_CALCULATION_VERSION
): boolean {
  if (!storedProjection) {
    return true;
  }

  const storedVersion = storedProjection.calculationVersion
    ?? LEGACY_PROJECTION_CALCULATION_VERSION;

  return checkProjectionStaleness(
    storedProjection.inputs,
    currentInputs,
    storedVersion,
    currentCalculationVersion
  ).isStale;
}
