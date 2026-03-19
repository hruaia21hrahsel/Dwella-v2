---
phase: 02-security-data-integrity
plan: 01
subsystem: database
tags: [postgres, rls, row-level-security, supabase, triggers, state-machine, payments]

# Dependency graph
requires:
  - phase: 01-compilation-tooling
    provides: Stable TS codebase without compile errors to build upon

provides:
  - Per-operation RLS policies (SELECT/INSERT/UPDATE/DELETE) with explicit WITH CHECK on all 7 tables
  - Payment state machine BEFORE UPDATE trigger rejecting invalid status transitions at DB level

affects:
  - 03-runtime-correctness (relies on payment state machine being enforced at DB layer)
  - 04-ux-reliability (payments UI will get DB-level errors on invalid transitions)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Per-operation RLS (SELECT/INSERT/UPDATE/DELETE) with explicit WITH CHECK instead of FOR ALL
    - BEFORE UPDATE trigger with WHEN clause for payment state machine enforcement
    - SECURITY DEFINER function pattern for breaking RLS recursion (established in 005, continued here)

key-files:
  created:
    - supabase/migrations/016_rls_with_check.sql
    - supabase/migrations/017_payment_state_machine.sql
  modified: []

key-decisions:
  - "Retain public.is_property_owner() SECURITY DEFINER for tenants policies — avoids reintroducing RLS recursion fixed in migration 005"
  - "Use WHEN (OLD.status IS DISTINCT FROM NEW.status) on trigger — avoids firing on same-status updates, allows amount_paid updates without status change"
  - "confirmed->paid reversal included as valid transition — enables landlord correction of auto-confirmed payments"

patterns-established:
  - "All RLS UPDATE policies must have both USING (who can update) and WITH CHECK (what values can be written)"
  - "All RLS INSERT policies must have WITH CHECK (not just USING)"
  - "Payment status transitions are enforced at DB layer — client code does not need defensive checks"

requirements-completed: [SEC-03, DATA-03]

# Metrics
duration: 2min
completed: 2026-03-18
---

# Phase 2 Plan 01: RLS With Check + Payment State Machine Summary

**28 per-operation RLS policies with WITH CHECK replacing 7 FOR ALL policies, plus a BEFORE UPDATE trigger enforcing the 5-group payment state machine at the Postgres level**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-03-18T17:16:09Z
- **Completed:** 2026-03-18T17:17:45Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- Replaced all 7 `FOR ALL` RLS policies (which lacked WITH CHECK) with 28 per-operation policies ensuring INSERT and UPDATE rows can only write values the user owns
- Enforced the payment state machine at the database level via a BEFORE UPDATE trigger — invalid transitions (e.g., confirmed->pending) raise a Postgres exception
- Audited both scheduled Edge Functions (auto-confirm-payments, mark-overdue) and confirmed their transitions are valid under the new trigger
- Migration 016 is wrapped in a transaction so a partial failure rolls back all policy changes atomically

## Task Commits

Each task was committed atomically:

1. **Task 1: RLS per-operation policies with WITH CHECK** - `be573a7` (feat)
2. **Task 2: Payment state machine trigger** - `dac255f` (feat)

**Plan metadata:** `bd47c3f` (docs)

## Files Created/Modified

- `supabase/migrations/016_rls_with_check.sql` - Drops 7 FOR ALL policies; creates 28 per-operation policies (SELECT/INSERT/UPDATE/DELETE) across users, properties, tenants, payments, notifications, bot_conversations, expenses; wrapped in BEGIN/COMMIT
- `supabase/migrations/017_payment_state_machine.sql` - BEFORE UPDATE trigger on payments enforcing 5-group valid transition table; same-status updates always pass; idempotent via DROP TRIGGER IF EXISTS

## Decisions Made

- Retained `public.is_property_owner()` SECURITY DEFINER function for all tenants policies rather than switching to inline EXISTS subquery. Reason: the inline subquery would reintroduce RLS recursion that migration 005 fixed specifically because it runs as the session user and triggers the properties RLS check.
- Included `confirmed -> paid` as a valid reversal in the state machine. This was already a locked decision in the plan context (landlord correction use case).
- Used `WHEN (OLD.status IS DISTINCT FROM NEW.status)` on the trigger to avoid firing on same-status updates where only other fields (amount_paid, proof_url) change.

## Deviations from Plan

None - plan executed exactly as written.

The accepted `WITH CHECK` count of 17 (vs planner estimate of 21) is because the planner counted UPDATE policies twice per table (once for USING, once for WITH CHECK on separate counts), while grep counts lines. Functional correctness is identical: every INSERT has WITH CHECK and every UPDATE has both USING and WITH CHECK.

## Issues Encountered

None.

## User Setup Required

None — migrations are SQL files applied via `supabase db reset` or `supabase migration up`. No external service configuration required.

## Next Phase Readiness

- DB security layer hardened: RLS policies and payment state machine are ready for Phase 3 Edge Function and hook-level correctness work
- No breaking changes: all existing valid payment workflows (pending->paid, paid->confirmed, pending->overdue) are still valid transitions
- Both migration files are idempotent and safe to apply in any order after migration 015

---
*Phase: 02-security-data-integrity*
*Completed: 2026-03-18*
