# Dwella v2

## What This Is

A cross-platform mobile app (React Native + Expo) for landlords and tenants to manage rental properties, track payments, and communicate via an AI-powered Telegram/WhatsApp bot. Feature-complete, audited, and hardened for App Store and Play Store submission.

## Core Value

Every user-facing workflow (auth, property CRUD, payments, invites, bot) works correctly and securely.

## Requirements

### Validated

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
- ✓ AI bot (Claude API) with structured actions — AI Overhaul
- ✓ Telegram + WhatsApp bot integration — AI Overhaul
- ✓ AI tools: insights, search, smart reminders — AI Overhaul
- ✓ CRED Premium UI with Light/Dark theme system — UI Redesign
- ✓ PIN/biometric lock — UI Redesign
- ✓ Push notifications (Expo Notifications) — Phase C
- ✓ PostHog analytics integration — Phase C
- ✓ Expense tracking — Phase C
- ✓ Realtime subscriptions for payments/notifications — Phase B
- ✓ Zero TypeScript compilation errors — v1.0
- ✓ ESLint with security rules (no-explicit-any at error severity) — v1.0
- ✓ Sentry crash monitoring wired — v1.0
- ✓ RLS policies hardened (28 per-operation with WITH CHECK) — v1.0
- ✓ Crypto-secure tokens (expo-crypto randomUUID + getRandomBytes) — v1.0
- ✓ Webhook authentication (Telegram secret, WhatsApp HMAC-SHA256) — v1.0
- ✓ Prompt injection mitigation in bot context — v1.0
- ✓ Soft-delete filtering verified across all queries — v1.0
- ✓ Payment state machine enforced at DB level (BEFORE UPDATE trigger) — v1.0
- ✓ All Edge Functions return proper HTTP status codes — v1.0
- ✓ Auth error toast + Sentry capture — v1.0
- ✓ Env var fail-fast (requireEnv throws at import time) — v1.0
- ✓ Realtime subscription cleanup in all hooks — v1.0
- ✓ Push token registration with EAS projectId — v1.0
- ✓ App Store privacy checklist + AI disclosure modal — v1.0
- ✓ Fingerprint OTA policy + UpdateGate component — v1.0

### Active

(No active milestone — start next with `/gsd:new-milestone`)

### Out of Scope (deferred from v1.0)

- Unit test suite creation — post-launch recommendation
- Major refactors (dashboard decomposition, query builder abstraction)
- Data retention policy / GDPR documentation
- Disaster recovery runbook
- N+1 query optimization in dashboard hooks
- PostHog autocapture scoping
- App Links / Universal Links configuration
- Structured logging with PII redaction

## Context

- **Status:** v1.0 shipped 2026-03-19 — all 26 launch requirements met
- **Codebase:** ~55 screens/components, 13 Edge Functions, 18 SQL migrations
- **Tech stack:** React Native + Expo SDK 51, Supabase, Zustand, Claude API
- **Tech debt:** 10 items tracked in v1.0 audit (ESLint scope gap for Deno files, WhatsApp HMAC bypass, dead fallback code, iOS App Store placeholder)
- **Pre-launch blockers:** Sentry DSN, pg_cron schedule verification, iOS App Store ID in UpdateGate

## Constraints

- **Expo managed workflow:** No ejecting or native module changes
- **Supabase backend:** All DB changes must be migration-based
- **No breaking changes:** Existing beta users must not be disrupted

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Fix critical + security only | Preparing for launch, not a rewrite — minimize risk | ✓ Good — all 26 requirements met in 15 days |
| Bottom-up audit sequence (DB → Edge → Client → Store) | Root cause first — each phase audits against the previous | ✓ Good — no regressions, each layer verified against previous |
| Report non-critical issues | User prioritizes post-launch based on report | ✓ Good — 10 tech debt items tracked, none blocking |
| ESLint no-explicit-any at error severity | Blocks new as-any regressions in CI gate | ✓ Good — 0 as-any in app/lib/hooks/components |
| Payment state machine at DB level | No downstream code can corrupt financial data | ✓ Good — trigger rejects invalid transitions at Postgres level |
| AI disclosure per-screen (not _layout.tsx) | Non-AI users never see disclosure modal | ✓ Good — clean UX for non-AI users |
| Fingerprint OTA policy + UpdateGate | Prevents native dependency mismatch crashes | ✓ Good — silent apply + forced-update fallback |

---
*Last updated: 2026-03-19 after v1.0 milestone completion*
