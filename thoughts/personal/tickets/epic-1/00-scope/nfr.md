# EPIC 1 — Non-Functional Requirements (NFRs)

## ⚡ Performance
| Metric | Target | Rationale |
|---------|---------|-----------|
| Plan list load after login | < 1 s | Maintain smooth return experience |
| Auth API latency | < 250 ms P95 | Prevent login sluggishness |
| Onboarding step save | < 500 ms P95 | Avoid form drop-off |

## 🔒 Security & Privacy
| Requirement | Detail |
|-------------|---------|
| Password policy | ≥ 12 chars + 3 char classes; reject common pwned passwords |
| Session cookies | `Secure`, `HttpOnly`, `SameSite=Lax` |
| Token TTL | 7 days with “remember me”, 24 h otherwise |
| CSRF protection | Anti-CSRF token on mutations |
| Transport security | HTTPS only, HSTS enabled |
| PII handling | No PII in logs; encrypt at rest; mask telemetry fields |
| RLS | Enforce `auth.uid() = user_id` on all user tables |

## 🧠 Reliability & Availability
| Metric | Target | Notes |
|---------|---------|-------|
| Auth provider uptime | ≥ 99 % | Managed service SLA |
| Email delivery success | ≥ 98 % | Transactional email critical |
| Reset link success rate | ≥ 95 % | Detect bounces, expired links |

## 📈 Observability
| Signal | Collection | Purpose |
|---------|-------------|----------|
| `auth_success` / `auth_failure` | Structured logs | Detect lockout / brute force |
| `onboarding_completed` | Metric + event | Track funnel completion |
| `plan_list_loaded` | Metric | Verify P95 latency target |
| PII filtering | Log middleware | Ensure no sensitive data leaks |

## 🧩 Scalability
| Concern | Approach |
|----------|-----------|
| Growth in users | Leverage managed auth & Postgres scaling tiers |
| Email rate limits | Queue or rate-limit reset/verify emails |
| Session store | Use JWT + client cookies (no server state bloat) |

---

### ✅ Definition of Done
- All NFRs agreed by engineering + security.  
- Targets tracked as metrics in Validate phase.  
- Linked from `scope.md` and `01-research.md`.
