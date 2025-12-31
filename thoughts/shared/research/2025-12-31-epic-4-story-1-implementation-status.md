---
date: 2025-12-31T12:00:00-08:00
researcher: Claude
git_commit: 1f61883959fcd2a585384cee7f1b393428ecc038
branch: main
repository: plan-smart
topic: "Epic 4 Story 1 - AI Plan Summary Implementation Status"
tags: [research, codebase, ai-summary, epic-4, implementation-status]
status: complete
last_updated: 2025-12-31
last_updated_by: Claude
---

# Research: Epic 4 Story 1 - AI Plan Summary Implementation Status

**Date**: 2025-12-31T12:00:00-08:00
**Researcher**: Claude
**Git Commit**: 1f61883959fcd2a585384cee7f1b393428ecc038
**Branch**: main
**Repository**: plan-smart

## Research Question

What is the current implementation status of Epic 4 Story 1 (AI Plan Summary with Embedded Assumptions & Disclaimer) based on the scope defined in `thoughts/personal/tickets/epic-4/story-1-scope.md`?

## Summary

**Story A1 (AI Plan Summary)** is largely implemented with core functionality working. The implementation includes:
- AI narrative generation via GPT-4o-mini
- Four-section output (Where You Stand, Assumptions, Lifestyle, Disclaimer)
- Input hashing for deterministic caching
- Rate limiting (10 regenerations/day)
- Frontend component with fallback UI

**Gaps identified** against the acceptance criteria from the scope document:
- Stories A2 (Outcome-Aware Tone) and A3 (Non-Advisory Lifestyle) have partial implementation via prompt engineering but lack explicit guardrails
- Story A4 (One-Page Narrative View) has no dedicated versioned view - summary is embedded in dashboard

## Detailed Findings

### A1. AI Plan Summary - Implementation Status

| Acceptance Criteria | Status | Evidence |
|---------------------|--------|----------|
| Input = frozen projection JSON (versioned) | ✅ Implemented | [hash-inputs.ts:16-19](src/lib/ai/hash-inputs.ts#L16-L19) creates SHA-256 hash |
| Where you stand section | ✅ Implemented | [plan-summary.ts:17](src/lib/ai/prompts/plan-summary.ts#L17) |
| Assumptions section | ✅ Implemented | [plan-summary.ts:19](src/lib/ai/prompts/plan-summary.ts#L19) |
| Lifestyle section | ✅ Implemented | [plan-summary.ts:21](src/lib/ai/prompts/plan-summary.ts#L21) |
| Planning disclaimer | ✅ Implemented | [plan-summary.ts:1-2](src/lib/ai/prompts/plan-summary.ts#L1-L2) |
| Reading level ≤ 9th grade | ⚠️ Prompt only | Instructed in prompt line 5, no validation |
| Identical input → identical output | ✅ Implemented | Caching via `inputHash` in [ai-summaries.ts](src/db/schema/ai-summaries.ts) |

#### Key Implementation Files

- **API Endpoint**: [src/app/api/ai/plan-summary/route.ts](src/app/api/ai/plan-summary/route.ts)
- **Prompt Template**: [src/lib/ai/prompts/plan-summary.ts](src/lib/ai/prompts/plan-summary.ts)
- **Input Hashing**: [src/lib/ai/hash-inputs.ts](src/lib/ai/hash-inputs.ts)
- **Rate Limiting**: [src/lib/ai/rate-limit.ts](src/lib/ai/rate-limit.ts)
- **Database Schema**: [src/db/schema/ai-summaries.ts](src/db/schema/ai-summaries.ts)
- **UI Component**: [src/components/projections/AISummary.tsx](src/components/projections/AISummary.tsx)
- **Dashboard Integration**: [src/app/dashboard/dashboard-client.tsx](src/app/dashboard/dashboard-client.tsx)

### A2. Outcome-Aware Tone - Implementation Status

| Acceptance Criteria | Status | Evidence |
|---------------------|--------|----------|
| Tone flag: optimistic \| neutral \| cautious | ⚠️ Partial | Status (`on-track`/`needs-adjustment`/`at-risk`) passed, not tone flag |
| AI never uses imperative language | ⚠️ Prompt only | "NEVER suggest specific actions" in prompt |
| Shortfall framed as "adjustable gap" | ❌ Not implemented | No explicit framing instruction |
| Explicit banned phrases list | ❌ Not implemented | No banned phrases validation |

**Current Implementation**:
The retirement status is calculated numerically and passed to the AI:
```typescript
// From route.ts:182-186
const status = summary.yearsUntilDepletion === null
  ? 'on-track'
  : summary.yearsUntilDepletion > 20
    ? 'needs-adjustment'
    : 'at-risk';
```

**Gap**: The scope requires:
- Explicit tone flags (`optimistic | neutral | cautious`)
- Banned phrases list (`"you will fail"`, `"you must"`)
- Post-generation validation for imperative language

### A3. Non-Advisory Lifestyle - Implementation Status

| Acceptance Criteria | Status | Evidence |
|---------------------|--------|----------|
| No prescriptive verbs | ⚠️ Prompt only | "NEVER suggest specific actions" |
| Spending → lifestyle labels | ❌ Not implemented | No simple/moderate/flexible mapping |
| Framed as options, not recommendations | ⚠️ Prompt only | "NEVER provide investment advice" |

**Gap**: The scope requires:
- Lifestyle labels derived from spending bands (simple / moderate / flexible)
- Explicit prohibition of prescriptive verbs ("should", "need to")

### A4. One-Page Narrative View - Implementation Status

| Acceptance Criteria | Status | Evidence |
|---------------------|--------|----------|
| Plan version timestamp | ✅ Implemented | `projectionVersion` displayed in UI |
| Export references assumptions + disclaimer | ⚠️ Partial | Export exists but unclear if includes AI summary |
| No live recalculation in view layer | ✅ Implemented | Summary fetched from cache |

**Gap**: The scope describes a "single, shareable retirement story view" but current implementation embeds the summary within the dashboard. No dedicated one-page view exists.

## Architecture Overview

```
┌──────────────────────────────────────────────────────────────────┐
│                        Dashboard Page                             │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │                    AISummary Component                      │  │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────┐  │  │
│  │  │ Where    │ │ Key      │ │ Lifestyle│ │ Disclaimer   │  │  │
│  │  │ You Stand│ │Assumptions│ │ Impact  │ │              │  │  │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────────┘  │  │
│  └─────────────────────────┬──────────────────────────────────┘  │
│                            │                                      │
│                            ▼                                      │
│                 POST /api/ai/plan-summary                         │
│                            │                                      │
│          ┌─────────────────┼─────────────────┐                   │
│          ▼                 ▼                 ▼                   │
│    ┌───────────┐    ┌───────────┐    ┌─────────────┐            │
│    │ Check     │    │ Hash      │    │ Rate Limit  │            │
│    │ Cache     │    │ Inputs    │    │ Check       │            │
│    └─────┬─────┘    └───────────┘    └─────────────┘            │
│          │                                                        │
│          ▼ (miss)                                                │
│    ┌───────────────────────────────────────┐                     │
│    │         OpenAI GPT-4o-mini            │                     │
│    │    (temperature: 0, JSON mode)        │                     │
│    └─────────────────┬─────────────────────┘                     │
│                      │                                            │
│                      ▼                                            │
│              ┌───────────────┐                                   │
│              │ ai_summaries  │                                   │
│              │    table      │                                   │
│              └───────────────┘                                   │
└──────────────────────────────────────────────────────────────────┘
```

## Code References

### Core Implementation
- [src/lib/ai/prompts/plan-summary.ts:1-33](src/lib/ai/prompts/plan-summary.ts#L1-L33) - System prompt with guardrails
- [src/app/api/ai/plan-summary/route.ts](src/app/api/ai/plan-summary/route.ts) - API endpoint
- [src/lib/ai/hash-inputs.ts:16-19](src/lib/ai/hash-inputs.ts#L16-L19) - Deterministic input hashing
- [src/lib/ai/rate-limit.ts:37](src/lib/ai/rate-limit.ts#L37) - MAX_REGENERATIONS_PER_DAY = 10

### Database
- [src/db/schema/ai-summaries.ts](src/db/schema/ai-summaries.ts) - Schema definition
- [src/db/migrations/0005_breezy_hex.sql](src/db/migrations/0005_breezy_hex.sql) - Migration file

### Frontend
- [src/components/projections/AISummary.tsx](src/components/projections/AISummary.tsx) - Main component
- [src/app/dashboard/dashboard-client.tsx](src/app/dashboard/dashboard-client.tsx) - Dashboard integration

## Historical Context (from thoughts/)

- [thoughts/personal/tickets/epic-4/story-1-scope.md](thoughts/personal/tickets/epic-4/story-1-scope.md) - Original requirements for all 4 stories
- [thoughts/shared/plans/2025-12-30-epic-4-story-1-ai-plan-summary.md](thoughts/shared/plans/2025-12-30-epic-4-story-1-ai-plan-summary.md) - Implementation plan (4 phases)
- [thoughts/shared/research/2025-12-30-epic-4-story-1-ai-plan-summary.md](thoughts/shared/research/2025-12-30-epic-4-story-1-ai-plan-summary.md) - Initial research

## Recommendations for Completion

### High Priority (A2 Gaps)
1. **Add explicit tone flag mapping**:
   ```typescript
   // Map status to tone
   const toneMap = {
     'on-track': 'optimistic',
     'needs-adjustment': 'neutral',
     'at-risk': 'cautious'
   };
   ```

2. **Implement banned phrases validation**:
   ```typescript
   const BANNED_PHRASES = ['you will fail', 'you must', 'you need to', 'you should'];
   function validateResponse(text: string): boolean {
     return !BANNED_PHRASES.some(phrase => text.toLowerCase().includes(phrase));
   }
   ```

### Medium Priority (A3 Gaps)
3. **Add lifestyle labels mapping**:
   ```typescript
   function getLifestyleLabel(monthlySpending: number): string {
     if (monthlySpending < 3000) return 'simple';
     if (monthlySpending < 6000) return 'moderate';
     return 'flexible';
   }
   ```

4. **Update prompt with "adjustable gap" framing** for shortfall scenarios

### Low Priority (A4 Gaps)
5. **Create dedicated narrative view page** at `/plans/[id]/narrative` with:
   - Version timestamp
   - Export functionality that includes AI summary
   - Shareable URL

## Open Questions

1. Should banned phrase validation happen client-side, server-side, or both?
2. What spending thresholds define simple/moderate/flexible lifestyle bands?
3. Is a dedicated narrative view page needed, or is dashboard embedding sufficient?
4. Should we add Flesch-Kincaid reading level validation as a safety net?

## Related Research

- [thoughts/shared/research/2025-12-30-epic-4-story-1-ai-plan-summary.md](thoughts/shared/research/2025-12-30-epic-4-story-1-ai-plan-summary.md) - Initial architecture research
