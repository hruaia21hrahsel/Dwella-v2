# Dwella v2

## What This Is

A cross-platform mobile app (React Native + Expo) for landlords and tenants to manage rental properties, track payments, store documents, handle maintenance requests, and view financial reports — with an AI-powered Telegram/WhatsApp bot that supports natural language queries, interactive menus, media handling, and proactive notifications.

## Core Value

Every user-facing workflow (auth, property CRUD, payments, invites, documents, maintenance, reports, bot) works correctly and securely.

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
- ✓ CRED Premium UI with Light/Dark theme system — UI Redesign
- ✓ PIN/biometric lock — UI Redesign
- ✓ Push notifications (Expo Notifications) — Phase C
- ✓ PostHog analytics integration — Phase C
- ✓ Expense tracking — Phase C
- ✓ Realtime subscriptions for payments/notifications — Phase B
- ✓ Zero TypeScript compilation errors — v1.0
- ✓ ESLint with security rules (no-explicit-any at error severity) — v1.0
- ✓ Sentry crash monitoring wired — v1.0
- ✓ RLS policies hardened (28+ per-operation with WITH CHECK) — v1.0
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
- ✓ Document upload/view/download/delete with property + tenant scoping — v1.1
- ✓ Property-wide docs visible to all tenants, tenant-specific docs restricted — v1.1
- ✓ Maintenance request submission with photos and priority — v1.1
- ✓ Maintenance status lifecycle (open → acknowledged → in progress → resolved → closed) — v1.1
- ✓ Maintenance cost logging as property expense — v1.1
- ✓ Push notifications for maintenance events (new request, status change) — v1.1
- ✓ P&L bar charts, expense donut, payment reliability, occupancy tracking — v1.1
- ✓ Portfolio-level summary across all properties — v1.1
- ✓ AI tools screens removed, navigation clean — v1.1
- ✓ WhatsApp Business API setup and account linking flow — v1.2
- ✓ Media messages (photo payment proof, document sharing via WhatsApp) — v1.2
- ✓ Outbound WhatsApp messaging (reminders, receipts, maintenance notifications) — v1.2
- ✓ New bot intents (maintenance status, upcoming payments, property summary) — v1.2
- ✓ Menu-driven rich messaging with interactive buttons (both Telegram and WhatsApp) — v1.2
- ✓ PDF report generation and delivery via bot — v1.2

### Active

(See REQUIREMENTS.md for v1.3 requirements)

## Current Milestone: v1.3 Android Play Store Launch

**Goal:** Ship Dwella to Google Play Store with production signing, store listing, and all platform requirements met.

**Target features:**
- Release keystore generation + EAS Android credentials setup
- Privacy policy creation and publication
- Play Store assets (screenshots, feature graphic, description)
- Google OAuth configuration (Google Cloud Console + Supabase)
- Sentry crash monitoring reinstallation or deliberate removal
- PostHog production env wiring
- Unused Android permissions cleanup
- App Links assetlinks.json for verified deep linking
- End-to-end device testing on physical Android

### Out of Scope

- Unit test suite creation — post-launch recommendation
- Major refactors (dashboard decomposition, query builder abstraction)
- Data retention policy / GDPR documentation
- Disaster recovery runbook
- N+1 query optimization in dashboard hooks
- PostHog autocapture scoping
- App Links / Universal Links configuration
- Structured logging with PII redaction
- Document expiry dates with reminder notifications — v2
- E-signature integration for leases — v2
- Document version history — v2
- Maintenance request categories (plumbing, electrical, HVAC) — v2
- Vendor assignment and dispatch — v2
- Preventive maintenance scheduling — v2
- PDF/CSV export of reports — v2
- Custom date range filters for reports — v2
- Year-over-year comparison charts — v2

## Context

- **Status:** v1.3 in progress — Android Play Store Launch
- **Codebase:** ~80 screens/components, 12 Edge Functions, 25 SQL migrations, ~28,000 LOC TypeScript
- **Tech stack:** React Native + Expo SDK 51, Supabase, Zustand, Claude API, Victory Native
- **Tech debt:** 5 items from v1.2 audit (orphaned whatsapp-send-code function, pdf-reports bucket manual setup, HTML2PDF_API_KEY not in checklist, migration 026 settings dependency, WHATSAPP_BOT_PHONE env gating)
- **Pre-launch blockers:** Sentry DSN, pg_cron schedule verification, iOS App Store ID in UpdateGate, pdf-reports bucket creation, HTML2PDF_API_KEY secret

## Constraints

- **Expo managed workflow:** No ejecting or native module changes
- **Supabase backend:** All DB changes must be migration-based
- **No breaking changes:** Existing beta users must not be disrupted

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Fix critical + security only (v1.0) | Preparing for launch, not a rewrite — minimize risk | ✓ Good — all 26 requirements met in 15 days |
| Bottom-up audit sequence (DB → Edge → Client → Store) | Root cause first — each phase audits against the previous | ✓ Good — no regressions, each layer verified against previous |
| Report non-critical issues | User prioritizes post-launch based on report | ✓ Good — 10 tech debt items tracked, none blocking |
| ESLint no-explicit-any at error severity | Blocks new as-any regressions in CI gate | ✓ Good — 0 as-any in app/lib/hooks/components |
| Payment state machine at DB level | No downstream code can corrupt financial data | ✓ Good — trigger rejects invalid transitions at Postgres level |
| AI disclosure per-screen (not _layout.tsx) | Non-AI users never see disclosure modal | ✓ Good — clean UX for non-AI users |
| Fingerprint OTA policy + UpdateGate | Prevents native dependency mismatch crashes | ✓ Good — silent apply + forced-update fallback |
| Replace AI tools with practical features (v1.1) | AI tools had low engagement; documents/maintenance/reports are daily-use | ✓ Good — 21/21 requirements shipped in 2 days |
| DB-level state machine for maintenance | Matches payment pattern; prevents invalid status transitions | ✓ Good — consistent pattern, no bypass possible |
| Victory Native for charts | Native rendering, tap-to-highlight, theme-aware, no web dependency | ✓ Good — 6 chart components with tooltips, performant |
| Gap closure phase (Phase 10) | Milestone audit caught integration gaps before shipping | ✓ Good — notification routing + property shortcut wired |
| Route all WhatsApp sends through whatsapp-send (v1.2) | Single deployment point, consistent retry logic, template support | ✓ Good — 6 callers, zero direct Meta API calls remaining |
| pg_net DB trigger for maintenance notifications (v1.2) | Instant notification on any status change from any source (app, bot, admin) | ✓ Good — fires automatically, no cron lag |
| Dual access pattern for bot intents (v1.2) | Single handler callable from both Claude freeform and button taps | ✓ Good — no code duplication, consistent responses |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd:transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd:complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-03-29 — v1.3 milestone started*
