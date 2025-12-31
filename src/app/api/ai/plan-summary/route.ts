import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { z } from 'zod';
import { getServerUser } from '@/lib/auth/server';
import { createSecureQuery } from '@/db/secure-query';
import { hashProjectionInputs } from '@/lib/ai/hash-inputs';
import { PLAN_SUMMARY_SYSTEM_PROMPT, type PlanSummaryResponse } from '@/lib/ai/prompts/plan-summary';
import { checkAIRegenerationLimit, incrementAIRegenerationCount } from '@/lib/ai/rate-limit';
import { getLifestyleLabel } from '@/lib/ai/lifestyle-label';
import { validateSummaryResponse } from '@/lib/ai/validate-response';
import type { ProjectionInput, ProjectionAssumptions, ProjectionSummary } from '@/lib/projections/types';

const requestSchema = z.object({
  projectionResultId: z.string().uuid(),
  regenerate: z.boolean().optional().default(false),
});

export async function POST(request: NextRequest) {
  try {
    const user = await getServerUser();
    if (!user) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    // Parse and validate request
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ message: 'Invalid JSON' }, { status: 400 });
    }

    const parseResult = requestSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        { message: 'Invalid request', errors: parseResult.error.flatten() },
        { status: 400 }
      );
    }

    const { projectionResultId, regenerate } = parseResult.data;
    const secureQuery = createSecureQuery(user.id);

    // Fetch the projection result (validates ownership)
    const projection = await secureQuery.getProjectionById(projectionResultId);
    if (!projection) {
      return NextResponse.json(
        { message: 'Projection not found or access denied' },
        { status: 404 }
      );
    }

    // Calculate input hash for caching
    const inputHash = hashProjectionInputs(projection.inputs as ProjectionInput);

    // Check cache (unless regenerate requested)
    if (!regenerate) {
      const cached = await secureQuery.getAISummaryForProjection(projectionResultId, inputHash);
      if (cached) {
        return NextResponse.json({
          summary: cached.sections,
          meta: {
            cached: true,
            generatedAt: cached.createdAt.toISOString(),
            projectionVersion: inputHash.slice(0, 8),
            model: cached.model,
          },
        });
      }
    }

    // Check rate limit for regeneration
    if (regenerate) {
      const rateLimit = checkAIRegenerationLimit(user.id);
      if (!rateLimit.allowed) {
        return NextResponse.json(
          {
            message: 'Rate limit exceeded',
            remaining: rateLimit.remaining,
            resetAt: rateLimit.resetAt.toISOString(),
          },
          { status: 429 }
        );
      }
    }

    // Check OpenAI API key
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { message: 'AI service not configured' },
        { status: 503 }
      );
    }

    // Build context for AI
    const { context: userContext, tone, lifestyleLabel } = buildUserContext(
      projection.inputs as ProjectionInput,
      projection.assumptions as ProjectionAssumptions,
      projection.summary as ProjectionSummary
    );

    // Generate narrative via OpenAI with retry logic for banned phrases
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const MAX_RETRIES = 2;
    let sections: PlanSummaryResponse | null = null;
    let attempts = 0;
    let generationTimeMs = 0;
    let tokensUsed: number | undefined;

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
      generationTimeMs = Math.round(performance.now() - startTime);
      tokensUsed = completion.usage?.total_tokens;

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

    // Save to cache
    const saved = await secureQuery.saveAISummary({
      projectionResultId,
      inputHash,
      sections,
      model: 'gpt-4o-mini',
      tokensUsed,
      generationTimeMs,
    });

    // Increment rate limit counter if this was a regeneration
    if (regenerate) {
      incrementAIRegenerationCount(user.id);
    }

    return NextResponse.json({
      summary: sections,
      meta: {
        cached: false,
        generatedAt: saved.createdAt.toISOString(),
        projectionVersion: inputHash.slice(0, 8),
        model: 'gpt-4o-mini',
      },
    });

  } catch (error) {
    console.error('AI plan summary error:', error);
    return NextResponse.json(
      { message: 'Failed to generate plan summary' },
      { status: 500 }
    );
  }
}

function buildUserContext(
  inputs: ProjectionInput,
  assumptions: ProjectionAssumptions,
  summary: ProjectionSummary
): { context: string; tone: 'optimistic' | 'neutral' | 'cautious'; lifestyleLabel: 'simple' | 'moderate' | 'flexible' } {
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
