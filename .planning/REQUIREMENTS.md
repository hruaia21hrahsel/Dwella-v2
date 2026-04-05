# Requirements: Dwella v1.0 Launch Prep

**Defined:** 2026-04-05
**Milestone:** v1.0 Launch Prep
**Core Value:** Landlords can run rent tracking from a phone or Telegram chat without a spreadsheet — and tenants get the same visibility without setup friction.

**Drafting baseline:** GDPR + UK GDPR (strictest). Layer DPDP Act 2023 (India) and CCPA/CPRA (US) on top. One set of docs, jurisdiction-specific sections where law requires them.

## v1.0 Requirements

Every requirement below is a hard blocker to public v1.0 launch on the App Store and Google Play. Each maps to exactly one roadmap phase.

### Legal Artifacts (LEGAL)

- [ ] **LEGAL-01**: Privacy Policy exists, GDPR Articles 13/14 compliant, DPDP notice requirements met, CCPA "collected information" disclosures present, and is publicly hosted at a stable URL
- [ ] **LEGAL-02**: Privacy Policy discloses every data flow surfaced by `.planning/codebase/INTEGRATIONS.md` (Supabase region, Anthropic US, Telegram, Expo Push) with purpose, legal basis, and retention period per category
- [ ] **LEGAL-03**: Terms of Service / EULA exists, covers both landlord and tenant roles, explicitly disclaims that Dwella is a record-keeper (not a payment processor, escrow agent, or legal advisor), and names the solo developer's jurisdiction as governing law
- [ ] **LEGAL-04**: ToS includes a forward-looking paid-features clause so post-launch monetization does not require a full rewrite
- [ ] **LEGAL-05**: In-app "first run" screen presents ToS + Privacy Policy and records consent (timestamp + version) in the database before the user can use the app
- [ ] **LEGAL-06**: In-app consent flow before any tenant PII is sent to the Claude API via the bot. User must explicitly opt in to AI features; opt-out disables bot intents that require PII context
- [ ] **LEGAL-07**: In-app Settings screen links to current Privacy Policy, ToS, and data-rights request form/email

### Data Compliance (COMP)

- [ ] **COMP-01**: User-initiated account deletion flow exists in the app (Apple hard-requires this since 2022). Triggers cascading erasure of all personal data except where legally required to retain (e.g., tax/financial records)
- [ ] **COMP-02**: Database migration removes `ON DELETE RESTRICT` on `payments.tenant_id` where it blocks GDPR erasure; replaces with anonymization-on-delete pattern for payment rows that must be retained for financial records
- [ ] **COMP-03**: Data retention policy documented and enforced via scheduled job: archived records older than N days are hard-deleted or anonymized (N determined by legal basis per category)
- [ ] **COMP-04**: User can export their own data (Article 15 right of access / DPDP right to access) as a JSON or PDF bundle from within the app
- [ ] **COMP-05**: Supabase region confirmed via dashboard, documented in PROJECT.md, and disclosed in the privacy policy with explicit cross-border transfer language if region is outside EU and users include EU residents
- [ ] **COMP-06**: Data Processing Addendum (DPA) signed with Anthropic (Claude API). Supabase DPA confirmed already in place via their standard terms. Both referenced in privacy policy sub-processor list
- [ ] **COMP-07**: Telegram bot explicitly documented as "user-initiated third-party channel" with separate consent — users who never touch the bot must not have their data sent to Telegram
- [ ] **COMP-08**: CCPA "Do Not Sell or Share My Personal Information" link present (even though Dwella does not sell data, the link is required for the affirmative disclosure)
- [ ] **COMP-09**: DPDP Act 2023 grievance officer contact documented in the privacy policy (can be the solo developer's email initially)
- [ ] **COMP-10**: Cookie / tracker audit: confirm no third-party analytics SDKs, no ad SDKs, no silent trackers. Document as "no tracking" in stores

### Store Submission Surfaces (STORE)

- [ ] **STORE-01**: iOS `Info.plist` usage descriptions added for every privacy-sensitive API the app touches: camera, photo library, local authentication, secure store (patch `app.json:52-66`)
- [ ] **STORE-02**: Apple Privacy Nutrition Labels completed accurately across all data categories (Contact Info, User Content, Identifiers, Usage Data, Diagnostics, etc.) with "linked to user" flags correct
- [ ] **STORE-03**: Google Play Data Safety form completed matching the Apple nutrition labels (same facts, different form)
- [ ] **STORE-04**: Age rating questionnaire completed for both stores, accurately reflecting that Dwella handles financial records (may push age rating up from 4+)
- [ ] **STORE-05**: Apple App Privacy URL and Google Play Privacy URL point at the live privacy policy
- [ ] **STORE-06**: App Store and Play Store listing copy reviewed for compliance (no unverifiable claims, no prohibited terms, no medical/financial advice framing)
- [ ] **STORE-07**: Store listing screenshots contain no real user data (tenant names, addresses, phone numbers) — replaced with mock data

### Intellectual Property (IP)

- [ ] **IP-01**: "Dwella" name trademark clearance check performed for India (DPDP target market), EU (GDPR target), US (CCPA target). Document results; if conflict found, escalate
- [ ] **IP-02**: All references to NoBroker removed from the repo — specifically `dwella-nobroker-teal.jsx` at repo root and any other files referencing the trademark
- [ ] **IP-03**: Third-party asset license audit: every font, icon, image, and illustration in the repo has its license documented in a `THIRD-PARTY-LICENSES.md` file or equivalent
- [ ] **IP-04**: Logo and icon origin confirmed (not AI-generated in a way that conflicts with store submission rules, not derivative of another app's branding)
- [ ] **IP-05**: Open-source dependency license audit: confirm no GPL/AGPL contamination of the app bundle that would force source disclosure

### Security Hardening (SEC)

- [ ] **SEC-01**: Telegram webhook secret-token verification implemented in `supabase/functions/telegram-webhook/index.ts`. Requests without the correct `X-Telegram-Bot-Api-Secret-Token` header are rejected with 401
- [ ] **SEC-02**: XSS sink in `supabase/functions/invite-redirect/index.ts:187,193` fixed (escape token in HTML output, or switch to server-side redirect with token validated before insertion)
- [ ] **SEC-03**: `verify_jwt = false` public edge functions audited. Each one either (a) has alternative authentication (shared secret, webhook signature) or (b) is documented as intentionally public with rate limiting
- [ ] **SEC-04**: Production observability solution restored (Sentry or alternative). Errors from production must be visible within 24 hours of occurrence; otherwise the privacy policy's "we monitor for security incidents" claim is false
- [ ] **SEC-05**: Rate limiting on public endpoints (telegram-webhook, invite-redirect, process-bot-message) to prevent abuse and bot-spam billing

### Pre-Launch Operations (OPS)

- [ ] **OPS-01**: Pre-launch smoke test executed on physical iOS and Android devices covering: signup, login, create property, add tenant, send invite, accept invite, log payment, confirm payment, generate receipt, bot /start, bot log_payment, bot get_receipt, account deletion. Results documented
- [ ] **OPS-02**: `pg_cron` schedule registration verified in Supabase dashboard for `auto-confirm-payments` (hourly), `mark-overdue` (daily midnight), `send-reminders` (daily 9 AM)
- [ ] **OPS-03**: EAS Build production profile verified to produce a store-submittable artifact (correct bundle ID, signing, version, build number)
- [ ] **OPS-04**: `requireEnv()` in `constants/config.ts` verified against every production env var so that a missing var fails loudly at startup instead of silently

## Future Requirements (deferred)

Not in scope for v1.0 Launch Prep — tracked for post-launch milestones.

### Observability & Testing

- **FUT-01**: Automated test suite (unit, integration, E2E) — zero tests today per `.planning/codebase/TESTING.md`
- **FUT-02**: CI pipeline with type-check and test enforcement
- **FUT-03**: Structured logging across Edge Functions with log retention policy

### Platform & Infrastructure

- **FUT-04**: Expo SDK 56+ upgrade (addresses iOS 26 Hermes PAC crash concern)
- **FUT-05**: Legal entity formation (LLC / Pvt Ltd) to limit solo-dev personal liability
- **FUT-06**: Multi-language support for privacy policy and app UI (starting with Hindi for India market)
- **FUT-07**: WhatsApp bot (currently on backup branches only)
- **FUT-08**: Paid tier / in-app purchases with refund policy

### Product Expansion

- **FUT-09**: Maintenance request tracking (state machine referenced in memory but does not exist on main)
- **FUT-10**: Landing page / marketing website
- **FUT-11**: Real-time in-app chat between landlords and tenants

## Out of Scope

Explicit exclusions for this milestone. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| New product features (screens, bot intents, tools) | Launch readiness milestone — freeze feature set, fix legal/compliance gaps only |
| Expo SDK upgrade | Separate hardening milestone; legal artifacts can be drafted on current SDK |
| Automated test coverage | Separate hardening milestone; legal docs will reference manual verification honestly |
| Legal entity formation | Blocks launch if bundled here; advise user to form entity post-launch or in parallel |
| Payment processing / escrow | Dwella is a record-keeper; ToS must explicitly disclaim this (covered under LEGAL-03) |
| Landing page / marketing site | Not required for store submission |
| Translations / i18n | English-only at v1.0; translation is a separate future milestone |
| WhatsApp bot | Lives only on backup branches; not a launch blocker |
| Restoring full v1.2 WhatsApp and v1.3 landing page work from worktree-agent-aa2186cc | Diverged state; preserved as history, not merged |
| Real-time chat between landlords and tenants | Not launch-critical; bot + SMS fallback is sufficient for v1.0 |

## Traceability

Which phases cover which requirements. Populated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| LEGAL-01 | — | Pending |
| LEGAL-02 | — | Pending |
| LEGAL-03 | — | Pending |
| LEGAL-04 | — | Pending |
| LEGAL-05 | — | Pending |
| LEGAL-06 | — | Pending |
| LEGAL-07 | — | Pending |
| COMP-01 | — | Pending |
| COMP-02 | — | Pending |
| COMP-03 | — | Pending |
| COMP-04 | — | Pending |
| COMP-05 | — | Pending |
| COMP-06 | — | Pending |
| COMP-07 | — | Pending |
| COMP-08 | — | Pending |
| COMP-09 | — | Pending |
| COMP-10 | — | Pending |
| STORE-01 | — | Pending |
| STORE-02 | — | Pending |
| STORE-03 | — | Pending |
| STORE-04 | — | Pending |
| STORE-05 | — | Pending |
| STORE-06 | — | Pending |
| STORE-07 | — | Pending |
| IP-01 | — | Pending |
| IP-02 | — | Pending |
| IP-03 | — | Pending |
| IP-04 | — | Pending |
| IP-05 | — | Pending |
| SEC-01 | — | Pending |
| SEC-02 | — | Pending |
| SEC-03 | — | Pending |
| SEC-04 | — | Pending |
| SEC-05 | — | Pending |
| OPS-01 | — | Pending |
| OPS-02 | — | Pending |
| OPS-03 | — | Pending |
| OPS-04 | — | Pending |

**Coverage:**
- v1.0 requirements: 38 total
- Mapped to phases: 0 (roadmap not yet created)
- Unmapped: 38 ⚠️

---
*Requirements defined: 2026-04-05*
*Last updated: 2026-04-05 after initial definition*
