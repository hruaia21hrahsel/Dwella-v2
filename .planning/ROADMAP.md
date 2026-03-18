# Roadmap: Dwella v2 — Launch Audit & Hardening

## Overview

The app is feature-complete and in TestFlight beta. This roadmap sequences a bottom-up audit and hardening pass: establish a clean compilation and tooling baseline first, then fix security and data integrity at the root cause layer, audit Edge Functions against the now-verified DB contracts, verify client code and hooks, and finally gate on App Store submission config. Each phase produces a signed-off layer that the next phase audits against. No phase begins until the previous one is complete.

## Phases

- [ ] **Phase 1: Compilation & Tooling Baseline** - App compiles clean, ESLint enforces rules, error monitoring in place
- [ ] **Phase 2: Security & Data Integrity** - RLS hardened, crypto-secure tokens, webhook validation, state machine enforced at DB
- [ ] **Phase 3: Edge Functions & Backend** - All 13 Edge Functions verified for soft-delete, error codes, and correct cron schedules
- [ ] **Phase 4: Client Code & UX** - Hooks verified, subscription cleanup confirmed, auth errors visible, env validation in place
- [ ] **Phase 5: Launch Configuration & Store Gate** - App Store privacy, AI disclosure, EAS config, and OTA policy ready for submission

## Phase Details

### Phase 1: Compilation & Tooling Baseline
**Goal**: The codebase compiles with zero errors, lint rules are enforced, and production error monitoring is wired up — so all subsequent audit findings are reliable and regressions are caught automatically
**Depends on**: Nothing (first phase)
**Requirements**: TS-01, TS-02, TS-03, EDGE-04
**Success Criteria** (what must be TRUE):
  1. `npx tsc --noEmit` exits with zero errors (PostHog captureLifecycleEvents fix applied)
  2. ESLint with `@typescript-eslint` and `eslint-plugin-security` runs without reported security or type errors in critical paths
  3. All `as any` casts in auth, payments, and Edge Function critical paths are replaced with typed alternatives
  4. `@sentry/react-native` is initialized with a DSN and captures unhandled errors in the production build
**Plans**: 4 plans

Plans:
- [x] 01-01-PLAN.md — Verify TS compilation baseline and replace all `as any` casts in critical paths
- [x] 01-02-PLAN.md — Configure ESLint with TS + security rules and integrate Sentry crash monitoring
- [ ] 01-03-PLAN.md — Fix ESLint config (react-hooks plugin) and remove as any from hooks/components/lib (gap closure)
- [ ] 01-04-PLAN.md — Remove all as any from app/ screens and Sentry DSN checkpoint (gap closure)

### Phase 2: Security & Data Integrity
**Goal**: Every security-class vulnerability is closed at the root cause layer — RLS policies protect all tables, tokens are cryptographically secure, webhooks reject unauthenticated callers, and payment state transitions are enforced at the DB level so no downstream code can corrupt financial data
**Depends on**: Phase 1
**Requirements**: SEC-01, SEC-02, SEC-03, SEC-04, SEC-05, SEC-06, DATA-01, DATA-02, DATA-03, DATA-04
**Success Criteria** (what must be TRUE):
  1. Supabase Security Advisor reports zero RLS warnings across all 8 tables; all UPDATE policies have both `USING` and `WITH CHECK` clauses
  2. `Math.random()` no longer appears in any token or code generation path; `expo-crypto` `randomUUID()` and `getRandomValues()` are used instead
  3. Telegram and WhatsApp webhooks reject requests that fail secret/HMAC validation with a 401 response before any processing occurs
  4. A DB migration enforces payment state machine transitions via a `BEFORE UPDATE` trigger — invalid transitions are rejected at the Postgres level
  5. Soft-delete filtering (`is_archived = FALSE`) is confirmed present in all hooks, screens, and Edge Function DB queries via audit; archived records cannot appear in any user-facing view
**Plans**: TBD

### Phase 3: Edge Functions & Backend
**Goal**: All 13 deployed Edge Functions are verified against the Phase 2 confirmed DB contracts — each returns correct HTTP status codes, filters archived data, and executes its intended action reliably; scheduled cron jobs run on the correct schedules; the bot message flow completes end-to-end
**Depends on**: Phase 2
**Requirements**: EDGE-01, EDGE-02, EDGE-03, EDGE-05
**Success Criteria** (what must be TRUE):
  1. Every Edge Function returns 400 for bad input, 404 for missing resources, 500 for unexpected failures — no function returns a generic 500 for a known error condition
  2. `auto-confirm-payments`, `mark-overdue`, and `send-reminders` are confirmed active with correct pg_cron schedules in the Supabase dashboard; archived tenants do not appear in their query results
  3. A bot message sent via Telegram results in a confirmed DB action and a reply — the full chain (webhook → Claude → structured JSON → DB mutation → reply) completes without error
  4. Real App Store and Play Store URLs are live in `invite-redirect/index.ts` and the deep link routes a device correctly to the app store listing
**Plans**: TBD

### Phase 4: Client Code & UX
**Goal**: The client layer is observable and resilient — hooks clean up Realtime subscriptions, auth failures are visible to the user, the app refuses to start without required environment variables, and push notifications deliver to a physical device
**Depends on**: Phase 3
**Requirements**: CLIENT-01, CLIENT-02, CLIENT-03, CLIENT-04
**Success Criteria** (what must be TRUE):
  1. An auth sync failure (profile load error) shows a user-visible error or toast instead of silently failing; the user knows something went wrong
  2. Starting the app without a required environment variable (e.g., `EXPO_PUBLIC_SUPABASE_URL`) throws an explicit error with a clear message rather than crashing silently later
  3. Realtime subscription channels are confirmed to call `unsubscribe()` and `removeChannel()` on cleanup — no channel accumulation observed across navigation in React Native DevTools
  4. A push notification sent from the Supabase Edge Function delivers and appears on a physical test device
**Plans**: TBD

### Phase 5: Launch Configuration & Store Gate
**Goal**: The app is ready for App Store and Play Store submission — metadata is correct, AI data sharing is disclosed per Apple November 2025 guidelines, EAS build config is validated, and OTA runtime version policy prevents existing users from crashing after a native dependency update
**Depends on**: Phase 4
**Requirements**: LAUNCH-01, LAUNCH-02, LAUNCH-03, LAUNCH-04
**Success Criteria** (what must be TRUE):
  1. App Store Connect privacy section lists all third-party data destinations (Supabase, PostHog, Claude API, Telegram, WhatsApp) with accurate data type and purpose fields
  2. An in-app disclosure is shown to users before AI features process their data, meeting Apple's November 2025 guideline requirement for AI data sharing
  3. `app.json` version and build number are set correctly for the production release; EAS `production` profile validates via dry-run without errors
  4. `runtimeVersion` policy in `app.json` / `eas.json` is configured so that a native dependency change triggers a required update rather than silently crashing OTA users
**Plans**: TBD

## Progress

**Execution Order:**
Phases execute sequentially: 1 → 2 → 3 → 4 → 5

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Compilation & Tooling Baseline | 3/4 | In Progress|  |
| 2. Security & Data Integrity | 0/TBD | Not started | - |
| 3. Edge Functions & Backend | 0/TBD | Not started | - |
| 4. Client Code & UX | 0/TBD | Not started | - |
| 5. Launch Configuration & Store Gate | 0/TBD | Not started | - |
