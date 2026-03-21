# Feature Landscape

**Domain:** WhatsApp Cloud API + Telegram bot expansion for property management
**Researched:** 2026-03-21
**Confidence:** HIGH (Meta official docs, Telegram Bot API docs, multi-source cross-verification)

---

## Table Stakes

Features users expect a property management bot to have. Missing these makes the bot feel broken or unusable.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Outbound rent reminders via WhatsApp | Tenants already receive them via push; WhatsApp reminders reduce no-response rate | MEDIUM | Requires pre-approved **utility template** (non-promotional, transactional). Must be submitted to Meta and approved before any outbound send. Template approval typically takes minutes to 48 hours. |
| Payment confirmation receipt via WhatsApp | Tenants expect a paper trail after paying | MEDIUM | Utility template, same approval requirement. Variables: `{{tenant_name}}`, `{{amount}}`, `{{month}}`, `{{property_address}}`. |
| Maintenance status notifications via WhatsApp | Both landlord and tenant expect to know when status changes | MEDIUM | Utility template per status transition (acknowledged, in_progress, resolved). One template per transition or parameterized status variable. |
| Inbound media: tenant sends photo as payment proof | Tenants already use WhatsApp to send photos — expecting bot to accept them is natural | HIGH | Webhook receives `image` type message with `media_id`. Must call GET `https://graph.facebook.com/v{version}/{media-id}` with Bearer token to retrieve download URL, then download binary and upload to Supabase Storage. **Media URL expires in ~5 min** — must download immediately in the webhook handler. |
| Interactive main menu on both WhatsApp and Telegram | Bots without navigation feel opaque; menu provides discoverability | HIGH | WhatsApp: `interactive` message type with `type: "button"` (max 3 buttons per message). With 5 menu categories, must split into two messages (3+2) or use list message (max 10 rows). Telegram: inline keyboard, up to 8 buttons per row, 100 per keyboard. |
| Freeform text alongside button navigation | Users type naturally; forcing button-only is unusable | LOW | RICH-04 requirement. Both platforms support mixed input. Buttons are shortcuts — all actions must also be reachable by typing. |
| Bot welcome message on account linking | Users need onboarding context when they first connect | LOW | Triggered once on successful link. Free-form text within the 24-hour session window. No template needed if sent immediately after user-initiated linking flow. |

---

## Differentiators

Features that make Dwella's bot stand out from typical rental notification bots.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Menu-driven sub-navigation (5 categories, contextual sub-options) | Most rental bots are dumb notification senders. Multi-level menu makes the bot an action layer, not just an alert channel. | HIGH | WhatsApp: Each sub-menu level uses a new `interactive` message. The 3-button-per-message limit means hierarchical menus require chained messages. Telegram: Inline keyboard supports more buttons per message, making full sub-menus in one message feasible. Must track conversation state in `bot_conversations` table to know which menu level the user is at. |
| PDF report delivery via bot (user picks month/year) | Landlords want financial reports in their messenger without opening the app | HIGH | Two-turn conversation: bot asks for month/year (buttons or freeform), then generates PDF via existing `generate-pdf` Edge Function and sends as document message. WhatsApp document send requires multipart form or URL upload to WhatsApp media endpoint first. Telegram: send via `sendDocument` — simpler, file upload inline. |
| Maintenance status query via bot | "What's happening with my leaking sink report?" — natural language question answered without app open | MEDIUM | New intent: `query_maintenance`. Claude API receives maintenance context. Response rendered as formatted text message. No buttons needed for read-only query. |
| Upcoming payments summary | Tenant asks "what do I owe?" and gets a structured response | MEDIUM | New intent: `query_upcoming_payments`. Pulls from `payments` table for that tenant. Response as formatted text listing month, amount, status, due date. |
| Property summary for landlords | "How is my portfolio doing?" answered in one bot message | MEDIUM | New intent: `query_property_summary`. Aggregates occupancy, rent collection status, open maintenance counts. Clean summary message. |
| Document sharing via WhatsApp | Tenant receives lease or landlord sends notice directly via WhatsApp | MEDIUM | WhatsApp outbound document: must upload document to WhatsApp media first via `POST /media`, get `media_id`, then send as `document` type message. Supabase Storage signed URL can be fetched and forwarded. Inbound document from tenant: same two-step retrieve-and-store flow as image, but for PDF/DOCX. |

---

## Anti-Features

Features to explicitly avoid, even though they may seem natural to add.

| Feature | Why Avoid | What to Do Instead |
|---------|-----------|-------------------|
| WhatsApp list messages (structured lists) | REQUIREMENTS.md explicitly out-of-scopes them. They require separate interactive format, add implementation complexity, and buttons cover the v1.2 menu depth. | Use interactive reply buttons (max 3) with chained messages for deeper menus |
| Property deletion via bot | Destructive action on user's core data. Easy to trigger by accident in a messaging UI. Impossible to add "are you sure?" that users take seriously in chat. | Button in Properties sub-menu says "Manage in app" and links to app deep link |
| Video or voice message handling | Photos and documents cover payment proof and lease sharing. Video adds storage and processing cost with minimal incremental value for rental management. | Accept only `image` and `document` MIME types. Return a friendly error for video/audio. |
| WhatsApp-only features that diverge from Telegram | Dual bot maintenance doubles complexity if features diverge. Both bots share the same Claude-powered intent layer. | Both bots receive the same menu structure, same intents, same responses — platform formatting differs but logic is shared |
| Interactive buttons in outbound template messages without approval | Templates with interactive buttons require separate Meta approval. Using unapproved interactive templates causes API rejection. | Submit utility templates with quick reply buttons as part of template approval. Non-template interactive messages only within 24-hour user session. |
| Stateless menu system (re-render menu on every message) | Without session state, the bot cannot know which sub-menu the user is navigating. Every reply becomes ambiguous. | Store `menu_state` in `bot_conversations` table. On each inbound message, load state, process, update state. |
| Collecting media from users without immediate download | WhatsApp media URLs expire within 5 minutes of webhook delivery. Delayed download loses the file permanently. | Webhook handler must download media synchronously before returning 200 OK. Upload to Supabase Storage in the same request. |

---

## Feature Dependencies

```
Outbound WhatsApp templates (reminders, receipts, maintenance notifications)
    └──requires──> Approved utility templates in Meta Business Manager
    └──requires──> WhatsApp-linked user records (phone_number on user or tenant)
    └──requires──> Updated Edge Functions (send-reminders, auto-confirm-payments, maintenance notification triggers)
    └──depends on──> SETUP-01, SETUP-02 (account setup and linking)

Inbound media handling (MEDIA-01, MEDIA-02)
    └──requires──> WhatsApp webhook handler updates (detect image/document message type)
    └──requires──> Meta Graph API media download step (GET /{media-id})
    └──requires──> Supabase Storage upload (existing `payment-proofs` or `documents` bucket)
    └──depends on──> SETUP-01, SETUP-02

Interactive menus — WhatsApp (RICH-02, RICH-03)
    └──requires──> `interactive` message type with `type: "button"` (max 3 buttons)
    └──requires──> Chained messages for categories exceeding 3 (5 categories = 2 messages)
    └──requires──> Session state in `bot_conversations` to track menu position
    └──NOTE──> Interactive messages only work within 24-hour user session window
    └──NOTE──> Must send template to re-open session if user has been silent >24h

Interactive menus — Telegram (RICH-02, RICH-03, RICH-05)
    └──requires──> InlineKeyboardMarkup with callback_data (max 64 bytes per button)
    └──requires──> Callback query handler in whatsapp-webhook or separate telegram-webhook
    └──NOTE──> No session window restriction on Telegram — inline keyboards work anytime

New bot intents (INTENT-01, INTENT-02, INTENT-03)
    └──requires──> Updated Claude API system prompt with maintenance + payment + property context
    └──requires──> New intent handlers in process-bot-message Edge Function
    └──depends on──> Existing bot_conversations table and context caching pattern

PDF report delivery via bot
    └──requires──> Two-turn conversation (ask month/year → generate → send)
    └──requires──> generate-pdf Edge Function (already deployed)
    └──requires──> WhatsApp: upload PDF to media endpoint → send document message
    └──requires──> Telegram: sendDocument API call (simpler, no pre-upload)
    └──depends on──> Interactive menus (sub-menu trigger point)

Welcome message (RICH-01)
    └──requires──> Trigger hook on successful WhatsApp account link
    └──no new infrastructure needed (outbound message send already needed for templates)
    └──NOTE──> Send within same handler that processes the verification code, before user session expires
```

---

## Message Type Constraints Reference

Critical limits to design within. These drive implementation decisions.

### WhatsApp Interactive Reply Buttons (Session-only, no approval needed)

| Property | Limit |
|----------|-------|
| Max buttons per message | **3** |
| Button title text | **20 characters** |
| Button ID (payload) | 256 characters |
| Body text | 1024 characters |
| Header text (optional) | 60 characters |
| Footer text (optional) | 60 characters |
| When usable | Within 24-hour user session window only |

### WhatsApp List Messages (Out of scope for v1.2 — documented for reference)

| Property | Limit |
|----------|-------|
| Max rows across all sections | **10** |
| Row title | 24 characters |
| Row description | 72 characters |
| Section title | 24 characters |
| Button text (opens list) | 20 characters |

### WhatsApp Template Messages (Require Meta approval)

| Property | Limit |
|----------|-------|
| Variables | `{{1}}`, `{{2}}` etc. — positional, not named |
| Quick reply buttons in template | Up to 3 (standard layout), up to 10 (extended layout) |
| CTA buttons in template | Max 2 (1 URL, 1 phone) |
| Header media (image) | 5 MB (JPG/PNG) |
| Document header | 10 MB (PDF) |
| Approval time | Minutes to 48 hours (usually minutes via automated review) |
| Categories | Marketing, Utility, Authentication, Service |

**For Dwella v1.2:** All outbound proactive messages (reminders, receipts, notifications) must use **Utility** category templates. Utility = non-promotional, transactional, tied to user's existing account/payment relationship.

### WhatsApp Media Limits

| Type | Max Size | Formats | Caption limit |
|------|----------|---------|---------------|
| Image | 5 MB (template), 100 MB (session) | JPG, PNG | 1024 characters |
| Document (PDF) | 10 MB (template), 100 MB (session) | PDF, DOCX, XLSX, etc. | 1024 characters |
| Media URL expiry | **~5 minutes** after webhook delivery | — | Download immediately |
| Meta storage retention | 14 days | — | Download and re-store |

### Telegram Inline Keyboard

| Property | Limit |
|----------|-------|
| Max buttons per keyboard | **100** (send/edit), note: 200 cap only for sendMessage, not edits |
| Max buttons per row | **8** (practical: 4 for readability, 3 for mobile) |
| callback_data per button | **64 bytes** |
| Button text | No documented hard limit, but short text recommended |
| Session window | None — inline keyboards work at any time |

---

## Session Window: The Critical WhatsApp Constraint

**This is the single most important rule governing interactive messaging on WhatsApp.**

- Businesses can only send **free-form messages** (including interactive buttons) within **24 hours** of the user's last inbound message.
- After 24 hours of user silence, the business must send a **pre-approved template** to reopen the conversation.
- When the user replies to a template, the 24-hour window resets.
- Interactive buttons within templates require the buttons to be part of the approved template — they cannot be added ad-hoc.

**Practical implications for Dwella:**
- Main menu (RICH-02) can only be shown after user sends any message. Bot cannot proactively push a menu to idle users.
- Outbound reminders (OUT-01, OUT-02, OUT-03) must use pre-approved templates — they are business-initiated outside the session window.
- First-time welcome message (RICH-01) works because the linking flow starts with a user message (verification code send).
- Users who link and then go silent for 24+ hours require a template to re-engage before any interactive content can be sent.

**Telegram has no such restriction.** Inline keyboards can be sent at any time, including proactive outbound messages.

---

## Template Approval: What to Submit to Meta

Templates needed for v1.2. All must be submitted to Meta Business Manager before launch.

| Template Name | Category | Variables | Purpose |
|---------------|----------|-----------|---------|
| `dwella_rent_reminder` | Utility | `{{1}}` tenant name, `{{2}}` amount, `{{3}}` due date, `{{4}}` property | OUT-01: 3-day before, on-day, 3-day after reminders |
| `dwella_payment_confirmed` | Utility | `{{1}}` tenant name, `{{2}}` amount, `{{3}}` month, `{{4}}` property | OUT-02: Payment confirmation receipt |
| `dwella_maintenance_update` | Utility | `{{1}}` tenant name, `{{2}}` request description, `{{3}}` new status | OUT-03: Maintenance status change |
| `dwella_reopen_session` | Utility | `{{1}}` user name | Re-engage users after 24h silence; leads into menu |

**Rejection risk:** Template rejection happens when utility templates include promotional language or vague context. Keep all templates factual, specific to existing account relationships, zero promotional content.

---

## MVP for v1.2

**Must ship for milestone completion:**

1. Meta Business API setup guide (SETUP-01) — without this, nothing else works
2. WhatsApp account linking end-to-end (SETUP-02) — prerequisite for all other features
3. Pre-approved utility templates submitted and approved (reminders, receipt, maintenance notification)
4. Outbound reminders and receipts via WhatsApp (OUT-01, OUT-02, OUT-03)
5. Inbound photo payment proof via WhatsApp (MEDIA-01)
6. Main menu on both bots (RICH-02, RICH-05) — requires session state in `bot_conversations`
7. Sub-menu navigation (RICH-03) — Properties, Payments, History, Maintenance, Others
8. New intents: maintenance status, upcoming payments, property summary (INTENT-01, INTENT-02, INTENT-03)

**Ship when base is validated:**

- Inbound document sharing (MEDIA-02) — same flow as media but for documents; lower urgency than photo payment proof
- PDF report delivery via bot — depends on interactive menu functioning; adds two-turn state complexity
- Outbound document sharing (send lease via WhatsApp) — requires media upload step; lower urgency than inbound

**Do not build:**

- WhatsApp list messages — explicitly out of scope per REQUIREMENTS.md
- Per-platform feature divergence — one intent layer, two renderers
- Video/voice handling — no property management use case worth the complexity

---

## Existing Infrastructure Reuse Map

| Existing System | Reused By |
|-----------------|-----------|
| `bot_conversations` table | Session state (`menu_state` column addition needed), conversation history |
| `process-bot-message` Edge Function | New intents added here (query_maintenance, query_upcoming_payments, query_property_summary) |
| `telegram-webhook` Edge Function | Extended with callback query handling for inline keyboard |
| WhatsApp webhook handler (existing) | Extended with `interactive` message sending and `image`/`document` inbound handling |
| `send-reminders` Edge Function | Extended to send WhatsApp template in addition to push notification |
| `auto-confirm-payments` Edge Function | Extended to send `dwella_payment_confirmed` template |
| Maintenance notification triggers (v1.1) | Extended to send `dwella_maintenance_update` template |
| `generate-pdf` Edge Function | Reused for bot PDF delivery; PDF upload to WhatsApp media endpoint is new |
| Supabase Storage (`payment-proofs` bucket) | Inbound WhatsApp payment proof photos stored here — same path pattern |
| Existing Claude API system prompt context | Expanded to include maintenance + upcoming payment data |

---

## Sources

- WhatsApp Cloud API interactive reply buttons — official Meta docs (HIGH confidence): https://developers.facebook.com/docs/whatsapp/cloud-api/messages/interactive-reply-buttons-messages/
- WhatsApp character limits reference (HIGH confidence, multi-source verified): https://help.pickyassist.com/general-guidelines/character-limits-whatsapp
- WhatsApp list message documentation (HIGH confidence): https://developers.facebook.com/docs/whatsapp/cloud-api/messages/interactive-list-messages/
- Template category guide July 2025 (HIGH confidence): https://www.chatarchitect.com/news/message-template-category-guide
- WhatsApp media size limits (MEDIUM confidence, multi-source consistent): https://whatchimp.com/docs/whatsapp-api-maximum-media-size-supported-formats/
- WhatsApp 24-hour session window (HIGH confidence, official via smsmode): https://www.smsmode.com/en/whatsapp-business-api-customer-care-window-ou-templates-comment-les-utiliser/
- WhatsApp media download webhook flow (MEDIUM confidence, developer article): https://medium.com/@shreyas.sreedhar/downloading-media-using-whatsapps-cloud-api-webhooks-and-uploading-it-to-aws-s3-bucket-via-nodejs-07c5cbae896f
- Telegram Bot API buttons documentation (HIGH confidence): https://core.telegram.org/api/bots/buttons
- Telegram inline keyboard limits, Bot API 7.0 (HIGH confidence): https://core.telegram.org/bots/features
- WhatsApp outbound messaging 2025 pricing and conversation rules (MEDIUM confidence): https://www.wati.io/en/blog/whatsapp-business-api/whatsapp-api-rate-limits/
- Interactive button UX patterns for property management bots (MEDIUM confidence): https://www.verloop.io/blog/big-ux-ui-whatsapp-chatbot-challenges-how-to-tackle/

---

*Feature research for: Dwella v2 v1.2 milestone — WhatsApp Bot Expansion*
*Researched: 2026-03-21*
