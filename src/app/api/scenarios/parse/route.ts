import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { getServerUser } from '@/lib/auth/server';
import { SCENARIO_PARSE_PROMPT } from '@/lib/ai/prompts/scenario-parse';
import type { ParsedScenario, ParsedScenarioField } from '@/lib/scenarios/types';
import type { ProjectionOverrides } from '@/lib/projections/input-builder';

const FIELD_LABELS: Record<string, string> = {
  expectedReturn: 'Expected Return',
  inflationRate: 'Inflation Rate',
  retirementAge: 'Retirement Age',
  maxAge: 'Life Expectancy',
  contributionGrowthRate: 'Contribution Growth Rate',
  annualHealthcareCosts: 'Annual Healthcare Costs',
  healthcareInflationRate: 'Healthcare Inflation Rate',
};

function formatDisplayValue(key: string, value: number): string {
  switch (key) {
    case 'expectedReturn':
    case 'inflationRate':
    case 'contributionGrowthRate':
    case 'healthcareInflationRate':
      return `${(value * 100).toFixed(1)}%`;
    case 'retirementAge':
    case 'maxAge':
      return `Age ${value}`;
    case 'annualHealthcareCosts':
      return `$${value.toLocaleString()}/year`;
    default:
      return String(value);
  }
}

export async function POST(request: Request) {
  try {
    const user = await getServerUser();
    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { query } = await request.json();
    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: 'Query is required' },
        { status: 400 }
      );
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { success: false, error: 'OpenAI API key not configured' },
        { status: 500 }
      );
    }

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: SCENARIO_PARSE_PROMPT },
        { role: 'user', content: query },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.1,
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      return NextResponse.json(
        { success: false, error: 'Failed to parse response' },
        { status: 500 }
      );
    }

    const parsed = JSON.parse(content);

    // Filter out null values from overrides
    const overrides: Record<string, number> = {};
    const fields: ParsedScenarioField[] = [];

    for (const [key, value] of Object.entries(parsed.overrides || {})) {
      if (value !== null && value !== undefined) {
        overrides[key] = value as number;
        fields.push({
          key: key as keyof ProjectionOverrides,
          label: FIELD_LABELS[key] || key,
          value: value as number,
          displayValue: formatDisplayValue(key, value as number),
          confidence: parsed.confidence?.fields?.[key] ?? parsed.confidence?.overall ?? 0.8,
        });
      }
    }

    const scenario: ParsedScenario = {
      overrides,
      fields,
      confidence: {
        overall: parsed.confidence?.overall ?? 0.8,
        fields: parsed.confidence?.fields ?? {},
      },
      originalQuery: query,
    };

    return NextResponse.json({ success: true, data: scenario });
  } catch (error) {
    console.error('Scenario parse error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to parse scenario' },
      { status: 500 }
    );
  }
}
