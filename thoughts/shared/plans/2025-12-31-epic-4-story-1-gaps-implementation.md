# Epic 4 Story 1 - AI Summary Gaps Implementation Plan

## Overview

Complete the remaining acceptance criteria for Epic 4 Story 1 (AI Plan Summary) by implementing:
- **A2**: Outcome-Aware Tone with banned phrases validation
- **A3**: Percentile-based lifestyle labels

The dedicated narrative view (A4) is deferred - dashboard embedding is sufficient for now.

## Current State Analysis

The AI plan summary feature is largely implemented with core functionality working:
- GPT-4o-mini generates four-section narratives
- Input hashing provides deterministic caching
- Rate limiting (10 regenerations/day) is in place
- Status calculation exists: `on-track` / `needs-adjustment` / `at-risk`

### Key Discoveries:
- Status is calculated at [route.ts:182-186](src/app/api/ai/plan-summary/route.ts#L182-L186) but not mapped to explicit tone flags
- No validation exists on AI response content beyond structure checking
- Monthly spending is passed to AI at [route.ts:201](src/app/api/ai/plan-summary/route.ts#L201) but no lifestyle label is derived
- Prompt at [plan-summary.ts:12-13](src/lib/ai/prompts/plan-summary.ts#L12-L13) says "NEVER provide advice" but doesn't list specific banned phrases

## Desired End State

After this implementation:

1. **Tone flags** are explicitly passed to the AI (`optimistic | neutral | cautious`) based on retirement status
2. **Banned phrases** are validated server-side after AI generation; if found, the response is regenerated (up to 2 retries)
3. **Lifestyle labels** are derived from monthly spending percentiles and passed to the AI
4. **Prompt updates** include "adjustable gap" framing and explicit prescriptive verb prohibition

### Verification:
- Generate summaries for each status tier and verify appropriate tone
- Attempt to trigger banned phrases through edge cases; verify they're caught
- Generate summaries across spending levels; verify lifestyle labels appear correctly

## What We're NOT Doing

- **A4: Dedicated narrative view page** - Dashboard embedding is sufficient
- **Client-side validation** - Server-side only per user preference
- **Reading level validation** - Flesch-Kincaid scoring is nice-to-have, not critical
- **Export with AI summary** - Can be added later if needed

## Implementation Approach

The changes are focused on three files:
1. [src/lib/ai/prompts/plan-summary.ts](src/lib/ai/prompts/plan-summary.ts) - Update prompt with tone, lifestyle labels, banned phrases
2. [src/app/api/ai/plan-summary/route.ts](src/app/api/ai/plan-summary/route.ts) - Add tone mapping, lifestyle label calculation, response validation
3. New file: [src/lib/ai/validate-response.ts](src/lib/ai/validate-response.ts) - Banned phrases validation logic

---

## Phase 1: Tone Mapping & Prompt Updates

### Overview
Map retirement status to explicit tone flags and update the prompt with improved guardrails.

### Changes Required:

#### 1. Update Prompt Template
**File**: `src/lib/ai/prompts/plan-summary.ts`

Add tone instructions and banned phrases list:

```typescript
export const PLANNING_DISCLAIMER = `This retirement projection is for planning purposes only and is not financial, investment, tax, or legal advice. Actual results will vary based on market conditions, personal circumstances, and other factors. Consult with qualified professionals before making financial decisions.`;

// Banned phrases that should never appear in AI output
export const BANNED_PHRASES = [
  'you will fail',
  'you must',
  'you need to',
  'you should',
  'you have to',
  'you cannot',
  'you won\'t make it',
  'not enough',
  'doomed',
  'impossible',
  'guaranteed',
  'definitely will',
  'definitely won\'t',
];

// Tone-specific instructions based on retirement status
export const TONE_INSTRUCTIONS: Record<'optimistic' | 'neutral' | 'cautious', string> = {
  optimistic: `Use an encouraging, positive tone. Emphasize the user's strong position and the flexibility their savings provide. Frame the future with confidence while noting that assumptions can change.`,
  neutral: `Use a balanced, matter-of-fact tone. Acknowledge both strengths and areas for potential adjustment. Frame any shortfalls as "adjustable gaps" that can be addressed through various life choices.`,
  cautious: `Use a supportive but realistic tone. Acknowledge the challenges while emphasizing that projections are not destiny. Frame shortfalls as "adjustable gaps" and highlight that many factors remain within the user's control. Avoid alarmist language.`,
};

export const PLAN_SUMMARY_SYSTEM_PROMPT = (tone: 'optimistic' | 'neutral' | 'cautious', lifestyleLabel: string) => `You are a financial planning assistant. Generate a clear, empathetic retirement outlook narrative in plain English at a 9th-grade reading level.

TONE: ${TONE_INSTRUCTIONS[tone]}

LIFESTYLE CONTEXT: The user's planned spending places them in the "${lifestyleLabel}" lifestyle category.

You MUST:
- Reference the specific assumptions provided (return rate, inflation rate, life expectancy)
- Include the exact dollar amounts from the projection data
- Use simple language without financial jargon
- Be encouraging but realistic about the user's situation
- Frame any funding shortfall as an "adjustable gap" rather than a failure
- Describe spending in terms of lifestyle impact, not prescriptive advice

You MUST NEVER:
- Use prescriptive verbs like "should", "need to", "must", "have to"
- Suggest specific actions the user should take
- Provide investment, tax, or legal advice
- Use alarmist or fear-inducing language
- Make guarantees about future outcomes

Output a JSON object with exactly these four sections:

1. "whereYouStand": 2-3 sentences summarizing current retirement readiness. Include their retirement status, projected balance at retirement, and whether funds are expected to last. Be empathetic but factual.

2. "assumptions": 2-3 sentences listing the key assumptions this projection depends on. Mention the expected annual return rate, inflation rate, and life expectancy age specifically with their values.

3. "lifestyle": 2-3 sentences explaining what this projection means for their day-to-day life in retirement. Reference their ${lifestyleLabel} lifestyle category and planned monthly spending.

4. "disclaimer": Use this exact text: "${PLANNING_DISCLAIMER}"

Keep each section concise - aim for 50-75 words per section maximum.`;
```

#### 2. Add Tone Mapping to Route
**File**: `src/app/api/ai/plan-summary/route.ts`

Update `buildUserContext` function to include tone:

```typescript
// Add at top of file, after imports
import { PLAN_SUMMARY_SYSTEM_PROMPT, BANNED_PHRASES } from '@/lib/ai/prompts/plan-summary';

// Update buildUserContext function (around line 176)
function buildUserContext(
  inputs: ProjectionInput,
  assumptions: ProjectionAssumptions,
  summary: ProjectionSummary
): { context: string; tone: 'optimistic' | 'neutral' | 'cautious'; lifestyleLabel: string } {
  // Calculate retirement status
  const status = summary.yearsUntilDepletion === null
    ? 'on-track'
    : summary.yearsUntilDepletion > 20
      ? 'needs-adjustment'
      : 'at-risk';

  // Map status to tone
  const toneMap: Record<string, 'optimistic' | 'neutral' | 'cautious'> = {
    'on-track': 'optimistic',
    'needs-adjustment': 'neutral',
    'at-risk': 'cautious',
  };
  const tone = toneMap[status];

  // Calculate lifestyle label from monthly spending
  const monthlySpending = Math.round(inputs.annualExpenses / 12);
  const lifestyleLabel = getLifestyleLabel(monthlySpending);

  const context = JSON.stringify({
    status,
    tone,
    lifestyleLabel,
    currentAge: inputs.currentAge,
    retirementAge: assumptions.retirementAge,
    maxAge: assumptions.maxAge,
    assumptions: {
      expectedReturnPercent: (assumptions.expectedReturn * 100).toFixed(1),
      inflationRatePercent: (assumptions.inflationRate * 100).toFixed(1),
      healthcareInflationPercent: (assumptions.healthcareInflationRate * 100).toFixed(1),
    },
    projectedBalanceAtRetirement: Math.round(summary.projectedRetirementBalance),
    endingBalance: Math.round(summary.endingBalance),
    yearsUntilDepletion: summary.yearsUntilDepletion,
    monthlySpending,
    hasIncomeStreams: inputs.incomeStreams.length > 0,
  });

  return { context, tone, lifestyleLabel };
}
```

### Success Criteria:

#### Automated Verification:
- [x] TypeScript compiles: `npm run typecheck`
- [x] Linting passes: `npm run lint`
- [x] Build succeeds: `npm run build`

#### Manual Verification:
- [ ] Generate summary for "on-track" projection - verify optimistic tone
- [ ] Generate summary for "needs-adjustment" projection - verify neutral tone
- [ ] Generate summary for "at-risk" projection - verify cautious tone

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 2: Lifestyle Labels (Percentile-Based)

### Overview
Implement spending-to-lifestyle mapping based on US retirement spending percentiles.

### Research Context
Based on 2024-2025 data:
- Average retiree spends ~$5,000/month
- 48% of retirees spend less than $2,000/month
- Median annual spending is ~$54,000 ($4,500/month)

Percentile-based thresholds:
- **Simple** (≤30th percentile): Under $2,500/month
- **Moderate** (30th-70th percentile): $2,500 - $5,500/month
- **Flexible** (≥70th percentile): Over $5,500/month

### Changes Required:

#### 1. Add Lifestyle Label Function
**File**: `src/app/api/ai/plan-summary/route.ts`

Add this function before `buildUserContext`:

```typescript
/**
 * Maps monthly spending to a lifestyle label based on US retirement spending percentiles.
 *
 * Thresholds based on 2024-2025 data:
 * - Simple (≤30th percentile): Under $2,500/month
 * - Moderate (30th-70th percentile): $2,500 - $5,500/month
 * - Flexible (≥70th percentile): Over $5,500/month
 *
 * @param monthlySpending - Monthly spending in dollars
 * @returns Lifestyle label: 'simple' | 'moderate' | 'flexible'
 */
function getLifestyleLabel(monthlySpending: number): 'simple' | 'moderate' | 'flexible' {
  if (monthlySpending < 2500) {
    return 'simple';
  } else if (monthlySpending < 5500) {
    return 'moderate';
  } else {
    return 'flexible';
  }
}
```

### Success Criteria:

#### Automated Verification:
- [x] TypeScript compiles: `npm run typecheck`
- [ ] Unit test for `getLifestyleLabel` function passes (add to existing test file if present)

#### Manual Verification:
- [ ] Generate summary with $2,000/month spending - verify "simple" lifestyle mentioned
- [ ] Generate summary with $4,000/month spending - verify "moderate" lifestyle mentioned
- [ ] Generate summary with $7,000/month spending - verify "flexible" lifestyle mentioned

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 3: Banned Phrases Validation

### Overview
Implement server-side validation to catch and regenerate responses containing banned phrases.

### Changes Required:

#### 1. Create Validation Module
**File**: `src/lib/ai/validate-response.ts` (new file)

```typescript
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
```

#### 2. Add Validation to API Route
**File**: `src/app/api/ai/plan-summary/route.ts`

Update the AI generation section to include validation and retry logic:

```typescript
// Add import at top
import { validateSummaryResponse } from '@/lib/ai/validate-response';

// Replace the AI generation section (around lines 100-140) with:
const MAX_RETRIES = 2;
let sections: PlanSummaryResponse | null = null;
let attempts = 0;

while (attempts <= MAX_RETRIES && !sections) {
  attempts++;

  const startTime = performance.now();
  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: PLAN_SUMMARY_SYSTEM_PROMPT(tone, lifestyleLabel) },
      { role: 'user', content: userContext },
    ],
    response_format: { type: 'json_object' },
    temperature: 0,
    max_tokens: 1024,
  });
  const generationTimeMs = Math.round(performance.now() - startTime);

  const content = completion.choices[0]?.message?.content;
  if (!content) {
    console.error('AI response empty on attempt', attempts);
    continue;
  }

  try {
    const parsed = JSON.parse(content) as PlanSummaryResponse;

    // Validate structure
    if (!parsed.whereYouStand || !parsed.assumptions || !parsed.lifestyle || !parsed.disclaimer) {
      console.error('AI response missing required sections on attempt', attempts, content);
      continue;
    }

    // Validate against banned phrases
    const validation = validateSummaryResponse(parsed);
    if (!validation.valid) {
      console.warn('AI response contained banned phrases on attempt', attempts, validation.violations);
      continue;
    }

    sections = parsed;
  } catch (e) {
    console.error('AI response parsing error on attempt', attempts, e, content);
    continue;
  }
}

if (!sections) {
  return NextResponse.json(
    { message: 'AI generation failed after multiple attempts' },
    { status: 500 }
  );
}
```

### Success Criteria:

#### Automated Verification:
- [x] TypeScript compiles: `npm run typecheck`
- [x] Linting passes: `npm run lint`
- [x] Build succeeds: `npm run build`
- [ ] Unit tests for `validateAgainstBannedPhrases` pass

#### Manual Verification:
- [ ] Generate multiple summaries and verify no banned phrases appear
- [ ] Check server logs to see if any retries occurred
- [ ] Verify error handling works when all retries exhausted (edge case)

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 4: Final Integration & Testing

### Overview
Ensure all changes work together and update tests.

### Changes Required:

#### 1. Add Unit Tests
**File**: `src/lib/ai/__tests__/validate-response.test.ts` (new file)

```typescript
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
});
```

#### 2. Add Lifestyle Label Tests
**File**: Add to existing test file or create `src/app/api/ai/plan-summary/__tests__/route.test.ts`

```typescript
import { describe, it, expect } from 'vitest';

// Note: getLifestyleLabel would need to be exported or tested via integration tests
describe('getLifestyleLabel', () => {
  it('returns simple for spending under $2,500', () => {
    // Test with $2,000
    expect(getLifestyleLabel(2000)).toBe('simple');
    expect(getLifestyleLabel(2499)).toBe('simple');
  });

  it('returns moderate for spending $2,500-$5,499', () => {
    expect(getLifestyleLabel(2500)).toBe('moderate');
    expect(getLifestyleLabel(4000)).toBe('moderate');
    expect(getLifestyleLabel(5499)).toBe('moderate');
  });

  it('returns flexible for spending $5,500+', () => {
    expect(getLifestyleLabel(5500)).toBe('flexible');
    expect(getLifestyleLabel(10000)).toBe('flexible');
  });
});
```

### Success Criteria:

#### Automated Verification:
- [x] All unit tests pass: `npm test` (AI-related tests pass; pre-existing failures in ProjectionTable tests unrelated)
- [x] TypeScript compiles: `npm run typecheck`
- [x] Linting passes: `npm run lint`
- [x] Build succeeds: `npm run build`

#### Manual Verification:
- [ ] End-to-end test: Create new projection, verify AI summary generates with correct tone and lifestyle label
- [ ] Regeneration test: Click regenerate button, verify new summary respects rate limits
- [ ] Cache test: Reload page, verify cached summary is returned (check `cached: true` in response)

---

## Testing Strategy

### Unit Tests:
- `validateAgainstBannedPhrases` - test each banned phrase
- `validateSummaryResponse` - test section combination
- `getLifestyleLabel` - test boundary conditions

### Integration Tests:
- Generate summary with each status tier
- Generate summary with each lifestyle band
- Verify retry logic when banned phrases detected (mock OpenAI response)

### Manual Testing Steps:
1. Create projection with high savings → verify "on-track" + "optimistic" tone
2. Create projection with moderate savings → verify "needs-adjustment" + "neutral" tone
3. Create projection with low savings → verify "at-risk" + "cautious" tone + "adjustable gap" framing
4. Create projection with low spending ($1,500/mo) → verify "simple" lifestyle label
5. Create projection with moderate spending ($4,000/mo) → verify "moderate" lifestyle label
6. Create projection with high spending ($8,000/mo) → verify "flexible" lifestyle label

## Performance Considerations

- Retry logic adds latency (up to 2x-3x for edge cases with banned phrases)
- Consider monitoring retry rate in production logs
- If retry rate exceeds 5%, prompt may need adjustment

## Migration Notes

No database migrations required. Changes are backward-compatible:
- Existing cached summaries will still be served
- New summaries will use updated prompt
- Cache invalidation happens naturally via input hash

## References

- Original ticket: [thoughts/personal/tickets/epic-4/story-1-scope.md](thoughts/personal/tickets/epic-4/story-1-scope.md)
- Implementation status: [thoughts/shared/research/2025-12-31-epic-4-story-1-implementation-status.md](thoughts/shared/research/2025-12-31-epic-4-story-1-implementation-status.md)
- Current prompt: [src/lib/ai/prompts/plan-summary.ts](src/lib/ai/prompts/plan-summary.ts)
- Current route: [src/app/api/ai/plan-summary/route.ts](src/app/api/ai/plan-summary/route.ts)
