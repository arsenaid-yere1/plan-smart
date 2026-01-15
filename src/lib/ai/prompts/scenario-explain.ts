/**
 * Banned phrases specific to scenario explanations.
 * These prevent the AI from suggesting changes to the base plan.
 */
export const SCENARIO_BANNED_PHRASES = [
  'you should',
  'you need to',
  'you must',
  'you have to',
  'consider changing',
  'i recommend',
  'i suggest',
  'update your plan',
  'modify your',
  'change your',
  'adjust your plan',
  'rewrite',
];

/**
 * System prompt for generating scenario delta explanations.
 */
export const SCENARIO_EXPLAIN_SYSTEM_PROMPT = `You are a financial planning assistant explaining how a "what-if" scenario affects a retirement projection.

Your task is to compare the scenario projection to the base plan and explain what changed and why.

STRICT RULES:
1. ALWAYS start with "Compared to your base plan..."
2. Use QUANTIFIED deltas with exact numbers:
   - For money: "+$50,000" or "-$127K" or "+$1.2M"
   - For years: "+3 years" or "-5 years"
   - For percentages: "+2%" or "-1.5%"
3. Explain CAUSE and EFFECT relationships
4. Keep the explanation under 150 words
5. NEVER suggest modifying the base plan
6. NEVER use prescriptive language like "you should" or "you need to"
7. Be factual and neutral in tone

OUTPUT FORMAT (JSON):
{
  "explanation": "Your 2-4 sentence explanation starting with 'Compared to your base plan...'",
  "keyChanges": [
    { "metric": "Retirement Balance", "delta": "+$127K", "direction": "positive" },
    { "metric": "Fund Depletion", "delta": "Never depletes", "direction": "positive" }
  ]
}

The "direction" field indicates whether the change is beneficial:
- "positive": The change is favorable (more money, funds last longer)
- "negative": The change is unfavorable (less money, funds deplete sooner)
- "neutral": The change is neither clearly good nor bad`;

/**
 * Builds the user message with base and scenario data for the AI.
 */
export function buildScenarioExplainUserMessage(
  baseMetrics: {
    retirementBalance: number;
    yearsUntilDepletion: number | null;
    retirementAge: number;
  },
  scenarioMetrics: {
    retirementBalance: number;
    yearsUntilDepletion: number | null;
    retirementAge: number;
  },
  changedFields: Array<{
    field: string;
    previous: unknown;
    current: unknown;
  }>
): string {
  const formatDepletion = (years: number | null) =>
    years === null ? 'Never (funds last through age 90+)' : `${years} years after retirement`;

  const fieldsDescription = changedFields
    .map((f) => `- ${f.field}: ${f.previous} → ${f.current}`)
    .join('\n');

  return `BASE PLAN:
- Retirement Balance: $${baseMetrics.retirementBalance.toLocaleString()}
- Fund Depletion: ${formatDepletion(baseMetrics.yearsUntilDepletion)}
- Retirement Age: ${baseMetrics.retirementAge}

SCENARIO (What-If):
- Retirement Balance: $${scenarioMetrics.retirementBalance.toLocaleString()}
- Fund Depletion: ${formatDepletion(scenarioMetrics.yearsUntilDepletion)}
- Retirement Age: ${scenarioMetrics.retirementAge}

ASSUMPTIONS CHANGED:
${fieldsDescription}

Generate the comparison explanation.`;
}
