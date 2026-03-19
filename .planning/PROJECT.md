# Dwella v2 — Launch Audit & Hardening

## What This Is

A comprehensive audit and hardening pass on Dwella v2 — a React Native + Expo property management app for landlords and tenants. The app is feature-complete (Phases A-D) and in TestFlight beta with 4-5 testers. This project audits code quality, feature completeness, database/API correctness, and launch readiness — fixing critical and security issues, and reporting the rest.

## Core Value

Every user-facing workflow (auth, property CRUD, payments, invites, bot) must work correctly and securely before the app goes live on App Store and Play Store.

## Requirements

### Validated

<!-- Shipped and confirmed valuable — existing functionality from Phase A/B/AI/UI. -->

- ✓ Email/password auth with session persistence — Phase A
- ✓ Google and Apple OAuth — Phase A
- ✓ Property CRUD with soft-delete (is_archived) — Phase A
- ✓ Tenant CRUD with invite flow (UUID token, deep link acceptance) — Phase A
- ✓ Dual-role system (landlord + tenant simultaneously) — Phase A
- ✓ Payment state machine (pending → partial → paid → confirmed / overdue) — Phase B
- ✓ Payment proof upload to Supabase Storage — Phase B
- ✓ Auto-confirm payments (hourly Edge Function, >48h) — Phase B
- ✓ Mark overdue payments (daily midnight Edge Function) — Phase B
- ✓ Send payment reminders (daily 9 AM, 3 days before/on/after due) — Phase B
- ✓ AI bot (Claude API) with structured actions (log_payment, confirm_payment, add_property, add_tenant, send_reminder) — AI Overhaul
- ✓ Telegram + WhatsApp bot integration — AI Overhaul
- ✓ AI tools: insights, search, smart reminders — AI Overhaul
- ✓ CRED Premium UI with Light/Dark theme system — UI Redesign
- ✓ PIN/biometric lock — UI Redesign
- ✓ Push notifications (Expo Notifications) — Phase C
- ✓ PostHog analytics integration — Phase C
- ✓ Expense tracking — Phase C
- ✓ Realtime subscriptions for payments/notifications — Phase B

### Active

<!-- Audit and hardening scope for launch readiness. -->

- [ ] Fix TypeScript compilation errors (PostHog captureLifecycleEvents)
- [ ] Replace placeholder App Store / Play Store URLs in invite-redirect
- [ ] Replace Math.random() UUID/code generation with crypto-secure alternatives
- [ ] Audit and fix RLS policies across all tables
- [ ] Verify soft-delete filtering is consistent across all queries and Edge Functions
- [ ] Audit payment state machine transitions for correctness
- [x] Review and harden Edge Function error handling (proper HTTP status codes) — Validated in Phase 3
- [x] Fix silent auth state failures (show user-facing error on profile sync fail) — Validated in Phase 4
- [x] Validate .env / startup checks (fail fast on missing critical vars) — Validated in Phase 4
- [x] Audit invite flow end-to-end (token generation → deep link → acceptance) — Validated in Phase 3
- [x] Audit bot action flow end-to-end (message → Claude → DB action → reply) — Validated in Phase 3
- [x] Verify all scheduled Edge Functions work correctly — Validated in Phase 3 (pg_cron migration 018)
- [x] Check Realtime subscription cleanup (memory leaks) — Validated in Phase 4
- [ ] Review type safety issues (as any casts, untyped metadata)
- [ ] Security review: token leakage, log exposure, code predictability
- [ ] Verify PDF generation works (receipts, annual summaries)
- [x] Audit push notification flow (registration → delivery) — Validated in Phase 4
- [ ] Performance check: N+1 queries in dashboard, PostHog autocapture impact
- [ ] Launch config: app.json version, EAS build config, store metadata readiness

### Out of Scope

- Unit test suite creation — report as post-launch recommendation, not a blocker
- Major refactors (dashboard decomposition, query builder abstraction) — report only
- Data retention policy / GDPR documentation — report only
- Disaster recovery runbook — report only
- New features or functionality — audit only

## Context

- **Beta status:** TestFlight with 4-5 testers, no issues reported yet
- **Codebase maturity:** Phase A + B + AI Overhaul + CRED UI Redesign all complete and pushed
- **Known concerns:** 28 items identified in `.planning/codebase/CONCERNS.md` (1 critical, 1 high, 11 medium, 11 low)
- **Tech debt:** No unit tests, some `as any` casts, monolithic dashboard, no structured logging
- **Migrations:** 15 SQL migrations (001-015) applied
- **Edge Functions:** 13 deployed functions (bot, payments, reminders, AI tools, notifications, invite)

## Constraints

- **Fix scope:** Only critical and security issues get fixed; everything else is reported
- **No breaking changes:** Fixes must not break existing beta functionality
- **Supabase backend:** All DB changes must be migration-based (no manual SQL)
- **Expo managed workflow:** No ejecting or native module changes

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Fix critical + security only | Preparing for launch, not a rewrite — minimize risk | — Pending |
| Report non-critical issues | User will prioritize post-launch based on report | — Pending |
| Audit all 4 dimensions | Code quality + features + DB/API + launch readiness covers full surface | — Pending |

---
*Last updated: 2026-03-19 after Phase 4 completion — client hardening: auth error toast, env fail-fast, subscription cleanup verified, push token fix*
