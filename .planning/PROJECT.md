# Dwella

## What This Is

Dwella is a cross-platform mobile app (React Native + Expo) for landlords and tenants to manage rental properties, track rent payments, and communicate via an AI-powered Telegram bot. A single user can be both a landlord and a tenant simultaneously — role is derived from data (property ownership / invite acceptance), not a profile flag. The product is feature-complete as of v1.4 on `main` and is being prepared for its first public launch on the Apple App Store and Google Play Store.

## Core Value

Landlords can run the landlord side of their life (log rent, send reminders, issue receipts, manage tenants) from a phone or a Telegram chat, without touching a spreadsheet — and tenants get the same visibility without any landlord-side setup friction.

## Current Milestone: v1.0 Launch Prep

**Goal:** Close every hard blocker to shipping Dwella v1.0 to the Apple App Store and Google Play Store for a global audience, with legal and compliance artifacts that match the strictest applicable regime.

**Drafting baseline:** GDPR + UK GDPR (strictest). Layer DPDP Act 2023 (India, expected primary market given the NoBroker reference) and CCPA/CPRA (US) requirements on top. Do not maintain parallel policies — one set of docs, jurisdiction-specific sections where law requires them.

**Scope (the 5 areas that triggered this milestone):**
1. Privacy Policy covering Supabase-stored data, Telegram bot message content, Claude API processing, payment proof images, Expo push tokens, and any third-party SDK data flow
2. Terms of Service / EULA scoped to both landlord and tenant roles, including liability disclaimers around rent tracking (Dwella is a record-keeper, not a payment processor or escrow agent)
3. Data handling & compliance audit — retention, erasure rights, cross-border transfer disclosures (Supabase region + Anthropic US), consent flows before PII is sent to Claude
4. IP & trademark review — "Dwella" name clearance, third-party assets (fonts, icons, images), removal of NoBroker references from the repo
5. App Store + Play Store legal surfaces — privacy nutrition labels, Play data safety form, in-app account deletion flow (Apple hard-requires this since 2022), age rating

**Critical blockers surfaced by the codebase map** (see `.planning/codebase/CONCERNS.md` for full detail):
- **App Store hard blockers:** no privacy policy URL, no in-app account deletion, missing iOS `Info.plist` usage descriptions in `app.json:52-66`
- **GDPR erasure impossible:** `payments.tenant_id ON DELETE RESTRICT` means soft-delete cannot be promoted to hard-delete on request
- **Unconsented PII to US third party:** full tenant data flows to Anthropic on every bot message via `supabase/functions/process-bot-message/index.ts:784-834`
- **Public edge functions with `verify_jwt = false`** and no Telegram webhook secret-token verification (`supabase/config.toml:382-401`)
- **Potential XSS sink** in `supabase/functions/invite-redirect/index.ts:187,193`
- **IP red flag:** `dwella-nobroker-teal.jsx` at repo root references NoBroker (registered Indian proptech trademark)
- **Supabase region unknown** — must be confirmed in the Supabase dashboard and disclosed in the privacy policy
- **Zero observability:** Sentry and PostHog both removed with no replacement — no way to detect or investigate a post-launch incident

## Requirements

### Validated

<!-- Features already shipped on main as of 2026-04-05 (confirmed by codebase map). These are the existing product that the launch-prep milestone wraps around. -->

- ✓ Landlord can create, view, edit, and archive properties — shipped pre-v1.0
- ✓ Landlord can add tenants to properties via invite deep link — shipped pre-v1.0
- ✓ Tenant can accept an invite via `dwella://invite/{token}` deep link or universal fallback — shipped pre-v1.0
- ✓ Landlord can log rent payments with soft-delete pattern (`is_archived` flag) — shipped pre-v1.0
- ✓ Payment state machine (pending → partial → paid → confirmed, or overdue) enforced by DB trigger — shipped pre-v1.0
- ✓ Dual-role system: single user can be landlord and tenant simultaneously — shipped pre-v1.0
- ✓ Scheduled Edge Functions: `auto-confirm-payments` (hourly), `mark-overdue` (daily midnight), `send-reminders` (daily 9 AM) — shipped pre-v1.0
- ✓ Server-side PDF receipt generation via `pdf-lib` with Storage cache — shipped v1.4
- ✓ Telegram bot with 10 intents, inline keyboards, interactive receipt picker, `/menu` — shipped v1.4
- ✓ Property tools: EMI calculator, rental yield calculator — shipped v1.4

### Active

<!-- v1.0 Launch Prep milestone scope. Detailed requirements will be captured in REQUIREMENTS.md with REQ-IDs. -->

- [ ] Privacy Policy (GDPR + DPDP + CCPA compliant) published and linked from app + stores
- [ ] Terms of Service / EULA published and accepted in-app on first run
- [ ] In-app consent flow before tenant PII is sent to Claude API
- [ ] In-app account deletion flow (user-initiated, cascading erasure)
- [ ] Database migration to remove `ON DELETE RESTRICT` and enable true erasure where law requires
- [ ] Data retention policy documented and enforced (scheduled cleanup of expired data)
- [ ] Supabase region confirmed and disclosed in privacy policy
- [ ] Data Processing Addendum (DPA) signed with Anthropic; Supabase DPA confirmed
- [ ] iOS `Info.plist` usage descriptions added (camera, photo library, local auth, secure store)
- [ ] Apple Privacy Nutrition Labels completed
- [ ] Google Play Data Safety form completed
- [ ] Age rating questionnaire completed on both stores
- [ ] NoBroker references removed from repo; trademark audit clean
- [ ] Third-party asset license audit (fonts, icons, images)
- [ ] "Dwella" name trademark clearance check for launch markets
- [ ] Telegram webhook secret-token verification implemented
- [ ] `invite-redirect` XSS sink fixed
- [ ] Production error/observability solution restored (Sentry or alternative)
- [ ] Pre-launch smoke test pass (build, install, auth, core flows, bot) on physical iOS + Android devices

### Out of Scope

<!-- Explicit boundaries for this milestone. Prevents scope creep. -->

- New product features — v1.0 launch prep only touches what's already shipped on main; no new screens, no new bot intents, no new tools
- Migration to Expo SDK 56+ — the iOS 26 Hermes PAC crash concern is real but outside this milestone's goal of legal/compliance readiness
- Paid tier / in-app purchases — milestone answers "how will we monetize later" with a forward-looking privacy clause, no actual billing implementation
- WhatsApp bot (lives only on backup branches, not on main) — not a launch blocker
- Landing page / marketing website — not required for store submission
- Multi-language support — English only at v1.0; privacy policy translation is a future milestone concern
- Test coverage / CI — the TESTING.md doc notes zero automated tests, but adding them is a separate hardening milestone (legal docs will reference "manual verification" honestly)
- Real-time payment processing / escrow — Dwella is a record-keeper, ToS must explicitly disclaim this

## Context

**Product maturity:** Dwella is a brownfield codebase with ~28 database migrations, 10 Supabase Edge Functions, a full Expo Router app, and a working Telegram bot with 10 intents. v1.4 shipped on 2026-04-05. This is not "build the app" — this is "make the existing app legally launchable."

**Audience:** Initial target markets are India, European Union / UK, United States, and the rest of the world with no geo-gating. This global footprint forces drafting to the strictest applicable regime (GDPR) with DPDP and CCPA-specific sections layered in.

**Publisher:** Solo individual developer (no legal entity). This materially affects:
- Privacy policy "data controller" section names a natural person, exposing personal liability
- Governing-law clause in ToS must name the developer's country of residence
- Apple/Google developer account is under a personal name, not a company
- Recommendation to be made during the milestone: consider forming an LLC / Pvt Ltd / Ltd before launch

**Data flows that matter for privacy docs:**
- Supabase Postgres (EU or India or US region — TBD from dashboard) stores all user data with RLS
- Supabase Storage holds payment proof images and receipt PDFs
- Anthropic (Claude API, US) receives tenant names, addresses, rent amounts on every bot message
- Telegram (global CDN) sees all bot messages, inline keyboard interactions, user IDs
- Expo Push Notification service receives push tokens
- No analytics, no ads, no marketing trackers (Sentry and PostHog were removed)

**Why memory is partially stale and must be re-verified:** The concerns mapper flagged several memory inaccuracies (UpdateGate.tsx deleted, Sentry package gone, no maintenance state machine on main, Expo still on SDK 54). Trust the codebase map (`.planning/codebase/`) and current file state over memory for this milestone.

## Constraints

- **Legal regime:** Must satisfy GDPR + DPDP Act 2023 + CCPA/CPRA + App Store Review Guidelines 5.1 + Play Developer Content Policy (privacy) — Global launch with no geo-gating
- **Publisher:** Solo individual developer, no legal entity yet — personal liability considerations drive conservative drafting
- **Monetization:** Free at v1.0, paid tier forward-looking clauses only — no IAP implementation in this milestone
- **Stack locked:** React Native + Expo + Supabase + Anthropic Claude + Telegram — Cannot swap providers to satisfy data-residency concerns; work within constraints
- **Timeline driver:** User wants to ship v1.0 "soon" — Milestone scope must be ruthlessly limited to launch blockers, not "nice to have" hardening
- **No existing legal docs:** Starting from zero — every artifact in this milestone is net-new
- **Test coverage:** Zero automated tests — legal docs must reference "manual verification" honestly, cannot claim guarantees that aren't enforceable

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Draft to GDPR baseline, layer DPDP/CCPA on top | Single set of docs is cheaper to maintain than three parallel ones; GDPR is strictest so satisfying it satisfies most others | — Pending milestone execution |
| Publish v1.0 as solo developer (not entity) | Entity formation blocks launch; accept personal liability risk for initial release, plan entity formation post-launch | — Pending (advise user to reconsider during milestone) |
| Keep soft-delete pattern but add hard-delete path for erasure requests | True GDPR erasure requires removing `ON DELETE RESTRICT` on payments; requires migration + backup export before delete | — Pending |
| Gate Claude API bot behind explicit in-app consent on first use | Sending tenant PII to a US third party without consent is a GDPR Article 6 violation | — Pending |
| No new features in this milestone | Scope discipline — launch readiness, not product expansion | ✓ Agreed at milestone kickoff |

## Infrastructure

**Backend:** Supabase (managed Postgres + Auth + Storage + Edge Functions + Realtime)
**Supabase project region:** `ap-northeast-1` (Northeast Asia / Tokyo)
**Supabase provider:** AWS (t4g.micro)
**Region confirmed via:** Supabase dashboard -> Project Settings -> General, on 2026-04-06
**Cross-border transfer analysis:** See `.planning/legal/cross-border-transfers.md`.

**Other runtime infrastructure:**
- Anthropic Claude API (US) --- AI bot inference, consent-gated per LEGAL-06
- Telegram Bot API (global) --- user-initiated only per COMP-07
- Expo Push -> APNs (Apple, US) + FCM (Google, US) --- payment reminders

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-04-05 after /gsd-new-project kickoff for v1.0 Launch Prep milestone*
