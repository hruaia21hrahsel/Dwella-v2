# Roadmap: Dwella v1.0 Launch Prep

**Milestone:** v1.0 Launch Prep
**Created:** 2026-04-05
**Granularity:** standard
**Coverage:** 38/38 v1 requirements mapped

## Milestone Goal

Close every hard blocker to shipping Dwella v1.0 to the Apple App Store and Google Play Store for a global audience, with legal and compliance artifacts that match the strictest applicable regime (GDPR + DPDP + CCPA).

This is **brownfield launch prep**, not feature building. Every phase is scoped to "make the existing v1.4 app legally launchable" — no new product features.

## Phases

- [ ] **Phase 1: Fact-Finding & Unblockers** - Audit-driven findings and trivial unblockers that every downstream phase depends on
- [ ] **Phase 2: Legal Artifact Drafting** - Author Privacy Policy, Terms of Service, and EULA covering every data flow and role
- [ ] **Phase 3: Security Hardening** - Close edge-function attack surface, restore observability, rate-limit public endpoints
- [ ] **Phase 4: Data Rights & Compliance Flows** - Implement account deletion, data export, erasure migration, and retention enforcement
- [ ] **Phase 5: In-App Legal Surfaces** - First-run consent, AI consent gate, settings links, CCPA notice wired into the app
- [ ] **Phase 6: Store Submission Preparation** - Info.plist, nutrition labels, data safety form, age rating, listing copy, screenshots
- [ ] **Phase 7: Pre-Launch Smoke Test & Final Verification** - Physical-device smoke test, cron verification, EAS build validation

## Phase Details

### Phase 1: Fact-Finding & Unblockers
**Goal**: Resolve audit questions and ship trivial unblockers so downstream legal, compliance, and store phases have ground truth to build on
**Depends on**: Nothing (first phase)
**Requirements**: COMP-05, COMP-06, COMP-10, IP-01, IP-02, IP-03, IP-04, IP-05
**Success Criteria** (what must be TRUE):
  1. Supabase region is confirmed from the dashboard, recorded in PROJECT.md, and the cross-border transfer implications are documented in writing (unblocks LEGAL-02 language)
  2. Signed Anthropic DPA is on file and linked from a project document; Supabase standard DPA reference URL is recorded
  3. `dwella-nobroker-teal.jsx` and any other NoBroker references are removed from the working tree (verified by grep returning zero matches)
  4. A "Dwella" trademark clearance memo exists covering India, EU, and US with search results and conflict findings
  5. A `THIRD-PARTY-LICENSES.md` (or equivalent) file enumerates every font, icon, image, illustration, and runtime dependency with its license; no GPL/AGPL contamination present in the bundle
  6. A cookie/tracker audit confirms zero analytics, ad, or silent-tracker SDKs and is recorded as a one-page attestation
**Plans**: TBD

### Phase 2: Legal Artifact Drafting
**Goal**: Produce the hosted legal documents the app, stores, and users will reference — with jurisdiction-specific sections layered in where law requires
**Depends on**: Phase 1 (needs Supabase region from COMP-05 to finalize cross-border disclosure; needs DPA status from COMP-06 for sub-processor list; needs trademark result from IP-01 to safely name the product)
**Requirements**: LEGAL-01, LEGAL-02, LEGAL-03, LEGAL-04, COMP-08, COMP-09
**Success Criteria** (what must be TRUE):
  1. Privacy Policy is published at a stable public URL, drafted to GDPR Articles 13/14 baseline with DPDP § 5 notice and CCPA collected-information sections layered in
  2. Privacy Policy contains a sub-processor list naming Anthropic (US), Supabase (region confirmed in Phase 1), Telegram (global), and Expo Push, each with purpose, data categories, legal basis, and retention period
  3. Terms of Service / EULA is published at a stable public URL, covers both landlord and tenant roles, explicitly disclaims that Dwella is a record-keeper (not a payment processor, escrow agent, or legal advisor), and names the solo developer's jurisdiction as governing law
  4. ToS contains a forward-looking paid-features clause that permits future monetization without a full rewrite
  5. A visible "Do Not Sell or Share My Personal Information" section (CCPA affirmative disclosure) and a DPDP grievance officer contact are present in the published Privacy Policy
**Plans:** 3 plans
Plans:
- [x] 02-01-PLAN.md — Privacy Policy + GitHub Pages infrastructure
- [x] 02-02-PLAN.md — Terms of Service / EULA
- [ ] 02-03-PLAN.md — Enable GitHub Pages + developer review checkpoint

### Phase 3: Security Hardening
**Goal**: Close the edge-function attack surface and restore production observability so the privacy policy's "we monitor for incidents" claim is truthful
**Depends on**: Nothing (parallelizable with Phase 2 — touches different files)
**Requirements**: SEC-01, SEC-02, SEC-03, SEC-04, SEC-05
**Success Criteria** (what must be TRUE):
  1. `telegram-webhook` rejects requests without a valid `X-Telegram-Bot-Api-Secret-Token` header with HTTP 401, verified by manual curl test
  2. The `invite-redirect` XSS sink at lines 187/193 is fixed — tokens are UUID-regex-validated before HTML interpolation and escaped on output; a malicious `</script>` payload in the token query parameter no longer breaks out
  3. Every edge function with `verify_jwt = false` has a documented alternative auth mechanism (shared secret, webhook signature, or explicit "public with rate limiting" designation) recorded in `supabase/config.toml` comments
  4. A production observability solution is active: errors from any Edge Function or mobile build are visible in a dashboard within 24 hours of occurrence (Sentry re-enabled or documented alternative)
  5. Rate limiting is enforced on `telegram-webhook`, `invite-redirect`, and `process-bot-message` and a manual abuse simulation is blocked at the configured threshold
**Plans**: TBD

### Phase 4: Data Rights & Compliance Flows
**Goal**: Make GDPR/DPDP/CCPA data-subject rights technically executable — erasure, access, portability, retention — end to end
**Depends on**: Phase 1 (erasure pattern depends on knowing retention obligations from cookie/tracker audit and region-specific retention rules). Parallelizable with Phases 2 and 3.
**Requirements**: COMP-01, COMP-02, COMP-03, COMP-04, COMP-07
**Success Criteria** (what must be TRUE):
  1. A database migration replaces `ON DELETE RESTRICT` on `payments.tenant_id` (and any other RESTRICT FK that blocks erasure) with an anonymization-on-delete pattern for rows that must be retained for financial records; the migration runs cleanly on a fresh `supabase db reset`
  2. An in-app "Delete Account" flow in the profile screen completes end-to-end: triggers cascading erasure of the user's properties, tenants, bot_conversations, notifications, push tokens, avatars, and payment proofs, and either hard-deletes or anonymizes payment rows per the retention policy
  3. An in-app "Export My Data" flow produces a JSON or PDF bundle containing every row the user owns across all tables, downloadable from the device
  4. A scheduled retention job runs on a cron schedule and hard-deletes or anonymizes archived rows older than the documented retention window per data category
  5. Telegram bot context building is gated so that users who have never linked a Telegram chat have zero data sent to Telegram, verified by reading `telegram-webhook` / `process-bot-message` entry gates
**Plans**: TBD

### Phase 5: In-App Legal Surfaces
**Goal**: Wire the legal copy from Phase 2 and the rights infrastructure from Phase 4 into the actual app so users see, consent to, and can invoke them
**Depends on**: Phase 2 (needs live Privacy Policy and ToS URLs), Phase 4 (needs account deletion and data export flows to link to), Phase 1 (consent schema migration)
**Requirements**: LEGAL-05, LEGAL-06, LEGAL-07
**Success Criteria** (what must be TRUE):
  1. On first run after signup (email, Google, or Apple), the app presents ToS + Privacy Policy and records the user's consent with timestamp and document version in the database before the user can reach the main tabs
  2. Before any tenant PII is sent to the Claude API (first bot chat, first AI insight, first AI search), the user is presented with an explicit AI-features consent gate; opting out disables every bot intent that requires PII context and records the decision
  3. The Settings/Profile screen contains live links to the current Privacy Policy, Terms of Service, and a data-rights request contact (email or in-app form), all reachable within two taps from any main tab
**Plans**: TBD
**UI hint**: yes

### Phase 6: Store Submission Preparation
**Goal**: Produce every store-side artifact — Info.plist strings, nutrition labels, data safety form, age rating, listing copy, screenshots — that App Store Connect and Play Console demand before first review
**Depends on**: Phase 2 (privacy policy URL), Phase 4 (data-flow ground truth for labels), Phase 1 (tracker audit for labels), Phase 5 (account deletion must exist before Apple submission)
**Requirements**: STORE-01, STORE-02, STORE-03, STORE-04, STORE-05, STORE-06, STORE-07
**Success Criteria** (what must be TRUE):
  1. `app.json` Info.plist section contains usage description strings for camera (`NSCameraUsageDescription`), photo library (`NSPhotoLibraryUsageDescription`), Face ID (`NSFaceIDUsageDescription`), and secure store access — verified by a build that successfully requests each permission on a physical device without crashing
  2. Apple Privacy Nutrition Labels are drafted and entered in App Store Connect covering Contact Info, Financial Info, User Content, Identifiers, and Diagnostics, with "linked to user" flags accurate per the data flow audit
  3. Google Play Data Safety form is completed and matches the Apple nutrition labels fact-for-fact (same data categories, same collection/sharing flags)
  4. Age rating questionnaire is completed on both stores and the resulting rating is recorded, accounting for the app's handling of financial records
  5. Apple App Privacy URL and Google Play Privacy URL point at the Phase 2 published Privacy Policy and resolve live
  6. Store listing copy and screenshot set are reviewed: no unverifiable claims, no medical/financial advice framing, and zero real tenant names/addresses/phone numbers in any screenshot
**Plans**: TBD

### Phase 7: Pre-Launch Smoke Test & Final Verification
**Goal**: Prove the assembled v1.0 build is ship-ready on physical hardware and every operational pre-condition holds
**Depends on**: Phase 6 (and transitively every prior phase)
**Requirements**: OPS-01, OPS-02, OPS-03, OPS-04
**Success Criteria** (what must be TRUE):
  1. A physical-device smoke test on iOS and Android passes for: signup (email + Google + Apple), login, create property, add tenant, send invite, accept invite, log payment, confirm payment, generate receipt, bot /start, bot log_payment, bot get_receipt, and account deletion — with results recorded in a single `.planning/launch/smoke-test-results.md`
  2. `pg_cron` schedules for `auto-confirm-payments` (hourly), `mark-overdue` (daily midnight), and `send-reminders` (daily 9 AM) are verified registered in the Supabase dashboard and each has fired at least once in the last cycle
  3. An EAS Build production-profile artifact is produced with correct bundle ID, signing, version, and build number, and is loadable on a physical iOS device via TestFlight and a physical Android device via Play Internal Testing
  4. `requireEnv()` in `constants/config.ts` is audited against every production env var; removing any required var causes a loud startup failure in a rehearsal build
**Plans**: TBD

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Fact-Finding & Unblockers | 1/6 | In progress | - |
| 2. Legal Artifact Drafting | 0/3 | Planned | - |
| 3. Security Hardening | 0/0 | Not started | - |
| 4. Data Rights & Compliance Flows | 0/0 | Not started | - |
| 5. In-App Legal Surfaces | 0/0 | Not started | - |
| 6. Store Submission Preparation | 0/0 | Not started | - |
| 7. Pre-Launch Smoke Test & Final Verification | 0/0 | Not started | - |

## Parallelization Notes

- **Phase 2 (Legal) and Phase 3 (Security) can run in parallel** — they touch different files (docs/hosted content vs. edge functions and observability).
- **Phase 4 (Data Rights) can run in parallel with Phase 2 and Phase 3** once Phase 1 unblockers land.
- **Phase 5 (In-App Surfaces) is the first hard convergence point** — it needs published docs (Phase 2) and working rights flows (Phase 4).
- **Phase 6 (Store) consumes outputs from every prior phase.**
- **Phase 7 (Smoke Test) is strictly last.**

## Coverage Validation

All 38 v1 requirements mapped to exactly one phase:

- Phase 1 (8): COMP-05, COMP-06, COMP-10, IP-01, IP-02, IP-03, IP-04, IP-05
- Phase 2 (6): LEGAL-01, LEGAL-02, LEGAL-03, LEGAL-04, COMP-08, COMP-09
- Phase 3 (5): SEC-01, SEC-02, SEC-03, SEC-04, SEC-05
- Phase 4 (5): COMP-01, COMP-02, COMP-03, COMP-04, COMP-07
- Phase 5 (3): LEGAL-05, LEGAL-06, LEGAL-07
- Phase 6 (7): STORE-01, STORE-02, STORE-03, STORE-04, STORE-05, STORE-06, STORE-07
- Phase 7 (4): OPS-01, OPS-02, OPS-03, OPS-04

**Total: 38/38 ✓** — No orphans, no duplicates.

---
*Roadmap created: 2026-04-05 via /gsd-new-project for v1.0 Launch Prep milestone*
