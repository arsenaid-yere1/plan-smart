# EPIC 1 — User Registration, Login & Onboarding

## R-01 · Define Scope & Success Criteria

### 🧩 Problem Statement

New users must be able to:

- Create an account securely (email + password).
- Verify their email and sign in from any device.
- Recover a lost password.
- Complete a brief guided onboarding (personal + financial basics).
- Instantly view previously created retirement plans after login.

Returning users should have optional “remember me” sessions lasting 7 days.

---

### ✅ In Scope

| Category       | Included                                                                                                 |
| -------------- | -------------------------------------------------------------------------------------------------------- |
| **Auth**       | Email + password signup, login, logout, reset, verification email                                        |
| **Session**    | Persistent 7-day “remember me” token; default short-lived session                                        |
| **Onboarding** | 3–5 step wizard → birth year, target retirement age, filing status, income, savings rate, risk tolerance |
| **Data Model** | `user_profile`, `financial_snapshot`, `plans` (auto-create “Personal Plan v1”)                           |
| **Security**   | Password policy (min 12 chars + entropy), CSRF, HTTPS-only cookies, RLS policies                         |
| **UX Flows**   | Sign-up → verify → onboard → plans; login → plans; forgot/reset; logout                                  |
| **Emails**     | Verification + password reset transactional templates                                                    |
| **NFRs**       | Perf (< 1 s plan list load), Reliability (> 99 % auth uptime), Telemetry (auth events w/o PII)           |

---

### 🚫 Out of Scope (for MVP)

| Excluded                                | Notes                  |
| --------------------------------------- | ---------------------- |
| Social logins (Google, Apple, etc.)     | Future enhancement     |
| MFA / 2FA                               | Deferred               |
| OAuth flows (CFP accounts, aggregators) | Later phase            |
| Mobile app UI                           | Web MVP only           |
| Advanced analytics / tracking           | Limited telemetry only |
| Localization / i18n                     | English only           |

---

### 🎯 Success Criteria / Acceptance Benchmarks

| Goal                | Acceptance Test                                                |
| ------------------- | -------------------------------------------------------------- |
| Account creation    | Valid email → verification → login success                     |
| Password policy     | Weak password rejected; strength meter visible                 |
| Session persistence | “Remember me” → token valid 7 days; default = session-only     |
| Password reset      | Reset email sent; link ≤ 1 h TTL; reset works once             |
| Logout              | Cookie deleted; subsequent API 401; redirect home              |
| Onboarding → plan   | Completing wizard creates plan record + redirect to / plans    |
| Return user         | Plan list loads < 1 s via authenticated API                    |
| Security            | HTTPS enforced; no PII in logs; brute-force mitigation enabled |

---

### ⚙️ Risks & Assumptions

| Type           | Item                                                                    |
| -------------- | ----------------------------------------------------------------------- |
| **Assumption** | Chosen auth provider (Supabase/Auth0) supports email verify + token TTL |
| **Assumption** | SMTP provider (Postmark or built-in) reliable > 99 %                    |
| **Risk**       | Email deliverability issues delay verification                          |
| **Risk**       | Password reset token reuse or expiry misconfig                          |
| **Risk**       | Onboarding drop-off before first plan creation                          |

---

### 📦 Deliverables

- `thoughts/epic-1/00-scope/scope.md` (this file)
- `thoughts/epic-1/00-scope/nfr.md` (non-functional requirements)

---

### ✅ Definition of Done

- Scope and NFR docs committed to repo.
- Reviewed & approved by PM + Tech Lead.
- “In / Out” boundaries accepted before Research R-02 begins.
