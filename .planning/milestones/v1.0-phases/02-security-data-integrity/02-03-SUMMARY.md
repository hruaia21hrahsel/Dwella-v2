---
phase: 02-security-data-integrity
plan: 03
subsystem: api
tags: [prompt-injection, xml-escaping, soft-delete, invite-flow, bot-context, security]

# Dependency graph
requires:
  - phase: 02-security-data-integrity
    provides: "Research identifying soft-delete gaps and prompt injection vectors"
provides:
  - "sanitizeForContext helper: XML-escapes and truncates user-controlled strings in Claude bot context"
  - "is_archived filter on both invite flow queries (getInviteDetails, acceptInvite)"
affects: [03-bot-validation, future-bot-features, invite-flow-screens]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "XML tag wrapping for user-controlled strings in LLM context (SEC-06)"
    - "is_archived=false filter on all invite token queries (DATA-01, DATA-04)"

key-files:
  created: []
  modified:
    - supabase/functions/process-bot-message/index.ts
    - lib/invite.ts

key-decisions:
  - "XML-escape only metacharacters (&, <, >) — apostrophes and accented chars preserved; wrapping in XML tags gives Claude structural boundary for user data"
  - "Truncate to 200 chars in sanitizeForContext — balances context usefulness with context stuffing prevention"
  - "is_archived filter added in select query (not separate check) — single round trip to DB, fail-closed behavior"
  - "acceptInvite selects is_archived in column list to expose it for future use, though filtering on it is the primary guard"

patterns-established:
  - "sanitizeForContext pattern: all user-controlled strings passed to LLM context must be XML-escaped and length-bounded"
  - "Invite queries must always include .eq('is_archived', false) to match soft-delete contract"

requirements-completed: [SEC-06, DATA-01, DATA-04]

# Metrics
duration: 8min
completed: 2026-03-18
---

# Phase 2 Plan 03: Prompt Injection Mitigation + Invite Soft-Delete Fix Summary

**XML-escaped, XML-tagged bot context via sanitizeForContext helper + is_archived filtering on both invite queries closes SEC-06, DATA-01, and DATA-04**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-03-18T00:00:00Z
- **Completed:** 2026-03-18T00:08:00Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Added `sanitizeForContext` helper that XML-escapes `&`, `<`, `>` and truncates to 200 chars
- All property/tenant names in `buildContext` now wrapped in XML tags (`<property_name>`, `<tenant_name>`, `<flat_no>`, `<property_address>`, `<property_city>`)
- `findTenantByName` `.ilike()` input truncated to 200 chars to prevent context stuffing via search
- `getInviteDetails` and `acceptInvite` both now filter `is_archived = false`, closing the soft-delete gap that allowed archived tenant invite tokens to be fetched or accepted

## Task Commits

Each task was committed atomically:

1. **Task 1: Add prompt injection mitigation to process-bot-message buildContext** - `538fbd5` (fix)
2. **Task 2: Add is_archived filter to invite flow and fix acceptInvite** - `5bafa97` (fix)

## Files Created/Modified
- `supabase/functions/process-bot-message/index.ts` - Added sanitizeForContext function; updated buildContext to XML-escape and XML-tag all user-controlled strings; truncated findTenantByName ilike input
- `lib/invite.ts` - Added `.eq('is_archived', false)` to getInviteDetails and acceptInvite queries

## Decisions Made
- XML-escape only the three XML metacharacters (`&`, `<`, `>`) — apostrophes, accented characters, and other unicode preserved. This keeps names readable in Claude's context while closing the injection vector.
- Use XML tag wrapping (`<property_name>...</property_name>`) rather than just escaping — gives Claude structural boundaries between user data and system instructions.
- Truncate to 200 chars in `sanitizeForContext` — sufficient for any real property/tenant name, prevents context stuffing.
- `is_archived` filter added directly to the `.eq()` chain rather than as a post-fetch guard — fail-closed: returns null/not-found if tenant is archived, no secondary check needed.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- SEC-06 (prompt injection), DATA-01 (invite soft-delete gap), and DATA-04 (invite edge cases) are fully resolved
- Bot context is now safe for user-controlled strings; XML tag structure is in place for future context improvements
- Invite flow is consistent with the soft-delete contract applied everywhere else in the codebase

---
*Phase: 02-security-data-integrity*
*Completed: 2026-03-18*
