---
phase: 08-maintenance-requests
verified: 2026-03-21T10:00:00Z
status: passed
score: 12/12 must-haves verified
re_verification: false
gaps: []
human_verification:
  - test: "Submit a maintenance request as a tenant with photos"
    expected: "Request appears in list immediately, landlord receives push notification"
    why_human: "Push notification delivery and Realtime list update require a live Supabase environment"
  - test: "Advance request through all status steps as landlord"
    expected: "Each step updates the timeline, tenant receives push notification at each transition"
    why_human: "Push notification delivery requires live device with valid push token"
  - test: "Mark request resolved with a cost amount"
    expected: "Expense row created in property expenses, linked to request via maintenance_request_id"
    why_human: "Requires live Supabase environment; cannot verify INSERT result without running the app"
  - test: "Close a request via the ConfirmDialog"
    expected: "ConfirmDialog appears, confirming executes the close transition and shows success toast"
    why_human: "Modal dialog interaction requires visual verification"
  - test: "Photo upload, thumbnail display, and full-screen viewer"
    expected: "Photos appear as thumbnails in detail screen, tapping opens full-screen pinch-zoom modal"
    why_human: "Requires live device camera/gallery access and Supabase Storage"
---

# Phase 8: Maintenance Requests Verification Report

**Phase Goal:** Maintenance requests feature — tenants submit requests with photos, landlords manage status lifecycle, push notifications on changes, cost tracking on resolution.
**Verified:** 2026-03-21T10:00:00Z
**Status:** passed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | maintenance_requests table exists with correct columns, constraints, and RLS policies | VERIFIED | `supabase/migrations/022_maintenance_requests.sql` — full DDL, 4 RLS policies, BEFORE UPDATE trigger, indexes |
| 2 | maintenance_status_logs table exists with correct columns and RLS policies | VERIFIED | Migration 022 — 4 RLS policies (landlord/tenant SELECT + INSERT), CASCADE FK to maintenance_requests |
| 3 | BEFORE UPDATE trigger enforces valid status transitions | VERIFIED | `validate_maintenance_transition()` function + trigger in migration 022; covers all 4 valid transitions, raises EXCEPTION on invalid |
| 4 | expenses table has nullable maintenance_request_id FK column | VERIFIED | Migration 022 `ALTER TABLE public.expenses ADD COLUMN maintenance_request_id uuid REFERENCES ... ON DELETE SET NULL` |
| 5 | maintenance-photos storage bucket exists with RLS | VERIFIED | Migration 022 — INSERT into storage.buckets + 4 storage policies (landlord ALL, tenant read/insert/delete) |
| 6 | TypeScript interfaces exist for MaintenanceRequest and MaintenanceStatusLog | VERIFIED | `lib/types.ts` lines 114-140 — both interfaces, MaintenanceStatus/Priority types, Expense.maintenance_request_id |
| 7 | Status/priority label, color, icon, and next-status helpers exist and are tested | VERIFIED | `lib/maintenance.ts` exports all 12 required symbols; `__tests__/maintenance.test.ts` covers all pure helpers |
| 8 | useMaintenanceRequests hook fetches requests filtered by propertyId and subscribes to Realtime | VERIFIED | `hooks/useMaintenanceRequests.ts` — useCallback fetch, useEffect Realtime channel `maintenance-{propertyId}`, cleanup on unmount |
| 9 | Tenant can fill out and submit a maintenance request with title, description, priority, and photos | VERIFIED | `app/maintenance/submit.tsx` — full form, INSERT flow in correct order (row → status log → photos → UPDATE paths → push) |
| 10 | Landlord receives push notification after a new request is submitted | VERIFIED | `app/maintenance/submit.tsx` line 156 — `functions.invoke('send-push')` with `maintenance_new` type after successful INSERT |
| 11 | Landlord can advance a request through all status steps via the primary action button | VERIFIED | `app/maintenance/[id].tsx` — `handleStatusChange()` updates maintenance_requests.status, ConfirmDialog gates close transition |
| 12 | Landlord can add notes, tenant gets push on status change, resolved logs cost as expense | VERIFIED | `app/maintenance/[id].tsx` — note TextInput, `maintenance_status_logs.insert` with note, `functions.invoke('send-push')` with `maintenance_status_update` type, `expenses.insert` with `maintenance_request_id` and `category: 'maintenance'` |

**Score:** 12/12 truths verified

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `supabase/migrations/022_maintenance_requests.sql` | Tables, RLS, trigger, storage bucket, expenses ALTER | VERIFIED | 246 lines — both tables, indexes, ALTER expenses, updated_at trigger, status transition trigger, RLS policies for both tables, storage bucket, 4 storage RLS policies |
| `lib/types.ts` | MaintenanceRequest and MaintenanceStatusLog interfaces | VERIFIED | Lines 114-140 — MaintenanceStatus, MaintenancePriority, MaintenanceRequest, MaintenanceStatusLog; Expense.maintenance_request_id at line 100 |
| `lib/maintenance.ts` | STATUS_LABELS, STATUS_COLORS, NEXT_STATUS, NEXT_STATUS_LABEL, PRIORITY_*, helpers | VERIFIED | All 12 exports present: STATUS_LABELS/COLORS/ICONS, NEXT_STATUS/LABEL, PRIORITY_LABELS/COLORS/ICONS, ALL_STATUSES, ALL_PRIORITIES, getMaintenancePhotoPath, getExpenseDescription |
| `constants/config.ts` | MAINTENANCE_PHOTOS_BUCKET constant | VERIFIED | Line 40: `export const MAINTENANCE_PHOTOS_BUCKET = 'maintenance-photos'` |
| `__tests__/maintenance.test.ts` | Unit tests for pure maintenance helpers | VERIFIED | 16 test cases covering all 9 behaviors listed in plan |
| `hooks/useMaintenanceRequests.ts` | Realtime-enabled hook | VERIFIED | Fetch on mount, Realtime channel subscription `maintenance-{propertyId}`, cleanup, returns { requests, isLoading, error, refresh } |
| `components/MaintenanceRequestCard.tsx` | List card with status chip, priority dot, description preview | VERIFIED | STATUS_LABELS/COLORS/ICONS + PRIORITY_COLORS imported; description with numberOfLines={2}; relative timestamp; status chip with soft background |
| `components/MaintenancePhotoUploader.tsx` | Camera + gallery picker, 5-photo limit, remove buttons | VERIFIED | launchCameraAsync, launchImageLibraryAsync, requestCameraPermissionsAsync, requestMediaLibraryPermissionsAsync, accessibilityLabel "Remove photo {n}", 5-photo limit enforced |
| `components/MaintenanceFilterBar.tsx` | Status + priority filter chips with sort toggle | VERIFIED | Two ScrollView rows, ALL_STATUSES + ALL_PRIORITIES chips, sort-variant icon, accessibilityLabel with sort order text |
| `components/MaintenanceTimeline.tsx` | Vertical activity log with icons, names, timestamps, notes, connector lines | VERIFIED | STATUS_ICONS import, from_status null check, connector View between entries, actor names via userNames lookup, note in italic |
| `app/maintenance/submit.tsx` | Tenant submit form screen | VERIFIED | Full INSERT flow: maintenance_requests → maintenance_status_logs → photo upload → UPDATE paths → send-push; priority default 'normal'; MaintenancePhotoUploader |
| `app/maintenance/index.tsx` | Standalone request list with property picker | VERIFIED | Direct supabase query, Realtime subscription, SectionList grouped by status, MaintenanceFilterBar, MaintenanceRequestCard, EmptyState, FAB for tenant role |
| `app/property/[id]/maintenance.tsx` | Contextual request list for a property | VERIFIED | useMaintenanceRequests(propertyId), SectionList, MaintenanceFilterBar, FAB for tenant role, same filter/sort UX |
| `app/maintenance/[id].tsx` | Request detail screen with status management, timeline, cost logging | VERIFIED | handleStatusChange() with status update + log insert + expense insert + send-push; MaintenanceTimeline; cost field (decimal-pad) when resolving; ConfirmDialog for close |
| `app/notifications/index.tsx` | Maintenance notification type handlers | VERIFIED | maintenance_new → 'wrench-outline' / '#14B8A6'; maintenance_status_update → 'hammer-wrench' / '#F59E0B'; both in iconForType and useIconColorForType |
| `app/(tabs)/tools/index.tsx` | Tools menu with active Maintenance card | VERIFIED | Maintenance item has `route: '/maintenance'`, no `comingSoon: true` |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `lib/maintenance.ts` | `lib/types.ts` | `import { MaintenanceStatus, MaintenancePriority }` | WIRED | Line 2: `import { MaintenancePriority, MaintenanceStatus } from './types'` |
| `hooks/useMaintenanceRequests.ts` | `lib/supabase.ts` | `supabase.channel('maintenance-{propertyId}')` | WIRED | Lines 51-64: channel creation with postgres_changes subscription and cleanup |
| `components/MaintenanceRequestCard.tsx` | `lib/maintenance.ts` | STATUS_LABELS, STATUS_COLORS, PRIORITY_COLORS imports | WIRED | Lines 7-12: named imports from `@/lib/maintenance` |
| `app/maintenance/submit.tsx` | `supabase maintenance_requests table` | `supabase.from('maintenance_requests').insert()` | WIRED | Line 77-88: INSERT row, then UPDATE photo_paths |
| `app/maintenance/submit.tsx` | `send-push Edge Function` | `supabase.functions.invoke('send-push')` | WIRED | Line 156: invoked after successful INSERT with maintenance_new type |
| `app/maintenance/index.tsx` | `hooks/useMaintenanceRequests.ts` | Direct supabase query (standalone screen uses direct query by design) | WIRED | Lines 70-87: `supabase.from('maintenance_requests').select('*')` with property filter |
| `app/maintenance/[id].tsx` | `supabase maintenance_requests table` | `supabase.from('maintenance_requests').update()` | WIRED | Line 219-222: `.update({ status: nextStatus })` |
| `app/maintenance/[id].tsx` | `supabase maintenance_status_logs table` | `supabase.from('maintenance_status_logs').insert()` | WIRED | Lines 226-232: insert with from_status, to_status, note |
| `app/maintenance/[id].tsx` | `supabase expenses table` | `supabase.from('expenses').insert()` with maintenance_request_id | WIRED | Lines 236-244: insert with category 'maintenance', getExpenseDescription, maintenance_request_id |
| `app/maintenance/[id].tsx` | `send-push Edge Function` | `supabase.functions.invoke('send-push')` | WIRED | Lines 260-270: invoked with maintenance_status_update type after status change |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| MAINT-01 | 08-01, 08-02, 08-03 | Tenant can submit a maintenance request with description, photos, and priority level | SATISFIED | `app/maintenance/submit.tsx` — title, description, priority segmented control (default 'normal'), up to 5 photos via MaintenancePhotoUploader; INSERT row → status log → upload photos |
| MAINT-02 | 08-03 | Landlord receives push notification when a new request is submitted | SATISFIED | `app/maintenance/submit.tsx` line 156 — fetches property owner_id → users.push_token → `functions.invoke('send-push')` with `maintenance_new` type |
| MAINT-03 | 08-02, 08-04 | Landlord can view, acknowledge, and update maintenance request status (full 5-step lifecycle) | SATISFIED | `app/maintenance/[id].tsx` — ACTION_LABELS maps all transitions; handleStatusChange() updates status via Supabase; ConfirmDialog gates close; NEXT_STATUS correctly terminal at 'closed' |
| MAINT-04 | 08-02, 08-04 | Landlord can add notes to a maintenance request | SATISFIED | `app/maintenance/[id].tsx` — note TextInput in landlord action area; note passed to `maintenance_status_logs.insert()` as nullable field |
| MAINT-05 | 08-04 | Tenant receives push notification when request status changes | SATISFIED | `app/maintenance/[id].tsx` lines 248-270 — fetches tenant user_id → users.push_token → `functions.invoke('send-push')` with `maintenance_status_update` type and STATUS_LABELS in body |
| MAINT-06 | 08-01, 08-04 | Completed maintenance request can log cost as a property expense | SATISFIED | `app/maintenance/[id].tsx` lines 235-244 — cost TextInput (decimal-pad, £ prefix) shown only when nextStatus === 'resolved'; `expenses.insert` with category 'maintenance', getExpenseDescription(title), maintenance_request_id FK |

All 6 requirements satisfied. No orphaned requirements detected.

---

### Anti-Patterns Found

None found. Scanned all 16 phase-created/modified files for:
- TODO/FIXME/HACK/PLACEHOLDER comments — none
- Empty return stubs (return null, return {}, return []) — none blocking goal
- Hardcoded empty data flowing to render — none; all data originates from Supabase queries
- Console.log-only handlers — none
- Forms with no submit wiring — submit.tsx wires `handleSubmit()` through the full INSERT flow

The 4 `placeholder` matches are TextInput `placeholder` prop values (hint text in form inputs) — not stubs.

---

### Human Verification Required

#### 1. Tenant Submit Flow with Push Notification

**Test:** Log in as a tenant, navigate Tools → Maintenance, tap "New Request", fill all fields and add a photo, submit.
**Expected:** Request appears in the list immediately (Realtime), landlord device receives push notification with title "New Maintenance Request".
**Why human:** Push notification delivery requires a live Supabase environment with a valid push token registered for the landlord account.

#### 2. Landlord Status Lifecycle

**Test:** Log in as a landlord, open a maintenance request, advance it through all 5 steps (Acknowledge → Start Work → Mark Resolved → Close Request), add a note at each step.
**Expected:** Each step updates the status header badge and adds a timeline entry with the actor name, note, and timestamp. Tenant receives a push notification at each transition.
**Why human:** Push notification requires live device; real-time timeline updates require active Supabase Realtime subscription.

#### 3. Cost-to-Expense Linking on Resolve

**Test:** As landlord, advance a request to "Mark Resolved", enter a cost amount (e.g., 150.00), confirm.
**Expected:** Expense appears in the property's expenses list with category "Maintenance", description "Repair: {request title}", and is linked to the maintenance request.
**Why human:** Requires live Supabase INSERT and verification that the expense table row has the correct maintenance_request_id FK.

#### 4. ConfirmDialog for Close Action

**Test:** As landlord, on an in_progress → resolved → close path, tap "Close Request".
**Expected:** ConfirmDialog appears with title "Close this request?", tapping "Close Request" in the dialog executes the transition and shows a success toast.
**Why human:** Modal dialog rendering and interaction requires visual verification on device.

#### 5. Photo Upload, Thumbnails, and Full-Screen Viewer

**Test:** Submit a request with 3 photos, then open the detail screen.
**Expected:** 3 thumbnails (80x80) in the Photos section; tapping one opens a full-screen modal with pinch-to-zoom (maximumZoomScale=3).
**Why human:** Requires live device camera/gallery access and Supabase Storage signed URLs.

---

## Gaps Summary

No gaps. All 12 must-have truths are verified across all 4 plans. All 6 MAINT requirements are satisfied with concrete implementation evidence. No stubs, orphaned artifacts, or missing key links detected.

The only items flagged are for human verification — all require a live Supabase environment or device interaction that cannot be confirmed programmatically.

---

*Verified: 2026-03-21T10:00:00Z*
*Verifier: Claude (gsd-verifier)*
