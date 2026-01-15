/**
 * Banned phrases for insights explanations.
 * Prevents prescriptive language while allowing observational statements.
 */
export const INSIGHTS_BANNED_PHRASES = [
  'you should',
  'you need to',
  'you must',
  'you have to',
  'consider changing',
  'i recommend',
  'i suggest',
  'focus on',
  'prioritize',
  'take action',
  'immediately',
  'urgently',
];

/**
 * System prompt for lever explanation generation
 */
export const LEVER_EXPLANATION_SYSTEM_PROMPT = `You explain retirement projection sensitivity analysis results.

CRITICAL RULES:
1. NEVER use prescriptive language ("you should", "you need to", "consider")
2. Use ONLY observational language ("has the biggest effect", "shows the largest impact")
3. Include quantified impacts from the data provided
4. Keep explanations factual and bounded to the analysis

FORMAT:
- Lead with the #1 lever and its quantified impact
- Briefly mention the other top factors
- Keep to 2-3 sentences total

EXAMPLE:
"Expected return has the biggest effect on your projected retirement balance. A 1% higher return would add approximately $127,000 to your retirement funds. Your retirement age and annual savings also show meaningful impact on long-term outcomes."

OUTPUT FORMAT (JSON):
{
  "explanation": "Your 2-3 sentence explanation using observational language only."
}`;

/**
 * System prompt for sensitivity explanation generation
 */
export const SENSITIVITY_EXPLANATION_SYSTEM_PROMPT = `You explain which assumptions a retirement projection is most sensitive to.

CRITICAL RULES:
1. Use observational language ONLY ("your projection depends heavily on", "shows sensitivity to")
2. NEVER suggest immediate action or changes
3. Encourage periodic review, not urgent response
4. Include the quantified sensitivity from the data
5. Frame as informational awareness, not advice

TONE:
- Educational and calm
- Forward-looking but not alarming
- Emphasize understanding over action

EXAMPLE:
"Your projection shows the most sensitivity to expected investment returns and retirement timing. The return assumption has a particularly large influence—variations of 1% translate to significant differences in projected outcomes. These assumptions are worth revisiting periodically as market conditions and your plans evolve."

OUTPUT FORMAT (JSON):
{
  "explanation": "Your 2-3 sentence explanation using observational language only."
}`;

/**
 * Build user message for lever explanation
 */
export function buildLeverUserMessage(
  levers: Array<{
    displayName: string;
    testDirection: string;
    testDelta: number;
    impactOnBalance: number;
  }>,
  formatDelta: (lever: string, delta: number) => string,
  formatCurrency: (value: number) => string,
  baselineBalance: number,
  baselineDepletion: number | null
): string {
  const leverDescriptions = levers.map((lever, index) =>
    `${index + 1}. ${lever.displayName}: ${lever.testDirection === 'increase' ? '+' : '-'}${formatDelta(lever.displayName.toLowerCase().replace(/ /g, ''), lever.testDelta)} → ${formatCurrency(lever.impactOnBalance)} impact on retirement balance`
  ).join('\n');

  const depletionText = baselineDepletion === null
    ? 'Never (sustainable)'
    : `${baselineDepletion} years after retirement`;

  return `TOP 3 LEVERS BY IMPACT:
${leverDescriptions}

BASELINE:
- Retirement Balance: ${formatCurrency(baselineBalance)}
- Fund Depletion: ${depletionText}

Generate a 2-3 sentence explanation of these findings using observational language only.`;
}

/**
 * Build user message for sensitivity explanation
 */
export function buildSensitivityUserMessage(
  assumptions: Array<{
    displayName: string;
    formattedValue: string;
    sensitivityScore: number;
    explanation: string;
  }>
): string {
  const assumptionDescriptions = assumptions.map((a, index) =>
    `${index + 1}. ${a.displayName} (Current: ${a.formattedValue}, Sensitivity: ${a.sensitivityScore}%)\n   ${a.explanation}`
  ).join('\n\n');

  return `MOST SENSITIVE ASSUMPTIONS:
${assumptionDescriptions}

Generate a 2-3 sentence explanation about these sensitivity findings. Encourage periodic review rather than immediate action.`;
}
