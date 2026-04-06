# DPA Register --- Dwella v1.0

**Purpose:** Single source of truth for all Data Processing Addendum / sub-processor evidence. Consumed by Phase 2 privacy policy drafting (LEGAL-02 sub-processor list).

**Last updated:** 2026-04-06

## Sub-Processors

### 1. Anthropic (Claude API)

- **Processor:** Anthropic PBC (US)
- **Purpose:** AI inference for Dwella bot intents (tenant-context-aware responses)
- **DPA mechanism:** Incorporated by reference into Anthropic Commercial Terms of Service (per https://privacy.claude.com/en/articles/7996862-how-do-i-view-and-sign-your-data-processing-addendum-dpa --- NOT a self-serve PDF download)
- **Commercial Terms accepted on:** 2026-03-17 (date of first invoice OH4VT93K-0001, $5.00 one-time credit purchase)
- **Public DPA version / date archived:** No standalone DPA PDF available; DPA is incorporated by reference into Commercial Terms of Service. Anthropic privacy center (privacy.claude.com) confirms DPA is not a self-serve download.
- **Evidence captured:** Invoice receipt PDF (Receipt-2043-8022-1434.pdf, dated 2026-03-17) confirms Commercial Terms acceptance. Receipt archived locally but not committed (contains billing address).

### 2. Supabase (Postgres, Auth, Storage, Edge Functions, Realtime)

- **Processor:** Supabase Inc.
- **Purpose:** Primary backend --- user authentication, tenant/property/payment data, receipt storage, edge-function runtime, realtime subscriptions
- **DPA mechanism:** Standard DPA incorporated by reference into Supabase Terms of Service (no individual signature required)
- **Canonical URL:** https://supabase.com/legal/dpa
- **Last updated:** 2026-03-17 (inferred from PDF filename `Supabase+DPA+260317.pdf` on supabase.com/legal/dpa)
- **Downloaded PDF URL (if present):** https://supabase.com/downloads/docs/Supabase+DPA+260317.pdf

### 3. Telegram (Bot API)

- **Note:** Telegram is a user-initiated third-party channel. Data only flows to Telegram after the user explicitly links a Telegram chat ID. Documented in COMP-07 (Phase 4) with its own consent gate. No DPA signed with Telegram --- covered by Telegram Bot Terms of Service (https://telegram.org/tos/bot-developers).
- **Consent scope:** User-initiated only. Users who never link a chat must have zero data sent to Telegram.

### 4. Expo Push (APNs / FCM pass-through)

- **Processor:** Expo (for their push service relay); ultimately Apple APNs and Google FCM
- **Purpose:** Push notification delivery for payment reminders, confirmations
- **DPA mechanism:** Expo's DPA: https://expo.dev/terms (incorporated by reference)
- **Last updated:** 2025-05-29 (from expo.dev/terms page header)

## Custom / Negotiated DPAs

None pursued for v1.0 per D-18. Self-serve mechanisms above cover GDPR Article 28 processor obligations.

## Re-Verification Cadence

Re-verify all URLs and DPA "last updated" dates every 90 days or before any major Phase 2 policy update.
