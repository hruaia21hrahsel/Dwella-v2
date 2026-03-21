# Phase 13: Rich Messaging & Menus - Context

**Gathered:** 2026-03-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Both WhatsApp and Telegram bots present interactive button menus, users can navigate all bot features via buttons or freeform text, new users receive a welcome message on account linking, and landlords can download a PDF payment report by picking month and year through a guided button flow.

</domain>

<decisions>
## Implementation Decisions

### Welcome message (RICH-01)
- **D-01:** Welcome message fires immediately on account linking — right after WhatsApp verification code is accepted or Telegram `/start` token matches
- **D-02:** Welcome message includes the main menu buttons in the same flow — user can start navigating immediately
- **D-03:** Brief, functional tone: "Welcome to Dwella! I can help you manage properties, payments, and maintenance. Use the menu below or type anything."
- **D-04:** Identical welcome experience on both WhatsApp and Telegram (RICH-05 parity)

### Session definition (RICH-02)
- **D-05:** "New session" = user hasn't messaged in 1 hour. Next message triggers the main menu before processing
- **D-06:** `last_bot_message_at` column added to `users` table via migration. Updated on every bot interaction
- **D-07:** Menu re-shows after any button action or freeform response completes, so user can continue navigating
- **D-08:** User can type "menu" or "help" anytime to summon the menu on demand

### Button layout (RICH-02, RICH-03)
- **D-09:** WhatsApp 3-button limit: sub-options exceeding 3 are split into multiple messages with labels like "Properties (1/2)" and "Properties (2/2)"
- **D-10:** Telegram mirrors WhatsApp layout — same button count and split pattern for consistent cross-platform experience (RICH-05)
- **D-11:** Main menu (5 categories) splits into 2 messages: Message 1 has Properties, Payments, History (3 buttons); Message 2 has Maintenance, Others (2 buttons)
- **D-12:** Every sub-option response includes a "Main Menu" button so user can navigate back (uses 1 of the 3 button slots)

### Menu routing (prior decisions, locked)
- **D-13:** Stateless `button_id` scheme (e.g., `menu_payments`, `action_log_payment`) — no sessions table needed
- **D-14:** Menu taps bypass Claude via lookup table — only freeform text routes to Claude
- **D-15:** Freeform text continues to work for all actions — buttons are shortcuts, not the only path (RICH-04)

### Sub-option mapping (RICH-03)
- **D-16:** Properties: view, add, edit, occupancy, summary, delete (delete responds with explanatory message directing to app)
- **D-17:** Payments: log, confirm, upcoming, remind
- **D-18:** History: payments, maintenance, recent activity, download PDF report
- **D-19:** Maintenance: submit, status, update
- **D-20:** Others: upload doc, link/unlink account, help, contact landlord/tenant, chat with bot

### PDF report generation (History > download PDF)
- **D-21:** HTML string sent to external HTML-to-PDF API (e.g., html2pdf.app, PDFShift). No Deno-native PDF library — deno-puppeteer ruled out
- **D-22:** Report contains payment summary only for selected month: tenant list, rent amounts, payment status, dates paid, total collected vs expected
- **D-23:** Two-turn button picker flow: Turn 1 = year buttons (2024, 2025, 2026), Turn 2 = month buttons (split across messages due to 3-button limit), then generate
- **D-24:** Generated PDF uploaded to Supabase Storage, delivered as document message via time-limited signed URL on both platforms

### Claude's Discretion
- Exact HTML template design for the PDF report
- Which external HTML-to-PDF API to use (research phase should evaluate options)
- Exact button_id naming convention (e.g., `menu_properties`, `sub_properties_view`, `action_log_payment`)
- Month button grouping strategy (e.g., Jan-Mar / Apr-Jun / Jul-Sep / Oct-Dec or Jan-Apr / May-Aug / Sep-Dec)
- Error messages for edge cases (no data for selected month, PDF generation failure)
- Whether `sendTelegram()` needs refactoring or just extension for `reply_markup` support

</decisions>

<specifics>
## Specific Ideas

- Buttons are shortcuts, not gates — every action must remain accessible via freeform text typed to Claude
- The "Main Menu" back button takes 1 of the 3 WhatsApp button slots, so sub-options effectively get 2 action buttons per message plus the back button
- PDF month/year picker is a stateful two-turn flow — the year selection must be remembered for the month turn. Use `bot_conversations.metadata` JSONB or inline button_id encoding (e.g., `pdf_month_2026_03`)
- Properties > delete should NOT delete — it sends an explanatory message directing the user to the app for destructive actions

</specifics>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Bot infrastructure (modify these files)
- `supabase/functions/telegram-webhook/index.ts` — Add `callback_query` handling and `reply_markup` (inline_keyboard) to `sendTelegram()`
- `supabase/functions/whatsapp-webhook/index.ts` — Add `interactive.button_reply` routing for incoming button taps
- `supabase/functions/process-bot-message/index.ts` — Add menu lookup table, button_id dispatch, keep freeform text routing to Claude
- `supabase/functions/whatsapp-send/index.ts` — Already supports `interactive` type with buttons (lines 106-120), `document` type (lines 122-131)

### PDF generation (new or modify)
- `supabase/functions/generate-pdf/` — May need creation or modification for HTML-to-PDF via external API
- `supabase/functions/whatsapp-send/index.ts` — Document delivery via signed URL

### Database
- `supabase/migrations/015_whatsapp.sql` — Current WhatsApp schema (whatsapp_phone, whatsapp_verify_code)
- `supabase/migrations/011_bot_metadata.sql` — `bot_conversations.metadata` JSONB column (usable for PDF picker state)

### Prior phase context
- `.planning/phases/11-setup-infrastructure/11-CONTEXT.md` — whatsapp-send design decisions, template submission, linking flow
- `.planning/ROADMAP.md` — Phase 13 success criteria, plan breakdown (13-01, 13-02, 13-03)
- `.planning/REQUIREMENTS.md` — RICH-01 through RICH-05 requirement definitions
- `.planning/STATE.md` — Prior decisions on stateless button_id scheme, menu bypass, two code paths

### Profile integration (welcome trigger point)
- `app/(tabs)/profile/index.tsx` — WhatsApp linking confirmation (realtime subscription), Telegram linking via deep link

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `whatsapp-send` interactive type: Already converts `{ body, buttons: [{id, title}] }` to Meta API format — ready for menu buttons
- `process-bot-message` intent/action system: Lookup table can reuse existing action handlers (`handleLogPayment`, `handleConfirmPayment`, etc.)
- `bot_conversations.metadata` JSONB: Available for storing PDF picker state (year selection) between turns
- `whatsapp-webhook sendWhatsApp()` helper: Already wraps `whatsapp-send` fetch — can send multiple messages for split menus

### Established Patterns
- Edge Functions: `serve()` from Deno std, `createClient()` from Supabase JS, env vars via `Deno.env.get()`
- Bot message flow: webhook → lookup user → dispatch → send reply
- Stateless design: No session table, state encoded in button_ids or metadata JSONB
- Cross-platform parity: Same features on both Telegram and WhatsApp (RICH-05)

### Integration Points
- Welcome message hooks into existing linking confirmation in both `whatsapp-webhook` (code verification) and `telegram-webhook` (`/start` token match)
- Menu lookup table lives in `process-bot-message` — both webhooks already delegate to it via `fetch(PROCESS_BOT_URL)`
- PDF delivery uses existing `whatsapp-send` document type and Telegram `sendDocument` API
- `last_bot_message_at` migration adds column to `users` table — both webhooks update it on each interaction

</code_context>

<deferred>
## Deferred Ideas

- WhatsApp List messages (structured lists with sections) — explicitly out of scope per REQUIREMENTS.md
- Hindi/multilingual menu labels — English only for v1.2
- Menu customization per user role (landlord vs tenant menus) — could be a v2 enhancement
- Inline payment amount entry via buttons (calculator-style) — freeform text sufficient for v1.2

</deferred>

---

*Phase: 13-rich-messaging*
*Context gathered: 2026-03-21*
