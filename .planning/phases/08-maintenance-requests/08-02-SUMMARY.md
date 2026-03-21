---
phase: 08-maintenance-requests
plan: 02
subsystem: ui
tags: [react-native, expo-image-picker, supabase-realtime, maintenance-requests]

# Dependency graph
requires:
  - phase: 08-01
    provides: lib/maintenance.ts helpers, lib/types.ts MaintenanceRequest/MaintenanceStatusLog interfaces, DB migration

provides:
  - hooks/useMaintenanceRequests.ts — Realtime-enabled data hook for maintenance_requests table
  - components/MaintenanceRequestCard.tsx — List item card with status chip, priority dot, description preview
  - components/MaintenancePhotoUploader.tsx — Camera + gallery photo picker with 5-photo limit
  - components/MaintenanceFilterBar.tsx — Status + priority filter chips with sort toggle
  - components/MaintenanceTimeline.tsx — Vertical activity log with status icons, connector lines, notes

affects:
  - 08-03 (tenant submit screen consumes hook + uploader + card)
  - 08-04 (landlord management screen consumes hook + card + filter bar + timeline)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - useExpenses.ts hook pattern (useState + useCallback fetch + useEffect Realtime channel cleanup)
    - STATUS_COLORS[status] + '1F' for 12%-opacity icon backgrounds (matching Document pattern)
    - relativeTime() local helper duplicated from notifications/index.tsx
    - Realtime channel name: `maintenance-{propertyId}`

key-files:
  created:
    - hooks/useMaintenanceRequests.ts
    - components/MaintenanceRequestCard.tsx
    - components/MaintenancePhotoUploader.tsx
    - components/MaintenanceFilterBar.tsx
    - components/MaintenanceTimeline.tsx
  modified: []

key-decisions:
  - "relativeTime helper duplicated in card and timeline (not extracted to lib) — consistent with existing pattern in notifications/index.tsx; extraction deferred"
  - "PhotoAsset interface defined locally in MaintenancePhotoUploader — not added to lib/types.ts since it is UI-only (ImagePicker asset shape)"
  - "FilterBar uses two ScrollView rows instead of one combined row — allows independent horizontal scroll for each dimension"

patterns-established:
  - "Maintenance status icon container: 40x40 (card) / 36x36 (timeline), borderRadius 10/18, backgroundColor STATUS_COLORS[status]+'1F'"
  - "Sort toggle accessibilityLabel pattern: 'Sort requests, currently Newest first / Oldest first'"
  - "Timeline connector: 2px View between icon circles, flex: 1, minHeight 16, backgroundColor colors.divider"

requirements-completed: [MAINT-01, MAINT-03, MAINT-04]

# Metrics
duration: 2min
completed: 2026-03-21
---

# Phase 08 Plan 02: Data Hook and UI Components Summary

**Realtime maintenance_requests hook + 4 reusable UI components (card, photo uploader, filter bar, timeline) ready for screen integration**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-03-21T08:49:57Z
- **Completed:** 2026-03-21T08:52:00Z
- **Tasks:** 2
- **Files modified:** 5 (all created)

## Accomplishments

- useMaintenanceRequests hook follows useExpenses.ts pattern exactly: useCallback fetch, two useEffects (mount + Realtime), cleanup on unmount
- MaintenanceRequestCard renders all D-09 required fields: title, description preview (numberOfLines 2), colored status chip, priority dot + label, relative timestamp
- MaintenancePhotoUploader offers camera capture and gallery selection with 5-photo limit, remove buttons with accessibilityLabel, permission requests before launch
- MaintenanceFilterBar delivers two filter rows (status + priority) plus sort-variant icon toggle with accessibility label
- MaintenanceTimeline renders vertical log with connector lines between entries, from_status null check for "submitted" text vs "changed status" text, note support

## Task Commits

1. **Task 1: useMaintenanceRequests hook + MaintenanceRequestCard** - `acf1354` (feat)
2. **Task 2: MaintenancePhotoUploader, MaintenanceFilterBar, MaintenanceTimeline** - `488690b` (feat)

## Files Created/Modified

- `hooks/useMaintenanceRequests.ts` - Realtime hook: fetches maintenance_requests by propertyId, is_archived=false filter, Realtime channel subscription
- `components/MaintenanceRequestCard.tsx` - List card: status icon container, title, description preview, status chip, priority dot+label, relative timestamp
- `components/MaintenancePhotoUploader.tsx` - Camera + gallery picker: permission gates, 5-photo limit, thumbnail strip with remove buttons
- `components/MaintenanceFilterBar.tsx` - Two-row filter: status chips + priority chips, sort toggle with accessibilityLabel
- `components/MaintenanceTimeline.tsx` - Vertical activity log: status icons, connector lines, actor names, timestamps, notes, from_status null check

## Decisions Made

- relativeTime helper duplicated locally in card and timeline rather than extracted to a shared util — consistent with existing codebase pattern (notifications/index.tsx has its own copy).
- PhotoAsset interface defined within MaintenancePhotoUploader.tsx rather than added to lib/types.ts — it is a UI-only shape (ImagePicker result) not a DB entity.
- FilterBar row layout: two separate ScrollView rows rather than combined — allows independent horizontal scrolling for status and priority dimensions.

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- All 5 building blocks ready for screen-level consumption in plans 03 and 04.
- Plan 03 (tenant submit screen) can import `useMaintenanceRequests`, `MaintenancePhotoUploader`, `MaintenanceRequestCard` immediately.
- Plan 04 (landlord management screen) can import `useMaintenanceRequests`, `MaintenanceRequestCard`, `MaintenanceFilterBar`, `MaintenanceTimeline` immediately.

---
*Phase: 08-maintenance-requests*
*Completed: 2026-03-21*

## Self-Check: PASSED

- FOUND: hooks/useMaintenanceRequests.ts
- FOUND: components/MaintenanceRequestCard.tsx
- FOUND: components/MaintenancePhotoUploader.tsx
- FOUND: components/MaintenanceFilterBar.tsx
- FOUND: components/MaintenanceTimeline.tsx
- FOUND: commit acf1354 (Task 1)
- FOUND: commit 488690b (Task 2)
