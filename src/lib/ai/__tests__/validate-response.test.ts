import { describe, it, expect } from 'vitest';
import { validateAgainstBannedPhrases, validateSummaryResponse } from '../validate-response';

describe('validateAgainstBannedPhrases', () => {
  it('returns valid for clean text', () => {
    const result = validateAgainstBannedPhrases('Your retirement looks promising with current savings.');
    expect(result.valid).toBe(true);
    expect(result.violations).toHaveLength(0);
  });

  it('catches "you must" phrase', () => {
    const result = validateAgainstBannedPhrases('You must save more money.');
    expect(result.valid).toBe(false);
    expect(result.violations).toContain('you must');
  });

  it('catches "you should" phrase', () => {
    const result = validateAgainstBannedPhrases('You should consider reducing expenses.');
    expect(result.valid).toBe(false);
    expect(result.violations).toContain('you should');
  });

  it('catches multiple violations', () => {
    const result = validateAgainstBannedPhrases('You must save more. You need to cut spending.');
    expect(result.valid).toBe(false);
    expect(result.violations).toContain('you must');
    expect(result.violations).toContain('you need to');
  });

  it('is case insensitive', () => {
    const result = validateAgainstBannedPhrases('YOU MUST save more.');
    expect(result.valid).toBe(false);
    expect(result.violations).toContain('you must');
  });

  it('catches "you will fail" phrase', () => {
    const result = validateAgainstBannedPhrases('At this rate, you will fail to meet your goals.');
    expect(result.valid).toBe(false);
    expect(result.violations).toContain('you will fail');
  });

  it('catches "guaranteed" phrase', () => {
    const result = validateAgainstBannedPhrases('This is guaranteed to work.');
    expect(result.valid).toBe(false);
    expect(result.violations).toContain('guaranteed');
  });
});

describe('validateSummaryResponse', () => {
  it('validates all sections except disclaimer', () => {
    const sections = {
      whereYouStand: 'Your retirement is on track.',
      assumptions: 'This assumes 7% returns.',
      lifestyle: 'You should reduce spending.', // Contains banned phrase
      disclaimer: 'This is not financial advice.',
    };
    const result = validateSummaryResponse(sections);
    expect(result.valid).toBe(false);
    expect(result.violations).toContain('you should');
  });

  it('passes for valid response', () => {
    const sections = {
      whereYouStand: 'Your retirement is on track.',
      assumptions: 'This assumes 7% returns.',
      lifestyle: 'This spending level supports a moderate lifestyle.',
      disclaimer: 'This is not financial advice.',
    };
    const result = validateSummaryResponse(sections);
    expect(result.valid).toBe(true);
  });

  it('ignores banned phrases in disclaimer', () => {
    const sections = {
      whereYouStand: 'Your retirement is on track.',
      assumptions: 'This assumes 7% returns.',
      lifestyle: 'This spending level supports a moderate lifestyle.',
      disclaimer: 'You must consult a financial advisor.', // Banned phrase in disclaimer is OK
    };
    const result = validateSummaryResponse(sections);
    expect(result.valid).toBe(true);
  });

  it('catches violations in whereYouStand section', () => {
    const sections = {
      whereYouStand: 'You will fail to reach your retirement goals.',
      assumptions: 'This assumes 7% returns.',
      lifestyle: 'This spending level supports a moderate lifestyle.',
      disclaimer: 'This is not financial advice.',
    };
    const result = validateSummaryResponse(sections);
    expect(result.valid).toBe(false);
    expect(result.violations).toContain('you will fail');
  });
});
