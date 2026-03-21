# Architecture Patterns

**Project:** Dwella v2 — v1.2 WhatsApp Bot Expansion
**Domain:** WhatsApp Cloud API integration with existing Supabase Edge Function architecture
**Researched:** 2026-03-21

---

## Current Architecture Baseline

The existing system uses two parallel webhook Edge Functions that both delegate to one shared AI function:

```
WhatsApp message → whatsapp-webhook → process-bot-message → reply via sendWhatsApp()
Telegram message → telegram-webhook → process-bot-message → reply via sendTelegram()
```

Both webhook functions already pass `source: 'whatsapp' | 'telegram'` to `process-bot-message`. The shared function returns a plain text `reply` string and the webhook functions handle delivery. This separation is the key architectural constraint: **process-bot-message must remain source-agnostic**.

The `send-reminders` Edge Function (scheduled daily) already sends inline WhatsApp text messages directly via `graph.facebook.com/v21.0/{PHONE_NUMBER_ID}/messages` — so the outbound WhatsApp pattern is already established.

---

## What Needs to Change

### New vs. Modified Components

| Component | Status | Change |
|-----------|--------|--------|
| `whatsapp-webhook` | MODIFY | Add image/document message parsing; add interactive button_reply routing |
| `process-bot-message` | MODIFY | Add new intents (INTENT-01/02/03); add menu/button response format; accept button_id |
| `telegram-webhook` | MODIFY | Add inline keyboard sending; add callback_query routing; answerCallbackQuery |
| `send-reminders` | MODIFY | Update to use template messages for out-of-session-window reliability |
| `auto-confirm-payments` | MODIFY | Hook into notify-whatsapp after payment promotion |
| `whatsapp-media` | NEW | Downloads media from Meta CDN, uploads to Supabase Storage |
| `whatsapp-send` | NEW | Shared outbound helper for all WhatsApp message types |
| `notify-whatsapp` | NEW | Outbound notifications for payment confirmation and maintenance events |

---

## Integration Point 1: Media Messages (MEDIA-01, MEDIA-02)

### The Problem

The current `whatsapp-webhook` drops non-text messages silently (lines 119-123 of existing code):

```typescript
const text = (msg['text']?.['body'] as string) ?? '';
if (!text.trim()) {
  return new Response('OK', { status: 200 });
}
```

Image and document messages arrive with `msg.type === 'image'` or `msg.type === 'document'`, not `msg.type === 'text'`.

### Incoming Webhook Payload Structure (MEDIUM confidence)

**Image message:**
```json
{
  "messages": [{
    "type": "image",
    "from": "919876543210",
    "id": "wamid.XXX",
    "image": {
      "id": "MEDIA_ID_STRING",
      "mime_type": "image/jpeg",
      "sha256": "...",
      "caption": "Payment for March"
    }
  }]
}
```

**Document message:**
```json
{
  "messages": [{
    "type": "document",
    "from": "919876543210",
    "document": {
      "id": "MEDIA_ID_STRING",
      "mime_type": "application/pdf",
      "sha256": "...",
      "filename": "lease.pdf",
      "caption": "Lease agreement"
    }
  }]
}
```

### Two-Step Media Download Flow (HIGH confidence — established pattern across multiple sources)

**Step 1 — Resolve media_id to download URL:**
```
GET https://graph.facebook.com/v21.0/{MEDIA_ID}
Authorization: Bearer {WHATSAPP_ACCESS_TOKEN}
```
Response: `{ "url": "https://lookaside.fbsbx.com/whatsapp_business/attachments/...", "mime_type": "image/jpeg", "sha256": "...", "file_size": 12345 }`

**CRITICAL:** The returned URL is a temporary `lookaside.fbsbx.com` URL that **expires in 5 minutes** and requires the same Bearer token to download.

**Step 2 — Download the binary:**
```
GET {url_from_step_1}
Authorization: Bearer {WHATSAPP_ACCESS_TOKEN}
```
Response: raw binary ArrayBuffer.

**Step 3 — Upload to Supabase Storage:**
Use the Supabase JS client with service role key to upload to the appropriate bucket (`payment-proofs` for images, `documents` for document messages).

### New Edge Function: `whatsapp-media`

This is the appropriate container for the download+upload logic. Keeping it separate from `whatsapp-webhook` prevents the 5-minute URL expiry from being a concern during the webhook's acknowledgment window (Meta expects a fast response).

**Data flow:**
```
whatsapp-webhook receives image message
  → extracts { media_id, caption, sender_phone, mime_type }
  → immediately returns 200 OK to Meta
  → fire-and-forget fetch() to whatsapp-media Edge Function
    → Step 1: GET graph.facebook.com/{media_id} → resolve download URL
    → Step 2: GET lookaside URL → download binary ArrayBuffer
    → Step 3: identify user by whatsapp_phone
    → Step 4: classify intent from caption (heuristic: contains "payment" → proof, else → document)
    → Step 5: upload binary to Supabase Storage
    → Step 6: update payments.proof_url OR insert documents row
    → Step 7: call whatsapp-send with confirmation reply to sender
```

**Storage path convention (matching existing patterns):**
- Payment proof: `payment-proofs/{property_id}/{tenant_id}/{year}-{month}.jpg`
- Document: `documents/{property_id}/{user_id}/{timestamp}-{filename}`

**NOTE on fire-and-forget:** The `whatsapp-webhook` must return 200 to Meta within the response window. The call to `whatsapp-media` should use `fetch()` without `await` (fire-and-forget). Supabase Edge Functions run on Deno Deploy — `EdgeRuntime.waitUntil()` can be used if available to ensure the async call completes even after response is sent.

### What Changes in `whatsapp-webhook`

Add message type routing before the existing `if (!text.trim())` guard:

```typescript
const msgType = msg['type'] as string;

if (msgType === 'image' || msgType === 'document') {
  // Handle media — identify user, fire-and-forget to whatsapp-media
  const mediaObj = (msg[msgType] as Record<string, unknown>);
  const media_id = mediaObj['id'] as string;
  // fire-and-forget (no await)
  fetch(WHATSAPP_MEDIA_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id: linkedUser.id, media_id, mime_type: mediaObj['mime_type'], caption: mediaObj['caption'] })
  });
  return new Response('OK', { status: 200 });
}

if (msgType === 'interactive') {
  const buttonId = (msg['interactive'] as any)?.['button_reply']?.['id'] as string;
  // treat buttonId as the intent signal, forward to process-bot-message
  // ...
}
```

---

## Integration Point 2: Interactive Button Callbacks (RICH-01 through RICH-05)

### WhatsApp Button Reply Payload (MEDIUM confidence — multiple implementation sources agree)

When a user taps a reply button, Meta sends a webhook POST with:

```json
{
  "messages": [{
    "type": "interactive",
    "from": "919876543210",
    "interactive": {
      "type": "button_reply",
      "button_reply": {
        "id": "menu_payments",
        "title": "Payments"
      }
    }
  }]
}
```

The `button_reply.id` is the string set when constructing the outbound interactive message. This is the routing key.

### Telegram Callback Query Payload (HIGH confidence — official Telegram Bot API)

When a user taps an inline keyboard button, Telegram sends a separate update type:

```json
{
  "callback_query": {
    "id": "12345",
    "from": { "id": 987654321 },
    "message": { "chat": { "id": 987654321 } },
    "data": "menu_payments"
  }
}
```

**CRITICAL difference from WhatsApp:** Telegram button callbacks arrive as `callback_query` updates, not `message` updates. The `telegram-webhook` currently only handles `update['message']` and will silently drop all button taps. This must be fixed.

Telegram also requires acknowledging the callback query or the button shows a loading spinner indefinitely:
```
POST https://api.telegram.org/bot{TOKEN}/answerCallbackQuery
{ "callback_query_id": "12345" }
```

### Button State Machine Design

Menu state is encoded in button_id strings — no session state needed in DB. This keeps the architecture stateless at the Edge Function level.

**Button ID convention:**
```
menu_main           → show main menu
menu_payments       → show payments submenu
menu_history        → show history submenu
menu_maintenance    → show maintenance submenu
menu_properties     → show properties submenu
menu_others         → show others submenu
action_log_payment  → forward to Claude: "log payment"
action_upcoming     → forward to Claude: "show upcoming payments"
action_maint_status → forward to Claude: "show maintenance status"
action_property_sum → forward to Claude: "property summary"
action_pdf_report   → trigger PDF generation flow (multi-turn)
action_contact      → show contact info (static response)
```

### Sending Interactive Messages

**WhatsApp interactive button message (max 3 buttons per message — CRITICAL constraint):**
```json
{
  "messaging_product": "whatsapp",
  "to": "+919876543210",
  "type": "interactive",
  "interactive": {
    "type": "button",
    "body": { "text": "What would you like to do?" },
    "action": {
      "buttons": [
        { "type": "reply", "reply": { "id": "menu_payments", "title": "Payments" } },
        { "type": "reply", "reply": { "id": "menu_maintenance", "title": "Maintenance" } },
        { "type": "reply", "reply": { "id": "menu_others", "title": "More..." } }
      ]
    }
  }
}
```

**CONSTRAINT:** WhatsApp supports maximum 3 reply buttons per interactive message. The 5-category main menu (Properties, Payments, History, Maintenance, Others) requires either pagination (send two messages) or collapsing into 3 top-level buckets with "More..." expanding to a second message.

**Telegram inline keyboard (no strict button limit):**
```json
{
  "chat_id": 987654321,
  "text": "What would you like to do?",
  "reply_markup": {
    "inline_keyboard": [
      [{ "text": "Properties", "callback_data": "menu_properties" }],
      [{ "text": "Payments", "callback_data": "menu_payments" }],
      [{ "text": "History", "callback_data": "menu_history" }],
      [{ "text": "Maintenance", "callback_data": "menu_maintenance" }],
      [{ "text": "Others", "callback_data": "menu_others" }]
    ]
  }
}
```

### What Changes in `process-bot-message`

The function currently returns `{ reply: string }`. For interactive menus, it must return structured button data. Add a `buttons` field to `BotResponse`:

```typescript
interface BotResponse {
  reply: string;
  intent?: string;
  action_taken?: string;
  buttons?: Array<{ id: string; title: string }>;  // NEW
}
```

Webhook functions check `buttons` and send interactive messages instead of plain text.

Add `button_id` to `BotRequest` so button callbacks can bypass Claude entirely for pure menu navigation:

```typescript
interface BotRequest {
  user_id: string;
  message: string;
  source: 'app' | 'telegram' | 'whatsapp';
  telegram_chat_id?: number;
  button_id?: string;  // NEW — set when routing from button callback
}
```

When `button_id` is present and matches a pure menu key (e.g., `menu_payments`), `process-bot-message` uses a lookup table and skips Claude. Only action buttons (e.g., `action_log_payment`) invoke Claude. This avoids unnecessary API calls and latency for menu navigation.

---

## Integration Point 3: Outbound Template Messages (OUT-01, OUT-02, OUT-03)

### Current State in `send-reminders`

`send-reminders` already sends plain text WhatsApp messages (lines 135-156 of existing code). This works during an active 24-hour conversation window but fails outside it: **Meta's WhatsApp Cloud API only allows free-form text within a 24-hour customer service window**. Outside this window, only pre-approved Template Messages work.

### Template Message Pattern (HIGH confidence — existing in codebase)

`whatsapp-send-code` demonstrates this pattern and it already works in production:
```json
{
  "type": "template",
  "template": {
    "name": "dwella_verification",
    "language": { "code": "en" },
    "components": [{ "type": "body", "parameters": [{ "type": "text", "text": "123456" }] }]
  }
}
```

Required Meta-approved templates for v1.2:

| Template Name | Trigger | Parameters |
|--------------|---------|------------|
| `dwella_rent_reminder` | send-reminders (3 days before / due day / 3 days after) | property_name, due_date, amount |
| `dwella_payment_confirmed` | auto-confirm-payments or manual confirm | tenant_name, property_name, amount, month |
| `dwella_maintenance_update` | maintenance status change | tenant_name, request_title, new_status |

**CRITICAL external dependency:** Templates must be submitted to and approved by Meta before deployment. Approval takes 2-7 days. Template submission should begin at project kick-off and run in parallel with Phase 1-3 development.

### New Edge Function: `notify-whatsapp`

Handles OUT-02 (payment confirmed) and OUT-03 (maintenance status change). Called from:
- `auto-confirm-payments` after promoting `paid` → `confirmed`
- App client after successful maintenance status update mutation

For maintenance notifications, there is currently no Edge Function that fires on status change — this happens via client-side Supabase mutation with RLS. The app calling `notify-whatsapp` directly after a successful mutation is the cleanest approach without adding pg_net DB trigger complexity.

### Shared `whatsapp-send` Edge Function

Both `send-reminders` and new `notify-whatsapp` duplicate the Meta API fetch call. Extracting a `whatsapp-send` function that wraps all outbound message types eliminates this duplication and centralizes API version management. This mirrors the existing `send-push` pattern (send-reminders calls send-push via `supabase.functions.invoke()`).

---

## Integration Point 4: New Bot Intents (INTENT-01, INTENT-02, INTENT-03)

### What Changes in `process-bot-message`

**New intent strings** to add to `ACTION_HANDLERS` and the Claude system prompt:

| Intent | Requirement | Claude entities | Handler reads |
|--------|-------------|-----------------|---------------|
| `query_maintenance_status` | INTENT-01 | `{ tenant_name?, property_name? }` | `maintenance_requests` + `maintenance_status_logs` |
| `query_upcoming_payments` | INTENT-02 | `{ days?: number }` | `payments` WHERE status pending/partial AND due_date upcoming |
| `query_property_summary` | INTENT-03 | `{ property_name? }` | `properties` + `tenants` + aggregated `payments` |

These are pure query intents — no DB writes. Each needs a new handler function in `process-bot-message` following the existing `ActionHandler` pattern.

### Context Extension for INTENT-01

`buildContext()` currently loads properties/tenants/payments. To support maintenance status queries, it needs to optionally fetch open maintenance requests. Loading them eagerly alongside existing context queries is the simplest approach at current scale (adds one DB query, Postgres handles it easily).

---

## Integration Point 5: PDF Report via Bot (RICH-03 History submenu)

The "download PDF report" menu item requires:

1. Bot presents month/year picker (button matrix for last 6 months, or asks user to type month/year)
2. Bot invokes `generate-pdf` Edge Function (already exists) with `{ user_id, month, year }`
3. `generate-pdf` returns a signed Supabase Storage URL (modification needed if it currently returns binary)
4. Bot sends document to user

**WhatsApp outbound document:**
```json
{
  "type": "document",
  "document": {
    "link": "https://your-signed-storage-url/report.pdf",
    "filename": "DwellaReport-March2026.pdf"
  }
}
```
WhatsApp accepts a `link` URL for outbound documents — no need to upload to Meta first if the Storage URL is accessible.

**Telegram outbound document:**
```
POST /sendDocument
{ "chat_id": 123, "document": "https://signed-url..." }
```
Telegram accepts publicly-accessible URLs for PDFs (up to 50MB).

**Required modification to `generate-pdf`:** Must upload the generated PDF to Supabase Storage and return a signed URL instead of (or in addition to) returning binary content.

---

## Revised Data Flow Diagram

```
INBOUND TEXT:
WhatsApp text → whatsapp-webhook → lookup user → process-bot-message → whatsapp-send(text or interactive)
Telegram text → telegram-webhook → lookup user → process-bot-message → sendTelegram(text or inline keyboard)

INBOUND BUTTON CALLBACK:
WhatsApp button → whatsapp-webhook (interactive branch) → button_id → process-bot-message(button_id) → whatsapp-send(submenu or action result)
Telegram button → telegram-webhook (callback_query branch) → answerCallbackQuery + data → process-bot-message(button_id) → sendTelegram(submenu or action result)

INBOUND MEDIA:
WhatsApp image/doc → whatsapp-webhook (200 OK immediately) → fire-and-forget whatsapp-media → download Meta CDN → upload Supabase Storage → update DB → whatsapp-send(confirmation)

OUTBOUND SCHEDULED:
send-reminders (daily 9AM) → for each tenant with whatsapp_phone → whatsapp-send(template: dwella_rent_reminder) + send-push

OUTBOUND TRIGGERED:
auto-confirm-payments → for each confirmed payment with whatsapp_phone → notify-whatsapp → whatsapp-send(template: dwella_payment_confirmed)
App (maintenance status update) → notify-whatsapp → whatsapp-send(template: dwella_maintenance_update)

OUTBOUND PDF:
Bot (user requests PDF) → process-bot-message → generate-pdf → signed URL → whatsapp-send(document) or sendTelegram(document)
```

---

## Component Boundaries

| Component | Responsibility | Communicates With |
|-----------|---------------|-------------------|
| `whatsapp-webhook` | Validate HMAC, route by message type (text/interactive/image/document), lookup user by phone | `process-bot-message`, `whatsapp-media`, `whatsapp-send` |
| `telegram-webhook` | Validate secret, route message/callback_query, lookup user by chat_id, answerCallbackQuery | `process-bot-message`, Telegram Bot API |
| `process-bot-message` | Claude intent detection, action execution, menu routing (lookup table), context building | Supabase DB, Claude API, `generate-pdf` |
| `whatsapp-media` | Download media from Meta CDN (2-step), upload to Supabase Storage, update DB row | Meta Graph API (media endpoints), Supabase Storage, Supabase DB, `whatsapp-send` |
| `whatsapp-send` | Send any outbound WhatsApp message type (text, interactive, template, document) | Meta Graph API (messages endpoint only) |
| `notify-whatsapp` | Triggered notifications for payment confirmation and maintenance events | Supabase DB (lookup phone), `whatsapp-send` |
| `send-reminders` | Scheduled rent reminders; calls `whatsapp-send` + `send-push` | Supabase DB, `whatsapp-send`, `send-push` |
| `auto-confirm-payments` | Hourly payment promotion; triggers `notify-whatsapp` for WhatsApp users | Supabase DB, `notify-whatsapp` |
| `generate-pdf` | Generate PDF and return signed URL | Supabase Storage |
| `send-push` | Existing — Expo push notifications; unchanged | Expo Push API |

---

## New Components: Detailed Specifications

### 1. `whatsapp-media` (NEW Edge Function)

**Trigger:** Called fire-and-forget by `whatsapp-webhook` when `msg.type === 'image' | 'document'`

**Inputs:**
```typescript
{
  user_id: string;
  media_id: string;
  mime_type: string;
  caption?: string;
  filename?: string;  // documents only
}
```

**Logic:**
1. GET `https://graph.facebook.com/v21.0/{media_id}` with Bearer token → resolve temporary download URL
2. GET the lookaside URL with Bearer token → binary ArrayBuffer
3. Classify intent from caption heuristic (contains "payment" keyword → payment-proof bucket, else → documents bucket)
4. For payment proof: look up tenant context from user's properties, determine month/year from caption or default to current, upload to `payment-proofs/{property_id}/{tenant_id}/{year}-{month}.ext`, update `payments.proof_url`
5. For document: upload to `documents/{property_id}/{user_id}/{timestamp}-{original_filename}`, insert row in `documents` table
6. Invoke `whatsapp-send` with a confirmation text message to the sender's phone

### 2. `whatsapp-send` (NEW Edge Function)

**Trigger:** Called by any Edge Function needing outbound WhatsApp

**Inputs:**
```typescript
{
  to: string;  // E.164 phone number
  type: 'text' | 'interactive' | 'template' | 'document';
  // one of:
  text?: { body: string };
  interactive?: object;  // full interactive message payload
  template?: { name: string; language: { code: string }; components: object[] };
  document?: { link: string; filename: string };
}
```

Eliminates the 40-line fetch block duplicated across `whatsapp-webhook`, `send-reminders`, and future functions. Single point of API version management.

### 3. `notify-whatsapp` (NEW Edge Function)

**Trigger:** Called by `auto-confirm-payments` and app client after maintenance mutations

**Inputs:**
```typescript
{
  type: 'payment_confirmed' | 'maintenance_update';
  user_id: string;
  payload: {
    // payment_confirmed fields:
    tenant_name?: string;
    property_name?: string;
    amount?: number;
    month?: number;
    year?: number;
    // maintenance_update fields:
    request_title?: string;
    new_status?: string;
  };
}
```

Logic: look up `whatsapp_phone` for `user_id`, if found call `whatsapp-send` with the appropriate template.

---

## Database Changes Required

### Migration 025: Session Tracking

No new tables needed for menu state — button IDs carry all state. One addition enables the welcome + auto-menu on new sessions:

```sql
-- Track last WhatsApp message time for session detection
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS last_whatsapp_message_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_users_last_whatsapp
  ON public.users(last_whatsapp_message_at)
  WHERE whatsapp_phone IS NOT NULL;
```

Session detection in `whatsapp-webhook`: if `last_whatsapp_message_at IS NULL OR now() - last_whatsapp_message_at > interval '24 hours'`, trigger welcome message + main menu. Update `last_whatsapp_message_at` on every message processed.

### Migration 025 or verify existing: proof_url on payments

Check whether `payments` already has a `proof_url` or `proof_storage_path` column (likely from earlier migration). If not:

```sql
ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS proof_url text;
```

---

## Build Order

Respects component dependencies — each phase only requires what the previous phase delivered.

### Phase 1: WhatsApp Media Handling (MEDIA-01, MEDIA-02)
**Depends on:** existing `whatsapp-webhook`, `payment-proofs` bucket, `documents` bucket, `whatsapp-send` helper
**Delivers:** `whatsapp-send` Edge Function; `whatsapp-media` Edge Function; media type routing in `whatsapp-webhook`; migration 025 (proof_url check)
**Why first:** Unblocks photo payment proof — highest tenant-facing utility. No menu system needed.
**Build `whatsapp-send` first** since both `whatsapp-media` and Phase 2 depend on it.

### Phase 2: Interactive Buttons + Menu System (RICH-01 through RICH-05)
**Depends on:** `whatsapp-send` from Phase 1, existing webhook functions, existing `process-bot-message`
**Delivers:** Modified `process-bot-message` with `buttons` response field and `button_id` input; modified `telegram-webhook` with callback_query routing; modified `whatsapp-webhook` with interactive routing; menu button ID scheme; session tracking migration
**Why second:** Menu system is the UX backbone for all bot features. Must be complete before testing new intents via buttons.

### Phase 3: New Bot Intents (INTENT-01, INTENT-02, INTENT-03)
**Depends on:** updated `process-bot-message` from Phase 2 (structured response format)
**Delivers:** Maintenance status, upcoming payments, property summary query handlers in `process-bot-message`; extended `buildContext()` with maintenance data
**Why third:** Pure additions to existing AI logic. No new infrastructure needed after Phase 2 response format is in place.

### Phase 4: Outbound Notifications (OUT-01, OUT-02, OUT-03)
**Depends on:** `whatsapp-send` from Phase 1; Meta template approval (external dependency — submit templates at project start)
**Delivers:** `notify-whatsapp` Edge Function; `send-reminders` updated to use template messages; `auto-confirm-payments` hooked to `notify-whatsapp`
**Why fourth:** Template approval is the long-pole. Submitting templates at project start means approval arrives during Phase 1-3 development, so Phase 4 can start without waiting.

### Phase 5: PDF Bot Delivery (RICH-03 History submenu)
**Depends on:** menu system from Phase 2; `whatsapp-send` document type; `generate-pdf` modified to return signed URL
**Delivers:** PDF month/year picker flow; `generate-pdf` modification; document delivery via WhatsApp and Telegram
**Why last:** Most complex multi-turn flow. All infrastructure is in place after Phase 4.

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Blocking the Webhook on Media Download
**What:** Awaiting the full media download inside `whatsapp-webhook` before returning 200
**Why bad:** Media downloads take 1-10 seconds. Meta expects fast acknowledgment and will retry on slow responses, causing duplicate processing.
**Instead:** Fire-and-forget to `whatsapp-media`, return 200 immediately.

### Anti-Pattern 2: Free-Form Text for Outbound Notifications After 24h Window
**What:** Sending `{ type: 'text' }` for rent reminders or payment confirmations
**Why bad:** If the user has not messaged in 24 hours, Meta rejects free-form outbound messages with error code 131047. Only pre-approved template messages work outside the session window.
**Instead:** Always use `{ type: 'template' }` for all scheduled/triggered outbound messages. Use free-form text only for replies within an active inbound-initiated session.

### Anti-Pattern 3: Duplicating the outbound fetch block across functions
**What:** Copy-pasting the 40-line `fetch('graph.facebook.com/messages', ...)` block into every function
**Why bad:** API version bumps, token handling changes, and error handling improvements must be applied in multiple places simultaneously.
**Instead:** All outbound WhatsApp goes through `whatsapp-send`. It is the single outbound channel.

### Anti-Pattern 4: Claude for every button tap
**What:** Forwarding `button_id = 'menu_main'` to Claude to determine the response
**Why bad:** Adds 500-800ms latency and Anthropic API cost for purely deterministic menu navigation.
**Instead:** Handle menu button_ids with a lookup table in `process-bot-message`. Only action button_ids (e.g., `action_log_payment`) that require AI interpretation invoke Claude.

### Anti-Pattern 5: Session state in DB for menu navigation
**What:** Storing "user is in payments submenu" in a `bot_sessions` table, read on each message
**Why bad:** Adds a DB read per message, complicates cleanup, creates stale state bugs when users abandon mid-flow.
**Instead:** Encode all state in button_id strings. Each button tap is fully self-describing. The existing `bot_conversations` table provides history context when Claude needs it.

### Anti-Pattern 6: Storing media as Base64 in DB
**What:** Base64-encoding the downloaded binary and storing in a Postgres column
**Why bad:** Massive row bloat, no streaming, no signed URL generation, defeats the purpose of Supabase Storage.
**Instead:** Always upload to Supabase Storage, store only the `storage_path` string in DB.

---

## Scalability Considerations

| Concern | At current scale | At 1K users | Notes |
|---------|-----------------|-------------|-------|
| Media download latency | Non-issue (fire-and-forget) | Non-issue | Each download is independent; async |
| WhatsApp rate limits | Not a concern | Monitor: Meta imposes per-phone-number limits | Template messages have separate daily limits |
| Button state collisions | None (stateless buttons) | None | No shared state to corrupt |
| Claude API calls per button tap | Must avoid for pure menu taps | Critical to avoid | Lookup table for menu, Claude for actions only |
| `buildContext()` query load | 3-4 queries per AI message | Add caching if needed | Current Supabase plan handles easily |
| Template approval turnaround | 2-7 days (Meta SLA) | N/A | Submit at project start, not at Phase 4 start |

---

## Sources

- WhatsApp Cloud API media reference (two-step download): [Media - WhatsApp Cloud API](https://developers.facebook.com/docs/whatsapp/cloud-api/reference/media/)
- Interactive reply buttons: [Interactive Reply Buttons - WhatsApp Cloud API](https://developers.facebook.com/docs/whatsapp/cloud-api/messages/interactive-reply-buttons-messages/)
- Button reply webhook payload structure (MEDIUM confidence, multiple implementation sources): [GitHub chatwoot issue #12030](https://github.com/chatwoot/chatwoot/issues/12030), [whatsapp-cloud-api PHP wrapper](https://github.com/netflie/whatsapp-cloud-api)
- Telegram callback_query payload: [Telegram Bot API](https://core.telegram.org/bots/api)
- Media two-step download flow (MEDIUM confidence, community): [Downloading Media via WhatsApp Cloud API - Medium](https://medium.com/@shreyas.sreedhar/downloading-media-using-whatsapps-cloud-api-webhooks-and-uploading-it-to-aws-s3-bucket-via-nodejs-07c5cbae896f)
- Template message format (HIGH confidence): existing `whatsapp-send-code/index.ts` working implementation in this codebase
- WhatsApp 24-hour messaging window constraint: [WhatsApp API Guide 2026 - Chatarmin](https://chatarmin.com/en/blog/whats-app-api-send-messages)
- `answerCallbackQuery` Telegram requirement: [Telegram Bot API - answerCallbackQuery](https://core.telegram.org/bots/api#answercallbackquery)
