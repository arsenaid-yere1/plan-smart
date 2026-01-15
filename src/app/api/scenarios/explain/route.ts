import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { getServerUser } from '@/lib/auth/server';
import {
  SCENARIO_EXPLAIN_SYSTEM_PROMPT,
  SCENARIO_BANNED_PHRASES,
  buildScenarioExplainUserMessage,
} from '@/lib/ai/prompts/scenario-explain';
import type { ScenarioExplanationResponse } from '@/lib/scenarios/types';

interface ExplainRequestBody {
  baseProjection: {
    retirementBalance: number;
    yearsUntilDepletion: number | null;
    retirementAge: number;
  };
  scenarioProjection: {
    retirementBalance: number;
    yearsUntilDepletion: number | null;
    retirementAge: number;
  };
  changedFields: Array<{
    field: string;
    previous: unknown;
    current: unknown;
  }>;
}

/**
 * Validate response against banned phrases
 */
function validateExplanation(explanation: string): { valid: boolean; violations: string[] } {
  const lowerText = explanation.toLowerCase();
  const violations: string[] = [];

  for (const phrase of SCENARIO_BANNED_PHRASES) {
    if (lowerText.includes(phrase.toLowerCase())) {
      violations.push(phrase);
    }
  }

  return {
    valid: violations.length === 0,
    violations,
  };
}

export async function POST(request: Request) {
  try {
    // 1. Authenticate
    const user = await getServerUser();
    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Parse and validate request body
    const body: ExplainRequestBody = await request.json();

    if (!body.baseProjection || !body.scenarioProjection || !body.changedFields) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // 3. Build the user message
    const userMessage = buildScenarioExplainUserMessage(
      body.baseProjection,
      body.scenarioProjection,
      body.changedFields
    );

    // 4. Call OpenAI with retry logic
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const MAX_RETRIES = 2;
    let result: ScenarioExplanationResponse | null = null;
    let attempts = 0;

    while (attempts <= MAX_RETRIES && !result) {
      attempts++;

      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: SCENARIO_EXPLAIN_SYSTEM_PROMPT },
          { role: 'user', content: userMessage },
        ],
        response_format: { type: 'json_object' },
        temperature: 0,
        max_tokens: 512,
      });

      const content = completion.choices[0]?.message?.content;
      if (!content) {
        console.warn('Empty response from OpenAI on attempt', attempts);
        continue;
      }

      try {
        const parsed = JSON.parse(content) as ScenarioExplanationResponse;

        // Validate structure
        if (!parsed.explanation || !Array.isArray(parsed.keyChanges)) {
          console.warn('Invalid response structure on attempt', attempts);
          continue;
        }

        // Validate against banned phrases
        const validation = validateExplanation(parsed.explanation);
        if (!validation.valid) {
          console.warn('Banned phrases detected on attempt', attempts, validation.violations);
          continue;
        }

        // Validate explanation starts correctly
        if (!parsed.explanation.toLowerCase().startsWith('compared to your base plan')) {
          console.warn('Explanation does not start with required phrase on attempt', attempts);
          continue;
        }

        result = parsed;
      } catch (parseError) {
        console.warn('JSON parse error on attempt', attempts, parseError);
        continue;
      }
    }

    if (!result) {
      return NextResponse.json(
        { success: false, error: 'Failed to generate valid explanation after retries' },
        { status: 500 }
      );
    }

    // 5. Return success response
    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('Scenario explain error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
