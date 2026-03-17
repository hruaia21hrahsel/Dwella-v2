# Feature Research

**Domain:** Pre-launch audit — React Native + Expo + Supabase property management / fintech-adjacent app
**Researched:** 2026-03-17
**Confidence:** HIGH (grounded in existing CONCERNS.md + Supabase production checklist + App Store guidelines)

---

## Feature Landscape

This document maps the audit surface as "features to be delivered by the audit milestone." Each row is an audit area, not a product feature.

---

### Table Stakes (Must Audit Before Launch — Reviewers or Users Reject Without These)

These are the areas where gaps produce launch blockers: App Store rejection, user data loss, or security vulnerabilities that are exploitable on day one. Failing any of these means the app should not ship.

| Audit Area | Why Expected | Complexity | Notes |
|---|---|---|---|
| TypeScript compilation passes | App must compile — `npx tsc --noEmit` is the absolute floor | LOW | Already known: PostHog `captureLifecycleEvents` invalid property in `app/_layout.tsx:243` |
| App Store / Play Store URLs are real | Invite flow redirects to wrong stores — users click invite link, land nowhere | LOW | Known blocker: `invite-redirect/index.ts` lines 20-21 contain placeholder IDs |
| RLS enabled and correct on all tables | Supabase tables without RLS are 100% public; anon key gives full read/write | HIGH | Must verify every table: `users`, `properties`, `tenants`, `payments`, `notifications`, `bot_conversations` |
| Auth flow end-to-end (email, Google, Apple) | Users cannot use the app if they cannot log in | MEDIUM | Cover session persistence, OAuth redirect handling, and session refresh |
| Invite deep link end-to-end | Core tenant onboarding flow — if broken, no tenant can join | MEDIUM | `dwella://invite/{token}` → `app/invite/[token].tsx` → `tenants.user_id` linked |
| Payment state machine correctness | Wrong state transitions cause landlords to think they've been paid when they haven't | MEDIUM | Trace all transitions: pending → partial → paid → confirmed / overdue |
| Edge Function HTTP status codes | Clients cannot differentiate retryable errors from fatal ones | MEDIUM | All 13 deployed functions return generic 500; need 400/404/500/503 distinction |
| Cryptographically secure token generation | `Math.random()` tokens are predictable — Telegram link tokens and WhatsApp codes are forgeable | LOW | `lib/bot.ts` lines 39-44 and line 79; fix with `expo-crypto` or native `crypto.getRandomValues` |
| Environment variable validation on startup | App boots silently with no Supabase URL/key — all queries fail invisibly | LOW | `lib/supabase.ts`: log-only warning must become a throw or visible user error |
| Soft-delete filter applied consistently | Archived records leaking into queries means former tenants see active data or reports are wrong | HIGH | Must check every `.from('tenants')` and `.from('properties')` call across hooks, screens, and Edge Functions |
| Realtime subscription cleanup | Memory leak from uncleaned channels degrades app on long sessions | LOW | `hooks/useProperties.ts:77` and `hooks/usePayments.ts:64` use `removeChannel` without `unsubscribe` |
| Auto-confirm / mark-overdue / send-reminders Edge Functions work correctly | Core scheduled business logic — if broken, payments silently never confirm or never go overdue | MEDIUM | Verify trigger schedules in Supabase cron, not just that code exists |
| Silent auth sync failure shows user error | Auth state initialized with `fallbackUser` on DB error — user has no idea their data is incomplete | LOW | `app/_layout.tsx:94-114`: add toast or banner on profile sync failure |
| App Store metadata readiness (version, screenshots, privacy policy) | Apple rejects for missing or inaccurate metadata on ~40% of first submissions | MEDIUM | `app.json` version/build number, EAS profile configuration, privacy policy URL, age rating |
| Privacy disclosure for AI (Claude API) | Apple now requires consent modal before personal data is sent to external AI providers | MEDIUM | Bot sends full properties/tenants context to Claude API — disclosure required in App Store privacy questionnaire and in-app |

---

### Differentiators (Deeper Audit Areas That Catch Non-Obvious Issues)

These areas go beyond the obvious. A superficial audit skips them. A thorough audit checks them because they produce hard-to-reproduce production failures or gradual trust erosion.

| Audit Area | Value Proposition | Complexity | Notes |
|---|---|---|---|
| Bot action flow end-to-end trace | Bot silently failing is worse than bot crashing — landlord thinks action was taken, it wasn't | HIGH | Trace: Telegram message → `telegram-webhook` → `process-bot-message` → Claude JSON → DB write → reply; verify each hop |
| N+1 query detection in dashboard | Dashboard slow to load at scale; free Supabase plan has connection limits that N+1 exhausts fast | MEDIUM | `hooks/useDashboard.ts` implied sequential: properties → tenants per property → payments per tenant |
| Payment proof storage path correctness | Wrong storage path means proof images are orphaned or inaccessible — landlord cannot verify payment | MEDIUM | Verify path `{property_id}/{tenant_id}/{year}-{month}.jpg` matches actual upload logic |
| PostHog analytics correctness and privacy | Autocapture may capture sensitive payment data in touch events; GDPR implications for EU users | MEDIUM | Disable or sample aggressive autocapture in production; verify no payment amounts in captured events |
| Scheduled Edge Function cron configuration | Supabase cron schedules are separate from function deployment — a deployed function with a misconfigured cron never runs | MEDIUM | Verify pg_cron entries match stated schedules (hourly, daily midnight, daily 9 AM) |
| PDF generation correctness | Receipts and annual summaries are legal documents — wrong totals or missing data erode trust | HIGH | Test `generate-pdf` Edge Function with a real tenant's data; check year/month aggregation |
| Push notification registration and delivery | Notifications are the primary re-engagement loop — if token registration silently fails, users get no reminders | MEDIUM | Verify Expo push token registration → stored in DB → used by `send-reminders` function |
| Sensitive data in logs / network responses | Verification codes and tokens logged in Edge Functions are readable in Supabase function logs | MEDIUM | `lib/bot.ts` sends `{ phone, code }` to Edge Function; function logs must mask sensitive fields |
| `as any` casts audit | Type bypasses hide runtime errors — `as any` in auth and Edge Functions conceals interface mismatches | LOW | `lib/supabase.ts:24`, `send-reminders/index.ts:35,47`, `lib/types.ts:109` |
| EAS build configuration correctness | Wrong `eas.json` profiles or missing credentials silently produce builds that cannot be submitted | MEDIUM | Verify `production` profile, `bundleIdentifier`, `googleServicesFile`, and signing config |
| Deep link token exposure in HTML | Invite token rendered in redirect page HTML — users who share screenshots expose valid tokens | LOW | `invite-redirect/index.ts:187`: `<code>${token}</code>` renders raw token; acceptable risk but document it |
| Dependency version audit | Outdated packages with known CVEs rejected by some enterprise MDMs; Expo SDK compatibility matrix matters | LOW | Run `npx expo install --check` and `npm audit`; flag CVEs against Expo SDK 51 compatibility |

---

### Anti-Features (Audit Approaches to Deliberately NOT Take)

These are approaches that seem thorough but add risk, scope creep, or wasted effort for a hardening milestone with a fix-only-critical constraint.

| Anti-Feature | Why Requested | Why Problematic | Alternative |
|---|---|---|---|
| Writing a unit test suite | Tests give confidence before launch | Out of scope per PROJECT.md; creating tests is new work that can introduce regressions during the test setup itself; 0-to-coverage in a single sprint is a false security | Report absence as a post-launch recommendation; identify the 3-5 critical paths that need tests first |
| Full dashboard component decomposition | Monolithic dashboard is hard to maintain | Refactoring a working screen before launch is a regression risk; no user-facing value | Report as post-launch tech debt with suggested component breakdown |
| Implementing retry logic everywhere | Network resilience is genuinely valuable | Retry logic with improper idempotency on payment operations can double-record payments — dangerous in fintech | Fix only the non-mutating calls (reads, notification sends); flag payment mutations as needing idempotency keys first |
| Certificate pinning | Mentioned in fintech security guides | Breaks OTA updates (Expo Updates relies on certificate validation that pinning interferes with); causes crashes when Supabase rotates certs | Verify TLS is enforced at Supabase level (SSL enforcement setting); do not pin in the client |
| GDPR documentation creation | Required for legal compliance | Creating a full data retention policy and DPA is legal work, not engineering work | Report as out of scope; provide a data inventory (what's collected, where stored) as input to a lawyer |
| Penetration testing (manual) | Full pentest catches what automated tools miss | Takes 2-5 days of dedicated effort; out of scope for this milestone | Run Supabase Security Advisor (automated), verify RLS with policy simulation — covers 80% of the attack surface |
| Sentry or structured logging integration | Critical for production observability | New SDK integration before launch is a code change that needs testing; wrong DSN means silent loss of all errors | Add as P1 post-launch task; note existing `console.error` locations so Sentry can be dropped in cleanly later |

---

## Feature Dependencies

```
TypeScript Compilation Fix
    └──required by──> All other audit work (can't run or verify a non-compiling app)

RLS Audit
    └──required by──> Security sign-off
                          └──required by──> App Store submission

Soft-Delete Consistency Audit
    └──required by──> Data Integrity sign-off
    └──required by──> RLS Audit (RLS policies often rely on owner checks that break on archived records)

Edge Function Error Handling
    └──required by──> Bot Action Flow Trace
    └──required by──> Scheduled Function Verification

Payment State Machine Audit
    └──required by──> PDF Generation correctness check

App Store metadata + EAS config
    └──required by──> Submission (final gate)

Crypto-secure token fix
    └──required by──> Security sign-off

Invite flow end-to-end
    └──depends on──> Deep link routing (Expo Router)
    └──depends on──> RLS (invite acceptance writes to tenants row)
```

### Dependency Notes

- **TypeScript fix is the absolute first task:** Nothing else can be reliably verified on a non-compiling codebase. Fix `captureLifecycleEvents` before any other audit step.
- **RLS audit must precede security sign-off:** Supabase documentation is explicit — tables without RLS are fully public to any client with the anon key. This is the highest-leverage security check.
- **Soft-delete consistency depends on RLS correctness:** Many RLS policies are written assuming `is_archived = FALSE` filtered rows. If soft-delete filtering is absent, RLS policies may pass rows they shouldn't.
- **Payment state machine audit gates PDF correctness:** PDF receipts aggregate payment history; if the state machine has incorrect transitions, the receipt totals will be wrong regardless of the PDF rendering logic.
- **App Store / Play Store URL fix is independent:** Can be done in parallel with any other work — single-line config change, deploy one Edge Function.

---

## MVP Definition

For this milestone, "MVP" means: the minimum audit scope that produces a launch-ready app. Anything beyond this is a post-launch improvement.

### Launch With (Audit v1 — Required for App Store Submission)

- [ ] TypeScript compilation error fixed — prerequisite for everything else
- [ ] App Store / Play Store URLs replaced with real IDs
- [ ] RLS policies verified on all tables
- [ ] Cryptographically secure token generation replacing `Math.random()`
- [ ] Soft-delete filtering verified across all queries and Edge Functions
- [ ] Payment state machine transitions verified as correct
- [ ] Edge Function error handling returns appropriate HTTP status codes
- [ ] Auth sync failure shows user-facing error instead of silent fallback
- [ ] Environment variable validation throws on missing critical vars
- [ ] Invite flow verified end-to-end
- [ ] Scheduled Edge Functions verified to have correct cron schedules
- [ ] App Store metadata readiness confirmed (version, privacy policy, age rating, AI disclosure)

### Add After Validation (v1.x — Post-Launch Improvements)

- [ ] N+1 query optimization in dashboard — trigger: user complaints about dashboard load time
- [ ] Structured logging / Sentry integration — trigger: first production bug that can't be diagnosed from user report
- [ ] Retry logic for non-mutating API calls — trigger: user complaints about network errors
- [ ] Push notification delivery verification with real device — trigger: reminder send rates in PostHog drop below expected
- [ ] PostHog autocapture scoping — trigger: GDPR inquiry or EU user base grows

### Future Consideration (v2+ — After Product-Market Fit)

- [ ] Unit test suite — defer until core workflows stabilize; testing a moving target wastes effort
- [ ] Payment state machine enforcement via DB trigger — valid hardening but requires migration and thorough testing
- [ ] Dashboard component decomposition — low user impact, high refactor risk before initial scale is proven
- [ ] Full GDPR documentation and data retention policy — engage a lawyer when user base is large enough to attract regulatory attention

---

## Feature Prioritization Matrix

| Audit Area | User / Business Value | Implementation Cost | Priority |
|---|---|---|---|
| TypeScript compilation fix | HIGH (build blocker) | LOW | P1 |
| App Store URLs replaced | HIGH (launch blocker) | LOW | P1 |
| RLS audit and fixes | HIGH (data breach risk) | HIGH | P1 |
| Crypto-secure token generation | HIGH (security) | LOW | P1 |
| Soft-delete consistency | HIGH (data integrity) | MEDIUM | P1 |
| Auth sync user-facing error | MEDIUM | LOW | P1 |
| Edge Function error codes | MEDIUM (bot reliability) | MEDIUM | P1 |
| Payment state machine audit | HIGH (fintech correctness) | MEDIUM | P1 |
| Scheduled function cron verification | HIGH (silent failure risk) | LOW | P1 |
| App Store metadata / EAS config | HIGH (submission gate) | MEDIUM | P1 |
| AI privacy disclosure | HIGH (App Store rejection risk) | LOW | P1 |
| Invite flow end-to-end trace | HIGH (tenant onboarding) | MEDIUM | P1 |
| Bot action flow end-to-end trace | MEDIUM (trust erosion) | HIGH | P2 |
| N+1 query in dashboard | MEDIUM (UX at scale) | MEDIUM | P2 |
| Payment proof storage paths | MEDIUM (proof integrity) | LOW | P2 |
| Realtime subscription cleanup | LOW (memory leak) | LOW | P2 |
| PostHog privacy scoping | MEDIUM (GDPR risk) | LOW | P2 |
| PDF generation correctness | HIGH (legal doc) | MEDIUM | P2 |
| Push notification delivery | MEDIUM (re-engagement) | LOW | P2 |
| `as any` cast audit | LOW (type safety) | LOW | P3 |
| Dependency CVE audit | LOW (enterprise MDM edge case) | LOW | P3 |
| Unit test suite | LOW (post-launch) | HIGH | P3 |

**Priority key:**
- P1: Must complete before App Store submission
- P2: Should complete before submission if time allows; required before v1.1
- P3: Post-launch; defer without shame

---

## Competitor Feature Analysis

This is an audit milestone, not a product feature build. Competitor analysis is therefore framed as: what do comparable apps audit before launch?

| Audit Area | Buildium / AppFolio (enterprise PM) | Splitwise (payments, consumer) | Our Approach |
|---|---|---|---|
| RLS / data isolation | Full tenant isolation enforced at DB layer | Per-group data isolation | Supabase RLS policies on all tables — must verify each one |
| Payment audit trail | Immutable ledger with ON DELETE RESTRICT | Soft history, no deletion | Already have RESTRICT; verify state machine and no unauthorized state skips |
| AI data disclosure | No AI features | N/A | Apple now requires explicit consent before Claude API receives personal data |
| Deep link security | Invite tokens are single-use and expire | Group invite links expire | Token expiry not currently implemented — document as known gap, not a blocker |
| Offline resilience | Native apps with local DB cache | Network-dependent | React Native + Supabase is network-dependent; document graceful error states |

---

## Sources

- Supabase Production Checklist (HIGH confidence — official docs): https://supabase.com/docs/guides/deployment/going-into-prod
- App Store Review Guidelines 2026 (HIGH confidence — official): https://developer.apple.com/app-store/review/guidelines/
- Supabase Security Advisor and RLS audit patterns: https://dev.to/fabio_a26a4e58d4163919a53/supabase-security-the-hidden-dangers-of-rls-and-how-to-audit-your-api-29e9
- EAS Submit documentation (HIGH confidence — official Expo docs): https://docs.expo.dev/submit/introduction/
- App Store rejection reasons 2025-2026 (MEDIUM confidence — aggregated from multiple review sources): https://twinr.dev/blogs/apple-app-store-rejection-reasons-2025/
- React Native security checklist (MEDIUM confidence): https://sugandsingh5566.medium.com/mobile-application-security-checklist-in-react-native-ba9565065df9
- Existing CONCERNS.md (HIGH confidence — direct codebase analysis): `.planning/codebase/CONCERNS.md`
- PROJECT.md audit scope definition (HIGH confidence): `.planning/PROJECT.md`

---

*Feature research for: Dwella v2 pre-launch audit — property management / fintech-adjacent mobile app*
*Researched: 2026-03-17*
