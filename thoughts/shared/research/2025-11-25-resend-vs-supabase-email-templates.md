---
date: 2025-11-25T12:00:00-08:00
researcher: Claude
git_commit: 80ba93b3a8d14b982e602ac93e25781d0b6159c9
branch: main
repository: plan-smart
topic: "Comparison of Resend Email Templates vs Supabase Email Templates"
tags: [research, email, resend, supabase, templates, authentication]
status: complete
last_updated: 2025-11-25
last_updated_by: Claude
---

# Research: Comparison of Resend Email Templates vs Supabase Email Templates

**Date**: 2025-11-25T12:00:00-08:00
**Researcher**: Claude
**Git Commit**: 80ba93b3a8d14b982e602ac93e25781d0b6159c9
**Branch**: main
**Repository**: plan-smart

## Research Question

Compare Resend email templates with Supabase email templates - how does this codebase handle email templates and what are the differences between the two approaches?

## Summary

This codebase uses **Resend with custom React templates** instead of Supabase's built-in email system. There are no Supabase email templates configured - the project has chosen to decouple email delivery from authentication entirely. Supabase handles user authentication only, while Resend handles all transactional email delivery through custom React component templates.

### Key Finding

**No direct comparison is possible** because the codebase doesn't use Supabase email templates at all. The architecture intentionally bypasses Supabase's built-in email functionality in favor of a custom Resend implementation.

## Detailed Findings

### Current Implementation: Resend Email Templates

The codebase implements a custom email system using Resend with React component templates.

**Directory Structure:**
```
src/lib/email/
├── client.ts                    # Resend client initialization
├── send.ts                      # Email sending functions
├── queue.ts                     # Rate limiting (5 emails/hour/address)
├── templates/
│   ├── verification-email.tsx   # React component template
│   └── password-reset-email.tsx # React component template
└── __tests__/                   # Test coverage
```

**Email Types Implemented:**
| Email Type | Template File | Expiration |
|------------|--------------|------------|
| Verification | `verification-email.tsx` | 24 hours |
| Password Reset | `password-reset-email.tsx` | 1 hour |
| Welcome | Inline HTML in `send.ts` | N/A |

**Technical Approach:**
- Templates are **React/TSX components** with inline CSS styling
- Resend renders React components server-side when sending
- All emails sent from `Plan Smart <noreply@plansmart.app>`
- Branded with Plan Smart colors (#4F46E5 - indigo)

### Why Supabase Email Templates Are Not Used

**Supabase Built-in Limitations:**
1. **Rate limiting**: Only 2 emails/hour on built-in service (inadequate for production)
2. **No customization**: Limited template control without custom SMTP
3. **Requires external SMTP anyway**: To scale, must integrate external provider

**Decision documented in** `thoughts/shared/research/2025-11-12-epic-1-technology-selection.md`:
> "Built-in email service inadequate for production: 2 emails/hour limit. Requires custom SMTP integration (Resend or Postmark)."

### Comparison: Resend vs Supabase Email Templates

| Aspect | Resend (Current Implementation) | Supabase Built-in |
|--------|--------------------------------|-------------------|
| **Template Format** | React/TSX components | HTML templates in Supabase dashboard |
| **Rate Limits** | 3,000 emails/month free, then scalable | 2 emails/hour built-in |
| **Customization** | Full control, type-safe | Limited to template variables |
| **Developer Experience** | Modern React patterns, local development | Dashboard-only editing |
| **Deliverability** | AWS SES infrastructure | Shared Supabase infrastructure |
| **Cost (MVP)** | $0 | $0 |
| **Cost (50k emails)** | $20/month | Requires external SMTP anyway |
| **Local Testing** | React component testing | Manual dashboard preview |
| **Version Control** | Git-tracked TSX files | Not version controlled |

### Resend Template Implementation Details

**Verification Email Template** ([verification-email.tsx](src/lib/email/templates/verification-email.tsx)):
```tsx
export const VerificationEmail: React.FC<VerificationEmailProps> = ({
  verificationUrl,
}) => (
  <html>
    <head>
      <style>{`/* Inline CSS styling */`}</style>
    </head>
    <body>
      <div className="container">
        <div className="header">
          <h1>Welcome to Plan Smart!</h1>
        </div>
        <div className="content">
          <a href={verificationUrl} className="button">
            Verify Email Address
          </a>
          {/* 24-hour expiration notice */}
        </div>
      </div>
    </body>
  </html>
);
```

**Password Reset Template** ([password-reset-email.tsx](src/lib/email/templates/password-reset-email.tsx)):
- Includes security warning box
- 1-hour expiration notice
- Single-use token notice

**Email Sending Functions** ([send.ts](src/lib/email/send.ts)):
```typescript
await resend.emails.send({
  from: FROM_EMAIL,
  to: email,
  subject: 'Verify your Plan Smart account',
  react: VerificationEmail({ verificationUrl, email }),
});
```

### What Supabase Email Templates Would Look Like (Not Implemented)

If using Supabase's built-in templates, configuration would be in `supabase/config.toml`:

```toml
[auth.email]
enable_signup = true
double_confirm_changes = true
enable_confirmations = true

[auth.email.template.confirmation]
subject = "Confirm your signup"
content_path = "./supabase/templates/confirmation.html"

[auth.email.template.recovery]
subject = "Reset your password"
content_path = "./supabase/templates/recovery.html"
```

**This configuration does not exist in this codebase** - no `supabase/` directory or `config.toml` file.

## Code References

### Resend Implementation
- [src/lib/email/client.ts](src/lib/email/client.ts) - Resend client setup with API key
- [src/lib/email/send.ts](src/lib/email/send.ts) - `sendVerificationEmail()`, `sendPasswordResetEmail()`, `sendWelcomeEmail()`
- [src/lib/email/templates/verification-email.tsx](src/lib/email/templates/verification-email.tsx) - React verification template
- [src/lib/email/templates/password-reset-email.tsx](src/lib/email/templates/password-reset-email.tsx) - React password reset template
- [src/lib/email/queue.ts](src/lib/email/queue.ts) - Rate limiting logic

### Authentication Integration
- [src/lib/auth/supabase-adapter.ts](src/lib/auth/supabase-adapter.ts) - Supabase auth without built-in emails
- [src/app/api/auth/signup/route.ts](src/app/api/auth/signup/route.ts) - Signup triggers custom email
- [src/app/api/auth/verify-email/route.ts](src/app/api/auth/verify-email/route.ts) - Verification handler
- [src/app/api/auth/forgot-password/route.ts](src/app/api/auth/forgot-password/route.ts) - Password reset trigger

### Configuration
- [.env.example](.env.example) - `RESEND_API_KEY=re_your_api_key`
- [package.json](package.json) - `"resend": "^6.5.2"` dependency

## Architecture Insights

### Decoupled Email Architecture

The codebase implements a **separation of concerns**:

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Supabase      │     │   Next.js API   │     │     Resend      │
│   (Auth Only)   │────▶│   (Orchestrate) │────▶│   (Deliver)     │
└─────────────────┘     └─────────────────┘     └─────────────────┘
        │                        │                       │
   User signup            Trigger email            Send via AWS SES
   Session mgmt           Rate limiting            React rendering
   Token validation       Template selection       Deliverability
```

**Benefits of this approach:**
1. **Provider flexibility**: Can switch email providers without touching auth
2. **Full template control**: React components vs dashboard-only editing
3. **Local development**: Test email templates locally with unit tests
4. **Version control**: Templates tracked in git, not stuck in dashboard
5. **Type safety**: TypeScript interfaces for template props

### Provider Abstraction Pattern

The auth system uses an abstraction layer that doesn't assume email handling:

```typescript
// src/lib/auth/supabase-adapter.ts
export interface AuthProvider {
  signUp(email: string, password: string): Promise<User>;
  verifyEmail(token: string): Promise<void>;
  resetPassword(email: string): Promise<void>;
  // Email sending is NOT part of auth interface
}
```

Email sending is handled separately by the application layer, not by the auth provider.

## Historical Context (from thoughts/)

### Technology Selection Decision
- [thoughts/shared/research/2025-11-12-epic-1-technology-selection.md](thoughts/shared/research/2025-11-12-epic-1-technology-selection.md)
  - Documents Resend vs Postmark decision
  - Notes Supabase 2 emails/hour limitation
  - Recommends Resend for MVP, Postmark as fallback for deliverability issues

### Implementation Plan
- [thoughts/shared/plans/2025-11-17-epic-1-auth-onboarding-implementation.md](thoughts/shared/plans/2025-11-17-epic-1-auth-onboarding-implementation.md)
  - Detailed email template specifications
  - Testing requirements for email delivery
  - Deployment checklist (SPF, DKIM, DMARC)

### Architecture Decisions
- [thoughts/shared/architecture/2025-11-17-authentication-provider-decision.md](thoughts/shared/architecture/2025-11-17-authentication-provider-decision.md)
  - Cost analysis including Resend pricing
  - Migration considerations for email templates

## Related Research

- [2025-11-12-epic-1-technology-selection.md](thoughts/shared/research/2025-11-12-epic-1-technology-selection.md) - Original email provider selection
- [2025-11-11-epic-1-implementation-readiness.md](thoughts/shared/research/2025-11-11-epic-1-implementation-readiness.md) - Email requirements analysis

## Open Questions

1. **Postmark fallback**: If deliverability drops below 98%, the documented fallback is Postmark. Has this threshold been monitored?

2. **Welcome email template**: Currently uses inline HTML in `send.ts` instead of a React component. Should this be migrated to a TSX template for consistency?

3. **Email testing in production**: Are SPF, DKIM, and DMARC records configured for `plansmart.app`?

4. **Rate limiting persistence**: Current rate limiting is in-memory (`Map`). Will this reset on server restart causing potential abuse?
