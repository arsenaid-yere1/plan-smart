---
date: 2025-12-30T12:00:00-08:00
researcher: Claude
git_commit: a24ba268c98ea41cbafee957209b575912e98d8e
branch: main
repository: plan-smart
topic: "Epic 4 Story 1 - AI Plan Summary Implementation Research"
tags: [research, codebase, ai, openai, projections, narrative-generation, epic-4]
status: complete
last_updated: 2025-12-30
last_updated_by: Claude
---

# Research: Epic 4 Story 1 - AI Plan Summary with Embedded Assumptions & Disclaimer

**Date**: 2025-12-30T12:00:00-08:00
**Researcher**: Claude
**Git Commit**: a24ba268c98ea41cbafee957209b575912e98d8e
**Branch**: main
**Repository**: plan-smart

## Research Question

How should we implement the AI Plan Summary feature (Epic 4 Story 1) that generates plain-English retirement narratives with embedded assumptions and disclaimers, ensuring deterministic outputs and legal safety?

## Summary

The codebase is well-prepared for AI narrative generation:

1. **OpenAI infrastructure exists** - GPT-4o-mini integration already in place for NL parsing
2. **Projection data is persisted** - JSONB storage with versioning and staleness detection
3. **All required assumptions are available** - Growth rate, inflation, lifespan, income streams
4. **Caching patterns established** - Database-backed storage with deterministic engine
5. **No disclaimers exist yet** - This is new functionality to implement

Key implementation path: Create a new `/api/ai/plan-summary` endpoint that accepts a frozen `projectionId`, retrieves the versioned projection data, generates a narrative via OpenAI, caches the result, and returns structured sections.

## Detailed Findings

### 1. Existing AI/LLM Integration

#### Current Implementation
- **Package**: `openai` v6.13.0 in [package.json](package.json)
- **Endpoint**: [src/app/api/parse-financial-nl/route.ts](src/app/api/parse-financial-nl/route.ts)
- **Model**: GPT-4o-mini
- **Pattern**: System prompt + user content → JSON response

```typescript
// Existing pattern from parse-financial-nl
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
  temperature: 0.1,  // Low temperature for consistency
});
```

#### What Doesn't Exist
- No narrative generation prompts
- No AI response caching
- No cost/token tracking
- No reading level enforcement

### 2. Projection Data Structures

#### Input Types ([src/lib/projections/types.ts](src/lib/projections/types.ts))

**ProjectionInput** (lines 57-90):
```typescript
interface ProjectionInput {
  currentAge: number;
  retirementAge: number;
  maxAge: number;
  balancesByType: BalanceByType;
  annualContribution: number;
  contributionAllocation: BalanceByType;
  expectedReturn: number;
  inflationRate: number;
  contributionGrowthRate: number;
  annualExpenses: number;
  annualHealthcareCosts: number;
  healthcareInflationRate: number;
  incomeStreams: IncomeStream[];
  annualDebtPayments: number;
}
```

**ProjectionAssumptions** (lines 173-180) - Human-readable snapshot for AI:
```typescript
interface ProjectionAssumptions {
  expectedReturn: number;
  inflationRate: number;
  healthcareInflationRate: number;
  contributionGrowthRate: number;
  retirementAge: number;
  maxAge: number;
}
```

#### Output Types

**ProjectionRecord** (lines 130-140):
```typescript
interface ProjectionRecord {
  age: number;
  year: number;
  balance: number;
  inflows: number;
  outflows: number;
  balanceByType: BalanceByType;
  withdrawalsByType?: BalanceByType;
}
```

**ProjectionSummary** (lines 145-155):
```typescript
interface ProjectionSummary {
  startingBalance: number;
  endingBalance: number;
  projectedRetirementBalance: number;
  totalContributions: number;
  totalWithdrawals: number;
  yearsUntilDepletion: number | null;  // null = never depletes
}
```

#### Database Storage ([src/db/schema/projection-results.ts](src/db/schema/projection-results.ts))

```typescript
// Table: projection_results
{
  id: uuid,
  planId: uuid (unique, one-to-one with plans),
  userId: uuid,
  inputs: jsonb,       // Full ProjectionInput
  assumptions: jsonb,  // Human-readable ProjectionAssumptions
  records: jsonb,      // ProjectionRecord[]
  summary: jsonb,      // ProjectionSummary
  calculationTimeMs: integer,
  createdAt: timestamp,
  updatedAt: timestamp
}
```

### 3. Financial Assumptions

#### Default Values ([src/lib/projections/assumptions.ts](src/lib/projections/assumptions.ts))

| Parameter | Default | Range | Source |
|-----------|---------|-------|--------|
| Expected Return (Conservative) | 4% | 1-30% | `DEFAULT_RETURN_RATES` |
| Expected Return (Moderate) | 6% | 1-30% | `DEFAULT_RETURN_RATES` |
| Expected Return (Aggressive) | 8% | 1-30% | `DEFAULT_RETURN_RATES` |
| Inflation Rate | 2.5% | 1-10% | `DEFAULT_INFLATION_RATE` |
| Healthcare Inflation | 5% | 0-15% | `DEFAULT_HEALTHCARE_INFLATION_RATE` |
| Max Age (Lifespan) | 90 | 50-120 | `DEFAULT_MAX_AGE` |
| Contribution Growth | 0% | 0-10% | `DEFAULT_CONTRIBUTION_GROWTH_RATE` |

#### User-Specific Data ([src/db/schema/financial-snapshot.ts](src/db/schema/financial-snapshot.ts))
- `birthYear` → Current age calculation
- `targetRetirementAge` → Retirement timeline
- `riskTolerance` → Maps to return rate
- `investmentAccounts` → Balances by tax category
- `incomeStreams` → Social Security, pensions, etc.
- `monthlyContribution` → Savings rate

### 4. Caching & Determinism Patterns

#### Current Caching Strategy
1. **Database Persistence**: Projections stored in `projection_results` table
2. **Staleness Detection**: [src/lib/projections/staleness.ts](src/lib/projections/staleness.ts) compares stored vs current inputs
3. **Upsert Pattern**: One projection per plan via `onConflictDoUpdate`

#### Determinism Guarantee
- **Pure Engine**: [src/lib/projections/engine.ts](src/lib/projections/engine.ts) - Same input → same output
- **Only Variable**: `new Date().getFullYear()` for current year
- **Rounding**: Fixed-point arithmetic with `Math.round(value * 100) / 100`

#### For AI Narratives
To achieve "identical input → identical output":
1. Use `temperature: 0` in OpenAI calls
2. Hash projection inputs to create cache key
3. Store generated narratives alongside projection results
4. Include projection version in cache key

### 5. API Route Patterns

#### Standard Structure ([src/app/api/](src/app/api/))
```
src/app/api/
├── auth/           # Authentication endpoints
├── projections/    # Projection calculations
│   ├── calculate/route.ts
│   ├── save/route.ts
│   └── [planId]/route.ts
└── parse-financial-nl/route.ts  # Existing AI endpoint
```

#### Authentication Pattern
```typescript
export async function POST(request: NextRequest) {
  const user = await getServerUser();
  if (!user) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }
  // ... handler logic
}
```

#### Resource Ownership Pattern
```typescript
const secureQuery = createSecureQuery(user.id);
const plan = await secureQuery.getPlanById(planId);
if (!plan) {
  return NextResponse.json(
    { message: 'Plan not found or access denied' },
    { status: 404 }
  );
}
```

### 6. Existing Warnings System

#### Projection Warnings ([src/lib/projections/warnings.ts](src/lib/projections/warnings.ts))
```typescript
type ProjectionWarning = {
  type: string;
  message: string;
  severity: 'info' | 'warning';
};
```

Warning triggers:
- High inflation (>8%)
- Low returns (<2%)
- Zero savings + contributions
- Debt exceeds contributions
- Near retirement (≤5 years)

### 7. Retirement Status Classification

#### Status Logic ([src/lib/projections/status.ts](src/lib/projections/status.ts))
```typescript
type RetirementStatus = 'on-track' | 'needs-adjustment' | 'at-risk';

// Classification:
// - On Track: yearsUntilDepletion === null (funds last through maxAge)
// - Needs Adjustment: yearsUntilDepletion > 20
// - At Risk: yearsUntilDepletion <= 20
```

## Architecture Insights

### Proposed AI Summary Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│  Plans Client   │───▶│ /api/ai/summary  │───▶│    OpenAI API   │
│  (React)        │    │   POST handler   │    │   GPT-4o-mini   │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                              │
                              ▼
                       ┌──────────────────┐
                       │ projection_results│
                       │ + ai_summaries   │
                       └──────────────────┘
```

### New Database Table (Suggested)

```sql
CREATE TABLE ai_summaries (
  id UUID PRIMARY KEY,
  projection_result_id UUID REFERENCES projection_results(id) ON DELETE CASCADE,
  user_id UUID REFERENCES user_profile(id) ON DELETE CASCADE,
  input_hash VARCHAR(64),  -- SHA-256 of projection inputs
  sections JSONB,          -- {whereYouStand, assumptions, lifestyle, disclaimer}
  model VARCHAR(50),       -- e.g., 'gpt-4o-mini'
  tokens_used INTEGER,
  generation_time_ms INTEGER,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(projection_result_id, input_hash)
);
```

### Prompt Structure (Suggested)

```typescript
const NARRATIVE_SYSTEM_PROMPT = `
You are a financial planning assistant. Generate a clear, empathetic retirement outlook
in plain English at a 9th-grade reading level.

You MUST:
- Reference the specific assumptions provided (return rate, inflation, lifespan)
- Include the exact disclaimer text provided
- Use simple language without financial jargon
- Be encouraging but realistic
- Never provide investment advice or specific recommendations

Output a JSON object with these sections:
1. whereYouStand: 2-3 sentences summarizing current retirement readiness
2. assumptions: List the key assumptions this projection depends on
3. lifestyle: What this means for their day-to-day in retirement
4. disclaimer: The planning-only disclaimer (use exact text provided)
`;
```

## Code References

### Existing AI Integration
- [src/app/api/parse-financial-nl/route.ts](src/app/api/parse-financial-nl/route.ts) - OpenAI pattern
- [package.json:40](package.json#L40) - OpenAI dependency

### Projection System
- [src/lib/projections/types.ts](src/lib/projections/types.ts) - All type definitions
- [src/lib/projections/engine.ts](src/lib/projections/engine.ts) - Calculation engine
- [src/lib/projections/assumptions.ts](src/lib/projections/assumptions.ts) - Default values
- [src/lib/projections/staleness.ts](src/lib/projections/staleness.ts) - Input comparison
- [src/lib/projections/status.ts](src/lib/projections/status.ts) - Status classification

### Database Layer
- [src/db/schema/projection-results.ts](src/db/schema/projection-results.ts) - Projection storage
- [src/db/secure-query.ts](src/db/secure-query.ts) - User-scoped queries

### API Patterns
- [src/app/api/projections/calculate/route.ts](src/app/api/projections/calculate/route.ts) - Complex handler pattern
- [src/lib/auth/server.ts](src/lib/auth/server.ts) - Authentication helpers

## Historical Context (from thoughts/)

### Epic 4 Ticket
- [thoughts/personal/tickets/epic-4/story-1-scope.md](thoughts/personal/tickets/epic-4/story-1-scope.md) - Story requirements

### Prior Research
- [thoughts/shared/research/2025-12-29-story-3.5-persist-projection-results.md](thoughts/shared/research/2025-12-29-story-3.5-persist-projection-results.md) - Projection persistence (mentions AI narrative as future use case)
- [thoughts/shared/research/2025-12-05-epic-2-onboarding-wizard-implementation.md](thoughts/shared/research/2025-12-05-epic-2-onboarding-wizard-implementation.md) - First OpenAI integration

### Implementation Plans
- [thoughts/shared/plans/2025-12-10-epic-2-onboarding-wizard-implementation.md](thoughts/shared/plans/2025-12-10-epic-2-onboarding-wizard-implementation.md) - OpenAI setup pattern
- [thoughts/shared/plans/2025-12-29-story-3.5-persist-projection-results.md](thoughts/shared/plans/2025-12-29-story-3.5-persist-projection-results.md) - Versioning strategy

## Related Research

- [thoughts/shared/research/2025-12-17-epic-3-projection-engine-implementation-readiness.md](thoughts/shared/research/2025-12-17-epic-3-projection-engine-implementation-readiness.md) - Projection engine analysis
- [thoughts/shared/research/2025-12-30-story-7-export-projection-results.md](thoughts/shared/research/2025-12-30-story-7-export-projection-results.md) - Export functionality

## Implementation Recommendations

### 1. API Endpoint Structure
```typescript
// POST /api/ai/plan-summary
{
  projectionResultId: string;  // Required - frozen projection ID
  regenerate?: boolean;        // Force regeneration, bypass cache
}

// Response
{
  summary: {
    whereYouStand: string;
    assumptions: string;
    lifestyle: string;
    disclaimer: string;
  };
  meta: {
    cached: boolean;
    generatedAt: string;
    projectionVersion: string;
    model: string;
  };
}
```

### 2. Caching Strategy
1. Hash projection inputs with SHA-256
2. Store narratives in `ai_summaries` table
3. Cache key: `{projectionResultId}:{inputHash}`
4. Invalidate on projection recalculation

### 3. Determinism Approach
- Use `temperature: 0` for OpenAI
- Include `seed` parameter if available
- Hash-based caching ensures same input → same cached output

### 4. Reading Level Enforcement
- Include reading level requirement in system prompt
- Consider post-processing with Flesch-Kincaid check
- Use simple sentence structures in prompt examples

### 5. Disclaimer Language (Draft)
```
This retirement projection is for planning purposes only and is not financial,
investment, tax, or legal advice. Actual results will vary based on market
conditions, personal circumstances, and other factors. Consult with qualified
professionals before making financial decisions.
```

## Decisions Made

1. **Model Selection**: GPT-4o-mini confirmed - balances cost, speed, and capability for narrative generation
2. **Token Budget**: 1,024 max output tokens
   - Typical usage: 400-600 tokens for four sections
   - Input: ~500-800 tokens (system prompt + projection JSON)
   - Cost: ~$0.0006 per generation
   - Performance: ~5-10 seconds response time
3. **Caching Duration**: No time-based expiration
   - Cache invalidates only when projection inputs change (via input hash)
   - User can force regenerate with `regenerate: true` flag
   - Cascade delete when projection is removed
   - Rationale: Narratives are deterministic from frozen data; time-based expiry adds complexity without benefit
4. **Error Handling**: Graceful fallback with retry option
   - Single attempt with 30-second timeout
   - On failure: Show fallback UI with non-AI projection summary
     - Retirement status badge (On Track / Needs Adjustment / At Risk)
     - Key stats from ProjectionSummary (balance, years until depletion)
     - Message: "AI summary temporarily unavailable. Here's your projection overview."
   - Provide "Try Again" button for user-initiated retry
   - Log errors server-side for monitoring
   - No automatic retries (avoids complexity, user controls retry)
5. **Rate Limiting**: 10 regenerations per day per user
   - Cache hits (normal usage) are unlimited - no API call
   - Only "force regenerate" requests count against limit
   - 10/day is generous for legitimate use
   - Prevents abuse and cost runaway
   - Use existing rate-limit pattern from `src/lib/auth/rate-limit.ts`
   - Reset at midnight UTC

6. **Disclaimer Language**: Use draft disclaimer for v1, revisit later
   - Draft text covers key points: planning only, not advice, results vary, consult professionals
   - Can be updated after legal review without code changes (store in constants file)
   - Good enough for initial release

## Deferred (Future Consideration)
- **Multilingual Support**: English only for v1
- **Disclaimer Legal Review**: Revisit with legal counsel before public launch
- **Audio Narration**: Text-to-speech for accessibility (consider OpenAI TTS API)
