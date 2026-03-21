---
phase: 07-document-storage
plan: 04
subsystem: ui
tags: [react-native, expo-router, documents, supabase-storage, document-management]

# Dependency graph
requires:
  - phase: 07-01
    provides: database migration, storage bucket, RLS policies, lib/documents.ts
  - phase: 07-02
    provides: useDocuments hook (property/tenant tri-state filtering)
  - phase: 07-03
    provides: DocumentCard, DocumentUploader, DocumentViewer, CategoryFilterBar components

provides:
  - Standalone documents screen accessible from tools menu (app/documents/index.tsx)
  - Property-contextual documents screen accessible from property detail (app/property/[id]/documents.tsx)
  - Stack layout for documents route (app/documents/_layout.tsx)
  - Tools menu Documents card activated (route: /documents, comingSoon removed)
  - Property detail Documents shortcut card (navigates to /property/[id]/documents)

affects: [phase-08-maintenance, phase-09-reporting]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Two-entry-point navigation (tools menu + property detail shortcut) for feature access
    - Tri-state upload scope: null (property-wide) vs tenantId (tenant-specific)
    - Landlord/tenant role determination via property.owner_id === user.id comparison
    - Inline IIFE pattern for conditionally rendered tenant doc sections in JSX

key-files:
  created:
    - app/documents/_layout.tsx
    - app/documents/index.tsx
    - app/property/[id]/documents.tsx
  modified:
    - app/(tabs)/tools/index.tsx
    - app/(tabs)/properties/[id].tsx

key-decisions:
  - "Used as Href cast for /property/[id]/documents route to satisfy Expo Router type system before type regeneration"
  - "FAB label changes based on role: landlord sees Upload Document, tenant sees Upload to My Tenancy"
  - "Property picker in standalone screen: horizontal ScrollView chips, defaults to first property"

patterns-established:
  - "Documents entry point: tools menu pushes /documents (standalone); property detail pushes /property/[id]/documents (contextual)"
  - "Delete flow: ConfirmDialog with confirmColor=colors.error, loading=isDeleting state, toast on success/failure"

requirements-completed: [DOC-01, DOC-02, DOC-03, DOC-04, DOC-05, DOC-06, DOC-07, DOC-08]

# Metrics
duration: 3min
completed: 2026-03-21
---

# Phase 07 Plan 04: Document Screen Integration Summary

**Standalone and property-contextual document screens wired with upload/view/delete flows, tools menu activated, property detail shortcut added**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-21T06:27:08Z
- **Completed:** 2026-03-21T06:30:25Z
- **Tasks:** 1 of 2 complete (Task 2 is human verification checkpoint)
- **Files modified:** 5

## Accomplishments

- Created standalone documents screen (app/documents/index.tsx) with property picker, category filter, property docs + tenant docs sections, FAB upload, view/delete flows, ConfirmDialog
- Created property-contextual documents screen (app/property/[id]/documents.tsx) with same feature set, no property picker (ID from route params)
- Activated Documents card in tools menu (removed comingSoon, added route: '/documents')
- Added Documents shortcut card to property detail screen navigating to /property/[id]/documents
- TypeScript compiles with 0 errors

## Task Commits

1. **Task 1: Create standalone and property-contextual documents screens, wire tools menu** - `e4e58f6` (feat)

## Files Created/Modified

- `app/documents/_layout.tsx` - Stack layout with headerShown: false
- `app/documents/index.tsx` - Standalone documents screen with property picker, category filter, dual sections (property docs + tenant docs/my docs), FAB, upload/view/delete modals
- `app/property/[id]/documents.tsx` - Property-contextual documents screen, propertyId from useLocalSearchParams, Stack.Screen header with back button
- `app/(tabs)/tools/index.tsx` - Changed Documents entry from comingSoon: true to route: '/documents'
- `app/(tabs)/properties/[id].tsx` - Added Documents shortcut card navigating to /property/[id]/documents

## Decisions Made

- Used `as Href` cast on the `/property/${id}/documents` route push to satisfy Expo Router type system (new file not yet type-generated at compile time)
- FAB label is context-sensitive: landlord shows "Upload Document", tenant shows "Upload to My Tenancy"
- Standalone screen property picker: horizontal chip ScrollView, defaulting to first property in allProperties array (ownedProperties first, then tenantProperties)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

TypeScript gave one error for the new `/property/${id}/documents` route push because Expo Router's generated route types hadn't yet picked up the new file. Fixed with `as Href` cast, same pattern as tools/index.tsx uses for all routes. Zero errors after fix.

## Known Stubs

None. All data flows are wired: documents from `useDocuments` hook, tenants from `useTenants`, properties from `useProperties`, upload via `DocumentUploader`, view via `DocumentViewer`, delete via `deleteDocument` from `lib/documents`.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Document management fully wired and navigable from two entry points
- Awaiting human verification checkpoint (Task 2) before marking plan complete
- All DOC-01 through DOC-08 requirements implemented and ready for testing

---
*Phase: 07-document-storage*
*Completed: 2026-03-21*
