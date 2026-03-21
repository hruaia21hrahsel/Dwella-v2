---
phase: 11-setup-infrastructure
plan: 02
subsystem: whatsapp-messaging
tags: [whatsapp, refactor, edge-function, deep-link, profile]
dependency_graph:
  requires: [11-01]
  provides: [whatsapp-send-integration, whatsapp-deep-link]
  affects: [whatsapp-webhook, lib/bot, profile-screen]
tech_stack:
  added: []
  patterns: [edge-function-delegation, wa.me-deep-link, template-messaging]
key_files:
  created: []
  modified:
    - supabase/functions/whatsapp-webhook/index.ts
    - lib/bot.ts
    - app/(tabs)/profile/index.tsx
decisions:
  - "Webhook delegates all outbound messaging to whatsapp-send Edge Function (single source of truth)"
  - "Verification codes sent via template type through whatsapp-send instead of deprecated whatsapp-send-code"
  - "Open WhatsApp button uses wa.me deep link with stripped + prefix"
metrics:
  duration: 2m
  completed: "2026-03-21T13:48:39Z"
  tasks_completed: 2
  tasks_total: 2
  files_modified: 3
---

# Phase 11 Plan 02: Refactor WhatsApp Messaging and Add Deep Link Summary

Consolidated all outbound WhatsApp messaging through whatsapp-send Edge Function and added Open WhatsApp deep link button to profile screen.

## What Was Done

### Task 1: Refactor whatsapp-webhook and lib/bot.ts to use whatsapp-send
- **Webhook:** Removed inline Meta API calls (WHATSAPP_ACCESS_TOKEN, WHATSAPP_PHONE_NUMBER_ID env vars no longer needed). Replaced sendWhatsApp() with a version that delegates to the whatsapp-send Edge Function using service role auth.
- **lib/bot.ts:** Changed initiateWhatsAppLink() to call `/functions/v1/whatsapp-send` instead of `/functions/v1/whatsapp-send-code`. Request body now uses the template type with `dwella_verification` template name and code parameter.
- **Commit:** 9d327fd

### Task 2: Add "Open WhatsApp" button to profile screen
- Added a `contained-tonal` "Open WhatsApp" button with whatsapp icon in the linked state of the WhatsApp Bot section.
- Button opens `https://wa.me/{phone}` deep link (strips leading + from WHATSAPP_BOT_PHONE).
- Conditionally rendered only when WHATSAPP_BOT_PHONE is configured (per D-05).
- Positioned between the linked status text and the Unlink button.
- **Commit:** f5c0730

## Verification Results

- whatsapp-webhook contains `functions/v1/whatsapp-send` (3 references)
- whatsapp-webhook does NOT contain WHATSAPP_ACCESS_TOKEN or WHATSAPP_PHONE_NUMBER_ID
- whatsapp-webhook retains validateMetaSignature and normalizePhone
- lib/bot.ts calls whatsapp-send (not whatsapp-send-code)
- lib/bot.ts uses dwella_verification template with type: 'template'
- Profile screen contains "Open WhatsApp" button with wa.me deep link
- `npx tsc --noEmit` passes with zero errors

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

None - all functionality is fully wired.

## Self-Check: PASSED

- All 3 modified files exist on disk
- Both commit hashes (9d327fd, f5c0730) found in git log
