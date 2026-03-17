# Project Research Summary

**Project:** Dwella v2 — Pre-Launch Audit & Hardening
**Domain:** React Native / Expo mobile app audit — code quality, security, and App Store launch readiness
**Researched:** 2026-03-18
**Confidence:** HIGH

## Executive Summary

Dwella v2 is a feature-complete React Native + Expo + Supabase property management app in TestFlight beta. The audit is not a feature-build milestone — it is a hardening and launch-clearance milestone. Research across all four dimensions (stack, features, architecture, pitfalls) confirms the app is architecturally sound but has a well-defined set of correctness and security gaps that must be closed before App Store submission. The highest-leverage audit sequence is bottom-up: fix the data layer (RLS, soft-delete, state machine) first, then Edge Functions, then client code, and finally launch config. Auditing in any other order risks finding symptoms multiple times without resolving the root cause.

The recommended approach is to structure the work as five sequential audit phases, each dependent on the previous one being verified. TypeScript compilation must pass before any other phase can produce reliable findings. Security fixes (crypto, RLS, webhook validation, prompt injection) are prerequisite to any App Store privacy disclosure work. The App Store submission gate — metadata, privacy disclosure, EAS config — comes last and depends on all security and data integrity work being signed off. Two known issues, the `Math.random()` token generation and the PostHog `captureLifecycleEvents` compilation error, are single-line fixes that should be resolved in the first 30 minutes.

The primary risks to launch are: (1) an RLS policy that has `USING` without `WITH CHECK` on UPDATE — a class of vulnerability that affected 170+ Supabase apps via CVE-2025-48757; (2) Apple's November 2025 App Store guidelines update requiring explicit disclosure of AI data sharing, directly affecting the Claude API integration; and (3) the invite deep link using a custom URL scheme (`dwella://`) rather than verified App Links, which is interceptable by a malicious Android app. All three are addressable with confirmed patterns from official documentation.

## Key Findings

### Recommended Stack

The app's existing stack requires no new dependencies for correctness or security fixes — `expo-crypto` is already installed for CSPRNG token generation, and `expo-updates` is already installed for OTA config. The only net-new tooling recommended is `@sentry/react-native` (replacing the non-existent current error monitoring) and ESLint security plugins (`@typescript-eslint/eslint-plugin`, `eslint-plugin-security`) to enforce the fixes as lint-time rules rather than one-off patches. Both are additive and do not require ejecting from Expo managed workflow.

**Core technologies:**
- `expo-crypto` (already installed): Replace `Math.random()` in `lib/bot.ts` with `Crypto.randomUUID()` and `getRandomValues()` — zero install cost, one-line fix
- `@typescript-eslint/eslint-plugin` + `eslint-plugin-security`: Enforce `no-explicit-any`, `no-floating-promises`, and `no-pseudo-random` as lint errors — prevents regression after the fixes are applied
- TypeScript `strict: true`: The single highest-ROI code quality change — already has TS infrastructure, turning strict mode on catches `as any` casts at compile time
- `@sentry/react-native`: Production error capture — `sentry-expo` is deprecated at SDK 50; use `@sentry/react-native` directly with the Expo config plugin
- Supabase Security Advisor (dashboard tool): Automated RLS linter using Splinter — catches `USING` without `WITH CHECK` and tables with RLS disabled; faster and more reliable than manual `psql` review
- React Native DevTools (built-in): Hermes heap snapshot tooling for confirming Realtime subscription cleanup — replaces Flipper, which is abandoned for RN 0.73+

**What NOT to use:**
- `sentry-expo` — deprecated, use `@sentry/react-native`
- Flipper — abandoned for RN 0.73+; React Native DevTools is the official replacement
- `Math.random()` for any token or code generation — not a CSPRNG; `expo-crypto` is the drop-in fix
- Certificate pinning — breaks Expo OTA updates

### Expected Features

Research frames "features" as audit areas, not product feature additions. The audit surface maps to 15 P1 items required before App Store submission, 9 P2 items that should be addressed before submission if time allows, and 3 P3 items deferred post-launch without risk.

**Must have (P1 — required for submission):**
- TypeScript compilation passing — prerequisite for all other work
- App Store / Play Store URLs replaced with real IDs in `invite-redirect/index.ts`
- RLS verified on all 8 tables with correct `USING` + `WITH CHECK` on UPDATE policies
- Cryptographically secure token generation (`expo-crypto`) replacing `Math.random()`
- Soft-delete filtering verified across all hooks, screens, and Edge Functions
- Payment state machine transitions verified end-to-end
- Edge Function HTTP status codes returning 400/404/500/503 appropriately
- Auth sync failure showing user-facing error (not silent fallback)
- Environment variable validation throwing on missing critical vars
- Invite flow verified end-to-end including edge cases (already-accepted token)
- Scheduled Edge Functions verified to have correct pg_cron schedules
- App Store metadata readiness: version, privacy policy URL, age rating, AI disclosure

**Should have (P2 — before v1.1):**
- Bot action flow end-to-end trace (Telegram → Claude → DB → reply)
- N+1 query optimization in `useDashboard`
- PDF generation correctness verified with real tenant data
- Push notification token delivery on a physical device
- PostHog autocapture scoping to exclude payment input fields

**Defer (P3 — post-launch):**
- Unit test suite — defer until core workflows stabilize
- Dashboard component decomposition — low user impact, high regression risk
- Full GDPR documentation — legal work, engage a lawyer when user base warrants it

### Architecture Approach

The correct audit sequence is bottom-up: Data Layer (Postgres RLS, storage policies, migration integrity) → Edge Functions (input validation, soft-delete filters, error codes) → Hook Layer (subscription cleanup, N+1, error propagation) → Lib Modules (crypto, env validation, state management) → Client Layer (error display, TypeScript, UX correctness) → Cross-Cutting sweep (auth, logging, launch config). This order matters because an RLS gap at layer 1 is the root cause of symptoms appearing in 5+ downstream layers — auditing screens first means finding the same issue 10 times rather than once.

**Major components and audit boundaries:**
1. **Data Layer (Postgres + Storage)** — RLS policies on 8 tables + 2 storage buckets; verify `WITH CHECK` on all UPDATE policies; source of truth for all downstream correctness
2. **Edge Functions (13 deployed)** — grouped into bot ingestion, bot processing, scheduled state, AI tools, notifications, and utility; primary risks are missing webhook secret validation, soft-delete filter omission, and generic error codes
3. **Hook Layer (9 custom hooks)** — primary risks are missing `.eq('is_archived', false)`, Realtime channels calling `removeChannel` without `unsubscribe()` first, and N+1 queries in `useDashboard`
4. **Lib Modules** — `lib/bot.ts` has the known crypto issues; `lib/supabase.ts` needs fail-fast env validation; `lib/store.ts` needs verified logout clearing of all cached state
5. **Client Layer (screens + Zustand)** — TypeScript `as any` sweep, error display on hook failures, auth sync failure UX
6. **Cross-Cutting** — launch config (EAS, app.json, store metadata), AI privacy disclosure, logging hygiene

**Five critical cross-cutting chains to trace:**
- Soft-delete: missing at DB → affects hooks → affects Edge Functions → affects 10+ screens
- Auth identity propagation: `auth.uid()` → RLS → JWT at Edge boundaries → Zustand user state
- Payment state machine: DB CHECK constraint (partial) → Edge Function transitions → hook state → UI badges
- Bot message flow: webhook → Claude API → structured JSON validation → DB mutation
- Invite flow: UUID token → deep link → `invite-redirect` → `app/invite/[token].tsx` → `tenants.user_id`

### Critical Pitfalls

1. **RLS `USING` without `WITH CHECK` on UPDATE** — Postgres treats these as separate gates; a policy with only `USING` filters reads but does not restrict what values can be written on UPDATE. Use the Supabase Security Advisor linter to catch this automatically, then manually test with a second test account that does not own the data.

2. **Soft-delete filtering missing in Edge Functions** — `send-reminders`, `mark-overdue`, and `auto-confirm-payments` query the DB directly without the UI hooks. If `is_archived = FALSE` is omitted, archived tenants receive reminders and appear in overdue counts. Treat as the same root cause chain — fix at the query level, not per-symptom.

3. **Payment state machine enforced only in app code** — the Concerns document includes the exact SQL for a `BEFORE UPDATE` trigger that validates state transitions at the DB level. This should be applied as a migration, not deferred post-launch. Invalid states in financial data are permanent and confusing.

4. **App Store rejection for Privacy Manifest / AI data sharing** — Apple's November 2025 guidelines update requires explicit disclosure when personal data is sent to external AI providers. Dwella sends tenant names, property data, and payment context to the Claude API. This must appear in the App Store Connect privacy section and in-app disclosure before any submission.

5. **Deep link token hijacking on Android via custom URL scheme** — `dwella://` scheme provides zero ownership proof; any Android app can intercept it. The `invite-redirect` Edge Function already uses HTTPS URLs — the missing step is configuring `/.well-known/assetlinks.json` and `/.well-known/apple-app-site-association` for verified App Links / Universal Links in `app.json`.

## Implications for Roadmap

Based on research, the audit work divides cleanly into five sequential phases. Each phase produces a verifiable sign-off gate, and no phase should begin before the preceding one is signed off.

### Phase 1: TypeScript Compilation and Dependency Baseline

**Rationale:** Nothing else can be reliably verified on a codebase with compile errors. This is the unconditional prerequisite for every other phase. It also installs ESLint security plugins that will catch regressions during subsequent phases.
**Delivers:** Zero-error `npx tsc --noEmit` output; ESLint security rules enforced as errors; `@sentry/react-native` configured with DSN.
**Addresses:** PostHog `captureLifecycleEvents` compile error; `as any` casts audit; `sentry-expo` deprecation
**Avoids:** Auditing a non-compiling codebase where type errors mask real issues
**Research flag:** Standard patterns — skip research-phase. TypeScript strict mode and ESLint TS plugin are well-documented.

### Phase 2: Data Layer and Security Audit

**Rationale:** RLS gaps are the highest-severity launch blocker and the root cause of the largest number of downstream symptoms. Fixing at the DB level prevents re-auditing hooks, screens, and Edge Functions for the same symptom. Crypto fixes and webhook validation belong here because they are security-class issues that must precede any security sign-off.
**Delivers:** RLS verified on all 8 tables with `WITH CHECK` on UPDATE policies; `Math.random()` replaced with `expo-crypto`; Telegram webhook secret validation confirmed; payment state machine trigger migration applied; prompt injection mitigations added to Claude API calls; deep link App Links / Universal Links configured.
**Addresses:** RLS audit (P1), crypto-secure tokens (P1), soft-delete consistency at DB level (P1), payment state machine DB enforcement (formerly P2 but reclassified as data integrity fix)
**Avoids:** CVE-2025-48757 class of RLS misconfiguration; token prediction attacks; webhook spoofing; prompt injection
**Research flag:** RLS audit pattern is well-documented (Supabase Security Advisor covers this automatically). App Links / Universal Links configuration needs research-phase — the `assetlinks.json` + `app.json` intent filter setup is Expo-specific and the exact configuration for managed workflow has nuances.

### Phase 3: Edge Function and Scheduled Job Audit

**Rationale:** Edge Functions touch the DB directly via the service role key, bypassing client RLS. They must be validated against the confirmed DB contracts from Phase 2, not before. Soft-delete filtering in scheduled functions and correct HTTP status codes belong here.
**Delivers:** All 13 Edge Functions verified for soft-delete filters, correct error codes, auth checks, and idempotency; pg_cron schedules verified in Supabase dashboard; bot action flow traced end-to-end; App Store / Play Store URLs replaced in `invite-redirect`.
**Addresses:** Soft-delete consistency in Edge Functions (P1), Edge Function error codes (P1), scheduled cron verification (P1), bot flow trace (P2), invite-redirect placeholder URLs (P1)
**Avoids:** Ghost data from archived records in scheduled jobs; silent cron misconfiguration; bot silently failing without user feedback
**Research flag:** Standard patterns — all 13 functions follow known patterns. No research-phase needed.

### Phase 4: Client Code and Hook Audit

**Rationale:** Hooks mirror DB queries and inherit RLS assumptions. With the DB and Edge layers confirmed, hooks and screens can be audited against known-good contracts rather than unknown ones. Realtime subscription cleanup, N+1 detection, and error display belong here.
**Delivers:** All hooks verified for soft-delete filtering and Realtime subscription cleanup; `useDashboard` N+1 evaluated and documented (with fix if trivial); auth sync failure shows user-visible error; env var validation throws on missing critical vars; push notification delivery verified on physical device.
**Addresses:** Realtime subscription cleanup (P2), auth sync UX (P1), env validation (P1), N+1 queries (P2), push notification delivery (P2)
**Avoids:** Memory leak from uncleaned Realtime channels; silent app failures with no user feedback; stale push token accumulation
**Research flag:** Standard patterns — React hooks cleanup and Supabase Realtime lifecycle are well-documented.

### Phase 5: Launch Configuration and Store Submission Gate

**Rationale:** All security, data integrity, and code quality work must be signed off before touching submission config. App Store metadata, privacy disclosure, EAS build config, and OTA runtime version are the final gate — none of these can be assessed correctly until the app itself is correct.
**Delivers:** App Store Connect privacy section updated with data flow inventory (Supabase, PostHog, Claude API, Telegram, WhatsApp/Meta); AI data sharing disclosure in-app; `app.json` version and build number incremented; EAS `production` profile validated with dry-run; `runtimeVersion` confirmed for OTA compatibility; privacy policy URL resolves; age rating confirmed for financial app category; screenshots current for CRED Premium UI.
**Addresses:** App Store metadata (P1), AI privacy disclosure (P1), EAS config (P2), OTA runtime version (PITFALLS checklist item)
**Avoids:** Apple rejection for privacy manifest mismatch (12% of Q1 2025 submissions rejected on this ground); OTA update crashing existing users after native surface change
**Research flag:** Standard patterns — Apple App Store submission process and EAS build configuration are well-documented in official Expo docs.

### Phase Ordering Rationale

- Phase 1 before everything: a non-compiling codebase produces unreliable audit findings
- Phase 2 before Phases 3-4: DB-level fixes are root causes; downstream phases audit against confirmed contracts
- Phase 3 before Phase 4: Edge Functions use service role key and bypass client RLS; they must be audited against confirmed DB contracts, not before
- Phase 4 before Phase 5: store submission requires a correct, secure, and observable app; client-side issues found in Phase 4 would require restarting submission paperwork
- Phase 5 last: the submission gate depends on all prior phases being signed off

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 2 (App Links / Universal Links):** The configuration for Expo managed workflow — specifically the `intentFilters` in `app.json` for Android App Links with `autoVerify: true`, and the `associatedDomains` entitlement for iOS Universal Links — has nuances specific to EAS Build. The `assetlinks.json` endpoint must be served from the production domain before EAS Build generates the signing hash. This sequence needs research before Phase 2 planning begins.

Phases with standard patterns (skip research-phase):
- **Phase 1:** TypeScript strict mode + ESLint TS plugin setup is exhaustively documented
- **Phase 3:** All 13 Edge Functions follow patterns documented in official Supabase Edge Functions docs
- **Phase 4:** React hooks cleanup lifecycle and Supabase Realtime channel management are well-documented
- **Phase 5:** App Store submission and EAS Build production profile are covered in official Expo + Apple docs

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All recommendations are either already-installed packages or have direct official documentation. No speculative tooling choices. |
| Features | HIGH | Grounded in the existing CONCERNS.md (direct codebase analysis), Supabase production checklist (official), and Apple App Store guidelines (official). |
| Architecture | HIGH | Based on actual codebase structure (CLAUDE.md, PROJECT.md, CONCERNS.md) and official Supabase/Expo documentation for all patterns cited. |
| Pitfalls | HIGH | CVE-2025-48757 is a real, documented vulnerability. Apple November 2025 guidelines update is official. All other pitfalls cross-referenced against official Supabase and Expo documentation. |

**Overall confidence:** HIGH

### Gaps to Address

- **App Links / Universal Links configuration sequence with EAS Build:** The exact order of operations (build → get signing fingerprint → deploy `assetlinks.json` → rebuild with verified intent filter) is not fully documented for Expo managed workflow. Needs research during Phase 2 planning.

- **Invite token single-use enforcement:** The CONCERNS.md notes the invite flow does not verify that `invited_email` matches the accepting user's email. This is documented as a known gap, not a blocker, but needs explicit decision during Phase 3 planning: either add email verification, or document the deliberate design choice (token-based, no email gate).

- **WhatsApp webhook authentication:** The `whatsapp-webhook` function's HMAC or shared secret validation is noted but not confirmed in the existing CONCERNS.md. Needs direct code inspection during Phase 3 to determine if it follows the same pattern as the Telegram webhook or has a different validation approach.

- **PostHog PII capture scope:** Whether `captureTouches: true` is currently enabled in the production PostHog initialization needs direct code inspection. If it is enabled and payment fields are affected, the fix is simple (disable or add exclusion selectors), but the current state is not confirmed from research files alone.

## Sources

### Primary (HIGH confidence)

- Expo Crypto Documentation — `randomUUID()` and `getRandomValues()` CSPRNG backing
- Supabase RLS Documentation — `USING` vs `WITH CHECK` behavior, Security Advisor tooling
- Sentry for Expo (official Expo docs) — confirms `sentry-expo` deprecation, `@sentry/react-native` migration path
- Sentry React Native documentation — Expo Router instrumentation
- Apple App Store Review Guidelines (November 2025) — AI data sharing disclosure requirements
- React Native DevTools documentation — Flipper replacement, Hermes CDP-based tooling
- Expo OTA Updates runtime versioning documentation — `runtimeVersion` policy behavior
- EAS Submit documentation — production build profile and submission requirements
- Supabase Edge Function limits documentation — 2-second CPU time limit, timeout behavior
- Dwella v2 CONCERNS.md (direct codebase analysis) — 28 pre-identified issues with line-level attribution
- Dwella v2 PROJECT.md — audit scope definition

### Secondary (MEDIUM confidence)

- Supabase Security Retro 2025 (third-party summary of official changes) — Security Advisor and Splinter tool
- App Store rejection reasons 2025-2026 (aggregated from multiple review sources) — 12% rejection rate for privacy manifest issues
- React Native security checklist — mobile security patterns
- CVE-2025-48757 documentation — 170 apps exposed via RLS misconfiguration

### Tertiary (LOW confidence / needs validation during implementation)

- WhatsApp webhook HMAC validation specifics — not confirmed in codebase; needs direct code inspection
- PostHog `captureTouches` current production configuration — not confirmed from research; needs direct code inspection

---
*Research completed: 2026-03-18*
*Ready for roadmap: yes*
