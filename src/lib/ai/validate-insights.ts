import { INSIGHTS_BANNED_PHRASES } from './prompts/insights-explain';

export interface InsightsValidationResult {
  valid: boolean;
  violations: string[];
}

/**
 * Validate insights explanation against banned phrases
 */
export function validateInsightsExplanation(text: string): InsightsValidationResult {
  const lowerText = text.toLowerCase();
  const violations: string[] = [];

  for (const phrase of INSIGHTS_BANNED_PHRASES) {
    if (lowerText.includes(phrase.toLowerCase())) {
      violations.push(phrase);
    }
  }

  return {
    valid: violations.length === 0,
    violations,
  };
}
