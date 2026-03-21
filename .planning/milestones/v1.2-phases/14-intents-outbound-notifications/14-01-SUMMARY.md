---
phase: 14-intents-outbound-notifications
plan: 01
subsystem: api
tags: [supabase-edge-functions, claude-api, whatsapp, telegram, maintenance, payments, properties]

# Dependency graph
requires:
  - phase: 13-rich-messaging
    provides: handleButtonPress, buildMainMenu, handleSubAction, ACTION_HANDLERS, buildContext infrastructure
provides:
  - handleQueryMaintenanceStatus ActionHandler with emoji-formatted status and history
  - handleQueryUpcomingPayments ActionHandler with amounts and due dates
  - handleQueryPropertySummary ActionHandler with occupancy and collection rate
  - Three ACTION_HANDLERS entries for Claude freeform dispatch
  - buildContext extended with active maintenance requests
  - handleButtonPress intercept for sub_maint_status, sub_payments_upcoming, sub_properties_summary
affects: [14-02-outbound-notifications, process-bot-message]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Query handler pattern: ActionHandler signature used for read-only queries, not just mutations"
    - "Button intercept before fallback: specific button IDs checked inside startsWith block before generic handleSubAction"
    - "D-04 pattern: sub-menu buttons execute real DB queries and return results + action buttons + main menu"

key-files:
  created: []
  modified:
    - supabase/functions/process-bot-message/index.ts

key-decisions:
  - "Query handlers registered in ACTION_HANDLERS so Claude freeform dispatch and button dispatch share the same implementation"
  - "Sub-menu button intercept placed inside startsWith('sub_') block — specific before generic — avoids restructuring handleSubAction"
  - "All three query responses append main menu (buildMainMenu()) per D-02 for re-navigation"
  - "Stale instructional text removed from handleSubAction for the three rewired buttons — no dead code left"

patterns-established:
  - "ActionHandler for queries: same signature as mutation handlers, no entities needed (_entities param ignored)"
  - "D-04 intercept pattern: check specific button IDs inside sub_ prefix block before fallback to handleSubAction"

requirements-completed:
  - INTENT-01
  - INTENT-02
  - INTENT-03

# Metrics
duration: 5min
completed: 2026-03-21
---

# Phase 14 Plan 01: Intents & Sub-menu Rewire Summary

**Three query intent handlers (maintenance status, upcoming payments, property summary) added to process-bot-message with real DB queries callable via Claude freeform dispatch and direct button intercept**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-03-21T16:00:00Z
- **Completed:** 2026-03-21T16:03:59Z
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments

- Added handleQueryMaintenanceStatus: fetches active maintenance requests for landlord (by property) and tenant (by tenant_id), formats with status emoji and status log history
- Added handleQueryUpcomingPayments: collects all tenant IDs (owned properties + own tenancy rows), returns pending/partial/overdue payments with amounts remaining
- Added handleQueryPropertySummary: dual-role — landlord sees per-property occupancy + collection rate + overdue count; tenant sees their own current payment status
- Registered all three in ACTION_HANDLERS for Claude freeform dispatch
- Extended buildContext() with active maintenance requests (open/acknowledged/in progress, filtered to user-relevant entries)
- Updated Claude system prompt to list the three new query intents with descriptions
- Rewired sub_maint_status, sub_payments_upcoming, sub_properties_summary in handleButtonPress to call real handlers instead of returning instructional text
- Each button response includes action buttons (Submit/Update for maintenance; Log/Remind for payments; View for summary) plus main menu re-navigation

## Task Commits

1. **Task 1: Add three query ACTION_HANDLERS and extend buildContext** - `8e5709b` (feat)
2. **Task 2: Rewire sub-menu buttons to execute real DB queries** - `cb27d76` (feat)

## Files Created/Modified

- `supabase/functions/process-bot-message/index.ts` - Three new ActionHandler functions, ACTION_HANDLERS extended, buildContext maintenance block, system prompt updated, handleButtonPress intercept block, handleSubAction cleaned

## Decisions Made

- Query handlers use ActionHandler signature (same as mutation handlers) — consistent interface, no special-casing in dispatch code
- Sub-menu intercept placed inside `if (buttonId.startsWith('sub_'))` block with specific ID check first — avoids restructuring while still intercepting before handleSubAction
- Stale instructional text for the three rewired buttons removed from handleSubAction to avoid dead code

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required. Deploy `supabase functions deploy process-bot-message` to activate.

## Next Phase Readiness

- Three new query intents are callable via both Claude freeform text and sub-menu button taps
- Phase 14 Plan 02 (outbound notifications) can proceed independently — it targets whatsapp-webhook and send-reminders functions, not process-bot-message
- Deployment of process-bot-message activates all three intents on both Telegram and WhatsApp

---
*Phase: 14-intents-outbound-notifications*
*Completed: 2026-03-21*
