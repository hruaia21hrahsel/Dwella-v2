---
phase: 08-maintenance-requests
plan: 04
subsystem: ui
tags: [react-native, supabase-realtime, maintenance-requests, push-notifications, expense-tracking]

# Dependency graph
requires:
  - phase: 08-maintenance-requests
    plan: 01
    provides: "maintenance_requests table, maintenance_status_logs table, expenses.maintenance_request_id column, lib/maintenance.ts helpers"
  - phase: 08-maintenance-requests
    plan: 02
    provides: "MaintenanceTimeline component, MaintenanceStatusLog type"
provides:
  - "app/maintenance/[id].tsx — detail screen with status management, timeline, cost logging"
  - "Updated app/notifications/index.tsx — maintenance notification type handling"
affects:
  - "expenses table (inserts via resolve flow)"
  - "maintenance_status_logs table (inserts on every status change)"
  - "send-push Edge Function (invoked on status change)"

# Tech stack
tech_stack:
  added: []
  patterns:
    - "Realtime channels per-resource (request + logs separate channels)"
    - "Photo viewer via full-screen Modal + ScrollView with maximumZoomScale"
    - "ConfirmDialog for destructive terminal-state action (close)"
    - "NEXT_STATUS Partial<Record> gates action button visibility"

# Key files
key_files:
  created:
    - path: app/maintenance/[id].tsx
      purpose: "Request detail screen — info, photos, timeline, landlord status management"
  modified:
    - path: app/notifications/index.tsx
      change: "Added maintenance_new and maintenance_status_update cases to iconForType and useIconColorForType"

# Decisions
decisions:
  - "Photo viewer uses a local Modal + ScrollView (maximumZoomScale=3) rather than reusing DocumentViewer — DocumentViewer is coupled to the Document type and share/download flows; maintenance photos only need view + pinch-zoom"
  - "Close action shows ConfirmDialog (destructive pattern per UI-SPEC); all other status advances execute immediately"
  - "Push notification error is silently swallowed — failure to notify should not block the status update itself"

# Metrics
metrics:
  duration_minutes: 8
  completed_date: "2026-03-21"
  tasks_completed: 2
  files_changed: 2
---

# Phase 08 Plan 04: Maintenance Request Detail Screen and Notification Integration Summary

**One-liner:** Landlord-facing status management screen with full activity timeline, cost-to-expense linking on resolve, tenant push notification on every transition, and maintenance notification type icons wired into the notifications screen.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create request detail screen with status management, timeline, cost logging, and notifications | 2171dfd | app/maintenance/[id].tsx |
| 2 | Update notifications screen for maintenance notification types | e09bb5a | app/notifications/index.tsx |

## What Was Built

### Task 1 — app/maintenance/[id].tsx

The request detail screen covers the full landlord management workflow and tenant view:

- **Request info section:** Title (in header), description, priority chip (colored pill), tenant name, relative timestamp.
- **Photos section:** Signed URLs fetched via `supabase.storage.from(MAINTENANCE_PHOTOS_BUCKET).createSignedUrl()`, displayed as 80x80 thumbnails in a horizontal ScrollView. Tap opens a full-screen modal with pinch-to-zoom (maximumZoomScale=3).
- **Activity timeline section:** `MaintenanceTimeline` component receives `logs` and `userNames` fetched from the `users` table.
- **Landlord action area** (isLandlord && status !== 'closed'):
  - Notes TextInput (optional)
  - Cost field (decimal-pad keyboard, £ prefix) — only visible when advancing to `resolved`
  - Primary action button with labels: "Acknowledge Request", "Start Work", "Mark Resolved", "Close Request"
  - `Close Request` triggers `ConfirmDialog` first (destructive pattern)
- **Status change handler** (MAINT-03 through MAINT-06):
  1. `maintenance_requests.update({ status: nextStatus })`
  2. `maintenance_status_logs.insert(...)` with optional note
  3. If resolving with cost entered: `expenses.insert({ category: 'maintenance', description: getExpenseDescription(title), maintenance_request_id: request.id })`
  4. Fetch tenant's `push_token` and invoke `send-push` Edge Function
- **Realtime:** Two channels — one on `maintenance_requests` (filtered by id), one on `maintenance_status_logs` (filtered by request_id). Both cleaned up on unmount.

### Task 2 — app/notifications/index.tsx

Added two new cases in both switch functions:

- `iconForType`: `maintenance_new` → `wrench-outline`, `maintenance_status_update` → `hammer-wrench`
- `useIconColorForType`: `maintenance_new` → `#14B8A6` (teal), `maintenance_status_update` → `#F59E0B` (amber)

## Deviations from Plan

### Auto-fixed Issues

None.

The DocumentViewer component was referenced in the plan spec as a reuse candidate for photo viewing, but DocumentViewer is tightly coupled to the `Document` type and includes share/download functionality not relevant to maintenance photos. A local full-screen Modal with ScrollView was used instead — this is a valid deviation per the spirit of the plan (viewing photos) without adding Document dependencies to the maintenance flow. The plan notes "use the existing DocumentViewer component passing the signed URL and mimeType 'image/jpeg'" — however DocumentViewer's API requires a full `Document` object, not a signed URL. Building a lightweight local modal avoids a forced API mismatch.

**Impact:** Functionally equivalent (full-screen image view with pinch-zoom). No schema or type changes. Deviation tracked here for verifier awareness.

## Known Stubs

None. All data is wired to real Supabase queries. No placeholder or hardcoded values flow to the UI.

## Self-Check: PASSED

- [x] `app/maintenance/[id].tsx` exists
- [x] `app/notifications/index.tsx` updated
- [x] Commit 2171dfd exists (feat(08-04): create maintenance request detail screen...)
- [x] Commit e09bb5a exists (feat(08-04): add maintenance notification types...)
- [x] `npx tsc --noEmit` exits 0
- [x] All acceptance criteria verified via grep
