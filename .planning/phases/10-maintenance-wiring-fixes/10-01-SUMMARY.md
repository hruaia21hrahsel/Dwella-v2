---
phase: 10-maintenance-wiring-fixes
plan: 01
subsystem: maintenance-notifications
tags: [maintenance, notifications, navigation, property-detail]
dependency_graph:
  requires: [phase-08-maintenance-requests]
  provides: [maintenance-notification-routing, property-maintenance-shortcut]
  affects: [app/notifications/index.tsx, app/(tabs)/properties/[id].tsx, lib/types.ts]
tech_stack:
  added: []
  patterns: [non-blocking-notification-insert, maintenance-fk-on-notifications]
key_files:
  created:
    - supabase/migrations/024_notification_maintenance_fk.sql
  modified:
    - lib/types.ts
    - app/maintenance/submit.tsx
    - app/maintenance/[id].tsx
    - app/notifications/index.tsx
    - app/(tabs)/properties/[id].tsx
decisions:
  - Notification INSERT is non-blocking (try/catch with console.warn) — push failure must not disrupt submit/advance flows
  - In-app notification row created regardless of push_token presence — decoupled from push delivery
  - Href cast used for dynamic route strings — consistent with existing property/documents pattern
metrics:
  duration: 8min
  completed_date: "2026-03-21T12:13:34Z"
  tasks: 2
  files: 5
---

# Phase 10 Plan 01: Maintenance Wiring Fixes Summary

## One-liner

Maintenance notification tap routing to /maintenance/{id} and teal wrench shortcut card on property detail screen.

## What Was Built

Phase 8 built the full maintenance feature but left two integration gaps. This plan closes both:

1. **Notification tap routing** — `handlePress` in the bell screen now routes `maintenance_new` and `maintenance_status_update` notifications to `/maintenance/{requestId}`. Previously, tapping these notifications did nothing.

2. **Property detail shortcut** — A teal wrench "Maintenance" shortcut card was added after the Documents card on the property detail screen, linking to `/property/{id}/maintenance`.

3. **DB migration 024** — Adds nullable `maintenance_request_id` FK column on the `notifications` table with a partial index for efficient lookups.

4. **Notification INSERT wiring** — Both `submit.tsx` (landlord notification on new request) and `[id].tsx` (tenant notification on status advance) now insert in-app notification rows with `maintenance_request_id` set, in addition to the existing push notification calls.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Migration, type update, and notification INSERT wiring | c8bdf4a | 024_notification_maintenance_fk.sql, lib/types.ts, submit.tsx, [id].tsx |
| 2 | Notification tap routing and property detail shortcut card | d5dabed | notifications/index.tsx, properties/[id].tsx |

## Deviations from Plan

None — plan executed exactly as written.

## Pre-existing Test Failures (Out of Scope)

Two tests in `__tests__/documents.test.ts` were already failing before this plan:
- `getViewerUrl › returns a Google Docs Viewer URL for Word (.doc)` — expects `docs.google.com/viewer` but implementation uses `docs.google.com/gview`
- `getViewerUrl › returns a Google Docs Viewer URL for Word (.docx)` — same issue

These are pre-existing failures unrelated to maintenance wiring. All 116 other tests pass.

## Known Stubs

None — all data paths are fully wired.

## Self-Check: PASSED

- supabase/migrations/024_notification_maintenance_fk.sql: FOUND
- lib/types.ts Notification.maintenance_request_id: FOUND
- app/maintenance/submit.tsx notifications INSERT: FOUND
- app/maintenance/[id].tsx notifications INSERT: FOUND
- app/notifications/index.tsx maintenance routing: FOUND
- app/(tabs)/properties/[id].tsx wrench-outline shortcut: FOUND
- Commit c8bdf4a: FOUND
- Commit d5dabed: FOUND
- npx tsc --noEmit: 0 errors
