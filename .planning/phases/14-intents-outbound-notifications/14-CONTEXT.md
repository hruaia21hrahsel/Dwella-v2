# Phase 14: Intents & Outbound Notifications - Context

**Gathered:** 2026-03-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Users can ask the bot about maintenance status, upcoming payments, and property summary in natural language, and tenants and landlords receive proactive WhatsApp notifications for reminders, payment confirmations, and maintenance updates. Telegram users receive equivalent outbound notifications.

</domain>

<decisions>
## Implementation Decisions

### Intent response formatting
- **D-01:** Query responses use structured text with emoji markers AND follow-up action buttons. E.g. maintenance status shows status + history with an "Update Request" button; upcoming payments shows amounts + dates with "Log Payment" / "Send Reminder" buttons.
- **D-02:** All intent query responses re-show the main menu after the answer (consistent with Phase 13 behavior where menu appends to every response via additional_messages).
- **D-03:** Property summary intent shows occupancy + collection only: occupied/total units, this month's collection rate (collected vs expected), overdue count. One message, easy to scan.
- **D-04:** New intents are wired into existing Phase 13 sub-menu buttons — `sub_maint_status`, `sub_payments_upcoming`, and `sub_properties_summary` buttons execute actual queries instead of returning instructional text. Dual access: both button tap and freeform text trigger the same handler.

### Notification trigger mechanism
- **D-05:** Maintenance status change notifications use a Postgres AFTER UPDATE trigger on `maintenance_requests` that calls `pg_net.http_post` to invoke a `notify-whatsapp` Edge Function. Fully automatic — any status change from any source (app, bot, future admin) fires the notification.
- **D-06:** Both tenant AND landlord receive maintenance status change notifications. Same template, same content.
- **D-07:** Payment confirmation receipts (OUT-02) are sent inside the existing `auto-confirm-payments` Edge Function, right after the status update. WhatsApp template call added to the existing hourly cron. Manual confirms from the app do NOT trigger WhatsApp (only auto-confirms).

### Template fallback behavior
- **D-08:** If WhatsApp template send fails (not approved, user not linked, API error), fall back to push notification via `send-push` Edge Function. Log the WhatsApp failure for debugging. The notification DB row is always created regardless of delivery channel.
- **D-09:** Telegram users also receive outbound notifications (reminders, confirmations, maintenance updates). Telegram doesn't need templates — just plain text via `sendTelegram`. Full parity with WhatsApp.
- **D-10:** send-reminders template switch is minimal: replace the free-form `sendWhatsApp` call with a `dwella_rent_reminder` template call. Keep existing 3-day-before / on-day / 3-day-after timing unchanged. Telegram reminders are a separate addition in the same function.

### Claude's Discretion
- Exact emoji choice for structured responses
- How to handle edge cases (no maintenance requests found, no upcoming payments)
- buildContext() query structure for maintenance data
- Error message wording for failed queries
- Notification deduplication (if user has both WhatsApp + Telegram, send to both or pick one)

</decisions>

<specifics>
## Specific Ideas

- Sub-menu buttons from Phase 13 (`sub_maint_status`, `sub_payments_upcoming`, `sub_properties_summary`) currently return instructional text like "type: show my properties". Phase 14 replaces those with actual async query handlers that call the same logic as the Claude intents.
- send-reminders currently sends free-form WhatsApp text (lines 114-157 of send-reminders/index.ts). This violates Meta's 24-hour session window policy. Template switch is mandatory for compliance.
- The `notify-whatsapp` Edge Function pattern: DB trigger fires on status change, pg_net calls the function, function looks up tenant + landlord WhatsApp phones, sends template to both, falls back to push on failure.

</specifics>

<canonical_refs>
## Canonical References

### Bot intent routing
- `supabase/functions/process-bot-message/index.ts` (lines 618-709) -- ACTION_HANDLERS, buildContext(), Claude dispatch
- `supabase/functions/process-bot-message/index.ts` (handleButtonPress, handleSubAction) -- Phase 13 button dispatch, sub-menu handlers to replace

### Outbound notifications
- `supabase/functions/send-reminders/index.ts` -- Current reminder logic, WhatsApp free-form text (lines 114-157), timing logic
- `supabase/functions/auto-confirm-payments/index.ts` -- Current auto-confirm, push-only notification
- `supabase/functions/whatsapp-send/index.ts` -- Template message support (type: 'template', components array)

### Maintenance schema
- `supabase/migrations/022_maintenance_requests.sql` -- Table schema, status enum, BEFORE UPDATE trigger
- `supabase/migrations/024_notification_maintenance_fk.sql` -- Notifications FK to maintenance_requests

### Phase 11 decisions
- `.planning/phases/11-setup-infrastructure/11-CONTEXT.md` -- D-11 template names/variables, D-13 CTA button, D-14 tone

### Phase 13 menu system
- `.planning/phases/13-rich-messaging/13-CONTEXT.md` -- Button layout decisions, sub-menu structure
- `supabase/functions/telegram-webhook/index.ts` -- sendTelegram, sendTelegramDocument, sendBotResponse

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `whatsapp-send/index.ts`: Already supports `type: 'template'` with body parameters — no changes needed to the sender
- `sendTelegram()` in telegram-webhook: Accepts reply_markup for inline keyboards — can send structured responses
- `sendBotResponse()` in both webhooks: Handles multi-message responses with buttons — intent responses plug in directly
- `send-push` Edge Function: Existing push notification delivery — serves as fallback channel

### Established Patterns
- **ACTION_HANDLERS dispatch**: New intents follow the existing `Record<string, ActionHandler>` pattern
- **buildContext() nesting**: Properties → tenants → payments already nested; maintenance needs similar join
- **Edge Function structure**: All functions use `serve()`, CORS headers, service key auth — notify-whatsapp follows same pattern
- **DB trigger pattern**: `validate_maintenance_transition()` BEFORE UPDATE trigger exists; AFTER UPDATE trigger for notifications follows the same migration style

### Integration Points
- `process-bot-message/index.ts` — 3 new ACTION_HANDLERS + buildContext() extension + 3 sub-menu button replacements
- `send-reminders/index.ts` — Replace free-form WhatsApp with template call, add Telegram send
- `auto-confirm-payments/index.ts` — Add WhatsApp template + Telegram message after status update
- New `notify-whatsapp/index.ts` — Edge Function invoked by DB trigger
- New migration `026_maintenance_notify_trigger.sql` — AFTER UPDATE trigger using pg_net

</code_context>

<deferred>
## Deferred Ideas

- Manual payment confirmation triggering WhatsApp receipt (only auto-confirm sends notification in this phase)
- Notification preferences (user opts out of WhatsApp/Telegram/push per category)
- Rate limiting on outbound messages
- Notification deduplication across channels (currently sends to all linked channels)

</deferred>

---

*Phase: 14-intents-outbound-notifications*
*Context gathered: 2026-03-21*
