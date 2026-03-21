# Project Research Summary

**Project:** Dwella v2 — v1.2 WhatsApp Bot Expansion
**Domain:** WhatsApp Cloud API + Telegram interactive bot for property management
**Researched:** 2026-03-21
**Confidence:** HIGH

## Executive Summary

Dwella v1.2 extends the existing dual-bot architecture (WhatsApp + Telegram) with interactive menus, inbound media handling, outbound template notifications, and new AI intents. The core finding across all four research areas is that this milestone adds zero new npm packages and zero new Deno libraries — every new capability is achieved by extending HTTP API surface calls within the existing Supabase Edge Function pattern. The recommended approach follows a strict dependency order: build `whatsapp-send` first (shared outbound helper), add media handling second, wire interactive menus third, and deploy outbound template notifications last (because template approval from Meta is an external dependency with a 2-7 day lead time that must be started on Day 1).

The single most important architectural rule governing this milestone is the WhatsApp 24-hour customer service window. Interactive menus can only be sent inside an active session; all proactive outbound messages (rent reminders, payment receipts, maintenance alerts) must use pre-approved Utility templates. This constraint bifurcates every outbound code path and must be encoded as a first-class design decision before any Edge Function is written. Telegram has no equivalent restriction and can serve as the simpler reference implementation for menu logic.

The primary risks are operational (Meta template rejection, temporary access token expiry, phone number pre-registration, messaging tier limits) and architectural (blocking the webhook on synchronous processing, duplicating the outbound fetch block, forwarding menu button taps to Claude unnecessarily). All of these are preventable with correct setup on Day 1 and well-understood patterns already established in the codebase. Recovery costs range from low to high, with phone number quality rating degradation being the most expensive to recover from.

---

## Key Findings

### Recommended Stack

The existing stack handles all v1.2 requirements without modification. WhatsApp Cloud API v21.0 is already in production at `graph.facebook.com/v21.0` — all new calls use the same version and the same `WHATSAPP_ACCESS_TOKEN` credential. Telegram Bot API requires no version change. All new Edge Functions are written in the same Deno `fetch` pattern already used in `whatsapp-webhook`, `telegram-webhook`, and `send-reminders`.

**Core technologies (existing, confirmed):**
- **WhatsApp Cloud API v21.0:** Interactive reply buttons, template messages, media endpoints — version locked, auth pattern established in production
- **Telegram Bot API (current):** Inline keyboards with `callback_data`, `answerCallbackQuery` — no version segment needed
- **Supabase Edge Functions (Deno):** Native `fetch`, `FormData`, `ArrayBuffer` — all required primitives built-in, no esm.sh imports needed
- **Supabase Storage (`payment-proofs` bucket):** Binary upload pattern already working — extended to inbound WhatsApp media
- **Claude API (`claude-sonnet-4-20250514`):** Extended with 3 new read-only intents; menu navigation bypasses Claude via lookup table

**Critical version/limit facts:**
- WhatsApp interactive reply buttons: max **3 per message**, button title max **20 characters**
- Telegram `callback_data`: max **64 bytes** per button
- WhatsApp media URL expiry: **5 minutes** after webhook delivery — download immediately
- WhatsApp new account messaging tier: **250 business-initiated conversations per 24 hours**

### Expected Features

**Must have (table stakes):**
- Outbound rent reminders via WhatsApp — reduces no-response rate; requires pre-approved Utility template
- Payment confirmation receipt via WhatsApp — tenant paper trail; Utility template required
- Maintenance status notifications via WhatsApp — expected by both landlord and tenant; Utility template per event
- Inbound photo as payment proof via WhatsApp (MEDIA-01) — natural user behavior; two-step media download required
- Interactive main menu on both WhatsApp and Telegram (RICH-02, RICH-05) — without navigation the bot feels opaque
- Freeform text alongside buttons (RICH-04) — all actions must be reachable by typing, not buttons only
- Bot welcome message on WhatsApp account linking (RICH-01) — onboarding context for new connections

**Should have (differentiators):**
- Menu-driven sub-navigation with 5 categories (RICH-03) — makes the bot an action layer, not just an alert channel
- PDF report delivery via bot with month/year picker — landlords get financial reports without opening the app
- Maintenance status query via natural language (INTENT-01) — "what's happening with my sink repair?" answered in chat
- Upcoming payments summary (INTENT-02) — tenant asks "what do I owe?" and gets a structured response
- Property portfolio summary for landlords (INTENT-03) — occupancy, rent collection, open maintenance in one message
- Inbound document sharing via WhatsApp (MEDIA-02) — lease and notice exchange within the messenger

**Defer (v2+):**
- WhatsApp list messages — explicitly out of scope per REQUIREMENTS.md; buttons cover the v1.2 menu depth
- Video/voice message handling — no property management use case worth the storage and processing cost
- Per-platform feature divergence — one intent layer, two platform renderers; divergence doubles maintenance

**Pre-flight requirement (not a code task):**
- Four Meta templates must be submitted for approval on Day 1: `dwella_rent_reminder`, `dwella_payment_confirmed`, `dwella_maintenance_update`, `dwella_reopen_session`

### Architecture Approach

The existing architecture separates inbound webhook functions (`whatsapp-webhook`, `telegram-webhook`) from a shared AI dispatch function (`process-bot-message`). This separation is preserved and extended. Three new Edge Functions are introduced to centralize responsibilities that are currently duplicated or missing: `whatsapp-send` (all outbound WhatsApp, single API version control point), `whatsapp-media` (inbound media download + Supabase Storage upload, fire-and-forget from webhook), and `notify-whatsapp` (triggered outbound notifications for payment confirmation and maintenance events). Menu navigation uses a stateless button ID scheme — all state is encoded in the `button_id` string, avoiding a sessions table.

**Major components:**
1. `whatsapp-webhook` — HMAC validation, message type routing (text/interactive/image/document), fire-and-forget to `whatsapp-media`
2. `telegram-webhook` — secret validation, message/callback_query routing, `answerCallbackQuery` required on every callback
3. `process-bot-message` — Claude intent detection; lookup table for pure menu navigation (no Claude call); new query handlers for INTENT-01/02/03; extended context with maintenance data
4. `whatsapp-send` (NEW) — single outbound channel for all WhatsApp message types (text, interactive, template, document)
5. `whatsapp-media` (NEW) — two-step Meta CDN download then Supabase Storage upload; classifies intent from caption heuristic
6. `notify-whatsapp` (NEW) — payment confirmation and maintenance status template sends; called by `auto-confirm-payments` and app client

**Database changes:** One migration — add `last_whatsapp_message_at timestamptz` to `users` for session detection; verify `proof_url` column exists on `payments`.

### Critical Pitfalls

1. **Non-template messages outside the 24-hour session window** — All outbound Edge Functions must use `type: "template"` with approved templates. Sending free-form text or interactive buttons to users who have not messaged in 24+ hours returns error 131047. Design two code paths: template for scheduled/triggered outbound, interactive for in-session replies.

2. **Media URL 5-minute expiry** — The `whatsapp-webhook` must fire-and-forget to `whatsapp-media` immediately after receipt. The media download inside `whatsapp-media` must include `Authorization: Bearer {TOKEN}` — the CDN URL is authenticated, not public. Never pass the media ID downstream for later resolution.

3. **Webhook synchronous processing causing Meta retries** — `whatsapp-webhook` must return HTTP 200 immediately after HMAC validation. Processing Claude, DB writes, and reply sends must happen after the response is sent. Implement `message_id` deduplication to prevent duplicate bot replies on retries.

4. **Temporary access token used in production** — The Developer Dashboard provides a 24-hour token. Use a System User token from Meta Business Manager from Day 1. Store in Supabase secrets only, never in `.env` or committed to git.

5. **Template rejection and automatic recategorization** — Write all templates with pure transactional language, no promotional framing, no shortened URLs, exact `{{1}}` variable format. Submit on Day 1. Subscribe to `message_template_status_update` webhooks to detect auto-recategorization without notice (Meta removed the 24-hour warning period in April 2025).

---

## Implications for Roadmap

Based on research, the dependency order is firm: `whatsapp-send` is a prerequisite for all other phases; template approval is the long-pole external dependency that must be started in parallel with Phase 1.

### Phase 0: Setup and Prerequisites (Pre-Development)
**Rationale:** Meta template approval takes 2-7 days and is a hard external dependency for outbound notifications. Setup blockers — System User token, phone number registration, Meta app in Live mode — must be resolved before any code can be tested end-to-end.
**Delivers:** System User token configured in Supabase secrets; Meta app in Live mode; WhatsApp phone number registered and clean (never previously used in the WhatsApp consumer app); all 4 templates submitted to Meta Business Manager; SETUP-01 documentation complete; WhatsApp account linking flow verified end-to-end (SETUP-02)
**Avoids:** Temporary token expiry (Pitfall 5), phone number pre-registration conflict (Pitfall 6), template submission delay blocking Phase 4

### Phase 1: Media Handling — Inbound Photo and Document (MEDIA-01, MEDIA-02)
**Rationale:** `whatsapp-send` (the shared outbound helper) must be built first because all later phases depend on it. Inbound media is the highest-urgency tenant-facing feature with no dependency on interactive menus or templates. Building it first validates the `whatsapp-send` helper under real conditions before other phases rely on it.
**Delivers:** `whatsapp-send` Edge Function (text, interactive, template, document types); `whatsapp-media` Edge Function (two-step Meta CDN download + Supabase Storage upload); media type routing added to `whatsapp-webhook`; DB migration (verify `proof_url` on `payments`)
**Addresses:** MEDIA-01 (payment photo proof), MEDIA-02 (document sharing)
**Avoids:** Media URL 5-minute expiry (Pitfall 3), blocking webhook on synchronous download (Pitfall 8), duplicating outbound fetch block across functions (Architecture anti-pattern 3)

### Phase 2: Interactive Menus — WhatsApp and Telegram (RICH-01 through RICH-05)
**Rationale:** The menu system is the UX backbone for all new bot features. It must be complete before new intents can be reached via button navigation. Building menus second means `whatsapp-send` is already available for interactive message delivery.
**Delivers:** Modified `process-bot-message` with `buttons` response field and `button_id` input (lookup table for pure menu taps, bypasses Claude); modified `telegram-webhook` with `callback_query` routing and `answerCallbackQuery`; modified `whatsapp-webhook` with `interactive` type routing; stateless button ID scheme (`menu_payments`, `action_log_payment`, etc.); `last_whatsapp_message_at` session tracking migration; welcome message on account linking (RICH-01)
**Addresses:** RICH-01, RICH-02, RICH-03, RICH-04, RICH-05
**Avoids:** Forwarding menu taps to Claude (Architecture anti-pattern 4), session state DB table for menu navigation (anti-pattern 5), WhatsApp interactive message outside 24h window (Pitfalls 1 and 2), Telegram callback spinner stuck from missing `answerCallbackQuery`

### Phase 3: New Bot Intents (INTENT-01, INTENT-02, INTENT-03)
**Rationale:** Pure additions to existing AI logic. No new infrastructure required after Phase 2 establishes the structured response format with `buttons` and `button_id`. This is the lowest-risk phase — no new Edge Functions, no external dependencies, no new schema.
**Delivers:** Maintenance status query handler (`query_maintenance_status`); upcoming payments handler (`query_upcoming_payments`); property summary handler (`query_property_summary`); extended `buildContext()` with maintenance data; updated Claude system prompt
**Addresses:** INTENT-01, INTENT-02, INTENT-03
**Uses:** Updated `process-bot-message` `ActionHandler` pattern from Phase 2

### Phase 4: Outbound Template Notifications (OUT-01, OUT-02, OUT-03)
**Rationale:** This phase is blocked on Meta template approval (submitted in Phase 0). If templates are approved by the time Phase 3 is complete, Phase 4 can proceed immediately. Building it fourth means all helper infrastructure (`whatsapp-send`, `notify-whatsapp`) is available.
**Delivers:** `notify-whatsapp` Edge Function (payment confirmed + maintenance update template sends); `send-reminders` updated to use `dwella_rent_reminder` template (replacing free-form text that breaks outside the 24h window); `auto-confirm-payments` hooked to `notify-whatsapp`; HTTP 429 error handling with failures logging for the 250-conversation tier limit
**Addresses:** OUT-01, OUT-02, OUT-03
**Avoids:** Free-form text outside 24h window (Pitfall 1), messaging tier 250 cap silent failures (Pitfall 7), template variable mismatch errors

### Phase 5: PDF Report Delivery via Bot (RICH-03 History submenu)
**Rationale:** Most complex multi-turn flow; depends on interactive menus (Phase 2) and `whatsapp-send` document type (Phase 1). Deferred last to ensure all infrastructure is stable before adding two-turn state complexity.
**Delivers:** PDF month/year picker flow in both bots; `generate-pdf` modified to return signed Supabase Storage URL instead of binary; document delivery via `whatsapp-send` (document type with `link` field) and Telegram `sendDocument`; file size guard (keep under 10MB practical limit)
**Addresses:** RICH-03 History submenu PDF delivery
**Avoids:** In-memory PDF generation exceeding Edge Function memory limits (generate to Storage, return signed URL not binary)

### Phase Ordering Rationale

- `whatsapp-send` must be built in Phase 1 before any phase that sends outbound WhatsApp messages — it is the single outbound channel and all later phases call it
- Template approval (2-7 days) runs in parallel with Phases 1-3 so Phase 4 is not delayed by an external wait
- Menu system (Phase 2) must precede new intents (Phase 3) because intents are reached via menu button taps in the UX flow
- PDF delivery (Phase 5) is last because it requires a two-turn conversation state machine and all other infrastructure to be stable first

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 4:** WhatsApp messaging tier limit handling — backoff strategy and failure logging table design need implementation specifics validated against Supabase Edge Function runtime constraints (no `setTimeout` in Deno Deploy)
- **Phase 5:** PDF generation library for Deno on `esm.sh` — `deno-puppeteer` is confirmed not viable (no Chromium binary in Edge Function runtime); the specific Deno-compatible HTML-to-PDF library needs selection and validation before Phase 5 begins

Phases with standard patterns (skip additional research):
- **Phase 1:** Media two-step download pattern is documented at HIGH confidence across multiple sources; `whatsapp-send` follows the existing `whatsapp-send-code` pattern exactly
- **Phase 2:** Interactive button and Telegram inline keyboard specs are fully documented at HIGH confidence; all payload structures are verified; implementation is unambiguous
- **Phase 3:** Follows the existing `process-bot-message` `ActionHandler` pattern exactly — pure addition, no new integration surface, no new API calls

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Zero new dependencies; all new capability is API surface extension of existing working integrations verified in production |
| Features | HIGH | Meta official docs + Telegram Bot API spec; all limits verified from multiple sources with cross-verification |
| Architecture | HIGH | Patterns derived from existing working codebase + official API specs; component boundaries and data flows are unambiguous |
| Pitfalls | HIGH | Cross-verified against Meta docs, multiple third-party provider blogs, and direct gaps identified in existing codebase source files |

**Overall confidence:** HIGH

### Gaps to Address

- **PDF generation library for Deno:** `generate-pdf` Edge Function exists in CLAUDE.md plans but the specific Deno-compatible HTML-to-PDF library is not yet selected. Options via `esm.sh` must be evaluated during Phase 5 planning. Hard constraint: no Chromium binary available, ruling out all headless browser approaches.
- **`whatsapp-media` intent classification heuristic:** Research recommends classifying inbound media as payment proof vs. document based on caption keywords. This heuristic may need refinement for non-English captions or absent captions. A user-facing fallback (ask sender to clarify) should be designed during Phase 1 planning.
- **`generate-pdf` current return format:** Research flags that the function must be modified to return a signed Supabase Storage URL. Verify the current implementation's return shape before Phase 5 begins to scope the modification accurately.
- **WhatsApp opt-in requirement for cold outbound:** The first outbound message to a user who has never initiated a conversation requires documented opt-in. The `send-reminders` opt-in tracking mechanism needs design during Phase 4 planning.

---

## Sources

### Primary (HIGH confidence)
- [WhatsApp Cloud API — Interactive Reply Buttons](https://developers.facebook.com/docs/whatsapp/cloud-api/messages/interactive-reply-buttons-messages/) — button JSON structure, 3-button hard limit
- [WhatsApp Node.js SDK — Interactive Message Reference](https://whatsapp.github.io/WhatsApp-Nodejs-SDK/api-reference/messages/interactive/) — Meta official SDK confirming structure
- [WhatsApp Cloud API — Media Reference](https://developers.facebook.com/docs/whatsapp/cloud-api/reference/media/) — two-step download, 5-minute URL expiry, authenticated CDN URLs
- [AWS End User Messaging Social — Supported Media Types](https://docs.aws.amazon.com/social-messaging/latest/userguide/supported-media-types.html) — file size limits (mirrors Meta specs)
- [WhatsApp Template Category Guidelines July 2025](https://www.ycloud.com/blog/whatsapp-api-message-template-category-guidelines-update/) — Utility vs. Marketing classification
- [Telegram Bot API](https://core.telegram.org/bots/api) — InlineKeyboardMarkup, callback_query, answerCallbackQuery, 64-byte callback_data limit
- Existing codebase: `whatsapp-webhook/index.ts`, `whatsapp-send-code/index.ts`, `send-reminders/index.ts`, `telegram-webhook/index.ts` — confirmed v21.0 usage, auth pattern, and existing gaps identified by direct source inspection

### Secondary (MEDIUM confidence)
- [WhatsApp 24-hour Customer Service Window — smsmode](https://www.smsmode.com/en/whatsapp-business-api-customer-care-window-ou-templates-comment-les-utiliser/) — session window rules and consequences
- [Downloading Media via WhatsApp Cloud API — Medium](https://medium.com/@shreyas.sreedhar/downloading-media-using-whatsapps-cloud-api-webhooks-and-uploading-it-to-aws-s3-bucket-via-nodejs-07c5cbae896f) — two-step media download flow implementation
- [WhatsApp API Rate Limits — Wati](https://www.wati.io/en/blog/whatsapp-business-api/whatsapp-api-rate-limits/) — 250-conversation tier limit and escalation timeline
- [Building a Scalable Webhook Architecture — ChatArchitect](https://chatarmin.com/en/blog/whats-app-api-send-messages) — async webhook processing patterns
- [Messaging Limits — Meta for Developers](https://developers.facebook.com/docs/whatsapp/messaging-limits/) — tier escalation mechanics
- [Button reply webhook payload — Chatwoot GitHub #12030](https://github.com/chatwoot/chatwoot/issues/12030) — interactive button_reply payload structure cross-verification

### Tertiary (referenced for completeness)
- [WhatsApp Template Approval: 27 Reasons Meta Rejects — WUSeller](https://www.wuseller.com/blog/whatsapp-template-approval-checklist-27-reasons-meta-rejects-messages/) — template rejection checklist
- [Permanent Access Token Setup — Anjok Technologies](https://anjoktechnologies.in/blog/-whatsapp-cloud-api-permanent-access-token-step-by-step-system-user-2026-complete-correct-guide-by-anjok-technologies) — System User token setup walkthrough
- [WhatsApp Messaging Limits and Quality Ratings — PickyAssist](https://pickyassist.com/blog/whatsapps-messaging-limits-quality-ratings-on-2025/) — quality rating tier mechanics and recovery

---

*Research completed: 2026-03-21*
*Ready for roadmap: yes*
