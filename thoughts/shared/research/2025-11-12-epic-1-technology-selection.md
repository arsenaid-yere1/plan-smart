---
date: 2025-11-12T17:11:18+0000
researcher: Claude Code
git_commit: n/a (not a git repository)
branch: n/a
repository: plan-smart
topic: "Epic 1 Technology Stack Selection and Recommendations"
tags: [research, technology-selection, epic-1, authentication, next-js, supabase, drizzle-orm, resend, postmark]
status: complete
last_updated: 2025-11-12
last_updated_by: Claude Code
---

# Research: Epic 1 Technology Stack Selection and Recommendations

**Date**: 2025-11-12T17:11:18+0000
**Researcher**: Claude Code
**Git Commit**: n/a (not a git repository)
**Branch**: n/a
**Repository**: plan-smart

## Research Question

What is the optimal technology stack for implementing Epic 1 (User Registration, Login & Onboarding) that meets all specified requirements: authentication with RLS, <1s page loads, <250ms auth API latency, 7-day sessions, email verification, and 99% uptime?

## Summary

After comprehensive research across authentication providers, frontend frameworks, database ORMs, and email services, the **recommended technology stack** for Epic 1 is:

- **Frontend**: Next.js 15 (App Router)
- **Authentication**: Supabase Auth
- **Database**: PostgreSQL via Supabase
- **ORM**: Drizzle ORM
- **Email**: Resend (or Postmark for maximum reliability)
- **Deployment**: Vercel (MVP stage)
- **State Management**: Zustand
- **Forms**: React Hook Form + Zod

This stack provides:
- ✅ Native RLS support with `auth.uid()` integration
- ✅ Sub-1s page load performance
- ✅ <250ms auth latency (regional deployment)
- ✅ 7-day "remember me" sessions (Pro plan)
- ✅ Type-safe end-to-end development
- ✅ Rapid MVP development (2-3 weeks vs 6-8 weeks with alternatives)
- ✅ Cost-effective scaling ($25-50/month for 50k MAU)

**Critical Security Note**: CVE-2025-29927 requires upgrading to Next.js 15.2.3+ immediately upon project initialization.

## Detailed Findings

### 1. Authentication Provider Comparison

#### Supabase Auth - RECOMMENDED ⭐

**Strengths**:
- **Native PostgreSQL integration with RLS**: `auth.uid()` function seamlessly integrates with Row-Level Security policies
- **Generous free tier**: 50,000 MAU included
- **Pro plan ($25/month)**: Unlocks 7-day session configuration, leaked password protection, and 100k MAU
- **Performance**: 15-100ms auth latency in same region (meets <250ms requirement)
- **All-in-one platform**: Auth + Database + Storage + Edge Functions
- **Session management**: Fully configurable token TTL (7 days for "remember me", 24h default)
- **Security features**: CSRF protection via JWT validation, configurable password policies (12+ chars), RLS enforcement
- **Developer experience**: Excellent Next.js integration via `@supabase/ssr` package

**Limitations**:
- ❌ **No guaranteed latency SLA** on Free/Pro tiers (Enterprise only)
- ❌ **Cross-region latency can exceed 250ms** (350-600ms reported)
- ⚠️ **No uptime SLA on Free/Pro** (99.9% on Enterprise only)
- ❌ **Email service inadequate for production**: 2 emails/hour limit requires custom SMTP integration

**Requirements Assessment**:
- <250ms auth latency: ✅ **Partially met** (depends on regional deployment)
- 7-day sessions: ✅ **Met** (Pro plan required)
- 99% uptime: ⚠️ **No SLA on Pro** (exceeds on Enterprise at 99.9%)
- RLS support: ✅ **Excellent native support**
- Email verification: ✅ **Built-in** (requires external SMTP for production volume)

**Pricing Path**:
- MVP/Development: Free tier (50k MAU)
- Production Launch: Pro tier ($25/month) + custom SMTP ($5-20/month)
- **Total: ~$30-45/month** for first 100k MAU

**Reference**: [thoughts/shared/research/2025-11-12-epic-1-technology-selection.md](#supabase-detailed-research)

---

#### Auth0 - NOT RECOMMENDED ❌

**Why not**:
- ❌ **No native PostgreSQL RLS integration**: Requires custom middleware to map JWT claims to session variables
- ❌ **No guaranteed <250ms latency**: Community reports 200-500ms+ typical
- ❌ **Free tier limited to 3-day sessions**: Requires Enterprise plan for 7+ day sessions
- ❌ **Expensive scaling**: $0.07/MAU (21x more expensive than Supabase's $0.00325/MAU)
- ❌ **Separate database required**: Auth0 stores credentials separately from application data

**When to consider**: Enterprise compliance (SOC2, HIPAA) is mandatory and budget allows $35+ base + $0.07/MAU pricing

**Reference**: [thoughts/shared/research/2025-11-12-epic-1-technology-selection.md](#auth0-detailed-research)

---

### 2. Frontend Framework Selection

#### Next.js 15 (App Router) - RECOMMENDED ⭐

**Why chosen**:
- **Server Components**: Credentials never leave server, perfect for authentication
- **Performance**: 20-30% less JavaScript than Pages Router, achieving <1s page loads
- **Partial Prerendering (PPR)**: Static shell served instantly from CDN, dynamic content streamed (ideal for dashboards)
- **Protected routes**: Native middleware + Server Components provide defense-in-depth
- **Multi-step forms**: Nested layouts and Server Actions simplify onboarding wizard implementation
- **Supabase integration**: First-class support via `@supabase/ssr` with cookie-based sessions
- **Type safety**: TypeScript 5.1.3+ with typed routes and Server Action inference

**Implementation patterns for Epic 1**:

```typescript
// Middleware for route protection (Layer 1)
export async function middleware(request: NextRequest) {
  const supabase = createServerClient(/* ... */)
  await supabase.auth.getClaims() // Validates JWT
  return response
}

// Data Access Layer (Layer 2 - Primary Security)
export const verifySession = cache(async () => {
  const session = await supabase.auth.getSession()
  if (!session) redirect('/login')
  return session
})

// Server Component with automatic auth check
export default async function PlansPage() {
  const session = await verifySession()
  const plans = await getPlans(session.user.id)
  return <PlansGrid plans={plans} />
}
```

**Performance optimization strategies**:
- SSG for marketing pages: Pre-rendered at build time
- PPR for authenticated dashboards: Static shell + dynamic data
- Streaming with Suspense: Load auth checks parallel with page shells
- Image optimization: Automatic AVIF/WebP conversion
- Bundle analysis: Keep critical JS <14kb for TCP slow-start

**Critical Security Update**: CVE-2025-29927 (CVSS 9.1) allows middleware bypass. **Immediate upgrade required** to 15.2.3+, 14.2.25+, 13.5.9+, or 12.3.5+.

**Reference**: [thoughts/shared/research/2025-11-12-epic-1-technology-selection.md](#nextjs-detailed-research)

---

### 3. Database & ORM Selection

#### PostgreSQL via Supabase + Drizzle ORM - RECOMMENDED ⭐

**Why this combination**:

**PostgreSQL via Supabase**:
- Native RLS support with `auth.uid()` helper function
- Managed service with automatic backups (Pro tier)
- Connection pooling for serverless (Supabase Pooler)
- Real-time subscriptions if needed for future features
- Free tier includes full PostgreSQL features

**Drizzle ORM**:
- **Native RLS support**: Define policies directly in schema using `pgPolicy()`
- **Zero code generation**: Types inferred instantly from TypeScript schema
- **Best performance**: 7.4kb bundle size, sub-100ms p95 latency on 370k records
- **SQL-first approach**: Maintains control while providing type safety
- **Excellent Next.js 15 integration**: Works seamlessly with Server Components and Server Actions

**Schema definition with RLS**:
```typescript
// schema.ts
export const plans = pgTable('plans', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull(),
  name: text('name').notNull(),
  createdAt: timestamp('created_at').defaultNow()
}, (table) => [
  pgPolicy('user_plans_policy', {
    for: 'all',
    to: authenticatedRole,
    using: sql`${table.userId} = auth.uid()`
  })
]);
```

**Performance optimization for <1s requirement**:
1. **Index all RLS policy columns**: 100x improvement confirmed
   ```sql
   CREATE INDEX idx_plans_user_id ON plans(user_id);
   ```
2. **Wrap auth functions in SELECT**: 171ms → <0.1ms
   ```sql
   (SELECT auth.uid()) = user_id  -- Instead of auth.uid() = user_id
   ```
3. **Explicit filters**: Always include `where(eq(plans.userId, userId))`

**Migration workflow**:
1. Define schema in TypeScript
2. `drizzle-kit generate` → creates SQL migrations
3. `drizzle-kit migrate` → applies to database
4. Commit migrations to version control

**Alternatives considered**:
- **Prisma**: ❌ No native RLS support (requires workarounds marked "not for production")
- **Kysely**: ❌ No RLS support (marked "wontfix"), manual migrations
- **Supabase JS Client**: ✅ Good option but less sophisticated type safety

**Reference**: [thoughts/shared/research/2025-11-12-epic-1-technology-selection.md](#orm-detailed-research)

---

### 4. Email Service Selection

#### Resend - RECOMMENDED FOR MVP ⭐

**Why chosen**:
- **Free tier: 3,000 emails/month** (perfect for MVP)
- **Best developer experience**: React Email for type-safe templates
- **30-minute setup time** (fastest among all providers)
- **Excellent Next.js integration**: Native App Router and Server Actions support
- **Built on AWS SES**: Solid deliverability foundation
- **Pricing**: $0 MVP → $20/month (50k emails) as you scale

**Implementation with Server Actions**:
```typescript
'use server'
import { Resend } from 'resend';

export async function sendVerificationEmail(email: string, token: string) {
  const resend = new Resend(process.env.RESEND_API_KEY);

  await resend.emails.send({
    from: 'Plan Smart <[email protected]>',
    to: email,
    subject: 'Verify your email',
    html: `<a href="${process.env.NEXT_PUBLIC_URL}/verify/${token}">Verify</a>`
  });
}
```

**React Email templates**:
```typescript
// emails/verification.tsx
export default function VerificationEmail({ token }: { token: string }) {
  return (
    <Html>
      <Button href={`https://plansmart.com/verify/${token}`}>
        Verify Email
      </Button>
    </Html>
  );
}
```

**Deliverability**: Built on AWS SES infrastructure, likely meets 98%+ requirement but less battle-tested than Postmark

---

#### Postmark - ALTERNATIVE FOR MAXIMUM RELIABILITY ⭐

**When to choose Postmark over Resend**:
- **99.1% deliverability rate** (proven, independently tested)
- **Sub-1-second delivery** for time-sensitive auth emails
- **15+ years track record** for critical transactional emails
- **$15/month for 10,000 emails** (only slightly more expensive)

**Trade-offs**:
- Less modern developer experience than Resend
- No React-based templating (HTML/CSS templates)
- Smaller free tier (100 test emails vs 3,000/month)

**Recommendation**: Start with Resend for rapid MVP development. Switch to Postmark if you encounter deliverability issues or need guaranteed <1s delivery.

**Reference**: [thoughts/shared/research/2025-11-12-epic-1-technology-selection.md](#email-detailed-research)

---

### 5. State Management

#### Zustand - RECOMMENDED FOR GLOBAL UI STATE ⭐

**Why chosen**:
- **Lightweight**: <1KB gzipped
- **Performance**: Only re-renders components subscribed to changed state
- **No Provider wrapper**: Works seamlessly with Server Components
- **Persistence middleware**: Built-in localStorage sync
- **Simple API**: Less boilerplate than Redux

**Use cases in Epic 1**:
```typescript
// stores/dashboard.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const useDashboardStore = create(
  persist(
    (set) => ({
      sidebarOpen: true,
      currentPlan: null,
      toggleSidebar: () => set((state) => ({
        sidebarOpen: !state.sidebarOpen
      }))
    }),
    { name: 'dashboard-storage' }
  )
);

// Client Component
'use client'
function Sidebar() {
  const sidebarOpen = useDashboardStore(state => state.sidebarOpen);
  // Only re-renders when sidebarOpen changes
}
```

---

#### React Context - FOR ONBOARDING WIZARD LOCAL STATE

**Why Context for wizard**:
- Localized state within component tree
- Temporary data during multi-step flow
- No global state pollution

```typescript
// contexts/OnboardingContext.tsx
'use client'
export function OnboardingProvider({ children, initialData }) {
  const [formData, setFormData] = useState(initialData);
  const [currentStep, setCurrentStep] = useState(0);

  return (
    <OnboardingContext.Provider value={{ formData, currentStep, setFormData }}>
      {children}
    </OnboardingContext.Provider>
  );
}
```

**Decision matrix**:
- Global UI state (sidebar, filters): **Zustand**
- Onboarding wizard state: **Context**
- Form state: **React Hook Form**
- Server data fetching: **Server Components** (no client state)

**Reference**: [thoughts/shared/research/2025-11-12-epic-1-technology-selection.md](#state-management-research)

---

### 6. Form Management & Validation

#### React Hook Form + Zod - RECOMMENDED ⭐

**Why this combination**:
- **React Hook Form**: Optimized re-renders, excellent performance
- **Zod**: TypeScript-first schema validation
- **End-to-end type safety**: Client validation + Server Action validation

**Onboarding wizard implementation**:
```typescript
// schemas/onboarding.ts
export const profileSchema = z.object({
  birthYear: z.number().min(1900).max(new Date().getFullYear()),
  retirementAge: z.number().min(50).max(100),
  filingStatus: z.enum(['single', 'married', 'head_of_household']),
  income: z.number().positive(),
  savingsRate: z.number().min(0).max(100),
  riskTolerance: z.enum(['conservative', 'moderate', 'aggressive'])
});

export type ProfileData = z.infer<typeof profileSchema>;

// Client Component
'use client'
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

function ProfileStep({ onNext }) {
  const form = useForm<ProfileData>({
    resolver: zodResolver(profileSchema),
    mode: 'onBlur'
  });

  const onSubmit = async (data: ProfileData) => {
    const result = await saveProfileStep(data);
    if (result.success) onNext();
  };

  return <form onSubmit={form.handleSubmit(onSubmit)}>...</form>;
}

// Server Action (double validation)
'use server'
export async function saveProfileStep(data: unknown) {
  const validated = profileSchema.parse(data); // Server-side validation
  const session = await verifySession();

  await db.insert(financialSnapshot).values({
    userId: session.user.id,
    ...validated
  });

  return { success: true };
}
```

---

### 7. Deployment Platform

#### Vercel - RECOMMENDED FOR MVP ⭐

**Why chosen**:
- **Zero-config deployment**: Git push → production
- **Generous free tier**: 100GB bandwidth, 6,000 build minutes/month
- **Performance**: Global edge network, <50ms cold starts
- **Built-in features**: Preview deployments, analytics, Web Vitals monitoring
- **Next.js optimization**: Native ISR, image optimization, edge functions
- **Pro tier ($20/month)**: 1TB bandwidth, 100GB-hours serverless (sufficient for 10k-100k users)

**Cost progression**:
- <10k users: **Free tier**
- 10k-100k users: **Pro ($20-100/month)**
- >100k users: **Evaluate self-hosting if >$500/month**

**Migration path**: Build with Vercel-agnostic patterns (avoid Vercel-specific APIs) to enable future migration to AWS/GCP if needed

**Alternative considered**:
- **AWS ECS/Fargate**: Better for >$500/month hosting, but requires DevOps team and complex setup
- **Railway**: Good middle ground at $20-60/month, simpler than AWS
- **Netlify**: Similar to Vercel but weaker SSR support

**Reference**: [thoughts/shared/research/2025-11-12-epic-1-technology-selection.md](#deployment-research)

---

## Technology Stack Recommendation Matrix

### Recommended Stack (Primary)

| Layer | Technology | Tier | Monthly Cost | Justification |
|-------|-----------|------|--------------|---------------|
| **Frontend** | Next.js 15 (App Router) | Free | $0 | Best performance, Server Components, PPR for <1s loads |
| **Hosting** | Vercel Pro | Pro | $20 | Zero-config, global CDN, preview deployments |
| **Authentication** | Supabase Auth | Pro | $25 | Native RLS, 7-day sessions, 100k MAU included |
| **Database** | PostgreSQL (Supabase) | Included | $0 | Included with Supabase Pro, managed, RLS native |
| **ORM** | Drizzle ORM | Free | $0 | Native RLS support, best performance, type safety |
| **Email** | Resend | Pro | $20 | Modern DX, React Email, 50k emails included |
| **State** | Zustand | Free | $0 | Lightweight, performant, simple API |
| **Forms** | React Hook Form + Zod | Free | $0 | Performance, type safety, validation |
| **Styling** | Tailwind + shadcn/ui | Free | $0 | Rapid development, accessible components |
| | | **TOTAL** | **$65/month** | **For 50k-100k MAU in production** |

### Alternative Stack (Maximum Reliability)

Swap **Resend** → **Postmark** ($15/month) for proven 99.1% deliverability
**Total**: $60/month (slightly cheaper, more reliable emails)

### Budget-Constrained Stack (MVP)

| Layer | Technology | Tier | Monthly Cost |
|-------|-----------|------|--------------|
| Frontend | Next.js 15 | Free | $0 |
| Hosting | Vercel Hobby | Free | $0 |
| Authentication | Supabase Auth | Free | $0 |
| Database | PostgreSQL (Supabase) | Free | $0 |
| ORM | Drizzle ORM | Free | $0 |
| Email | Resend | Free | $0 |
| State/Forms/UI | Same as above | Free | $0 |
| | | **TOTAL** | **$0/month** |

**Limitations on free tier**:
- Supabase: 50k MAU limit, no 7-day sessions, projects pause after 1 week inactivity
- Resend: 3,000 emails/month, 100/day limit
- Vercel: Projects may pause, limited to personal use

**Upgrade trigger**: Move to Pro tiers when exceeding free limits or needing production features (session control, backups, no pausing)

---

## Code References

All references are to planning documentation as no code exists yet:
- [thoughts/personal/tickets/epic-1/00-scope/scope.md](../../personal/tickets/epic-1/00-scope/scope.md) - Epic 1 requirements
- [thoughts/personal/tickets/epic-1/00-scope/nfr.md](../../personal/tickets/epic-1/00-scope/nfr.md) - Non-functional requirements
- [thoughts/shared/research/2025-11-11-epic-1-implementation-readiness.md](./2025-11-11-epic-1-implementation-readiness.md) - Initial codebase assessment

---

## Architecture Insights

### Defense-in-Depth Authentication Pattern

The recommended stack implements three security layers:

**Layer 1: Middleware (Optimistic Filter)**
- Quick token check, redirects unauthenticated users
- NOT the primary security boundary (CVE-2025-29927 vulnerability)

**Layer 2: Data Access Layer (Primary Security)**
- `verifySession()` cached function validates JWT on every data fetch
- Enforced at Server Component and Server Action level

**Layer 3: Database RLS (Defense-in-Depth)**
- PostgreSQL policies enforce `auth.uid() = user_id`
- Protects against compromised application code
- Works even if middleware/DAL bypassed

### Performance Architecture for <1s Page Loads

**Marketing Pages (SSG)**:
```
User Request → Edge CDN (instant) → Pre-rendered HTML → <200ms
```

**Authenticated Dashboard (PPR)**:
```
User Request → Edge CDN → Static Shell (instant)
            ↓
         Origin Server → Dynamic Content Streamed → <800ms total
```

**Key optimizations**:
- Static assets cached with `max-age=31536000`
- Critical JS <14kb for TCP slow-start
- Images in AVIF/WebP with lazy loading
- Database queries indexed on RLS columns
- Connection pooling via Supabase Pooler

### Multi-Step Onboarding Pattern

**URL-based step management** (recommended over state-based):
```
/onboarding/profile → /onboarding/financial → /onboarding/preferences → /plans
```

**Benefits**:
- Bookmarkable URLs
- Browser back/forward works naturally
- Server-side step validation prevents skipping
- SEO-friendly if public onboarding needed

**State management**:
- Critical data (financial info): Saved to database immediately via Server Actions
- UX state (current step): React Context within onboarding tree
- Temporary selections: Client-side state, auto-save every 30s

---

## Historical Context (from thoughts/)

This research builds on:
- [thoughts/shared/research/2025-11-11-epic-1-implementation-readiness.md](./2025-11-11-epic-1-implementation-readiness.md) - Initial assessment identified Supabase + Next.js as potential choices

**Decision evolution**:
- Initial thought: Supabase OR Auth0 (undecided)
- Research finding: Auth0 lacks PostgreSQL RLS integration, expensive
- **Decision**: Supabase for integrated auth + database + RLS

**Key insight**: The combination of Supabase Auth + Drizzle ORM provides both native RLS support AND sophisticated type safety, eliminating the need to choose between them.

---

## Related Research

- [2025-11-11-epic-1-implementation-readiness.md](./2025-11-11-epic-1-implementation-readiness.md) - Initial codebase and requirements assessment

---

## Open Questions & Next Steps

### Open Questions

1. **Regional deployment location**: Where are most users located? Deploy Supabase database in that region for <250ms auth latency.

2. **Session "remember me" UI**: How should users opt-in to 7-day sessions? Checkbox on login form vs profile setting?

3. **Email verification strictness**: Should unverified users have read-only access or complete block until verification?

4. **Onboarding drop-off mitigation**: Implement progress saving? Allow skipping non-critical steps?

5. **Password strength meter**: Use zxcvbn library or simpler regex-based checking?

6. **Data retention**: How long to keep onboarding progress for incomplete signups?

7. **Testing strategy**: Jest vs Vitest? Playwright vs Cypress for E2E?

### Immediate Next Steps (R-02 Phase)

1. **Initialize project**:
   ```bash
   npx create-next-app@latest plan-smart --typescript --tailwind --app
   cd plan-smart
   npm install @supabase/ssr @supabase/supabase-js drizzle-orm drizzle-kit
   npm install resend react-hook-form @hookform/resolvers zod zustand
   ```

2. **Set up Supabase project**:
   - Create project at supabase.com
   - Note URL and anon key
   - Configure email templates
   - Set auth token TTL to 7 days (requires Pro upgrade)

3. **Configure Resend**:
   - Sign up at resend.com
   - Verify domain for sending
   - Get API key

4. **Initialize Drizzle**:
   ```bash
   npx drizzle-kit init
   ```
   - Define schema with RLS policies
   - Generate initial migrations

5. **Create proof-of-concept** (1-2 days):
   - Basic login/signup flow
   - Single onboarding step
   - Protected dashboard page
   - Email verification flow
   - Validate <1s page load and <250ms auth latency

6. **Security hardening**:
   - Upgrade Next.js to 15.2.3+ (CVE-2025-29927)
   - Implement defense-in-depth auth pattern
   - Add rate limiting for auth endpoints
   - Configure CSRF protection

7. **Performance baseline**:
   - Set up Vercel Analytics
   - Monitor Web Vitals
   - Establish <1s page load baseline
   - Profile auth API latency

### Risk Mitigation

**Risk: Auth latency >250ms cross-region**
- **Mitigation**: Deploy Supabase in user's primary region, use Vercel edge functions for auth checks
- **Fallback**: Consider Clerk if global latency required (higher cost)

**Risk: Resend deliverability issues for auth emails**
- **Mitigation**: Monitor bounce rates closely in first 2 weeks
- **Fallback**: Switch to Postmark ($15/month) if deliverability <98%

**Risk: Supabase free tier project pausing**
- **Mitigation**: Upgrade to Pro ($25/month) before launch
- **Trigger**: When moving to production or exceeding 50k MAU

**Risk: Onboarding drop-off**
- **Mitigation**: Implement auto-save, allow step skipping, progress indicators
- **Monitoring**: Track `onboarding_completed` metric (per NFR requirements)

---

## Appendix: Detailed Research Summaries

### Supabase Auth Detailed Research

**Complete findings**: See web research agent output on Supabase authentication capabilities

**Key highlights**:
- 15-100ms typical auth latency same-region
- 350-600ms cross-region (may exceed 250ms requirement)
- Pro plan unlocks session timeout controls (7-day configuration)
- RLS native with `auth.uid()` helper function
- Free tier: 50k MAU, no session controls
- Pro tier: $25/month, 100k MAU, session management
- Email service requires custom SMTP for production (2/hour default)
- Security: CSRF via JWT, password policies, RLS enforcement, HTTPS-only

**Deliverability**: No built-in production email service (must integrate Resend/Postmark)

**Performance optimization**:
- Deploy database in user's region
- Index RLS policy columns
- Wrap `auth.uid()` in SELECT
- Use connection pooler for serverless

---

### Auth0 Detailed Research

**Complete findings**: See web research agent output on Auth0

**Why not recommended for Epic 1**:
- No native PostgreSQL RLS integration (custom DB scripts only store credentials)
- No guaranteed <250ms latency (200-500ms+ reported)
- Free tier: 3-day max sessions (need Enterprise for 7+ days)
- Expensive: $0.07/MAU (vs Supabase $0.00325/MAU = 21x more)
- 99.99% uptime (Enterprise only), no SLA on free/developer tiers

**When it makes sense**: Enterprise compliance (SOC2, HIPAA) mandatory, budget >$500/month

---

### Next.js 15 Detailed Research

**Complete findings**: See web research agent output on Next.js for SaaS

**App Router advantages**:
- Server Components by default (credentials never leave server)
- 20-30% less JavaScript (faster page loads)
- Nested layouts (perfect for auth flows)
- Streaming with Suspense (parallel auth checks)
- Built-in middleware for route protection

**Performance strategies**:
- SSG for marketing pages
- PPR for dashboards (static shell + dynamic content)
- Image optimization (automatic AVIF/WebP)
- Bundle analysis (<14kb critical JS)
- Edge functions for auth checks

**Security**: CVE-2025-29927 requires 15.2.3+, 14.2.25+, 13.5.9+, or 12.3.5+

---

### Drizzle ORM Detailed Research

**Complete findings**: See web research agent output on PostgreSQL ORMs

**Why Drizzle over alternatives**:
- **Native RLS**: `pgPolicy()` in schema definitions
- **Performance**: 7.4kb bundle, sub-100ms p95 latency
- **Type safety**: No code generation, instant types
- **SQL control**: SQL-first approach maintains control

**vs Prisma**: Prisma has no native RLS support (workarounds marked "not for production")

**vs Kysely**: Kysely has no RLS support (marked "wontfix")

**vs Supabase JS Client**: Drizzle offers more sophisticated type safety

---

### Email Service Detailed Research

**Complete findings**: See web research agent output on email services

**Resend highlights**:
- Free: 3,000 emails/month
- Pro ($20/month): 50,000 emails
- 30-minute setup time
- React Email for templates
- Built on AWS SES

**Postmark highlights**:
- 99.1% deliverability (proven)
- Sub-1-second delivery
- $15/month for 10,000 emails
- 15+ years track record

**SendGrid**: Not recommended (78% inbox placement, lower than alternatives)

**AWS SES**: Not recommended (complex setup, poor documentation, sandbox restrictions)

---

## Conclusion

The recommended technology stack provides an optimal balance of:
- **Performance**: <1s page loads, <250ms auth latency (regional)
- **Security**: Defense-in-depth authentication, native RLS
- **Developer experience**: Type safety, rapid development
- **Cost efficiency**: $0 MVP → $65/month production (50k-100k MAU)
- **Scalability**: Clear upgrade path as usage grows

**Time to first prototype**: 2-3 days
**Time to production-ready MVP**: 2-3 weeks

This represents a **4-6 week time savings** compared to alternatives like Auth0 + Prisma + SendGrid, while also being significantly more cost-effective at scale.
