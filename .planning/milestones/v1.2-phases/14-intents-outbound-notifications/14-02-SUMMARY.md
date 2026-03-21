---
phase: 14-intents-outbound-notifications
plan: 02
subsystem: api
tags: [whatsapp, telegram, notifications, edge-functions, postgres, pg_net, templates]

# Dependency graph
requires:
  - phase: 11-setup-infrastructure
    provides: whatsapp-send Edge Function and dwella_* template definitions
  - phase: 13-rich-messaging
    provides: bot architecture with WhatsApp/Telegram dual-channel pattern
provides:
  - notify-whatsapp Edge Function for maintenance status change notifications
  - Migration 026 AFTER UPDATE trigger on maintenance_requests using pg_net
  - send-reminders upgraded to WhatsApp template + Telegram dual-channel
  - auto-confirm-payments upgraded to send dwella_payment_confirmed template + Telegram to tenant
affects:
  - phase-15-testing
  - pre-launch checklist (pg_cron schedules)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - pg_net AFTER UPDATE trigger calling Edge Function for DB-driven outbound notifications
    - WhatsApp template sends always routed through whatsapp-send Edge Function (not direct Meta API)
    - Telegram sends directly via api.telegram.org for parity with WhatsApp
    - Push fallback when neither WhatsApp nor Telegram linked

key-files:
  created:
    - supabase/functions/notify-whatsapp/index.ts
    - supabase/migrations/026_maintenance_notify_trigger.sql
  modified:
    - supabase/functions/send-reminders/index.ts
    - supabase/functions/auto-confirm-payments/index.ts

key-decisions:
  - "notify-whatsapp fetches push_token directly from users table instead of using supabase.functions.invoke with userId — send-push requires token not userId"
  - "send-reminders builds tenantMap keyed by user_id for O(1) template parameter lookup per notification"
  - "auto-confirm WhatsApp receipt goes only to tenant (not landlord) per D-07 — landlord still gets push only"
  - "DB trigger fires on AFTER UPDATE with WHEN clause guarding status change — matches existing BEFORE UPDATE trigger pattern from migration 022"

patterns-established:
  - "Template sends: all WhatsApp outbound uses whatsapp-send Edge Function as single source of truth"
  - "Dual-channel: WhatsApp + Telegram always paired; push fallback when both absent"
  - "DB row first: notifications table insert always before delivery attempts"

requirements-completed: [OUT-01, OUT-02, OUT-03]

# Metrics
duration: 12min
completed: 2026-03-21
---

# Phase 14 Plan 02: Outbound Notifications Summary

**Multi-channel outbound notification system: WhatsApp templates (dwella_rent_reminder, dwella_payment_confirmed, dwella_maintenance_update) + Telegram parity + push fallback via DB trigger and upgraded Edge Functions**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-03-21T16:10:00Z
- **Completed:** 2026-03-21T16:22:00Z
- **Tasks:** 3
- **Files modified:** 4 (2 created, 2 updated)

## Accomplishments

- Created notify-whatsapp Edge Function that sends maintenance status change notifications to both tenant and landlord via WhatsApp template + Telegram + push fallback
- Created migration 026 with AFTER UPDATE trigger on maintenance_requests using pg_net to invoke notify-whatsapp automatically on any status change
- Updated send-reminders to use dwella_rent_reminder template via whatsapp-send (Meta-compliant outside 24-hour window) and added Telegram reminder sends
- Updated auto-confirm-payments to send dwella_payment_confirmed WhatsApp template + Telegram message to tenant when payment is auto-confirmed

## Task Commits

Each task was committed atomically:

1. **Task 1: notify-whatsapp Edge Function and migration 026 trigger** - `c24b42c` (feat)
2. **Task 2: update send-reminders with WhatsApp template and Telegram** - `754ea52` (feat)
3. **Task 3: add WhatsApp and Telegram to auto-confirm-payments** - `4b43a77` (feat)

**Plan metadata:** (docs commit below)

## Files Created/Modified

- `supabase/functions/notify-whatsapp/index.ts` - New Edge Function: maintenance status change → WhatsApp template + Telegram + push fallback to both tenant and landlord
- `supabase/migrations/026_maintenance_notify_trigger.sql` - AFTER UPDATE trigger on maintenance_requests that fires pg_net call to notify-whatsapp on status change
- `supabase/functions/send-reminders/index.ts` - Replaced free-form Meta API call with dwella_rent_reminder template via whatsapp-send; added Telegram send block; extended tenant select to include monthly_rent
- `supabase/functions/auto-confirm-payments/index.ts` - Extended payment select to include month/year/amount_paid/tenant user_id; added dwella_payment_confirmed template + Telegram to tenant on auto-confirm

## Decisions Made

- notify-whatsapp fetches push_token inline from users table rather than passing userId to send-push, because send-push requires the actual token string not a userId
- send-reminders builds a tenantMap keyed by user_id to efficiently look up monthly_rent and tenant_name per notification without additional queries
- WhatsApp receipt on auto-confirm goes only to tenant per D-07; landlord continues to receive push notification only
- The AFTER UPDATE trigger uses WHEN clause guard on status change — matches the BEFORE UPDATE pattern from migration 022, avoiding double-fire on same-status updates

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed send-push call in notify-whatsapp to pass token not userId**
- **Found during:** Task 1 (notify-whatsapp implementation)
- **Issue:** Plan's `sendPushFallback` signature used `userId` but send-push Edge Function requires `token` (actual Expo push token string). The plan showed `{ userId, title, body, data }` in the messages array, but send-push reads `m.token`.
- **Fix:** Revised sendPushFallback to first query users table for push_token, then construct message with `token` field
- **Files modified:** supabase/functions/notify-whatsapp/index.ts
- **Verification:** Matches send-push interface at line 13 (`m.token`)
- **Committed in:** c24b42c (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - bug in plan's push fallback interface)
**Impact on plan:** Fix essential for push fallback to work. No scope creep.

## Issues Encountered

None beyond the push token interface mismatch corrected above.

## User Setup Required

None - no new external services. Templates were submitted in Phase 11. The notify-whatsapp function uses existing TELEGRAM_BOT_TOKEN, SUPABASE_SERVICE_ROLE_KEY, and whatsapp-send routing.

## Next Phase Readiness

- All three outbound notification paths are complete (OUT-01, OUT-02, OUT-03)
- Migration 026 needs to be applied to production: `supabase db push`
- notify-whatsapp needs to be deployed: `supabase functions deploy notify-whatsapp`
- send-reminders and auto-confirm-payments need redeployment
- Phase 14 plan 02 is the final plan in the milestone; full system ready for testing

## Self-Check: PASSED

- FOUND: supabase/functions/notify-whatsapp/index.ts
- FOUND: supabase/migrations/026_maintenance_notify_trigger.sql
- FOUND: supabase/functions/send-reminders/index.ts
- FOUND: supabase/functions/auto-confirm-payments/index.ts
- FOUND: .planning/phases/14-intents-outbound-notifications/14-02-SUMMARY.md
- FOUND: c24b42c (Task 1 commit)
- FOUND: 754ea52 (Task 2 commit)
- FOUND: 4b43a77 (Task 3 commit)

---
*Phase: 14-intents-outbound-notifications*
*Completed: 2026-03-21*
