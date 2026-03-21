---
phase: 13-rich-messaging
plan: "02"
subsystem: whatsapp-bot
tags: [whatsapp, interactive-buttons, session-detection, welcome-message, migration]
dependency_graph:
  requires: [supabase/functions/whatsapp-send/index.ts, supabase/functions/process-bot-message/index.ts]
  provides: [interactive button_reply routing, session detection, welcome message on linking, multi-message menu sending]
  affects: [supabase/functions/whatsapp-webhook/index.ts, supabase/migrations/025_rich_messaging.sql]
tech_stack:
  added: []
  patterns: [multi-message menu (split into 2 messages for >3 buttons), stateless button_id routing, session detection via last_bot_message_at timestamp]
key_files:
  created:
    - supabase/migrations/025_rich_messaging.sql
  modified:
    - supabase/functions/whatsapp-webhook/index.ts
decisions:
  - "sendBotResponse() flattens button rows to flat array (WhatsApp max 3) — mirrors Telegram's multi-message pattern from Plan 01"
  - "Welcome message replaces old linking confirmation text — user gets menu immediately on account link"
  - "Session detection queries last_bot_message_at inline (no separate helper) — consistent with existing user lookup pattern in webhook"
metrics:
  duration: "2 minutes"
  completed_date: "2026-03-21"
  tasks_completed: 2
  files_modified: 2
requirements:
  - RICH-01
  - RICH-02
  - RICH-05
---

# Phase 13 Plan 02: WhatsApp Webhook Interactive Routing Summary

**One-liner:** WhatsApp webhook routes interactive button_reply to process-bot-message with button_id, detects new sessions via 1-hour gap, and sends welcome message with menu on account linking.

## What Was Built

### Migration 025_rich_messaging.sql
Added `last_bot_message_at TIMESTAMPTZ` column to the `users` table. This column tracks the timestamp of the last bot interaction and is used for session detection (1-hour gap = new session triggers menu re-display).

### WhatsApp Webhook Enhancements

**New sending helpers:**
- `sendWhatsAppInteractive(to, body, buttons)` — sends interactive button messages via whatsapp-send Edge Function
- `sendWhatsAppDocument(to, link, filename, caption)` — sends document messages via whatsapp-send (ready for PDF delivery in Plan 03)
- `sendBotResponse(phone, botData)` — handles multi-message bot responses with optional button rows, flattening to WhatsApp's flat 3-button format

**Interactive button_reply routing:**
- New block handles `msgType === 'interactive'` with `button_reply` type
- Looks up linked user by phone, updates `last_bot_message_at`, forwards to process-bot-message with `button_id` in request body
- Uses `sendBotResponse` for the reply to support menu buttons in response

**Welcome message (RICH-01):**
- `sendWelcomeMessage(phone)` sends welcome text + 2 interactive menu messages (5 categories split across 2 messages per D-11)
- Replaces old linking confirmation text — fires immediately on successful verification code acceptance
- Main menu: Properties, Payments, History (message 1) + Maintenance, Others (message 2)

**Session detection (RICH-02):**
- After finding linked user in regular text flow, queries `last_bot_message_at`
- `isNewSession = true` when column is null OR last message was > 1 hour ago
- Updates `last_bot_message_at` on every interaction
- Shows menu on new session; "menu"/"help" text shows menu and returns early (no Claude call)

**Updated regular text flow:**
- Replaced `botData.reply` extraction + plain `sendWhatsApp` with `sendBotResponse` to support rich responses with buttons

## Deviations from Plan

None — plan executed exactly as written. Both tasks (migration + routing helpers + button_reply block in Task 1; welcome message + session detection in Task 2) were committed as a single atomic commit since the file was written once to contain all changes.

## Known Stubs

None. All functionality is fully wired:
- `sendWhatsAppInteractive` → calls whatsapp-send with `type: 'interactive'`
- `sendWhatsAppDocument` → calls whatsapp-send with `type: 'document'` (not yet used until Plan 03)
- Session detection → reads/writes real `last_bot_message_at` column
- Welcome message → sends real WhatsApp messages via sendWhatsApp + sendWhatsAppInteractive

## Self-Check: PASSED

- [x] `supabase/migrations/025_rich_messaging.sql` exists with `last_bot_message_at` column
- [x] `supabase/functions/whatsapp-webhook/index.ts` contains `sendWhatsAppInteractive`, `sendWhatsAppDocument`, `sendBotResponse`, `sendWelcomeMessage`
- [x] `whatsapp-webhook/index.ts` contains `if (msgType === 'interactive')` block with `button_reply` check
- [x] `whatsapp-webhook/index.ts` contains `button_id: buttonId` in fetch body
- [x] `whatsapp-webhook/index.ts` contains `isNewSession` with 1-hour threshold
- [x] `whatsapp-webhook/index.ts` contains `/^(menu|help)$/i` check
- [x] Old "Linked! Hi" text removed — replaced with `sendWelcomeMessage(senderPhone)`
- [x] Commit 3ee1479 exists

## Commits

| Hash | Message |
|------|---------|
| 3ee1479 | feat(13-02): add interactive button routing, multi-message sending, and migration to whatsapp-webhook |
