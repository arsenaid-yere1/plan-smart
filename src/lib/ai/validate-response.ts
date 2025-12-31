import { BANNED_PHRASES } from './prompts/plan-summary';

export interface ValidationResult {
  valid: boolean;
  violations: string[];
}

/**
 * Validates AI-generated text against banned phrases.
 * Returns violations found (if any).
 *
 * @param text - The text to validate (can be individual section or full response)
 * @returns ValidationResult with valid flag and list of violations
 */
export function validateAgainstBannedPhrases(text: string): ValidationResult {
  const lowerText = text.toLowerCase();
  const violations: string[] = [];

  for (const phrase of BANNED_PHRASES) {
    if (lowerText.includes(phrase.toLowerCase())) {
      violations.push(phrase);
    }
  }

  return {
    valid: violations.length === 0,
    violations,
  };
}

/**
 * Validates all sections of an AI summary response.
 *
 * @param sections - The four sections of the AI summary
 * @returns ValidationResult combining all section validations
 */
export function validateSummaryResponse(sections: {
  whereYouStand: string;
  assumptions: string;
  lifestyle: string;
  disclaimer: string;
}): ValidationResult {
  const allText = `${sections.whereYouStand} ${sections.assumptions} ${sections.lifestyle}`;
  // Note: We skip disclaimer since it's a fixed template
  return validateAgainstBannedPhrases(allText);
}
