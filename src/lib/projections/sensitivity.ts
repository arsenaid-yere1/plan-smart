import { runProjection } from './engine';
import type { ProjectionInput } from './types';
import type { LeverImpact, SensitivityResult, LowFrictionWin, SensitiveAssumption } from './sensitivity-types';

/**
 * Lever test configuration
 */
interface LeverTest {
  lever: keyof ProjectionInput;
  displayName: string;
  delta: number | ((input: ProjectionInput) => number);
  direction: 'increase' | 'decrease';
}

/**
 * Standard lever tests to evaluate
 */
const LEVER_TESTS: LeverTest[] = [
  {
    lever: 'expectedReturn',
    displayName: 'Expected Return',
    delta: 0.01, // 1 percentage point
    direction: 'increase',
  },
  {
    lever: 'inflationRate',
    displayName: 'Inflation Rate',
    delta: 0.005, // 0.5 percentage point
    direction: 'decrease',
  },
  {
    lever: 'retirementAge',
    displayName: 'Retirement Age',
    delta: 1, // 1 year
    direction: 'increase',
  },
  {
    lever: 'annualContribution',
    displayName: 'Annual Savings',
    delta: (input) => input.annualContribution * 0.1, // 10% increase
    direction: 'increase',
  },
  {
    lever: 'annualExpenses',
    displayName: 'Annual Expenses',
    delta: (input) => input.annualExpenses * 0.1, // 10% decrease
    direction: 'decrease',
  },
  {
    lever: 'annualHealthcareCosts',
    displayName: 'Healthcare Costs',
    delta: 1000, // $1,000 decrease
    direction: 'decrease',
  },
];

/**
 * Calculate depletion delta in years
 */
function calculateDepletionDelta(
  baseDepletion: number | null,
  modifiedDepletion: number | null
): number | null {
  if (baseDepletion === null && modifiedDepletion === null) {
    return null; // Both sustainable
  }
  if (baseDepletion === null) {
    return modifiedDepletion; // Base was sustainable, now depletes
  }
  if (modifiedDepletion === null) {
    return null; // Now sustainable (improvement)
  }
  return modifiedDepletion - baseDepletion;
}

/**
 * Run sensitivity analysis on projection inputs
 */
export function analyzeSensitivity(baseInput: ProjectionInput): SensitivityResult {
  // Run base projection
  const baseResult = runProjection(baseInput);
  const baseBalance = baseResult.summary.projectedRetirementBalance;
  const baseDepletion = baseResult.summary.yearsUntilDepletion;

  const impacts: LeverImpact[] = [];

  // Test each lever
  for (const test of LEVER_TESTS) {
    // Skip if lever doesn't apply (e.g., no contributions to increase)
    const currentValue = baseInput[test.lever];
    if (typeof currentValue !== 'number') continue;
    if (test.lever === 'annualContribution' && currentValue === 0) continue;
    if (test.lever === 'annualExpenses' && currentValue === 0) continue;

    // Calculate test delta
    const testDelta = typeof test.delta === 'function'
      ? test.delta(baseInput)
      : test.delta;

    // Create modified input
    const modifiedInput = { ...baseInput };
    const newValue = test.direction === 'increase'
      ? currentValue + testDelta
      : currentValue - testDelta;

    // Type assertion needed for computed property assignment
    (modifiedInput as Record<string, unknown>)[test.lever] = newValue;

    // Run modified projection
    const modifiedResult = runProjection(modifiedInput as ProjectionInput);

    const impactOnBalance = modifiedResult.summary.projectedRetirementBalance - baseBalance;
    const impactOnDepletion = calculateDepletionDelta(
      baseDepletion,
      modifiedResult.summary.yearsUntilDepletion
    );

    impacts.push({
      lever: test.lever,
      displayName: test.displayName,
      currentValue,
      testDelta,
      testDirection: test.direction,
      impactOnBalance,
      impactOnDepletion,
      percentImpact: baseBalance > 0
        ? Math.abs(impactOnBalance / baseBalance) * 100
        : 0,
    });
  }

  // Sort by absolute impact and take top 3
  const topLevers = impacts
    .sort((a, b) => Math.abs(b.impactOnBalance) - Math.abs(a.impactOnBalance))
    .slice(0, 3);

  return {
    topLevers,
    baselineBalance: baseBalance,
    baselineDepletion: baseDepletion,
    analysisTimestamp: new Date(),
  };
}

/**
 * Identify low-friction wins from sensitivity results
 */
export function identifyLowFrictionWins(
  baseInput: ProjectionInput,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _sensitivityResult: SensitivityResult
): LowFrictionWin[] {
  const wins: LowFrictionWin[] = [];
  const baseResult = runProjection(baseInput);
  const baseBalance = baseResult.summary.projectedRetirementBalance;

  // Win 1: Retire 1 year later (if under 70)
  if (baseInput.retirementAge < 70) {
    const laterRetirement = { ...baseInput, retirementAge: baseInput.retirementAge + 1 };
    const result = runProjection(laterRetirement);
    const impact = result.summary.projectedRetirementBalance - baseBalance;

    if (impact > 10000) {
      wins.push({
        id: 'retire-one-year-later',
        title: 'One additional working year',
        description: `Working until age ${baseInput.retirementAge + 1} instead of ${baseInput.retirementAge}`,
        effortLevel: 'moderate',
        potentialImpact: impact,
        impactDescription: `adds approximately ${formatCurrency(impact)} to retirement funds`,
        uncertaintyCaveat: 'Assumes continued employment and contribution levels',
        lever: 'retirementAge',
        delta: 1,
      });
    }
  }

  // Win 2: 5% expense reduction
  const expenseReduction = baseInput.annualExpenses * 0.05;
  if (expenseReduction > 0) {
    const reducedExpenses = { ...baseInput, annualExpenses: baseInput.annualExpenses - expenseReduction };
    const expenseResult = runProjection(reducedExpenses);
    const expenseImpact = expenseResult.summary.projectedRetirementBalance - baseBalance;

    if (expenseImpact > 5000) {
      wins.push({
        id: 'reduce-expenses-5pct',
        title: 'Modest expense reduction',
        description: `Reducing annual expenses by ${formatCurrency(expenseReduction)}/year (5%)`,
        effortLevel: 'low',
        potentialImpact: expenseImpact,
        impactDescription: `frees up approximately ${formatCurrency(expenseImpact)} for retirement`,
        uncertaintyCaveat: 'Based on current expense levels; actual savings may vary',
        lever: 'annualExpenses',
        delta: expenseReduction,
      });
    }
  }

  // Win 3: 10% savings increase (if currently contributing)
  if (baseInput.annualContribution > 0) {
    const contributionIncrease = baseInput.annualContribution * 0.10;
    const increasedContribution = { ...baseInput, annualContribution: baseInput.annualContribution + contributionIncrease };
    const contributionResult = runProjection(increasedContribution);
    const contributionImpact = contributionResult.summary.projectedRetirementBalance - baseBalance;

    if (contributionImpact > 5000) {
      wins.push({
        id: 'increase-savings-10pct',
        title: 'Incremental savings boost',
        description: `Saving an additional ${formatCurrency(contributionIncrease)}/year (10% increase)`,
        effortLevel: 'low',
        potentialImpact: contributionImpact,
        impactDescription: `grows to approximately ${formatCurrency(contributionImpact)} by retirement`,
        uncertaintyCaveat: 'Assumes consistent contribution over time; market returns may vary',
        lever: 'annualContribution',
        delta: contributionIncrease,
      });
    }
  }

  // Sort by impact and return top 3
  return wins
    .sort((a, b) => b.potentialImpact - a.potentialImpact)
    .slice(0, 3);
}

/**
 * Identify sensitive assumptions from analysis results
 */
export function identifySensitiveAssumptions(
  _input: ProjectionInput,
  sensitivityResult: SensitivityResult
): SensitiveAssumption[] {
  const assumptions: SensitiveAssumption[] = [];
  const maxImpact = Math.max(
    ...sensitivityResult.topLevers.map(l => Math.abs(l.impactOnBalance)),
    1 // Avoid division by zero
  );

  // Take top 2 most sensitive levers
  for (const lever of sensitivityResult.topLevers.slice(0, 2)) {
    const sensitivityScore = Math.round((Math.abs(lever.impactOnBalance) / maxImpact) * 100);

    assumptions.push({
      assumption: lever.lever,
      displayName: lever.displayName,
      currentValue: lever.currentValue,
      formattedValue: formatAssumptionValue(lever.lever, lever.currentValue),
      sensitivityScore,
      explanation: generateAssumptionExplanation(lever),
      reviewSuggestion: getReviewSuggestion(lever.lever),
    });
  }

  return assumptions;
}

/**
 * Format currency for display
 */
function formatCurrency(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${Math.round(value / 1_000)}K`;
  return `$${Math.round(value)}`;
}

/**
 * Format assumption value for display
 */
function formatAssumptionValue(lever: string, value: number): string {
  switch (lever) {
    case 'expectedReturn':
    case 'inflationRate':
    case 'healthcareInflationRate':
    case 'contributionGrowthRate':
      return `${(value * 100).toFixed(1)}%`;
    case 'retirementAge':
    case 'maxAge':
      return `Age ${value}`;
    case 'annualContribution':
    case 'annualExpenses':
    case 'annualHealthcareCosts':
      return formatCurrency(value);
    default:
      return String(value);
  }
}

/**
 * Format delta value for display
 */
export function formatDeltaValue(lever: string, delta: number): string {
  switch (lever) {
    case 'expectedReturn':
    case 'inflationRate':
    case 'healthcareInflationRate':
    case 'contributionGrowthRate':
      return `${(delta * 100).toFixed(1)}%`;
    case 'retirementAge':
    case 'maxAge':
      return `${delta} year${delta !== 1 ? 's' : ''}`;
    case 'annualContribution':
    case 'annualExpenses':
    case 'annualHealthcareCosts':
      return formatCurrency(delta);
    default:
      return String(delta);
  }
}

/**
 * Generate explanation for a sensitive assumption
 */
function generateAssumptionExplanation(lever: LeverImpact): string {
  const direction = lever.impactOnBalance > 0 ? 'higher' : 'lower';
  const absImpact = Math.abs(lever.impactOnBalance);
  const deltaFormatted = formatDeltaValue(lever.lever, lever.testDelta);

  return `A ${deltaFormatted} ${lever.testDirection} in ${lever.displayName.toLowerCase()} results in approximately ${formatCurrency(absImpact)} ${direction} retirement balance.`;
}

/**
 * Get review suggestion for a lever
 */
function getReviewSuggestion(lever: string): string {
  const suggestions: Record<string, string> = {
    expectedReturn: 'Review annually based on portfolio allocation and market conditions',
    inflationRate: 'Consider updating if inflation trends significantly change',
    retirementAge: 'Revisit as career plans evolve',
    annualContribution: 'Update when income or expenses change meaningfully',
    annualExpenses: 'Refresh after major life changes or annual budget review',
    annualHealthcareCosts: 'Review as healthcare needs or coverage changes',
    healthcareInflationRate: 'Monitor healthcare cost trends periodically',
    contributionGrowthRate: 'Adjust based on expected career trajectory',
    maxAge: 'Consider family health history and lifestyle factors',
  };

  return suggestions[lever] || 'Review periodically as circumstances change';
}
