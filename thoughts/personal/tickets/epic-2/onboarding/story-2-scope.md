# Story 2.2 — Display Financial Results After Onboarding (Core Aha Moment)

As a user, after completing onboarding, I want to immediately see my financial projection and key retirement metrics so I understand where I stand.

## Acceptance Criteria

### Trigger & Flow

- This screen is shown automatically after onboarding completion
- No additional clicks are required to "run" the plan
- User is routed to `/plan/:id/overview` (or equivalent)

### Data Display (Minimum Required)

The screen displays, above the fold:

#### Retirement Status Summary

One of:
- "On Track"
- "Needs Adjustment"
- "At Risk of Shortfall"

Status derived directly from projection output.

#### Key Numbers (Snapshot Cards)

- Estimated assets at retirement
- Estimated monthly retirement spending supported
- Age/year money runs out (if applicable)
- Retirement age target

#### Primary Projection Chart

- Asset balance over time
- Clear visual separation:
  - Pre-retirement (accumulation)
  - Post-retirement (drawdown)
- Shortfall year visually marked if applicable

### UX & Clarity

- Numbers are rounded and human-readable (e.g., $1.8M, not $1,823,492)
- No financial jargon without explanation
- Page loads fully in <2 seconds

### Error Handling

If projection fails:
- User sees a friendly message ("We couldn't generate your plan yet")
- Option to retry or edit inputs
- No blank or partially rendered states