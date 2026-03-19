# Requirements: Dwella v2 Launch Audit & Hardening

**Defined:** 2026-03-17
**Core Value:** Every user-facing workflow (auth, property CRUD, payments, invites, bot) must work correctly and securely before the app goes live.

## v1 Requirements

Requirements for launch readiness. Each maps to roadmap phases.

### Compilation & Type Safety

- [x] **TS-01**: App compiles with zero errors via `npx tsc --noEmit` (fix PostHog captureLifecycleEvents)
- [x] **TS-02**: All `as any` type casts in critical paths (auth, payments, Edge Functions) resolved with proper types
- [x] **TS-03**: ESLint with `eslint-plugin-security` and `@typescript-eslint` configured and passing

### Security & Cryptography

- [x] **SEC-01**: `Math.random()` UUID generation in `lib/bot.ts` replaced with `expo-crypto` randomUUID()
- [x] **SEC-02**: `Math.random()` verification code generation replaced with crypto-secure alternative
- [x] **SEC-03**: RLS policies audited on all tables with correct `USING` + `WITH CHECK` clauses on UPDATE
- [x] **SEC-04**: Telegram webhook validates bot secret/signature before processing
- [x] **SEC-05**: WhatsApp webhook validates HMAC/shared secret before processing
- [x] **SEC-06**: User-controlled strings (tenant names, property names) sanitized in Claude bot context to prevent prompt injection

### Data Integrity

- [x] **DATA-01**: Soft-delete filtering (`is_archived = FALSE`) verified across all hooks, screens, and Edge Functions
- [x] **DATA-02**: Payment state machine transitions audited for correctness (no invalid state changes)
- [x] **DATA-03**: Payment state machine enforced at DB level via trigger migration
- [x] **DATA-04**: Invite flow verified end-to-end (token generation → deep link → acceptance → edge cases)

### Edge Functions & Backend

- [x] **EDGE-01**: All Edge Functions return appropriate HTTP status codes (400/404/500/503, not generic 500)
- [x] **EDGE-02**: Scheduled functions (auto-confirm, mark-overdue, send-reminders) verified working with correct cron schedules
- [x] **EDGE-03**: Bot action flow traced end-to-end (message → Claude → structured JSON → DB action → reply)
- [x] **EDGE-04**: Sentry (`@sentry/react-native`) integrated for production error tracking
- [x] **EDGE-05**: App Store / Play Store placeholder URLs replaced with real values in invite-redirect

### Client & UX

- [x] **CLIENT-01**: Auth sync failure shows user-facing error/toast instead of silent fallback
- [x] **CLIENT-02**: Missing critical environment variables throw error on app startup (fail fast)
- [ ] **CLIENT-03**: Realtime subscription cleanup verified (no memory leaks from uncleaned channels)
- [ ] **CLIENT-04**: Push notification flow verified end-to-end (token registration → delivery on device)

### Launch Configuration

- [ ] **LAUNCH-01**: App Store Connect privacy section updated with all third-party data destinations (Supabase, PostHog, Claude API, Telegram, WhatsApp)
- [ ] **LAUNCH-02**: In-app AI data sharing disclosure added (Apple November 2025 guideline requirement)
- [ ] **LAUNCH-03**: app.json version and build number correct for production release
- [ ] **LAUNCH-04**: OTA `runtimeVersion` policy configured to prevent post-update crashes on native dependency changes

## v2 Requirements

Deferred to post-launch. Tracked but not in current roadmap.

### Performance

- **PERF-01**: N+1 query optimization in dashboard hooks
- **PERF-02**: PostHog autocapture scoped to exclude payment input fields

### Code Quality

- **QUAL-01**: Unit test suite for critical paths (auth, payments, bot)
- **QUAL-02**: Dashboard component decomposed into smaller focused components
- **QUAL-03**: Centralized soft-delete query builder or Postgres views

### Documentation

- **DOC-01**: Data retention policy documented per table (GDPR readiness)
- **DOC-02**: Edge Function deployment runbook
- **DOC-03**: Disaster recovery plan

### Security Hardening

- **SEC-07**: App Links (Android) and Universal Links (iOS) configured to prevent deep link hijacking
- **SEC-08**: Structured logging with PII redaction

## Out of Scope

| Feature | Reason |
|---------|--------|
| New features or functionality | This is an audit, not a feature milestone |
| Major architectural refactors | High regression risk pre-launch; report only |
| Full GDPR legal compliance | Requires legal counsel; document gaps only |
| Certificate pinning | Breaks Expo OTA updates |
| Retry logic on payment mutations | Requires idempotency keys; risk of double-recording payments without them |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| TS-01 | Phase 1 | Complete |
| TS-02 | Phase 1 | Complete |
| TS-03 | Phase 1 | Complete |
| EDGE-04 | Phase 1 | Complete |
| SEC-01 | Phase 2 | Complete |
| SEC-02 | Phase 2 | Complete |
| SEC-03 | Phase 2 | Complete |
| SEC-04 | Phase 2 | Complete |
| SEC-05 | Phase 2 | Complete |
| SEC-06 | Phase 2 | Complete |
| DATA-01 | Phase 2 | Complete |
| DATA-02 | Phase 2 | Complete |
| DATA-03 | Phase 2 | Complete |
| DATA-04 | Phase 2 | Complete |
| EDGE-01 | Phase 3 | Complete |
| EDGE-02 | Phase 3 | Complete |
| EDGE-03 | Phase 3 | Complete |
| EDGE-05 | Phase 3 | Complete |
| CLIENT-01 | Phase 4 | Complete |
| CLIENT-02 | Phase 4 | Complete |
| CLIENT-03 | Phase 4 | Pending |
| CLIENT-04 | Phase 4 | Pending |
| LAUNCH-01 | Phase 5 | Pending |
| LAUNCH-02 | Phase 5 | Pending |
| LAUNCH-03 | Phase 5 | Pending |
| LAUNCH-04 | Phase 5 | Pending |

**Coverage:**
- v1 requirements: 26 total
- Mapped to phases: 26
- Unmapped: 0

---
*Requirements defined: 2026-03-17*
*Last updated: 2026-03-18 — traceability filled after roadmap creation*
