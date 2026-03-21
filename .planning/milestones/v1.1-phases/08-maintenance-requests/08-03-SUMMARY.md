---
phase: 08-maintenance-requests
plan: "03"
subsystem: maintenance
tags: [maintenance, screens, tenant-flow, list, submit]
dependency_graph:
  requires: [08-01, 08-02]
  provides: [maintenance-submit-screen, maintenance-list-screens, tools-menu-wired]
  affects: [app/maintenance/submit.tsx, app/maintenance/index.tsx, app/property/[id]/maintenance.tsx, app/(tabs)/tools/index.tsx]
tech_stack:
  added: []
  patterns:
    - SectionList grouped by status (maintenance list screens)
    - Priority segmented control (submit screen)
    - Tenant role detection via tenants table query
    - Submit flow order: INSERT row → status log → upload photos → update paths → push notification
key_files:
  created:
    - app/maintenance/submit.tsx
    - app/maintenance/index.tsx
    - app/property/[id]/maintenance.tsx
  modified:
    - app/(tabs)/tools/index.tsx
decisions:
  - "Submit flow uploads photos after INSERT to avoid empty-path state when upload fails mid-way; partial failures show warning toast but do not block success"
  - "Both list screens use SectionList with ALL_STATUSES order (open→acknowledged→in_progress→resolved→closed) for consistent grouping"
  - "Standalone index.tsx uses a direct supabase query (not hook) since useMaintenanceRequests is per-property; property filter applied via query when selectedPropertyId is set"
  - "isTenant state derived via direct supabase query on mount (not tenantProperties) to handle contextual property screen accurately"
  - "Router.push uses 'as never' type cast for dynamic route strings to satisfy strict Expo Router typing without generating lint errors"
metrics:
  duration_minutes: 12
  completed_date: "2026-03-21"
  tasks_completed: 2
  files_changed: 4
---

# Phase 08 Plan 03: Maintenance Screens Summary

Tenant submission flow and both request list screens (standalone + contextual). Tools menu Maintenance card wired to navigate to /maintenance.

## What Was Built

### Task 1: Submit Screen + Tools Menu (commit: 641bae4)

**app/maintenance/submit.tsx**

Full-screen modal for tenants to submit maintenance requests. State: `title`, `description`, `priority` (default `'normal'`), `photos` (max 5 via `MaintenancePhotoUploader`), `isSubmitting`, `tenantId`.

Submit flow (in order per Research pitfall #1):
1. INSERT `maintenance_requests` row with `photo_paths: []`
2. INSERT `maintenance_status_logs` row (`from_status: null`, `to_status: 'open'`)
3. Upload photos sequentially via `expo-file-system/legacy` → `base64-arraybuffer` → Supabase Storage
4. UPDATE `photo_paths` if any uploaded successfully
5. Invoke `send-push` Edge Function to notify landlord

Error handling: submit failure → error toast; partial photo failure → info toast (request still saved). Push notification failure is silently caught to not block success.

Priority segmented control: three equal-width `TouchableOpacity` segments, 48px height, `borderRadius 10`, active segment = `colors.primary` fill.

**app/(tabs)/tools/index.tsx**

Removed `comingSoon: true` from Maintenance item, added `route: '/maintenance'`.

### Task 2: List Screens (commit: 980b7ae)

**app/maintenance/index.tsx** (standalone, tools menu entry point)

- Property picker (horizontal chips, visible when user has multiple properties)
- `MaintenanceFilterBar` with status/priority filter + sort toggle
- `SectionList` grouped by status (Open → Acknowledged → In Progress → Resolved → Closed), each section's items filtered by status/priority selection and ordered by sortOrder
- FAB (`wrench-plus-outline`, "New Request") visible to tenant role only
- Empty states: tenant (no requests) → subtitle + "Submit Request" action; landlord → subtitle only; filtered no results → "No matching requests"
- Data: direct `supabase.from('maintenance_requests')` query with Realtime subscription (used instead of hook because hook is per-property; null propertyId would be ambiguous)

**app/property/[id]/maintenance.tsx** (contextual, property detail entry point)

- Uses `useMaintenanceRequests(propertyId)` hook from Plan 02
- Same filter/sort state and SectionList grouping as standalone
- No property picker (already scoped to one property via route param)
- Same FAB and empty state logic
- Tenant role derived via direct supabase query on mount (`tenants.maybeSingle()`)

## Verification

- `npx tsc --noEmit`: 0 errors (both tasks)
- `npx jest --no-coverage`: 70/72 tests pass. 2 pre-existing failures in `__tests__/documents.test.ts` (`getViewerUrl` for `.doc/.docx`) — unrelated to this plan, were failing before this plan executed

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — all data flows are wired. Requests are loaded from the `maintenance_requests` table. Photos are uploaded to Supabase Storage. Push notifications are sent via the existing `send-push` Edge Function.

## Self-Check: PASSED

Files verified:
- `app/maintenance/submit.tsx` — exists, contains `from('maintenance_requests')`, `from('maintenance_status_logs')`, `functions.invoke('send-push'`, `getMaintenancePhotoPath`, `MaintenancePhotoUploader`, `priority` state defaulting to `'normal'`
- `app/maintenance/index.tsx` — exists, contains `from('maintenance_requests')`, `MaintenanceFilterBar`, `MaintenanceRequestCard`, `EmptyState` with `icon="wrench-outline"`, property picker
- `app/property/[id]/maintenance.tsx` — exists, contains `useMaintenanceRequests(propertyId`, `MaintenanceFilterBar`, `SectionList`
- `app/(tabs)/tools/index.tsx` — Maintenance item has `route: '/maintenance'`, no `comingSoon: true`

Commits verified:
- `641bae4` — feat(08-03): add maintenance submit screen and wire tools menu
- `980b7ae` — feat(08-03): add standalone and contextual maintenance list screens
