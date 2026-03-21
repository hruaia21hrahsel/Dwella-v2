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
  added: [expo-image-picker]
  patterns:
    - Two-entry-point navigation (tools menu + property detail shortcut) for feature access
    - Tri-state upload scope: null (property-wide) vs tenantId (tenant-specific)
    - Landlord/tenant role determination via property.owner_id === user.id comparison
    - SECURITY DEFINER functions for storage RLS to avoid cross-table RLS chain blocking

key-files:
  created:
    - app/documents/_layout.tsx
    - app/documents/index.tsx
    - app/property/[id]/documents.tsx
    - supabase/migrations/020_fix_storage_rls.sql
    - supabase/migrations/021_fix_storage_rls_definer.sql
  modified:
    - app/(tabs)/tools/index.tsx
    - app/(tabs)/properties/[id].tsx
    - components/DocumentUploader.tsx
    - components/CategoryFilterBar.tsx
    - lib/documents.ts

key-decisions:
  - "Used as Href cast for /property/[id]/documents route to satisfy Expo Router type system"
  - "FAB label changes based on role: landlord sees Upload Document, tenant sees Upload to My Tenancy"
  - "Switched upload from base64 ArrayBuffer to fetch blob for React Native compatibility"
  - "Split storage FOR ALL policy into per-operation SECURITY DEFINER policies to fix RLS chain blocking"
  - "Added gallery upload via expo-image-picker alongside file browser"
  - "Added scope picker in uploader for landlords to choose property vs tenant upload target"

requirements-completed: [DOC-01, DOC-02, DOC-03, DOC-04, DOC-05, DOC-06, DOC-07, DOC-08]

# Metrics
duration: 45min
completed: 2026-03-21
---

# Phase 07 Plan 04: Document Screen Integration Summary

**Standalone and property-contextual document screens wired with upload/view/delete flows, tools menu activated, human-verified**

## Performance

- **Duration:** ~45 min (including human verification and iterative fixes)
- **Tasks:** 2/2 complete (Task 2: human verification — approved)
- **Files created:** 5
- **Files modified:** 5

## Accomplishments

- Created standalone documents screen with property picker, category filter, upload/view/delete
- Created property-contextual documents screen with same features (property ID from route)
- Activated Documents card in tools menu
- Added Documents shortcut card to property detail screen
- Human verification completed — all flows tested and approved

## Post-Verification Fixes (from user testing)

1. **Property picker not visible**: `selectedPropertyId` initialized before async load — fixed with `useEffect`
2. **Gallery upload**: Added "From Gallery" button via `expo-image-picker` alongside "Browse Files"
3. **Layout**: Moved property picker and category filter inside ScrollView to prevent taking 75% of screen
4. **Storage upload failing**: Base64 ArrayBuffer caused `StorageApiError` — switched to fetch blob
5. **Storage RLS 403**: `FOR ALL` policy + inline EXISTS blocked by cross-table RLS — fixed with `SECURITY DEFINER` helper functions (migrations 020 + 021)
6. **Property documents screen layout**: Same fix — category filter moved inside scroll
7. **Upload scope**: Added "Upload for" picker so landlords can upload to specific tenants
8. **Delete not refreshing**: Added `refresh()` call after successful delete

## Self-Check: PASSED
