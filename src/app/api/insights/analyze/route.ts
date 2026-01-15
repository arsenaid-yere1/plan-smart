import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { getServerUser } from '@/lib/auth/server';
import { db } from '@/db/client';
import { financialSnapshot } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { buildProjectionInputFromSnapshot } from '@/lib/projections/input-builder';
import {
  analyzeSensitivity,
  identifyLowFrictionWins,
  identifySensitiveAssumptions,
  formatDeltaValue,
} from '@/lib/projections/sensitivity';
import type { InsightsResponse } from '@/lib/projections/sensitivity-types';
import {
  LEVER_EXPLANATION_SYSTEM_PROMPT,
  SENSITIVITY_EXPLANATION_SYSTEM_PROMPT,
  buildLeverUserMessage,
  buildSensitivityUserMessage,
} from '@/lib/ai/prompts/insights-explain';
import { validateInsightsExplanation } from '@/lib/ai/validate-insights';

const MAX_RETRIES = 2;

/**
 * Format currency for display
 */
function formatCurrency(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${Math.round(value / 1_000)}K`;
  return `$${Math.round(value)}`;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function POST(_request: NextRequest) {
  try {
    // Authenticate
    const user = await getServerUser();
    if (!user) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    // Get financial snapshot
    const [snapshot] = await db
      .select()
      .from(financialSnapshot)
      .where(eq(financialSnapshot.userId, user.id))
      .limit(1);

    if (!snapshot) {
      return NextResponse.json(
        { message: 'Financial snapshot not found. Please complete onboarding.' },
        { status: 404 }
      );
    }

    // Build projection input
    const input = buildProjectionInputFromSnapshot(snapshot, {});

    // Run sensitivity analysis
    const sensitivityResult = analyzeSensitivity(input);

    // Identify low-friction wins
    const lowFrictionWins = identifyLowFrictionWins(input, sensitivityResult);

    // Identify sensitive assumptions
    const sensitiveAssumptions = identifySensitiveAssumptions(input, sensitivityResult);

    // Check if OpenAI is configured
    if (!process.env.OPENAI_API_KEY) {
      // Return results without AI explanations
      return NextResponse.json({
        topLevers: sensitivityResult.topLevers,
        leverExplanation: '',
        lowFrictionWins,
        sensitiveAssumptions,
        sensitivityExplanation: '',
        baseline: {
          balance: sensitivityResult.baselineBalance,
          depletion: sensitivityResult.baselineDepletion,
        },
      } satisfies InsightsResponse);
    }

    const openai = new OpenAI();

    // Generate lever explanation
    let leverExplanation = '';
    const leverUserMessage = buildLeverUserMessage(
      sensitivityResult.topLevers,
      formatDeltaValue,
      formatCurrency,
      sensitivityResult.baselineBalance,
      sensitivityResult.baselineDepletion
    );

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        const leverCompletion = await openai.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: LEVER_EXPLANATION_SYSTEM_PROMPT },
            { role: 'user', content: leverUserMessage },
          ],
          response_format: { type: 'json_object' },
          temperature: 0,
          max_tokens: 256,
        });

        const leverContent = leverCompletion.choices[0]?.message?.content;
        if (!leverContent) continue;

        const leverParsed = JSON.parse(leverContent) as { explanation: string };
        const validation = validateInsightsExplanation(leverParsed.explanation);

        if (validation.valid) {
          leverExplanation = leverParsed.explanation;
          break;
        } else {
          console.warn('Lever explanation validation failed:', validation.violations);
        }
      } catch (error) {
        console.error('Lever explanation generation error:', error);
      }
    }

    // Generate sensitivity explanation
    let sensitivityExplanation = '';
    const sensitivityUserMessage = buildSensitivityUserMessage(sensitiveAssumptions);

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        const sensitivityCompletion = await openai.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: SENSITIVITY_EXPLANATION_SYSTEM_PROMPT },
            { role: 'user', content: sensitivityUserMessage },
          ],
          response_format: { type: 'json_object' },
          temperature: 0,
          max_tokens: 256,
        });

        const sensitivityContent = sensitivityCompletion.choices[0]?.message?.content;
        if (!sensitivityContent) continue;

        const sensitivityParsed = JSON.parse(sensitivityContent) as { explanation: string };
        const validation = validateInsightsExplanation(sensitivityParsed.explanation);

        if (validation.valid) {
          sensitivityExplanation = sensitivityParsed.explanation;
          break;
        } else {
          console.warn('Sensitivity explanation validation failed:', validation.violations);
        }
      } catch (error) {
        console.error('Sensitivity explanation generation error:', error);
      }
    }

    return NextResponse.json({
      topLevers: sensitivityResult.topLevers,
      leverExplanation,
      lowFrictionWins,
      sensitiveAssumptions,
      sensitivityExplanation,
      baseline: {
        balance: sensitivityResult.baselineBalance,
        depletion: sensitivityResult.baselineDepletion,
      },
    } satisfies InsightsResponse);
  } catch (error) {
    console.error('Insights analysis error:', error);
    return NextResponse.json(
      { message: 'Failed to analyze insights' },
      { status: 500 }
    );
  }
}
