import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { getServerUser } from '@/lib/auth/server';

const EXTRACTION_PROMPT = `You are a financial data extraction assistant. Extract structured financial information from the user's natural language input.

Return a JSON object with the following structure (include only fields that are mentioned):
{
  "birthYear": number | null,
  "targetRetirementAge": number | null,
  "annualIncome": number | null,
  "savingsRate": number | null,
  "investmentAccounts": [
    {
      "label": string,
      "type": "401k" | "IRA" | "Roth_IRA" | "Brokerage" | "Cash" | "Other",
      "balance": number,
      "monthlyContribution": number | null
    }
  ] | null,
  "primaryResidence": {
    "estimatedValue": number | null,
    "mortgageBalance": number | null,
    "interestRate": number | null
  } | null,
  "debts": [
    {
      "label": string,
      "type": "Mortgage" | "StudentLoan" | "CreditCard" | "AutoLoan" | "Other",
      "balance": number,
      "interestRate": number | null
    }
  ] | null,
  "incomeExpenses": {
    "monthlyEssential": number | null,
    "monthlyDiscretionary": number | null
  } | null,
  "confidence": {
    "overall": number,
    "fields": { [key: string]: number }
  }
}

Rules:
- Convert ages to birth years (current year is ${new Date().getFullYear()})
- Convert "k" notation to actual numbers (e.g., "300k" = 300000)
- Convert percentages to decimal where appropriate
- Infer account types from context (e.g., "retirement savings" likely means 401k or IRA)
- confidence scores should be 0-1 (1 = very confident, 0.5 = uncertain)
- Only include fields that are explicitly or strongly implied in the input`;

export async function POST(request: NextRequest) {
  try {
    // Verify authentication
    const user = await getServerUser();
    if (!user) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const { text } = await request.json();

    if (!text || typeof text !== 'string') {
      return NextResponse.json(
        { message: 'Text input is required' },
        { status: 400 }
      );
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { message: 'OpenAI API key not configured' },
        { status: 500 }
      );
    }

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: EXTRACTION_PROMPT },
        { role: 'user', content: text },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.1,
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      return NextResponse.json(
        { message: 'Failed to parse response' },
        { status: 500 }
      );
    }

    const parsed = JSON.parse(content);

    return NextResponse.json({
      success: true,
      data: parsed,
    });
  } catch (error) {
    console.error('NL parsing error:', error);
    return NextResponse.json(
      { message: 'Failed to parse financial data' },
      { status: 500 }
    );
  }
}
