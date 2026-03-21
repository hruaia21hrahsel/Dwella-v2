# Technology Stack

**Project:** Dwella v2 — v1.2 WhatsApp Bot Expansion
**Researched:** 2026-03-21
**Scope:** NEW capabilities only. Existing stack (Expo SDK 51, Supabase, Claude API, Zustand, Victory Native) is validated and unchanged.

---

## Executive Finding

This milestone adds **zero new npm packages** and **zero new Deno libraries**. Every new capability is achieved by extending the calls to existing HTTP APIs. The "stack" additions are entirely API surface extensions and new Edge Functions written in the same pattern already used in production.

---

## What Is Already In Place (Do Not Re-Research)

| Capability | Where | Status |
|------------|-------|--------|
| WhatsApp Cloud API v21.0 calls | `whatsapp-webhook`, `whatsapp-send-code`, `send-reminders` | Working. Auth pattern established. |
| WhatsApp template message sending | `whatsapp-send-code` | `dwella_verification` template already approved and in use. |
| WhatsApp outbound text messages | `send-reminders` | Sends plain text today — needs upgrade to templates for outbound. |
| Telegram Bot API calls | `telegram-webhook` | Working. `sendMessage` with `parse_mode: 'Markdown'`. |
| process-bot-message shared AI logic | `process-bot-message` | Claude API structured intent dispatch already working. |
| Supabase Storage binary upload | `payment-proofs` bucket | Pattern established — `arraybuffer` upload via service role. |
| Deno `fetch` for external APIs | All Edge Functions | Native Deno — no library needed. |

---

## API Layer: WhatsApp Cloud API

### Version Lock

**Use v21.0 exclusively.** The codebase already uses `graph.facebook.com/v21.0` in `whatsapp-webhook`, `whatsapp-send-code`, and `send-reminders`. All new calls must use the same version. Do not mix API versions across Edge Functions.

**Base URL:** `https://graph.facebook.com/v21.0`

### New Endpoints Needed

| Endpoint | Method | Purpose | Used By |
|----------|--------|---------|---------|
| `/{phone_number_id}/messages` | POST | Send interactive button messages | `whatsapp-webhook` (menu replies) |
| `/{phone_number_id}/messages` | POST | Send template messages (reminders, receipts, alerts) | `whatsapp-outbound` (new Edge Function) |
| `/{phone_number_id}/messages` | POST | Send document messages (PDF report delivery) | `whatsapp-outbound` |
| `/{media_id}` | GET | Retrieve temporary download URL for incoming media | `whatsapp-webhook` (MEDIA-01, MEDIA-02) |
| `/{phone_number_id}/media` | POST multipart | Upload outbound PDF before sending as document message | `whatsapp-outbound` (RICH-03 PDF delivery) |

All calls use the existing `Authorization: Bearer {WHATSAPP_ACCESS_TOKEN}` header — no new credentials.

---

### Interactive Reply Buttons (RICH-02, RICH-03, RICH-05)

Interactive buttons replace plain text replies for menu-driven flows. Sent by setting `type: "interactive"` on the message object.

**Hard constraints (HIGH confidence — Meta official SDK docs + community verification):**
- Maximum **3 buttons per message** — this is a hard API limit, not a soft guideline.
- Button `title` max **20 characters** — keep labels short. "Log Payment" yes; "Record a payment for this month" no.
- Button `id` max **256 bytes** — use short namespaced strings: `"menu:payments"`, `"sub:payments:log"`.
- Interactive messages **can only be sent within the 24-hour customer service window** — a user must have messaged first to open the window. Proactive outbound (reminders, notifications) must use approved templates regardless of button intent.

**The 5-category menu problem:** The RICH-02 requirement lists 5 categories (Properties, Payments, History, Maintenance, Others). Five exceeds the 3-button limit. Resolution: split into two sequential messages — message 1 sends buttons 1-3, message 2 sends buttons 4-5. Or condense to 3 top-level categories and fold less-common options into an "Others" text-triggered path. This is a design decision for the phase, not a stack blocker.

**Request body for interactive button message:**
```json
{
  "messaging_product": "whatsapp",
  "recipient_type": "individual",
  "to": "<E.164_phone>",
  "type": "interactive",
  "interactive": {
    "type": "button",
    "body": { "text": "What would you like to do?" },
    "action": {
      "buttons": [
        { "type": "reply", "reply": { "id": "menu:payments", "title": "Payments" } },
        { "type": "reply", "reply": { "id": "menu:maintenance", "title": "Maintenance" } },
        { "type": "reply", "reply": { "id": "menu:history", "title": "History" } }
      ]
    }
  }
}
```

**Incoming button reply webhook shape** (what the webhook receives when a user taps a button):
```json
{
  "type": "interactive",
  "interactive": {
    "type": "button_reply",
    "button_reply": { "id": "menu:payments", "title": "Payments" }
  }
}
```

The existing `whatsapp-webhook` currently reads only `msg['text']?.['body']`. It must additionally read `msg['interactive']?.['button_reply']?.['id']` to handle button callbacks. This is a 10-line addition to the existing webhook handler.

---

### Media Handling (MEDIA-01, MEDIA-02)

**Incoming media (tenant sends payment photo via WhatsApp):**

Webhook payload includes `msg['image']?.['id']` or `msg['document']?.['id']` — a temporary Media ID string. The existing webhook ignores these fields and returns early on non-text messages. This must be changed.

Two-step retrieval process (no library — raw Deno `fetch`):
1. `GET https://graph.facebook.com/v21.0/{media_id}` with `Authorization: Bearer {token}` → returns JSON with `url` field (valid for 5 minutes only)
2. `GET {url}` with `Authorization: Bearer {token}` → returns binary file content as `ArrayBuffer`

Then upload to Supabase Storage (`payment-proofs` bucket) using existing pattern.

**File size limits (HIGH confidence — verified against AWS Social Messaging docs, which mirror Meta's official limits):**
| Type | MIME Types | Max Size |
|------|-----------|---------|
| Image | `image/jpeg`, `image/png` | 5 MB |
| Document | `application/pdf` | 100 MB (practical: much less) |

**Outbound media (bot delivers PDF report to user):**

Required for RICH-03 "download PDF report" flow:
1. Generate PDF (base64 or binary) via `generate-pdf` Edge Function
2. Upload to WhatsApp media: `POST /{phone_number_id}/media` as `multipart/form-data` with fields `messaging_product=whatsapp`, `type=application/pdf`, `file=<binary>` → returns `{ "id": "<media_id>" }`
3. Send document message: `POST /{phone_number_id}/messages` with `type: "document"` and `document: { "id": "<media_id>", "filename": "dwella-report-2026-03.pdf" }`

Deno handles `multipart/form-data` natively via the built-in `FormData` class — no additional import needed. Supabase Storage returns `Blob` from `storage.from(bucket).download(path)` which can be appended directly to `FormData`.

---

### Template Messages: Outbound Proactive Messaging (OUT-01, OUT-02, OUT-03)

Templates are the **only** mechanism for sending proactive messages when the user has not messaged in the last 24 hours. The `dwella_verification` template is already approved and working — this establishes the pattern for all new templates.

**New templates to create and submit for approval:**

| Template Name | Category | Parameters | Use Case |
|---------------|----------|-----------|---------|
| `dwella_verification` | Utility | `{{1}}` = code | Already approved. Do not change. |
| `dwella_rent_reminder` | Utility | `{{1}}` = property name, `{{2}}` = days until/overdue, `{{3}}` = amount | OUT-01: 3 days before, on due date, 3 days overdue |
| `dwella_payment_receipt` | Utility | `{{1}}` = tenant name, `{{2}}` = property name, `{{3}}` = amount, `{{4}}` = month | OUT-02: payment confirmed |
| `dwella_maintenance_update` | Utility | `{{1}}` = property name, `{{2}}` = new status, `{{3}}` = request summary | OUT-03: maintenance status change |

**Why Utility (not Marketing):** Rent reminders, payment receipts, and maintenance status updates are transactional notifications triggered by user-initiated events. They contain no promotional content. Utility templates have two advantages: (1) they are free when sent within the 24-hour customer service window, and (2) they face less scrutiny during approval. If a template contains any promotional language it will be reclassified as Marketing automatically by Meta's scanner.

**Approval timeline:** 1 minute to 48 hours typically. Templates must be submitted via Meta Business Manager before any Edge Function can use them. Template creation is a prerequisite step, not a code task — it must appear in the setup guide (SETUP-01) as a manual human step.

**Pricing context (July 1 2025 change):** Meta moved from conversation-based to per-message pricing on July 1 2025. Utility templates within a 24-hour window are free. Outside the window, cost is per delivered message by country. For an India-based user base the cost is small but non-zero. This does not change the implementation approach.

**Template request body pattern (established in `whatsapp-send-code`):**
```json
{
  "messaging_product": "whatsapp",
  "to": "<phone>",
  "type": "template",
  "template": {
    "name": "dwella_rent_reminder",
    "language": { "code": "en" },
    "components": [
      {
        "type": "body",
        "parameters": [
          { "type": "text", "text": "Sunset Apartments" },
          { "type": "text", "text": "3 days" },
          { "type": "text", "text": "₹15,000" }
        ]
      }
    ]
  }
}
```

The existing `send-reminders` Edge Function already sends WhatsApp text messages outside the template system. This will break once the 24-hour window closes. It must be replaced with template calls for all three outbound scenarios (OUT-01, OUT-02, OUT-03).

---

## API Layer: Telegram Bot API

### Version

The Telegram Bot API is versioned implicitly by the bot API server — no URL version segment. The existing `telegram-webhook` calls `api.telegram.org/bot{token}/sendMessage` with `parse_mode: 'Markdown'`. No URL change is needed.

Bot API 9.x (current as of 2025) supports inline keyboards with callback data. Since the API endpoint is the same, there is no version migration to perform.

### Inline Keyboards (RICH-02, RICH-03, RICH-05)

Telegram inline keyboards are attached via `reply_markup` in any `sendMessage` call. Unlike WhatsApp's 3-button hard limit, Telegram supports arbitrary rows and columns — the full 5-category main menu can appear in a single message.

**`callback_data` limit: 64 bytes (HIGH confidence — consistent across all sources).** Keep IDs short. `"menu:payments"` is 13 bytes; `"sub:history:pdf"` is 15 bytes — both well within limit.

**JSON structure for `sendMessage` with inline keyboard:**
```json
{
  "chat_id": 123456789,
  "text": "What would you like to do?",
  "parse_mode": "Markdown",
  "reply_markup": {
    "inline_keyboard": [
      [
        { "text": "Properties", "callback_data": "menu:properties" },
        { "text": "Payments", "callback_data": "menu:payments" }
      ],
      [
        { "text": "History", "callback_data": "menu:history" },
        { "text": "Maintenance", "callback_data": "menu:maintenance" }
      ],
      [
        { "text": "Others", "callback_data": "menu:others" }
      ]
    ]
  }
}
```

The inner arrays are rows; multiple buttons in the same array appear side by side. This allows the 5-category grid layout.

### Callback Query Handling

When a user taps an inline button, Telegram sends a `callback_query` update — **not** a `message` update. The existing `telegram-webhook` reads only `update['message']` and returns early if it is absent. This must be extended to also read `update['callback_query']`.

**New endpoint required:** `answerCallbackQuery` must be called after processing every callback query to clear Telegram's loading spinner. Without this call, the button appears stuck to the user.

```
POST https://api.telegram.org/bot{token}/answerCallbackQuery
Body: { "callback_query_id": "<id>", "text": "" }
```

**Incoming callback_query update shape:**
```json
{
  "callback_query": {
    "id": "1234567890",
    "from": { "id": 987654321 },
    "message": { "chat": { "id": 987654321 }, "message_id": 42 },
    "data": "menu:payments"
  }
}
```

The `message.chat.id` is the `chatId` used to send the reply. The `data` field is the `callback_data` value that was set when the button was created.

---

## New Edge Functions

| Function | Responsibility | Why New (Not Modified) |
|----------|---------------|----------------------|
| `whatsapp-outbound` | Sends all proactive outbound WhatsApp messages: template-based reminders, payment receipts, maintenance alerts, and PDF document delivery | Outbound logic separated from the inbound webhook handler. Called by `send-reminders`, `auto-confirm-payments`, and the maintenance status update trigger. Keeps webhook handler focused on inbound parsing. |
| `generate-pdf` | Generates PDF report for a given user + month/year, uploads to Supabase Storage, returns download URL | Already planned in CLAUDE.md. Required for RICH-03 "History > download PDF report". PDF generation in Deno uses HTML string + a headless rendering approach or a pre-built PDF library available via esm.sh. |

---

## Existing Edge Functions: Required Modifications

| Function | What Changes |
|----------|-------------|
| `whatsapp-webhook` | (1) Parse `msg['type'] === 'interactive'` and extract `button_reply.id`. (2) Parse `msg['type'] === 'image'` or `'document'` and download media via the two-step media retrieval flow. (3) Route button `id` values through a menu state machine that sends the next interactive message. (4) On account linking success (SETUP-02 + RICH-01), send a welcome interactive message instead of plain text. |
| `telegram-webhook` | (1) Read `update['callback_query']` alongside `update['message']`. (2) Call `answerCallbackQuery` after every callback. (3) Modify `sendTelegram` to accept optional `reply_markup` parameter for inline keyboard. (4) Add menu dispatch routing on `callback_data` values. |
| `process-bot-message` | (1) Add `query_maintenance_status`, `query_upcoming_payments`, `query_property_summary` to `ACTION_HANDLERS` and Claude system prompt. (2) Extend `buildContext` to include maintenance requests for the current user. (3) Update `BotRequest` interface: add `interactive_button_id?: string` so button taps can bypass Claude entirely for deterministic menu navigation. |
| `send-reminders` | Replace the plain `type: "text"` WhatsApp sends (lines 136-153) with calls to `whatsapp-outbound` using the `dwella_rent_reminder` template. |

---

## Environment Variables: No New Additions

All new API calls reuse existing credentials:

| Variable | Used By | Already Configured |
|----------|---------|-------------------|
| `WHATSAPP_ACCESS_TOKEN` | All WhatsApp API calls | Yes |
| `WHATSAPP_PHONE_NUMBER_ID` | All WhatsApp API calls | Yes |
| `WHATSAPP_APP_SECRET` | HMAC validation in webhook | Yes |
| `WHATSAPP_VERIFY_TOKEN` | Webhook verification challenge | Yes |
| `TELEGRAM_BOT_TOKEN` | All Telegram API calls | Yes |
| `TELEGRAM_WEBHOOK_SECRET` | Webhook secret validation | Yes |

---

## What NOT to Add

| Rejected Option | Reason |
|-----------------|--------|
| `@whatsapp/nodejs-sdk` (Meta's official SDK) | Adds esm.sh CDN dependency for something that `fetch` already handles. The existing production pattern (raw REST calls) is working, audited, and HMAC-validated. A library wrapper adds abstraction without benefit. |
| `grammy`, `telegraf`, or any Telegram bot library | Same reason — the Telegram handler is a thin webhook dispatcher. A library would replace 136 lines of audited code with framework magic and a version dependency. |
| WhatsApp List Messages (`type: "list"`) | Explicitly out of scope in REQUIREMENTS.md. Interactive buttons cover the v1.2 menu requirement. Lists add complexity for no additional benefit in this use case. |
| Session state database table for menu navigation | Introduces schema migration + RLS policy for transient state. Use the `bot_conversations.metadata` column (already present) to store the current menu context per user, or embed state in button `id` values (stateless: `"sub:payments:log"` tells the handler exactly where the user is without a lookup). Stateless design preferred. |
| `deno-puppeteer` / `playwright` for PDF generation | Headless browser in a Supabase Edge Function is not supported (no Chromium binary, 150 MB cold start). Use an HTML-to-PDF Deno library from esm.sh or pre-generate PDFs by formatting data as structured text and encoding as PDF primitives. The `generate-pdf` function already exists in CLAUDE.md plans. |
| Video / voice message handling in WhatsApp | Explicitly out of scope in REQUIREMENTS.md. Photo + document covers the v1.2 use cases. |

---

## Integration Flow Summary

```
Incoming WhatsApp text message
  → whatsapp-webhook
  → (unchanged path) → process-bot-message → Claude API → reply

Incoming WhatsApp button tap
  → whatsapp-webhook (msg.type === "interactive")
  → Extract button_reply.id → menu state machine
  → Send next interactive message OR forward to process-bot-message with intent context

Incoming WhatsApp photo / document
  → whatsapp-webhook (msg.type === "image" | "document")
  → GET graph.facebook.com/v21.0/{media_id} → get temporary URL
  → GET {url} with auth → binary ArrayBuffer
  → Supabase Storage upload (payment-proofs bucket)
  → Update payment row → reply with confirmation

Outbound proactive (rent reminder / payment receipt / maintenance alert)
  → send-reminders / auto-confirm-payments / maintenance trigger
  → whatsapp-outbound (new Edge Function)
  → POST /{phone_number_id}/messages with type: "template"

Outbound PDF report via bot
  → user sends "menu:history" → "sub:history:pdf" → picks month/year
  → generate-pdf Edge Function → PDF binary → POST /{phone_number_id}/media
  → POST /{phone_number_id}/messages with type: "document"

Incoming Telegram text message
  → telegram-webhook (update.message path, unchanged)
  → process-bot-message → Claude API → sendMessage (+ optional inline_keyboard)

Incoming Telegram button tap
  → telegram-webhook (update.callback_query path, new)
  → answerCallbackQuery (clear spinner)
  → menu dispatch on callback_query.data → sendMessage with inline_keyboard
```

---

## Pre-Implementation Checklist (Before Writing Code)

These must be completed by the developer before the implementation phases:

- [ ] Create `dwella_rent_reminder` template in Meta Business Manager, submit for approval
- [ ] Create `dwella_payment_receipt` template in Meta Business Manager, submit for approval
- [ ] Create `dwella_maintenance_update` template in Meta Business Manager, submit for approval
- [ ] Verify Meta App is in Live mode (not Development mode) — webhooks and templates require Live mode
- [ ] Verify WhatsApp Business Account is connected to the Meta App and phone number is registered

---

## Confidence Assessment

| Area | Confidence | Source |
|------|-----------|--------|
| WhatsApp Cloud API v21.0 version | HIGH | Already in production codebase |
| Interactive button JSON structure | HIGH | Meta official Node.js SDK docs + multiple verifications |
| 3-button hard limit | HIGH | Consistent across Meta docs, community, and third-party providers |
| Media two-step retrieval flow | HIGH | Multiple developer implementations confirm the pattern |
| File size limits (5 MB image, 100 MB doc) | HIGH | AWS Social Messaging docs (mirrors Meta), cross-verified |
| Template approval timeline | MEDIUM | Third-party sources; Meta's own timeline is "minutes to 48 hours" |
| Template category (Utility vs Marketing) | HIGH | Meta's July 2025 category guidelines are well-documented |
| Telegram callback_data 64 byte limit | HIGH | Consistent across python-telegram-bot docs and all community sources |
| answerCallbackQuery requirement | HIGH | Telegram Bot API spec — missing call causes stuck UI |
| Telegram inline_keyboard row/column flexibility | HIGH | Confirmed in API spec and multiple implementations |

---

## Sources

- [WhatsApp Cloud API — Interactive Reply Buttons](https://developers.facebook.com/docs/whatsapp/cloud-api/messages/interactive-reply-buttons-messages/) — button JSON structure, 3-button limit (HIGH confidence)
- [WhatsApp Node.js SDK — Interactive Message Reference](https://whatsapp.github.io/WhatsApp-Nodejs-SDK/api-reference/messages/interactive/) — Meta official SDK confirming structure (HIGH confidence)
- [WhatsApp Cloud API — Media Reference](https://developers.facebook.com/docs/whatsapp/cloud-api/reference/media/) — media endpoints (HIGH confidence, via search)
- [AWS End User Messaging Social — Supported Media Types](https://docs.aws.amazon.com/social-messaging/latest/userguide/supported-media-types.html) — MIME types and size limits (HIGH confidence)
- [WhatsApp Template Category Guidelines July 2025](https://www.ycloud.com/blog/whatsapp-api-message-template-category-guidelines-update/) — Utility vs Marketing classification (HIGH confidence)
- [WhatsApp API Pricing Update July 2025](https://www.ycloud.com/blog/whatsapp-api-pricing-update) — per-message pricing context (HIGH confidence)
- [24-hour Customer Service Window](https://www.smsmode.com/en/whatsapp-business-api-customer-care-window-ou-templates-comment-les-utiliser/) — session window rules (HIGH confidence)
- [Telegram Bot API](https://core.telegram.org/bots/api) — InlineKeyboardMarkup, callback_query (HIGH confidence)
- [Telegram InlineKeyboardButton callback_data — python-telegram-bot](https://docs.python-telegram-bot.org/en/stable/telegram.callbackquery.html) — 64 byte limit cross-verification (HIGH confidence)
- Existing codebase: `whatsapp-webhook/index.ts`, `send-reminders/index.ts`, `telegram-webhook/index.ts` — confirmed v21.0 usage, auth pattern, and existing gaps (HIGH confidence)
