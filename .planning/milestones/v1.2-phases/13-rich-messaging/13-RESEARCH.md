# Phase 13: Rich Messaging & Menus - Research

**Researched:** 2026-03-21
**Domain:** WhatsApp Cloud API interactive buttons, Telegram inline keyboards, HTML-to-PDF via external API, Supabase Storage signed URLs, stateless button routing
**Confidence:** HIGH (for APIs and existing code patterns), MEDIUM (for HTML-to-PDF API selection)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Welcome message (RICH-01)**
- D-01: Welcome message fires immediately on account linking — right after WhatsApp verification code is accepted or Telegram `/start` token matches
- D-02: Welcome message includes the main menu buttons in the same flow — user can start navigating immediately
- D-03: Brief, functional tone: "Welcome to Dwella! I can help you manage properties, payments, and maintenance. Use the menu below or type anything."
- D-04: Identical welcome experience on both WhatsApp and Telegram (RICH-05 parity)

**Session definition (RICH-02)**
- D-05: "New session" = user hasn't messaged in 1 hour. Next message triggers the main menu before processing
- D-06: `last_bot_message_at` column added to `users` table via migration. Updated on every bot interaction
- D-07: Menu re-shows after any button action or freeform response completes, so user can continue navigating
- D-08: User can type "menu" or "help" anytime to summon the menu on demand

**Button layout (RICH-02, RICH-03)**
- D-09: WhatsApp 3-button limit: sub-options exceeding 3 are split into multiple messages with labels like "Properties (1/2)" and "Properties (2/2)"
- D-10: Telegram mirrors WhatsApp layout — same button count and split pattern for consistent cross-platform experience (RICH-05)
- D-11: Main menu (5 categories) splits into 2 messages: Message 1 has Properties, Payments, History (3 buttons); Message 2 has Maintenance, Others (2 buttons)
- D-12: Every sub-option response includes a "Main Menu" button so user can navigate back (uses 1 of the 3 button slots)

**Menu routing (locked)**
- D-13: Stateless `button_id` scheme (e.g., `menu_payments`, `action_log_payment`) — no sessions table needed
- D-14: Menu taps bypass Claude via lookup table — only freeform text routes to Claude
- D-15: Freeform text continues to work for all actions — buttons are shortcuts, not the only path (RICH-04)

**Sub-option mapping (RICH-03)**
- D-16: Properties: view, add, edit, occupancy, summary, delete (delete responds with explanatory message directing to app)
- D-17: Payments: log, confirm, upcoming, remind
- D-18: History: payments, maintenance, recent activity, download PDF report
- D-19: Maintenance: submit, status, update
- D-20: Others: upload doc, link/unlink account, help, contact landlord/tenant, chat with bot

**PDF report generation (History > download PDF)**
- D-21: HTML string sent to external HTML-to-PDF API (html2pdf.app recommended, no Deno-native library — deno-puppeteer ruled out)
- D-22: Report contains payment summary for selected month: tenant list, rent amounts, payment status, dates paid, total collected vs expected
- D-23: Two-turn button picker flow: Turn 1 = year buttons (2024, 2025, 2026), Turn 2 = month buttons (split across messages due to 3-button limit), then generate
- D-24: Generated PDF uploaded to Supabase Storage, delivered as document message via time-limited signed URL on both platforms

### Claude's Discretion
- Exact HTML template design for the PDF report
- Which external HTML-to-PDF API to use (html2pdf.app vs api2pdf vs pdfshift)
- Exact button_id naming convention (e.g., `menu_properties`, `sub_properties_view`, `action_log_payment`)
- Month button grouping strategy (e.g., Jan-Mar / Apr-Jun / Jul-Sep / Oct-Dec)
- Error messages for edge cases (no data for selected month, PDF generation failure)
- Whether `sendTelegram()` needs refactoring or just extension for `reply_markup` support

### Deferred Ideas (OUT OF SCOPE)
- WhatsApp List messages (structured lists with sections)
- Hindi/multilingual menu labels — English only for v1.2
- Menu customization per user role (landlord vs tenant menus)
- Inline payment amount entry via buttons (calculator-style)
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| RICH-01 | Bot sends warm welcome message to first-time users upon account linking | Welcome fires at linking confirmation point in whatsapp-webhook (code verification success) and telegram-webhook (/start token match); both already have the exact insertion point |
| RICH-02 | Bot presents main menu with 5 categories on each new session | Requires `last_bot_message_at` migration on users table; session check on every incoming text message before forwarding to process-bot-message |
| RICH-03 | Each main menu category expands into contextual sub-option buttons | Lookup table in process-bot-message; button_id dispatch returns structured response with buttons array; whatsapp-send `interactive` type already supports this |
| RICH-04 | Bot supports freeform text alongside button navigation | Existing freeform Claude path unchanged; button path is additive, not replacing |
| RICH-05 | Menu-driven flow works on both Telegram and WhatsApp bots | Telegram needs sendTelegram() extended with reply_markup + inline_keyboard; callback_query handling added to telegram-webhook |
</phase_requirements>

---

## Summary

Phase 13 adds interactive button menus to both the WhatsApp and Telegram bots, implements new-session detection, sends a welcome message on account linking, and delivers PDF reports via a two-turn button picker flow.

The foundational infrastructure is already in place. `whatsapp-send` already supports the `interactive` type with up to 3 buttons (lines 106-120 verified in code). The `process-bot-message` function already has action handlers that can be reused for button dispatch. The `bot_conversations.metadata` JSONB column is available for storing PDF picker state between turns. The only new infrastructure pieces are: (1) extending `sendTelegram()` with `reply_markup`, (2) adding `callback_query` handling to `telegram-webhook`, (3) adding `interactive.button_reply` routing to `whatsapp-webhook`, (4) a new migration adding `last_bot_message_at` to `users`, and (5) a new `generate-pdf` Edge Function calling an external HTML-to-PDF API.

**Primary recommendation:** Use `html2pdf.app` for PDF generation (POST `https://api.html2pdf.app/v1/generate` with `{ html, apiKey }`; response contains base64-encoded PDF). Store the PDF in Supabase Storage under `pdf-reports/{user_id}/{year}-{month}.pdf` and deliver via `createSignedUrl` with a short expiry (3600 seconds). For the two-turn picker state, encode year in the button_id itself (e.g., `pdf_month_2025`) so no server-side session state is needed.

---

## Standard Stack

### Core

| Library / API | Version / Endpoint | Purpose | Why Standard |
|---|---|---|---|
| WhatsApp Cloud API | Graph API v21.0 (already in use) | Send interactive button messages, receive button replies | Already integrated in whatsapp-send; project standard |
| Telegram Bot API | Current (no versioning) | Send inline keyboards, receive callback_query | Already integrated; standard Telegram bot pattern |
| html2pdf.app | REST API v1 | Convert HTML string to PDF via HTTP call | No Deno-native PDF library works reliably; external API is the established workaround pattern for Supabase Edge Functions |
| Supabase Storage JS SDK | @supabase/supabase-js@2 (already in use) | Store generated PDFs, create signed URLs | Already available in all Edge Functions |

### Supporting

| Library / API | Version | Purpose | When to Use |
|---|---|---|---|
| `bot_conversations.metadata` JSONB | Existing column (migration 011) | Store PDF picker turn state | Fallback if year cannot be encoded in button_id |
| Supabase `createSignedUrl` | JS SDK method | Deliver PDF with time-limited URL | PDF delivery to both platforms |

### Alternatives Considered for HTML-to-PDF

| Instead of | Could Use | Tradeoff |
|---|---|---|
| html2pdf.app | api2pdf.com | api2pdf supports base64 response too; slightly higher pricing but more feature-rich. Use if html2pdf.app free tier (50-100 conversions/month) is insufficient |
| html2pdf.app | pdfshift.io | PDFShift has generous free tier (250 conversions/month); slightly different API shape but same pattern |
| html2pdf.app | jsPDF / pdf-lib in Deno | Blocked by Deno.readFileSync restrictions in Supabase Edge Functions; not viable |
| html2pdf.app | deno-puppeteer | Ruled out in CONTEXT.md (D-21) — too heavy for Edge Functions |

**Recommendation:** html2pdf.app is the primary choice. If free tier (50-100 conversions/month) is too low for production, migrate to PDFShift (250/month free) without changing the integration pattern.

**Installation:** No npm install needed. All three are pure HTTP REST calls from Edge Functions.

---

## Architecture Patterns

### Files Modified in This Phase

```
supabase/
├── functions/
│   ├── whatsapp-webhook/index.ts    ← Add interactive.button_reply routing, last_bot_message_at update
│   ├── telegram-webhook/index.ts    ← Add callback_query handling, extend sendTelegram() with reply_markup
│   ├── process-bot-message/index.ts ← Add MENU_LOOKUP table, button_id dispatch, menu response shape
│   ├── whatsapp-send/index.ts       ← No changes needed (interactive + document already supported)
│   └── generate-pdf/index.ts        ← NEW: HTML-to-PDF via external API, upload to Storage, return signed URL
└── migrations/
    └── 016_rich_messaging.sql       ← ADD last_bot_message_at TIMESTAMPTZ to users table
```

### Pattern 1: WhatsApp Interactive Button Message (outbound)

`whatsapp-send` already handles this. The call shape is:

```typescript
// Source: supabase/functions/whatsapp-send/index.ts lines 106-120 (verified)
await fetch(WHATSAPP_SEND_URL, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${SERVICE_KEY}` },
  body: JSON.stringify({
    to: senderPhone,
    type: 'interactive',
    interactive: {
      body: 'What would you like to do?',
      buttons: [
        { id: 'menu_properties', title: 'Properties' },
        { id: 'menu_payments',   title: 'Payments' },
        { id: 'menu_history',    title: 'History' },
      ],
    },
  }),
});
```

Constraints (verified via Meta docs): maximum 3 buttons per message; button `id` max 256 chars; button `title` max 20 chars.

### Pattern 2: WhatsApp Button Reply (inbound webhook)

When a user taps a button, `whatsapp-webhook` receives a message with `type === 'interactive'`. The button selection is in `msg.interactive.button_reply`:

```typescript
// Source: Meta Cloud API docs (MEDIUM confidence — verified structure via multiple sources)
const msg = value['messages'][0];
const msgType = msg['type'] as string; // 'interactive'

if (msgType === 'interactive') {
  const interactiveType = (msg['interactive'] as any)?.['type']; // 'button_reply'
  if (interactiveType === 'button_reply') {
    const buttonId = (msg['interactive'] as any)?.['button_reply']?.['id'] as string;
    // e.g., 'menu_payments', 'sub_payments_log', 'pdf_year_2025'
  }
}
```

### Pattern 3: Telegram Inline Keyboard (outbound)

Extend `sendTelegram()` with an optional `reply_markup` parameter:

```typescript
// Source: Telegram Bot API docs (HIGH confidence)
async function sendTelegramWithButtons(
  chatId: number,
  text: string,
  buttons?: Array<Array<{ text: string; callback_data: string }>>,
) {
  const body: Record<string, unknown> = { chat_id: chatId, text, parse_mode: 'Markdown' };
  if (buttons) {
    body['reply_markup'] = { inline_keyboard: buttons };
  }
  await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

// Example: main menu message 1
await sendTelegramWithButtons(chatId, 'What would you like to do?', [
  [{ text: 'Properties', callback_data: 'menu_properties' }],
  [{ text: 'Payments',   callback_data: 'menu_payments' }],
  [{ text: 'History',    callback_data: 'menu_history' }],
]);
```

Inline keyboard buttons: each row is an array; rows are stacked vertically. `callback_data` max 64 bytes.

### Pattern 4: Telegram callback_query (inbound)

When a user taps an inline button, Telegram sends a `callback_query` update (not a `message`):

```typescript
// Source: Telegram Bot API docs (HIGH confidence)
const update = await req.json();
const callbackQuery = update['callback_query'] as Record<string, unknown> | undefined;

if (callbackQuery) {
  const chatId = (callbackQuery['message'] as any)?.['chat']?.['id'] as number;
  const buttonId = callbackQuery['data'] as string; // e.g., 'menu_payments'
  const callbackQueryId = callbackQuery['id'] as string;

  // MUST call answerCallbackQuery to dismiss the loading spinner
  await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/answerCallbackQuery`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ callback_query_id: callbackQueryId }),
  });

  // Then dispatch button_id same as WhatsApp
}
```

**Critical:** `answerCallbackQuery` MUST be called on every `callback_query` or Telegram clients show an infinite loading spinner to the user. It can be a no-op call with just the `callback_query_id`.

### Pattern 5: Stateless button_id naming convention

Encode all state in the button_id string. No server-side lookup needed for navigation:

```
menu_{category}            → show sub-options for that category
sub_{category}_{action}    → execute or explain that action
pdf_year_{YYYY}            → user picked a year in PDF picker
pdf_month_{YYYY}_{MM}      → user picked month+year in PDF picker → trigger generation
back_main                  → show main menu
```

The PDF year is encoded directly in the month button_id (`pdf_month_2025_03`), so `bot_conversations.metadata` is not required for this flow. This keeps the flow fully stateless.

### Pattern 6: process-bot-message menu lookup table

Add a `BUTTON_LOOKUP` table that maps button_id prefixes to response functions. The main serve handler checks `button_id` presence before routing to Claude:

```typescript
// Source: Architectural pattern derived from existing ACTION_HANDLERS pattern in process-bot-message
interface BotRequest {
  user_id: string;
  message: string;
  source: 'app' | 'telegram' | 'whatsapp';
  telegram_chat_id?: number;
  button_id?: string;   // NEW — present when user tapped a button
}

// Lookup returns { reply: string; buttons?: ButtonDef[][] }
type ButtonResponse = { reply: string; buttons?: Array<Array<{ id: string; title: string }>> };
type ButtonHandler = (supabase, userId) => Promise<ButtonResponse>;

const BUTTON_LOOKUP: Record<string, ButtonHandler> = {
  menu_properties: handleMenuProperties,
  menu_payments:   handleMenuPayments,
  // etc.
};
```

Webhooks pass `button_id` alongside `message` (set to the button title for logging) when a button is tapped. If `button_id` is present, `process-bot-message` dispatches to `BUTTON_LOOKUP` before touching Claude.

### Pattern 7: Multi-message menu sending

For split menus (D-09, D-11), call `sendWhatsApp()` twice in sequence:

```typescript
// Message 1 of main menu
await sendWhatsApp(phone, { type: 'interactive', interactive: {
  body: 'Choose a category (1/2):',
  buttons: [
    { id: 'menu_properties', title: 'Properties' },
    { id: 'menu_payments',   title: 'Payments' },
    { id: 'menu_history',    title: 'History' },
  ],
}});

// Message 2 of main menu
await sendWhatsApp(phone, { type: 'interactive', interactive: {
  body: 'Choose a category (2/2):',
  buttons: [
    { id: 'menu_maintenance', title: 'Maintenance' },
    { id: 'menu_others',      title: 'Others' },
  ],
}});
```

For Telegram, send two `sendMessage` calls with `inline_keyboard`. Both platforms use the same split.

### Pattern 8: HTML-to-PDF via html2pdf.app

```typescript
// Source: html2pdf.app documentation (MEDIUM confidence)
const HTML2PDF_API_KEY = Deno.env.get('HTML2PDF_API_KEY')!;

async function generatePdf(html: string): Promise<Uint8Array> {
  const res = await fetch('https://api.html2pdf.app/v1/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ html, apiKey: HTML2PDF_API_KEY }),
  });
  if (!res.ok) throw new Error(`html2pdf.app error: ${res.status}`);
  const data = await res.json() as { pdf: string }; // base64-encoded PDF
  return Uint8Array.from(atob(data.pdf), c => c.charCodeAt(0));
}
```

Upload to Supabase Storage then create signed URL:

```typescript
const path = `pdf-reports/${userId}/${year}-${String(month).padStart(2,'0')}.pdf`;
await supabase.storage.from('pdf-reports').upload(path, pdfBytes, {
  contentType: 'application/pdf',
  upsert: true,
});
const { data: signed } = await supabase.storage
  .from('pdf-reports')
  .createSignedUrl(path, 3600); // 1 hour expiry
// signed.signedUrl is the URL to deliver
```

Deliver via whatsapp-send `document` type or Telegram `sendDocument`.

### Pattern 9: Telegram sendDocument

```typescript
// Source: Telegram Bot API docs (HIGH confidence — standard method)
await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendDocument`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    chat_id: chatId,
    document: signedUrl,       // public URL Telegram fetches from
    caption: `Payment report — ${monthName} ${year}`,
  }),
});
```

For WhatsApp, use existing `document` type in whatsapp-send:

```typescript
{ to, type: 'document', document: { link: signedUrl, filename: `Dwella-${year}-${month}.pdf`, caption: 'Your payment report' } }
```

### Pattern 10: Session detection (new session = > 1 hour gap)

In both webhooks, check `last_bot_message_at` before forwarding to `process-bot-message`:

```typescript
const { data: user } = await supabase
  .from('users')
  .select('id, last_bot_message_at')
  .eq('whatsapp_phone', senderPhone)
  .single();

const isNewSession = !user.last_bot_message_at ||
  (Date.now() - new Date(user.last_bot_message_at).getTime()) > 60 * 60 * 1000;

if (isNewSession || /^(menu|help)$/i.test(text.trim())) {
  await sendMainMenu(senderPhone); // or chatId for Telegram
}

// Update last_bot_message_at on every interaction
await supabase.from('users').update({ last_bot_message_at: new Date().toISOString() }).eq('id', user.id);
```

### Anti-Patterns to Avoid

- **Calling answerCallbackQuery after already sending a reply:** Call it immediately on receipt (no-op), then send the reply. Never skip it.
- **Button title > 20 chars on WhatsApp:** Meta truncates silently — all titles must stay within 20 characters. Telegram callback_data max is 64 bytes.
- **Sending > 3 buttons in one WhatsApp message:** Meta rejects the message entirely. Always split.
- **Routing interactive button_reply through Claude:** D-14 is locked — button taps go to lookup table, not Claude. Never forward button_id messages to the Claude path.
- **Storing session state in a separate table:** D-13 is locked — use stateless button_id encoding. Do not add a sessions table.
- **Blocking on PDF generation before acknowledging WhatsApp/Telegram:** Generate PDF asynchronously after sending "Generating your report..." message, or accept that it's synchronous with a clear "please wait" UX message.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---|---|---|---|
| HTML to PDF in Deno | Custom PDF renderer, jsPDF in Edge Function | html2pdf.app REST API | Deno.readFileSync is blocklisted; jsPDF/pdfkit require filesystem access; puppeteer too heavy |
| Button state across turns | Sessions table or Redis-like store | Encode year in button_id (`pdf_month_2025_03`) | Stateless is the locked decision (D-13); avoids migration and race conditions |
| WhatsApp button message format | Custom Meta API payload builder | Existing whatsapp-send `interactive` type | Already tested and deployed; avoids duplication |

**Key insight:** The hardest part of this phase is the callback routing plumbing (two new inbound paths), not the button payloads themselves. The outbound side is already built.

---

## Common Pitfalls

### Pitfall 1: Forgetting answerCallbackQuery on Telegram

**What goes wrong:** User taps a button, loading spinner never dismisses, UI appears stuck.
**Why it happens:** Telegram requires explicit acknowledgment of every callback_query.
**How to avoid:** Call `answerCallbackQuery` immediately at the top of the `callback_query` branch before any async work. It can be a no-op (empty body except `callback_query_id`).
**Warning signs:** Users report "button doesn't work" or the bot seems slow.

### Pitfall 2: WhatsApp duplicate message delivery

**What goes wrong:** User taps a button, bot sends the response twice.
**Why it happens:** WhatsApp webhooks deliver status updates (delivery receipts, read receipts) as the same POST structure. `value.statuses` instead of `value.messages`. The existing code already guards against this (`if (!value?.['messages']`), but the interactive button reply arrives as a `messages` entry with `type === 'interactive'` — so the guard is already correct.
**How to avoid:** The existing guard handles this. Ensure the `interactive` type check happens before the "unsupported media type" fallback.
**Warning signs:** Double-responses to button taps.

### Pitfall 3: PDF base64 decode on large payloads

**What goes wrong:** Atob decode of large PDF causes memory issues in Deno Edge Function.
**Why it happens:** Deno Edge Functions have limited memory. A large base64 string passed through atob and then to Uint8Array is fine for typical one-page reports, but multi-page reports could be problematic.
**How to avoid:** Keep PDF reports to single month of data (D-22 is locked to one month). The report template should be lean HTML — no embedded images, no external fonts.
**Warning signs:** Edge Function timeout or OOM errors on PDF generation.

### Pitfall 4: Session column update on every message creating N+1 queries

**What goes wrong:** Every incoming message triggers a `SELECT` for user + `UPDATE` for `last_bot_message_at` = 2 round trips.
**Why it happens:** Session tracking requires reading the timestamp before updating it.
**How to avoid:** Combine into a single query using `returning('*')` on the update, or accept 2 queries (they're fast). Do not add debouncing logic — just always update.
**Warning signs:** None functionally, but latency could degrade at scale.

### Pitfall 5: Migration numbering conflict

**What goes wrong:** New migration `016_` already exists in the repository (016_rls_with_check.sql).
**Why it happens:** Migration numbering must be sequential and unique.
**How to avoid:** Check current highest migration number before naming the new one. As of research, migrations go up to `024_notification_maintenance_fk.sql`. Use `025_rich_messaging.sql` for the `last_bot_message_at` column addition.
**Warning signs:** `supabase db reset` fails with duplicate migration error.

### Pitfall 6: Telegram callback_query arrives as top-level update field, not under `message`

**What goes wrong:** `callback_query` is at `update.callback_query`, not `update.message`. The existing telegram-webhook code only checks `update.message` and returns early if absent.
**Why it happens:** Telegram sends different update types in the same webhook endpoint. The current code `const message = update['message']` on line 39, then `if (!message) return new Response('OK')` — this silently drops all button taps.
**How to avoid:** Check for `update.callback_query` before the early return for missing message. Handle it in a separate branch.
**Warning signs:** All Telegram button taps are silently ignored (no response to user).

---

## Code Examples

### Verified: WhatsApp button_reply incoming structure

```typescript
// Source: Meta WhatsApp Cloud API docs (MEDIUM confidence — multiple sources confirm structure)
// msg.type === 'interactive'
// msg.interactive.type === 'button_reply'
// msg.interactive.button_reply.id === the button_id you sent
// msg.interactive.button_reply.title === the button title the user tapped

const interactiveMsg = msg['interactive'] as {
  type: string;
  button_reply: { id: string; title: string };
};
const buttonId = interactiveMsg.button_reply.id;
```

### Verified: Telegram inline_keyboard outbound

```typescript
// Source: Telegram Bot API core.telegram.org (HIGH confidence)
// reply_markup must be a JSON-stringified InlineKeyboardMarkup
// inline_keyboard is an array of rows, each row is an array of InlineKeyboardButton
{
  chat_id: chatId,
  text: "Choose an option:",
  reply_markup: {
    inline_keyboard: [
      [{ text: "Properties", callback_data: "menu_properties" }],
      [{ text: "Payments",   callback_data: "menu_payments" }],
    ]
  }
}
```

### Verified: Telegram callback_query inbound

```typescript
// Source: Telegram Bot API (HIGH confidence)
// update.callback_query present when user taps inline button
// Must call answerCallbackQuery immediately
{
  callback_query: {
    id: "740038246",
    from: { id: 123456, ... },
    message: { chat: { id: 123456 }, ... },
    data: "menu_payments"   // this is callback_data you set
  }
}
```

### Verified: Supabase createSignedUrl

```typescript
// Source: Supabase JS SDK docs (HIGH confidence)
const { data, error } = await supabase.storage
  .from('pdf-reports')
  .createSignedUrl('path/to/file.pdf', 3600); // expiresIn = seconds
// data.signedUrl is the time-limited download URL
```

### Verified: Existing whatsapp-send document type call

```typescript
// Source: supabase/functions/whatsapp-send/index.ts lines 122-131 (verified in codebase)
{
  to: senderPhone,
  type: 'document',
  document: {
    link: signedUrl,
    filename: 'Dwella-Report-2025-03.pdf',
    caption: 'Your payment report for March 2025'
  }
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|---|---|---|---|
| Telegram ReplyKeyboard (persistent bottom buttons) | InlineKeyboardMarkup (inline below message) | Bot API 2.0 (2016), still current | Inline keyboards don't clutter the chat input area |
| WhatsApp template buttons (static, pre-approved) | Interactive reply buttons (dynamic, session-scoped) | Cloud API v13+ | Interactive buttons work within 24-hour session window; no template approval needed |
| PDF generation in browser (html2pdf.js) | Server-side HTML-to-PDF via REST API | Ongoing | Browser-only library; Deno/Node server-side requires external API or headless browser |

**Deprecated/outdated:**
- WhatsApp `whatsapp-send-code` Edge Function: replaced by template-type send in Phase 11; do not reference
- Telegram `reply_keyboard_markup`: use `inline_keyboard` instead for session-scoped navigation

---

## Open Questions

1. **html2pdf.app API key environment variable**
   - What we know: API requires apiKey parameter; key obtained after registration
   - What's unclear: Whether a free-tier key has been registered for this project
   - Recommendation: Plan 13-03 should include a task to obtain the API key and add `HTML2PDF_API_KEY` to Supabase Edge Function secrets. If not registered before implementation, use a mock PDF (static base64 bytes) to unblock development.

2. **Supabase Storage bucket for PDFs**
   - What we know: `payment-proofs` bucket exists; `documents` bucket created in Phase 7
   - What's unclear: Whether `pdf-reports` bucket needs to be created or if PDFs should go into the existing `documents` bucket
   - Recommendation: Create a dedicated `pdf-reports` bucket with private access. Signed URLs provide controlled access. This avoids cluttering the documents bucket with generated reports.

3. **html2pdf.app response field name**
   - What we know: Response contains base64 PDF; field is reported as `pdf` by publicapi.dev
   - What's unclear: Exact JSON field name not confirmed from official docs page (CSS-only content returned by WebFetch)
   - Recommendation: Assign LOW confidence to field name `pdf`. Implementation should log the raw response body to verify field name during first test. Fallback: check `data.pdf ?? data.base64 ?? data.content`.

4. **sendWhatsApp() signature in whatsapp-webhook**
   - What we know: Current `sendWhatsApp(to, text)` only sends text type
   - What's unclear: Whether to extend it to accept the full `WhatsAppSendRequest` body or add a separate `sendWhatsAppInteractive()` helper
   - Recommendation: Extend to `sendWhatsApp(to, payload: WhatsAppSendRequest)` accepting the full body passed through to whatsapp-send. Less duplication than a separate helper.

---

## Validation Architecture

### Test Framework

| Property | Value |
|---|---|
| Framework | None detected — Supabase Edge Functions have no automated test runner in this project |
| Config file | None |
| Quick run command | `supabase functions serve` + manual curl |
| Full suite command | Manual end-to-end test via actual WhatsApp/Telegram |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|---|---|---|---|---|
| RICH-01 | Welcome message fires on WhatsApp linking | manual-only | n/a — requires live WhatsApp session | ❌ |
| RICH-01 | Welcome message fires on Telegram /start with token | manual-only | n/a — requires live Telegram session | ❌ |
| RICH-02 | Main menu appears after 1-hour gap | manual-only | n/a — requires time elapse | ❌ |
| RICH-02 | "menu" or "help" text triggers menu | manual-only | curl simulate text message with body "menu" | ❌ |
| RICH-03 | Each category returns correct sub-option buttons | manual-only | curl simulate button_reply with each menu_* button_id | ❌ |
| RICH-04 | Freeform text still works after menus added | smoke | curl simulate freeform text to process-bot-message | ❌ |
| RICH-05 | Telegram shows identical menu layout | manual-only | Telegram client test | ❌ |

**Note:** All meaningful tests for this phase require live bot sessions or cURL simulation against a locally-served Edge Function. There is no automated test framework in this project for Edge Functions.

### Sampling Rate
- **Per task commit:** `supabase functions serve` + curl test of the specific changed function
- **Per wave merge:** Manual end-to-end smoke test: send "menu" via WhatsApp and Telegram, verify both show correct buttons
- **Phase gate:** All 5 RICH requirements manually verified before `/gsd:verify-work`

### Wave 0 Gaps

None — existing infrastructure (supabase functions serve) is sufficient for local testing. No test files to create.

---

## Sources

### Primary (HIGH confidence)
- Existing codebase: `supabase/functions/whatsapp-send/index.ts` — verified interactive and document type support
- Existing codebase: `supabase/functions/whatsapp-webhook/index.ts` — verified current message routing structure
- Existing codebase: `supabase/functions/telegram-webhook/index.ts` — verified current callback_query gap (early return on missing message)
- Existing codebase: `supabase/functions/process-bot-message/index.ts` — verified ACTION_HANDLERS pattern for reuse
- Existing codebase: `supabase/migrations/011_bot_metadata.sql` — verified metadata JSONB column exists
- Existing codebase: `supabase/migrations/024_notification_maintenance_fk.sql` — verified highest migration number is 024
- Supabase JS SDK: `createSignedUrl(path, expiresIn)` — official docs, HIGH confidence
- Telegram Bot API: `inline_keyboard`, `callback_query`, `answerCallbackQuery` — core.telegram.org, HIGH confidence

### Secondary (MEDIUM confidence)
- Meta WhatsApp Cloud API docs: `interactive.button_reply` webhook structure — multiple sources agree on field names
- html2pdf.app: `POST https://api.html2pdf.app/v1/generate` with `{ html, apiKey }`, base64 response — publicapi.dev + WebSearch cross-reference

### Tertiary (LOW confidence)
- html2pdf.app response field name (`pdf`) — not confirmed from official docs page directly; treat as hypothesis to verify at runtime

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — existing whatsapp-send and Telegram patterns are in-codebase; html2pdf.app is MEDIUM (API shape confirmed, exact field name unconfirmed)
- Architecture: HIGH — all patterns derived from existing code or official API docs
- Pitfalls: HIGH — pitfall 6 (Telegram callback_query early return) is a confirmed code issue visible in the current telegram-webhook source

**Research date:** 2026-03-21
**Valid until:** 2026-04-21 (Telegram and WhatsApp Cloud API are stable; html2pdf.app free tier pricing may change)
