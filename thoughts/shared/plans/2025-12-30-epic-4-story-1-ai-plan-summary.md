# AI Plan Summary Implementation Plan

## Overview

Implement an AI-generated plain-English retirement narrative that explains the user's retirement outlook with embedded assumptions and disclaimers. The feature generates four narrative sections (Where You Stand, Assumptions, Lifestyle Impact, Disclaimer) using GPT-4o-mini with deterministic caching.

## Current State Analysis

### What Exists
- **OpenAI integration**: GPT-4o-mini in `/api/parse-financial-nl` with `temperature: 0.1`
- **Projection storage**: `projection_results` table with JSONB inputs, assumptions, records, summary
- **UI location**: Plans page (`plans-client.tsx`) with projection charts and tables
- **Authentication**: `getServerUser()` pattern with Supabase
- **Rate limiting**: Login/email rate limiting exists but not applied to AI endpoints

### What's Missing
- AI narrative generation endpoint
- Response caching with input hash
- Rate limiting for AI regeneration
- UI component to display summary
- Database table for cached summaries

### Key Discoveries
- Projection inputs are already versioned and stored ([src/db/schema/projection-results.ts:22-29](src/db/schema/projection-results.ts#L22-L29))
- `ProjectionAssumptions` type exists for human-readable assumption display ([src/lib/projections/types.ts:173-180](src/lib/projections/types.ts#L173-L180))
- Status classification (`on-track`, `needs-adjustment`, `at-risk`) at [src/lib/projections/status.ts](src/lib/projections/status.ts)
- Low temperature (0.1) already used for consistency in existing AI endpoint

## Desired End State

After implementation:
1. Users see an AI-generated narrative summary on their Plans page explaining their retirement outlook
2. The summary references specific assumptions (return rate, inflation, lifespan)
3. Summaries are cached - identical projection inputs return identical narratives
4. Users can force regenerate (max 10/day) if they want fresh wording
5. If AI fails, users see a fallback with status badge and key metrics
6. All narratives include a legal disclaimer

### Verification
- Navigate to `/plans` with an existing projection
- AI summary card appears between status badge and content grid
- Summary contains all four sections with embedded assumption values
- Refreshing page returns cached (not regenerated) summary
- Clicking "Regenerate" creates new summary (up to rate limit)
- Disconnecting OpenAI shows fallback UI

## What We're NOT Doing

- **Multilingual support** - English only for v1
- **Audio narration** - No text-to-speech
- **Legal review** - Using draft disclaimer, revisit before public launch
- **Reading level validation** - Trust prompt engineering, no Flesch-Kincaid check
- **Cost tracking** - No per-user billing dashboard
- **Streaming responses** - Full response only

## Implementation Approach

We'll implement in four phases:
1. Database schema for caching AI summaries
2. Backend API endpoint with OpenAI integration and caching
3. Frontend component to display summaries
4. Rate limiting for regeneration requests

---

## Phase 1: Database Schema

### Overview
Create the `ai_summaries` table to cache generated narratives with input hash for invalidation.

### Changes Required

#### 1. Schema Definition
**File**: `src/db/schema/ai-summaries.ts` (new file)

```typescript
import { pgTable, uuid, varchar, jsonb, integer, timestamp, unique } from 'drizzle-orm/pg-core';
import { projectionResults } from './projection-results';
import { userProfile } from './user-profile';

// AI-generated narrative summaries for retirement projections
// Cached by input hash - same projection inputs return same narrative
export const aiSummaries = pgTable('ai_summaries', {
  id: uuid('id').primaryKey().defaultRandom(),

  // Foreign key to projection this summary explains
  projectionResultId: uuid('projection_result_id')
    .notNull()
    .references(() => projectionResults.id, { onDelete: 'cascade' }),

  // User ownership for RLS
  userId: uuid('user_id')
    .notNull()
    .references(() => userProfile.id, { onDelete: 'cascade' }),

  // SHA-256 hash of projection inputs for cache invalidation
  inputHash: varchar('input_hash', { length: 64 }).notNull(),

  // The four narrative sections
  sections: jsonb('sections').$type<{
    whereYouStand: string;
    assumptions: string;
    lifestyle: string;
    disclaimer: string;
  }>().notNull(),

  // Metadata for debugging and cost tracking
  model: varchar('model', { length: 50 }).notNull(),
  tokensUsed: integer('tokens_used'),
  generationTimeMs: integer('generation_time_ms'),

  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  // Unique constraint: one summary per projection + input hash combination
  projectionInputUnique: unique().on(table.projectionResultId, table.inputHash),
}));

// Type for the sections JSONB column
export type AISummarySections = {
  whereYouStand: string;
  assumptions: string;
  lifestyle: string;
  disclaimer: string;
};
```

#### 2. Export from Schema Index
**File**: `src/db/schema/index.ts`
**Changes**: Add export for new schema

```typescript
export * from './ai-summaries';
```

#### 3. Migration
**File**: `src/db/migrations/XXXX_ai_summaries.sql` (generated by drizzle-kit)

The migration will include:
- Table creation with all columns
- Foreign key constraints with CASCADE delete
- Unique constraint on (projection_result_id, input_hash)
- RLS policy: `auth.uid() = user_id`
- Indexes on user_id and projection_result_id

### Success Criteria

#### Automated Verification:
- [x] Run `npm run db:generate` - migration file created
- [x] Run `npx drizzle-kit push` - table created in database
- [x] TypeScript compiles without errors: `npm run typecheck`

#### Manual Verification:
- [ ] Verify table exists in Supabase dashboard
- [ ] Verify RLS policy is active
- [ ] Verify foreign key constraints work (delete projection → cascade delete summary)

---

## Phase 2: Backend API Endpoint

### Overview
Create `/api/ai/plan-summary` POST endpoint that generates or retrieves cached AI narratives.

### Changes Required

#### 1. AI Prompt Constants
**File**: `src/lib/ai/prompts/plan-summary.ts` (new file)

```typescript
// Disclaimer text - can be updated without code changes
export const PLANNING_DISCLAIMER = `This retirement projection is for planning purposes only and is not financial, investment, tax, or legal advice. Actual results will vary based on market conditions, personal circumstances, and other factors. Consult with qualified professionals before making financial decisions.`;

// System prompt for narrative generation
export const PLAN_SUMMARY_SYSTEM_PROMPT = `You are a financial planning assistant. Generate a clear, empathetic retirement outlook narrative in plain English at a 9th-grade reading level.

You MUST:
- Reference the specific assumptions provided (return rate, inflation rate, life expectancy)
- Include the exact dollar amounts from the projection data
- Use simple language without financial jargon
- Be encouraging but realistic about the user's situation
- NEVER provide investment advice or specific recommendations
- NEVER suggest specific actions the user should take

Output a JSON object with exactly these four sections:

1. "whereYouStand": 2-3 sentences summarizing current retirement readiness. Include their retirement status, projected balance at retirement, and whether funds are expected to last. Be empathetic but factual.

2. "assumptions": 2-3 sentences listing the key assumptions this projection depends on. Mention the expected annual return rate, inflation rate, and life expectancy age specifically with their values.

3. "lifestyle": 2-3 sentences explaining what this projection means for their day-to-day life in retirement. Reference their planned monthly spending if provided.

4. "disclaimer": Use this exact text: "${PLANNING_DISCLAIMER}"

Keep each section concise - aim for 50-75 words per section maximum.`;

// Type for the AI response
export interface PlanSummaryResponse {
  whereYouStand: string;
  assumptions: string;
  lifestyle: string;
  disclaimer: string;
}
```

#### 2. Input Hashing Utility
**File**: `src/lib/ai/hash-inputs.ts` (new file)

```typescript
import { createHash } from 'crypto';
import type { ProjectionInput } from '@/lib/projections/types';

/**
 * Create a deterministic SHA-256 hash of projection inputs for caching.
 * Same inputs always produce the same hash.
 */
export function hashProjectionInputs(inputs: ProjectionInput): string {
  // Sort keys to ensure deterministic stringification
  const sortedInputs = JSON.stringify(inputs, Object.keys(inputs).sort());
  return createHash('sha256').update(sortedInputs).digest('hex');
}
```

#### 3. Rate Limiting for AI Regeneration
**File**: `src/lib/ai/rate-limit.ts` (new file)

```typescript
// In-memory rate limiting for AI regeneration requests
// Resets at midnight UTC

interface RateLimitEntry {
  count: number;
  resetAt: number; // UTC midnight timestamp
}

const regenerationLimits = new Map<string, RateLimitEntry>();

const MAX_REGENERATIONS_PER_DAY = 10;

function getMidnightUTC(): number {
  const now = new Date();
  const midnight = new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() + 1, // Next midnight
    0, 0, 0, 0
  ));
  return midnight.getTime();
}

export function checkAIRegenerationLimit(userId: string): {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
} {
  const entry = regenerationLimits.get(userId);
  const now = Date.now();

  // No entry or expired - user has full quota
  if (!entry || entry.resetAt < now) {
    return {
      allowed: true,
      remaining: MAX_REGENERATIONS_PER_DAY,
      resetAt: new Date(getMidnightUTC()),
    };
  }

  const remaining = MAX_REGENERATIONS_PER_DAY - entry.count;
  return {
    allowed: remaining > 0,
    remaining: Math.max(0, remaining),
    resetAt: new Date(entry.resetAt),
  };
}

export function incrementAIRegenerationCount(userId: string): void {
  const now = Date.now();
  const entry = regenerationLimits.get(userId);

  // Reset if expired
  if (!entry || entry.resetAt < now) {
    regenerationLimits.set(userId, {
      count: 1,
      resetAt: getMidnightUTC(),
    });
    return;
  }

  // Increment existing
  entry.count++;
}

// Cleanup old entries every hour
setInterval(() => {
  const now = Date.now();
  for (const [userId, entry] of regenerationLimits.entries()) {
    if (entry.resetAt < now) {
      regenerationLimits.delete(userId);
    }
  }
}, 60 * 60 * 1000);
```

#### 4. Secure Query Methods
**File**: `src/db/secure-query.ts`
**Changes**: Add methods for AI summary CRUD

```typescript
// Add to SecureQueryBuilder class:

async getAISummaryForProjection(projectionResultId: string, inputHash: string) {
  const [summary] = await db
    .select()
    .from(aiSummaries)
    .where(
      and(
        eq(aiSummaries.projectionResultId, projectionResultId),
        eq(aiSummaries.inputHash, inputHash),
        eq(aiSummaries.userId, this.userId)
      )
    )
    .limit(1);
  return summary ?? null;
}

async saveAISummary(data: {
  projectionResultId: string;
  inputHash: string;
  sections: AISummarySections;
  model: string;
  tokensUsed?: number;
  generationTimeMs?: number;
}) {
  const [result] = await db
    .insert(aiSummaries)
    .values({
      projectionResultId: data.projectionResultId,
      userId: this.userId,
      inputHash: data.inputHash,
      sections: data.sections,
      model: data.model,
      tokensUsed: data.tokensUsed,
      generationTimeMs: data.generationTimeMs,
    })
    .onConflictDoUpdate({
      target: [aiSummaries.projectionResultId, aiSummaries.inputHash],
      set: {
        sections: data.sections,
        model: data.model,
        tokensUsed: data.tokensUsed,
        generationTimeMs: data.generationTimeMs,
      },
    })
    .returning();
  return result;
}
```

#### 5. API Route Handler
**File**: `src/app/api/ai/plan-summary/route.ts` (new file)

```typescript
import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { z } from 'zod';
import { getServerUser } from '@/lib/auth/server';
import { createSecureQuery } from '@/db/secure-query';
import { hashProjectionInputs } from '@/lib/ai/hash-inputs';
import { PLAN_SUMMARY_SYSTEM_PROMPT, type PlanSummaryResponse } from '@/lib/ai/prompts/plan-summary';
import { checkAIRegenerationLimit, incrementAIRegenerationCount } from '@/lib/ai/rate-limit';

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
    const inputHash = hashProjectionInputs(projection.inputs);

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
    const userContext = buildUserContext(projection);

    // Generate narrative via OpenAI
    const startTime = Date.now();
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: PLAN_SUMMARY_SYSTEM_PROMPT },
        { role: 'user', content: userContext },
      ],
      response_format: { type: 'json_object' },
      temperature: 0,
      max_tokens: 1024,
    });

    const generationTimeMs = Date.now() - startTime;
    const content = completion.choices[0]?.message?.content;

    if (!content) {
      return NextResponse.json(
        { message: 'AI generation failed - no response' },
        { status: 500 }
      );
    }

    // Parse and validate AI response
    let sections: PlanSummaryResponse;
    try {
      sections = JSON.parse(content);
      // Basic validation
      if (!sections.whereYouStand || !sections.assumptions ||
          !sections.lifestyle || !sections.disclaimer) {
        throw new Error('Missing required sections');
      }
    } catch (e) {
      console.error('AI response parsing error:', e, content);
      return NextResponse.json(
        { message: 'AI generation failed - invalid response format' },
        { status: 500 }
      );
    }

    // Save to cache
    const saved = await secureQuery.saveAISummary({
      projectionResultId,
      inputHash,
      sections,
      model: 'gpt-4o-mini',
      tokensUsed: completion.usage?.total_tokens,
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

function buildUserContext(projection: {
  inputs: ProjectionInput;
  assumptions: ProjectionAssumptions;
  summary: ProjectionSummary;
}): string {
  const { inputs, assumptions, summary } = projection;

  // Calculate retirement status
  const status = summary.yearsUntilDepletion === null
    ? 'on-track'
    : summary.yearsUntilDepletion > 20
      ? 'needs-adjustment'
      : 'at-risk';

  return JSON.stringify({
    status,
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
    monthlySpending: Math.round(inputs.annualExpenses / 12),
    hasIncomeStreams: inputs.incomeStreams.length > 0,
  });
}
```

#### 6. Add getProjectionById to SecureQuery
**File**: `src/db/secure-query.ts`
**Changes**: Add method to get projection by ID

```typescript
// Add to SecureQueryBuilder class:

async getProjectionById(projectionId: string) {
  const [projection] = await db
    .select()
    .from(projectionResults)
    .where(
      and(
        eq(projectionResults.id, projectionId),
        eq(projectionResults.userId, this.userId)
      )
    )
    .limit(1);
  return projection ?? null;
}
```

### Success Criteria

#### Automated Verification:
- [x] TypeScript compiles: `npm run typecheck`
- [x] Linting passes: `npm run lint`
- [ ] Unit test for hash function produces consistent output
- [ ] API returns 401 for unauthenticated requests
- [ ] API returns 404 for non-existent projection
- [ ] API returns cached result on second call with same input

#### Manual Verification:
- [ ] Call API with valid projection ID - returns generated summary
- [ ] Call API again - returns cached result (`cached: true`)
- [ ] Call API with `regenerate: true` - returns new generation
- [ ] Call regenerate 11 times - 11th returns 429 rate limit error
- [ ] Verify summary contains all four sections
- [ ] Verify assumptions section includes actual percentage values

**Implementation Note**: After completing Phase 2 and all automated verification passes, pause here for manual confirmation from the human that the API works correctly before proceeding to Phase 3.

---

## Phase 3: Frontend Component

### Overview
Create the AISummary component to display the narrative on the Plans page.

### Changes Required

#### 1. AISummary Component
**File**: `src/components/projections/AISummary.tsx` (new file)

```typescript
'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { RefreshCw, Sparkles, AlertCircle, Info } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AISummaryProps {
  projectionResultId: string | null;
  status: 'on-track' | 'needs-adjustment' | 'at-risk';
  projectedRetirementBalance: number;
  yearsUntilDepletion: number | null;
}

interface SummaryData {
  whereYouStand: string;
  assumptions: string;
  lifestyle: string;
  disclaimer: string;
}

interface SummaryMeta {
  cached: boolean;
  generatedAt: string;
  projectionVersion: string;
  model: string;
}

export function AISummary({
  projectionResultId,
  status,
  projectedRetirementBalance,
  yearsUntilDepletion,
}: AISummaryProps) {
  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [meta, setMeta] = useState<SummaryMeta | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [regenerating, setRegenerating] = useState(false);

  useEffect(() => {
    if (!projectionResultId) return;

    fetchSummary(false);
  }, [projectionResultId]);

  async function fetchSummary(regenerate: boolean) {
    if (!projectionResultId) return;

    setLoading(!regenerate);
    setRegenerating(regenerate);
    setError(null);

    try {
      const response = await fetch('/api/ai/plan-summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectionResultId, regenerate }),
      });

      if (!response.ok) {
        const data = await response.json();
        if (response.status === 429) {
          setError(`Rate limit reached. Try again after ${new Date(data.resetAt).toLocaleTimeString()}`);
        } else {
          setError(data.message || 'Failed to generate summary');
        }
        return;
      }

      const data = await response.json();
      setSummary(data.summary);
      setMeta(data.meta);
    } catch (e) {
      setError('Failed to load summary. Please try again.');
    } finally {
      setLoading(false);
      setRegenerating(false);
    }
  }

  // Fallback UI when AI is unavailable
  if (!projectionResultId || error) {
    return (
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Info className="h-5 w-5" />
            Your Retirement Overview
          </CardTitle>
        </CardHeader>
        <CardContent>
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <FallbackSummary
            status={status}
            projectedRetirementBalance={projectedRetirementBalance}
            yearsUntilDepletion={yearsUntilDepletion}
          />
          {error && (
            <Button
              variant="outline"
              size="sm"
              className="mt-4"
              onClick={() => fetchSummary(false)}
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Try Again
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }

  // Loading state
  if (loading) {
    return (
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Sparkles className="h-5 w-5 animate-pulse" />
            Generating Your Summary...
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-12 w-3/4" />
        </CardContent>
      </Card>
    );
  }

  // Success state with summary
  return (
    <Card className="mb-6">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Sparkles className="h-5 w-5 text-primary" />
          Your Retirement Summary
        </CardTitle>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => fetchSummary(true)}
          disabled={regenerating}
        >
          <RefreshCw className={cn("h-4 w-4 mr-2", regenerating && "animate-spin")} />
          {regenerating ? 'Regenerating...' : 'Regenerate'}
        </Button>
      </CardHeader>
      <CardContent className="space-y-6">
        {summary && (
          <>
            <SummarySection
              title="Where You Stand"
              content={summary.whereYouStand}
            />
            <SummarySection
              title="Key Assumptions"
              content={summary.assumptions}
            />
            <SummarySection
              title="What This Means for Your Lifestyle"
              content={summary.lifestyle}
            />
            <div className="pt-4 border-t">
              <p className="text-xs text-muted-foreground italic">
                {summary.disclaimer}
              </p>
            </div>
          </>
        )}
        {meta && (
          <p className="text-xs text-muted-foreground">
            {meta.cached ? 'Cached summary' : 'Freshly generated'} •
            Version {meta.projectionVersion}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function SummarySection({ title, content }: { title: string; content: string }) {
  return (
    <div>
      <h4 className="font-medium text-sm text-muted-foreground mb-1">{title}</h4>
      <p className="text-sm leading-relaxed">{content}</p>
    </div>
  );
}

function FallbackSummary({
  status,
  projectedRetirementBalance,
  yearsUntilDepletion,
}: {
  status: 'on-track' | 'needs-adjustment' | 'at-risk';
  projectedRetirementBalance: number;
  yearsUntilDepletion: number | null;
}) {
  const statusLabels = {
    'on-track': { label: 'On Track', color: 'text-green-600' },
    'needs-adjustment': { label: 'Needs Adjustment', color: 'text-yellow-600' },
    'at-risk': { label: 'At Risk', color: 'text-red-600' },
  };

  const { label, color } = statusLabels[status];
  const formatter = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  });

  return (
    <div className="space-y-3">
      <p className="text-sm">
        Your retirement projection status: <span className={cn("font-semibold", color)}>{label}</span>
      </p>
      <p className="text-sm">
        Projected balance at retirement: <span className="font-semibold">{formatter.format(projectedRetirementBalance)}</span>
      </p>
      <p className="text-sm">
        {yearsUntilDepletion === null
          ? 'Your funds are projected to last through your planned lifespan.'
          : `Funds projected to last ${yearsUntilDepletion} years into retirement.`}
      </p>
      <p className="text-xs text-muted-foreground italic mt-4">
        AI summary temporarily unavailable. Here's your projection overview.
      </p>
    </div>
  );
}
```

#### 2. Export from Index
**File**: `src/components/projections/index.ts`
**Changes**: Add export

```typescript
export { AISummary } from './AISummary';
```

#### 3. Integrate into Plans Page
**File**: `src/app/plans/plans-client.tsx`
**Changes**: Import and render AISummary component

Add to imports (around line 12):
```typescript
import {
  ProjectionChart,
  ProjectionTable,
  AssumptionsPanel,
  ExportPanel,
  AISummary,
  type Assumptions
} from '@/components/projections';
```

Add new prop to interface (around line 23):
```typescript
interface PlansClientProps {
  initialProjection: ProjectionResult;
  currentAge: number;
  defaultAssumptions: Assumptions;
  monthlySpending: number;
  projectionResultId: string | null; // Add this
}
```

Add to JSX after alerts section (after line 199, before main grid):
```typescript
{/* AI Summary Section */}
{!validationError && (
  <AISummary
    projectionResultId={projectionResultId}
    status={statusResult.status}
    projectedRetirementBalance={projection.summary.projectedRetirementBalance}
    yearsUntilDepletion={projection.summary.yearsUntilDepletion}
  />
)}
```

#### 4. Pass projectionResultId from Server Component
**File**: `src/app/plans/page.tsx`
**Changes**: Fetch and pass projection result ID

In the server component, after saving/fetching the projection, pass the ID to PlansClient:
```typescript
// Around line 262-271, update PlansClient props
<PlansClient
  initialProjection={projection}
  currentAge={currentAge}
  defaultAssumptions={defaultAssumptions}
  monthlySpending={monthlySpending}
  projectionResultId={projectionResult?.id ?? null}
/>
```

### Success Criteria

#### Automated Verification:
- [x] TypeScript compiles: `npm run typecheck`
- [x] Linting passes: `npm run lint`
- [x] Build succeeds: `npm run build`

#### Manual Verification:
- [ ] Navigate to `/plans` - AI summary card appears
- [ ] Summary shows all four sections with proper formatting
- [ ] Clicking "Regenerate" shows loading state then new content
- [ ] When API fails, fallback UI shows with status and key metrics
- [ ] "Try Again" button works after error
- [ ] Summary card looks good on mobile (responsive)

**Implementation Note**: After completing Phase 3 and all automated verification passes, pause here for manual confirmation from the human that the UI works correctly before proceeding to Phase 4.

---

## Phase 4: Integration Testing & Polish

### Overview
Final integration testing, edge case handling, and polish.

### Changes Required

#### 1. Handle Projection Recalculation
**File**: `src/app/plans/plans-client.tsx`
**Changes**: Refetch AI summary when projection changes

When assumptions change and projection recalculates, the AI summary should detect the new projection and fetch accordingly. The `projectionResultId` prop needs to update when a new projection is saved.

Add state tracking for projection ID:
```typescript
const [currentProjectionId, setCurrentProjectionId] = useState<string | null>(projectionResultId);
```

Update when projection recalculates (in the fetch response handler around line 83):
```typescript
if (data.meta?.projectionResultId) {
  setCurrentProjectionId(data.meta.projectionResultId);
}
```

Pass `currentProjectionId` instead of `projectionResultId` to AISummary component.

#### 2. Update Calculate API to Return Projection ID
**File**: `src/app/api/projections/calculate/route.ts`
**Changes**: Include projection result ID in response when saved

In the response object (around line 265), add:
```typescript
meta: {
  calculationTimeMs,
  warnings: warnings.length > 0 ? warnings : undefined,
  inputWarnings: inputWarnings.length > 0 ? inputWarnings : undefined,
  projectionResultId: savedProjection?.id, // Add this when projection is saved
},
```

#### 3. Add Loading Indicator During Assumption Changes
When assumptions are being adjusted and projection is recalculating, the AI summary should show a subtle loading indicator to indicate content may update.

### Success Criteria

#### Automated Verification:
- [ ] Full test suite passes: `npm test`
- [ ] Build succeeds: `npm run build`
- [ ] No TypeScript errors: `npm run typecheck`
- [ ] No lint errors: `npm run lint`

#### Manual Verification:
- [ ] Change assumptions slider → projection recalculates → AI summary updates
- [ ] Rate limit works (regenerate 10x, 11th fails)
- [ ] Error states display correctly
- [ ] Mobile layout works properly
- [ ] Page load performance is acceptable (summary doesn't block initial render)

---

## Testing Strategy

### Unit Tests

1. **Hash function** (`src/lib/ai/hash-inputs.test.ts`)
   - Same inputs produce same hash
   - Different inputs produce different hashes
   - Order of object keys doesn't affect hash

2. **Rate limiting** (`src/lib/ai/rate-limit.test.ts`)
   - First 10 requests allowed
   - 11th request blocked
   - Counter resets after midnight UTC

### Integration Tests

1. **API endpoint** (`src/app/api/ai/plan-summary/route.test.ts`)
   - Returns 401 for unauthenticated
   - Returns 404 for non-existent projection
   - Returns cached result on second call
   - Returns 429 after rate limit exceeded

### Manual Testing Steps

1. Log in and navigate to Plans page
2. Verify AI summary appears with all four sections
3. Verify assumption values in the summary match displayed assumptions
4. Click "Regenerate" and verify new content appears
5. Click "Regenerate" 10 more times - verify rate limit message on 11th
6. Change an assumption slider - verify summary updates after recalculation
7. Disconnect network - verify fallback UI shows
8. Reconnect and click "Try Again" - verify summary loads

---

## Performance Considerations

- **Initial load**: AI summary fetches asynchronously after page load, doesn't block projection display
- **Caching**: Hash-based caching means most page views hit cache (no AI call)
- **Token budget**: 1024 max tokens, typical usage 400-600, ~$0.0006 per generation
- **Response time**: GPT-4o-mini typically responds in 5-10 seconds
- **Rate limiting**: In-memory for simplicity; would need Redis for multi-instance deployment

---

## Migration Notes

- No data migration needed - new table with no existing data
- Feature can be deployed incrementally:
  1. Deploy database migration
  2. Deploy API endpoint
  3. Deploy UI component
- Feature flag not needed - graceful fallback if API unavailable

---

## References

- Original ticket: [thoughts/personal/tickets/epic-4/story-1-scope.md](thoughts/personal/tickets/epic-4/story-1-scope.md)
- Research document: [thoughts/shared/research/2025-12-30-epic-4-story-1-ai-plan-summary.md](thoughts/shared/research/2025-12-30-epic-4-story-1-ai-plan-summary.md)
- Existing OpenAI integration: [src/app/api/parse-financial-nl/route.ts](src/app/api/parse-financial-nl/route.ts)
- Projection storage: [src/db/schema/projection-results.ts](src/db/schema/projection-results.ts)
- UI integration point: [src/app/plans/plans-client.tsx:199](src/app/plans/plans-client.tsx#L199)
