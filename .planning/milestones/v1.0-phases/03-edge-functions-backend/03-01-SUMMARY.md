---
phase: 03-edge-functions-backend
plan: 01
subsystem: infra
tags: [deno, edge-functions, supabase, push-notifications, soft-delete, error-handling]

# Dependency graph
requires:
  - phase: 02-database-rls-security
    provides: soft-delete pattern (is_archived) on tenants table

provides:
  - send-push with input validation, try/catch, and correct 400/502/500 status codes
  - invite-redirect reading store URLs from env vars with hardcoded fallbacks
  - auto-confirm-payments filtering archived tenants before push dispatch
  - mark-overdue filtering archived tenants before overdue marking and push dispatch
  - send-reminders with per-tenant error isolation and safe unknown error message extraction

affects: [04-hooks-client, 05-config-launch]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Deno Edge Function error handling: try/catch wrapping entire handler, 400/502/500 status codes, Content-Type application/json on every Response
    - Soft-delete filter at query layer (select is_archived) + application layer (.filter(!is_archived)) for defense in depth
    - Per-item error isolation in cron loops: try/catch inside for loop with console.error + continue
    - Safe unknown error extraction: error instanceof Error ? error.message : String(error)

key-files:
  created: []
  modified:
    - supabase/functions/send-push/index.ts
    - supabase/functions/invite-redirect/index.ts
    - supabase/functions/auto-confirm-payments/index.ts
    - supabase/functions/mark-overdue/index.ts
    - supabase/functions/send-reminders/index.ts

key-decisions:
  - "is_archived added to tenants sub-select in auto-confirm-payments and mark-overdue queries so the field is available for application-layer filtering — without selecting it, the filter would silently pass all rows"
  - "send-push hardened with full try/catch: 400 for missing/invalid messages array, 502 for Expo API failure (res.ok check), 500 for unexpected errors in catch"
  - "invite-redirect store URLs moved to Deno.env.get('APPLE_APP_STORE_URL') and Deno.env.get('GOOGLE_PLAY_STORE_URL') with hardcoded fallbacks — avoids redeployment for URL updates"
  - "send-reminders per-tenant loop wrapped in try/catch so one tenant's payment query failure (e.g. network blip, DB error) does not abort the entire batch"

patterns-established:
  - "Content-Type: application/json on every Response constructor — no bare Response() calls"
  - "Error message extraction in Deno functions: instanceof Error guard before .message access"
  - "Cron function defense: select is_archived in joins, filter at application layer before processing or sending notifications"

requirements-completed: [EDGE-01, EDGE-02, EDGE-05]

# Metrics
duration: 4min
completed: 2026-03-19
---

# Phase 03 Plan 01: Edge Functions Hardening (Non-Bot) Summary

**5 Edge Functions hardened with input validation, correct HTTP status codes, Content-Type headers, soft-delete filtering on tenant joins, per-tenant error isolation, and env-var store URLs**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-03-19T13:48:13Z
- **Completed:** 2026-03-19T13:51:46Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- send-push fully hardened with try/catch, messages array validation (400), Expo API upstream failure (502), unexpected error (500), Content-Type on all response paths
- invite-redirect store URLs externalized to env vars with hardcoded fallbacks; missing-token error now returns JSON instead of plain text
- auto-confirm-payments and mark-overdue both select and filter is_archived on the tenants join, preventing push notifications being dispatched for archived tenants
- send-reminders wraps per-tenant loop body in try/catch so a single tenant's DB query failure cannot abort the entire daily cron batch
- send-reminders top-level error message extraction fixed: uses `instanceof Error` guard instead of direct `.message` on unknown-typed error

## Task Commits

Each task was committed atomically:

1. **Task 1: Harden send-push and invite-redirect** - `4684680` (fix)
2. **Task 2: Harden auto-confirm-payments, mark-overdue, and send-reminders** - `beedb2e` (fix)

**Plan metadata:** _(docs commit follows)_

## Files Created/Modified
- `supabase/functions/send-push/index.ts` - Full rewrite with try/catch, 3-tier status codes, input validation
- `supabase/functions/invite-redirect/index.ts` - Env-var store URLs, JSON error for missing token
- `supabase/functions/auto-confirm-payments/index.ts` - is_archived in select + activePayments filter + Content-Type on 500
- `supabase/functions/mark-overdue/index.ts` - is_archived in select + combined overduePayments filter + Content-Type on both 500s
- `supabase/functions/send-reminders/index.ts` - Per-tenant try/catch + instanceof Error guard + Content-Type on 500

## Decisions Made
- Added `is_archived` to the Supabase sub-select string in both auto-confirm-payments and mark-overdue. Without this the field would be undefined and the `.filter(!p.tenants?.is_archived)` would silently pass all rows — the select is the prerequisite for the filter to work.
- Per-tenant error isolation in send-reminders uses `continue` semantics (no explicit continue needed — loop naturally proceeds to next iteration after catch block). Logged with tenant ID for diagnosability.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Added is_archived to tenants sub-select in auto-confirm-payments and mark-overdue**
- **Found during:** Task 2 (Harden cron functions)
- **Issue:** Plan specified filtering on `!p.tenants?.is_archived` but the existing `.select()` strings did not include `is_archived` in the tenants sub-select. Filtering on an unselected field returns undefined, making the filter a silent no-op.
- **Fix:** Added `is_archived` to the tenants sub-select in both queries so the field is present in the returned data
- **Files modified:** supabase/functions/auto-confirm-payments/index.ts, supabase/functions/mark-overdue/index.ts
- **Verification:** grep confirms `is_archived` present in both select strings and both filter expressions
- **Committed in:** beedb2e (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - Bug: missing field in sub-select)
**Impact on plan:** Required fix for the soft-delete filter to actually function. No scope creep.

## Issues Encountered
None beyond the sub-select fix above.

## User Setup Required
None - no external service configuration required for this plan. The `APPLE_APP_STORE_URL` and `GOOGLE_PLAY_STORE_URL` env vars are optional — functions fall back to hardcoded URLs.

## Next Phase Readiness
- EDGE-01 partially closed: send-push, invite-redirect, auto-confirm-payments, mark-overdue, send-reminders all return correct HTTP status codes
- EDGE-02 closed: cron functions filter archived tenants; schedule timing verified in research (no code changes needed)
- EDGE-05 closed: invite-redirect reads store URLs from env vars with fallbacks
- Remaining EDGE-01 work (bot functions: telegram-webhook, process-bot-message, ai-insights, ai-draft-reminders, ai-search) handled in plan 02

## Self-Check: PASSED

All modified files exist on disk. Both task commits (4684680, beedb2e) confirmed present in git log. SUMMARY.md created at correct path.

---
*Phase: 03-edge-functions-backend*
*Completed: 2026-03-19*
