---
phase: 08-maintenance-requests
plan: 01
subsystem: database
tags: [supabase, postgres, rls, migrations, typescript, jest, expo-crypto]

# Dependency graph
requires:
  - phase: 07-document-storage
    provides: "is_property_owner helper, set_updated_at trigger, storage bucket RLS patterns, lib/documents.ts path helper patterns"
provides:
  - "migration 022 with maintenance_requests + maintenance_status_logs tables"
  - "BEFORE UPDATE trigger enforcing open->acknowledged->in_progress->resolved->closed transitions"
  - "maintenance-photos storage bucket with per-role RLS"
  - "MaintenanceRequest and MaintenanceStatusLog TypeScript interfaces"
  - "Expense interface updated with maintenance_request_id FK"
  - "lib/maintenance.ts helpers: STATUS_LABELS/COLORS/ICONS, NEXT_STATUS/LABEL, PRIORITY_LABELS/COLORS/ICONS, getMaintenancePhotoPath, getExpenseDescription"
  - "MAINTENANCE_PHOTOS_BUCKET constant"
affects: [08-02, 08-03, 08-04, 09-reporting-dashboards]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "BEFORE UPDATE trigger pattern for status machine enforcement (mirrors migration 017)"
    - "Partial<Record<Status, Status>> for terminal-state-safe transition maps"
    - "TDD: failing test commit → implementation commit"

key-files:
  created:
    - supabase/migrations/022_maintenance_requests.sql
    - lib/maintenance.ts
    - __tests__/maintenance.test.ts
  modified:
    - lib/types.ts
    - constants/config.ts
    - __tests__/setup.ts

key-decisions:
  - "Reuse is_property_owner SECURITY DEFINER helper (from migration 005) in maintenance RLS to avoid infinite recursion"
  - "maintenance-photos path structure: {property_id}/{request_id}/{uuid}.{ext} — matches documents bucket pattern for consistency"
  - "NEXT_STATUS typed as Partial<Record<MaintenanceStatus, MaintenanceStatus>> so closed has no entry (terminal state)"
  - "STATUS_COLORS['closed'] is teal (#0D9488) to visually differentiate from resolved (#10B981 green)"

patterns-established:
  - "Status machine trigger: same pattern as validate_payment_transition in migration 017"
  - "Storage RLS: split_part(name, '/', N) extracts path segments for property/request ownership checks"

requirements-completed: [MAINT-01, MAINT-03, MAINT-04, MAINT-06]

# Metrics
duration: 8min
completed: 2026-03-21
---

# Phase 8 Plan 01: Maintenance Requests DB Foundation and Helpers Summary

**Postgres migration with maintenance state machine trigger, per-operation RLS, maintenance-photos bucket, TypeScript interfaces, and pure helper module with 16 passing unit tests**

## Performance

- **Duration:** 8 min
- **Started:** 2026-03-21T08:39:00Z
- **Completed:** 2026-03-21T08:47:21Z
- **Tasks:** 1
- **Files modified:** 6

## Accomplishments

- Migration 022 creates both tables, indexes, updated_at trigger, status transition trigger, RLS for both tables, storage bucket, and storage RLS policies
- lib/maintenance.ts exports all required constants and helpers; mirrors lib/expenses.ts pattern
- All 16 unit tests green; `npx tsc --noEmit` produces zero errors

## Task Commits

1. **TDD RED — failing tests** - `9b5ba5a` (test)
2. **Implementation (GREEN) — migration, types, helpers, config** - `0e468c3` (feat)

## Files Created/Modified

- `supabase/migrations/022_maintenance_requests.sql` — Full DDL: two tables, indexes, ALTER expenses, two triggers, RLS on both tables, maintenance-photos bucket, four storage RLS policies
- `lib/maintenance.ts` — Status/priority label/color/icon maps, transition maps, ALL_STATUSES/ALL_PRIORITIES arrays, getMaintenancePhotoPath, getExpenseDescription
- `lib/types.ts` — Added MaintenanceStatus, MaintenancePriority, MaintenanceRequest, MaintenanceStatusLog; added maintenance_request_id to Expense
- `constants/config.ts` — Added MAINTENANCE_PHOTOS_BUCKET constant
- `__tests__/maintenance.test.ts` — 16 unit tests covering all pure helpers
- `__tests__/setup.ts` — Added MAINTENANCE_PHOTOS_BUCKET to constants/config mock

## Decisions Made

- NEXT_STATUS typed as `Partial<Record<…>>` rather than a full record — `closed` has no entry, which allows callers to gate the "advance" button on `status in NEXT_STATUS`
- STATUS_COLORS for `closed` is teal (`#0D9488`) to distinguish it visually from `resolved` green (`#10B981`)
- Storage RLS policies for maintenance-photos use path segment 2 (`split_part(name, '/', 2)`) as the request_id, consistent with how the tenant and landlord ownership is verified
- setup.ts mock extended with MAINTENANCE_PHOTOS_BUCKET so tests importing config don't need env vars

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None — no external service configuration required. Migration must be applied to production Supabase via `supabase db push` before phase 08-02 screens are live.

## Next Phase Readiness

- All types, helpers, and DB contracts are available for 08-02 (hooks), 08-03 (screens), 08-04 (status updates)
- `MAINTENANCE_PHOTOS_BUCKET` constant ready for use in hooks and screens
- `NEXT_STATUS` and `NEXT_STATUS_LABEL` maps ready for action-button logic
- Migration 022 must be applied before hooks attempt real DB calls

---
*Phase: 08-maintenance-requests*
*Completed: 2026-03-21*
