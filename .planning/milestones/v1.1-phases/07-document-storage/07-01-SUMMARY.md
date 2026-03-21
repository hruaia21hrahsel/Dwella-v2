---
phase: 07-document-storage
plan: 01
subsystem: database
tags: [supabase, postgres, rls, storage, expo-document-picker, react-native-webview, typescript, jest]

requires:
  - phase: 05-rls-hardening
    provides: is_property_owner() SECURITY DEFINER function and per-operation RLS pattern with WITH CHECK
  - phase: 05-rls-hardening
    provides: soft-delete pattern (is_archived) established across all tables
provides:
  - Migration 019 with documents table, storage bucket, 4 DB RLS policies, 3 storage RLS policies, archive cascade trigger
  - DocumentCategory type and Document interface in lib/types.ts
  - DOCUMENTS_BUCKET constant in constants/config.ts
  - lib/documents.ts with 9 async functions + 6 pure utilities + 4 constants (MIME_ICONS, CATEGORY_ICONS, CATEGORY_LABELS, ALL_CATEGORIES)
  - expo-document-picker and react-native-webview installed
  - base64-arraybuffer installed for binary-safe upload
  - __tests__/documents.test.ts with 25 passing unit tests
  - Supabase + config mocks added to __tests__/setup.ts enabling env-free test runs
affects: [07-02, 07-03, 07-04, useDocuments hook, DocumentCard, DocumentUploader, DocumentViewer]

tech-stack:
  added:
    - expo-document-picker (file picking from device + iCloud Drive)
    - react-native-webview (PDF rendering in-app)
    - base64-arraybuffer (decode base64 to ArrayBuffer for Supabase Storage upload)
  patterns:
    - expo-file-system/legacy subpath import (required for EncodingType + cacheDirectory in expo-file-system v19)
    - Atomic delete: remove storage file first, abort if storage fails to preserve DB/storage consistency
    - Property-wide storage path: {propertyId}/property/{uuid}.{ext}; tenant-specific: {propertyId}/{tenantId}/{uuid}.{ext}

key-files:
  created:
    - supabase/migrations/019_documents.sql
    - lib/documents.ts
    - __tests__/documents.test.ts
  modified:
    - lib/types.ts (added DocumentCategory + Document interface)
    - constants/config.ts (added DOCUMENTS_BUCKET)
    - app.json (added expo-document-picker iCloud plugin)
    - __tests__/setup.ts (added supabase + config mocks)
    - package.json / package-lock.json (3 new packages)

key-decisions:
  - "Import expo-file-system/legacy (not expo-file-system) to access EncodingType + cacheDirectory — v19 moved legacy API to subpath"
  - "Storage path uses split_part(name, '/', 1) for property_id — no bucket prefix in storage.objects.name"
  - "Add supabase + config mocks to setup.ts to unblock all lib/* unit tests from .env dependency"

patterns-established:
  - "Pattern: Import expo-file-system/legacy for readAsStringAsync/cacheDirectory/EncodingType in expo-file-system v19"
  - "Pattern: Mock lib/supabase and constants/config in __tests__/setup.ts for test isolation"
  - "Pattern: Atomic delete — storage.remove() before DB delete; throw on storage error without touching DB row"

requirements-completed: [DOC-01, DOC-02, DOC-03, DOC-06, DOC-07, DOC-08]

duration: ~20min
completed: 2026-03-21
---

# Phase 7 Plan 1: Document Storage Foundation Summary

**Postgres documents table with per-operation RLS (is_property_owner SECURITY DEFINER), 10 MB Supabase Storage bucket, archive cascade trigger, Document TypeScript interface, and 9-function documents utility library with 25 passing unit tests**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-03-21T06:00:00Z
- **Completed:** 2026-03-21T06:19:17Z
- **Tasks:** 2
- **Files modified:** 9

## Accomplishments

- Migration 019 creates the documents table with all 4 DB RLS policies using `is_property_owner()` SECURITY DEFINER to prevent recursion, 3 storage RLS policies that parse the `{propertyId}/{scope}/{uuid}.ext` path via `split_part`, and a trigger that cascades is_archived when a tenant is archived/restored
- `lib/documents.ts` exports all 9 async utility functions (getDocumentStoragePath, getViewerUrl, mimeToExt, getExtFromFilename, isImageMime, formatFileSize, uploadDocument, deleteDocument, shareDocument, getSignedUrl) plus MIME_ICONS, CATEGORY_ICONS, CATEGORY_LABELS, and ALL_CATEGORIES constants
- 25 unit tests in `__tests__/documents.test.ts` all pass; supabase + config mocks added to `setup.ts` enable env-free test runs for all lib/* files going forward

## Task Commits

1. **Task 1: Migration 019, types, config, packages** - `3ff107f` (feat)
2. **Task 2: lib/documents.ts utility functions and tests** - `49e7d39` (feat)

## Files Created/Modified

- `supabase/migrations/019_documents.sql` - Documents table, storage bucket, DB + storage RLS policies, archive cascade trigger
- `lib/documents.ts` - All document utility functions and icon/label constants
- `lib/types.ts` - Added DocumentCategory type and Document interface
- `constants/config.ts` - Added DOCUMENTS_BUCKET = 'documents'
- `app.json` - Added expo-document-picker plugin with usesIcloudStorage: true
- `__tests__/documents.test.ts` - 25 unit tests for all pure utility functions
- `__tests__/setup.ts` - Added supabase + config mocks (unblocks all lib/* test files)
- `package.json` / `package-lock.json` - Added expo-document-picker, react-native-webview, base64-arraybuffer

## Decisions Made

- Import from `expo-file-system/legacy` not `expo-file-system` — v19 moved `EncodingType`, `cacheDirectory`, `readAsStringAsync`, and `downloadAsync` to the legacy subpath; the main export now has class-based `File`/`Directory`/`Paths` API
- Atomic delete order: storage file first, then DB row — if storage fails, abort without touching DB to maintain consistency (orphaned DB rows are easier to discover/clean than orphaned storage objects)
- Mock `constants/config` and `lib/supabase` in `setup.ts` rather than in each test file — DRY and prevents any future lib/* test from failing due to missing .env

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed expo-file-system/legacy import for v19 API**
- **Found during:** Task 2 (lib/documents.ts creation)
- **Issue:** `FileSystem.EncodingType` and `FileSystem.cacheDirectory` do not exist on the main `expo-file-system` export in v19 — TypeScript error TS2339 on both properties
- **Fix:** Changed import from `'expo-file-system'` to `'expo-file-system/legacy'` which exports the full legacy API including `EncodingType`, `cacheDirectory`, `readAsStringAsync`, and `downloadAsync`
- **Files modified:** lib/documents.ts
- **Verification:** `npx tsc --noEmit` exits with 0 errors
- **Committed in:** 49e7d39 (Task 2 commit)

**2. [Rule 3 - Blocking] Added supabase + config mocks to setup.ts**
- **Found during:** Task 2 (running `npx jest __tests__/documents.test.ts`)
- **Issue:** `lib/documents.ts` imports `lib/supabase` → `constants/config` → `requireEnv()` throws `Missing required environment variable: EXPO_PUBLIC_SUPABASE_URL` at import time in the test runner (no .env in CI/test context). Same pre-existing issue in payments.test.ts.
- **Fix:** Added `jest.mock('@/constants/config', ...)` and `jest.mock('@/lib/supabase', ...)` to `__tests__/setup.ts` so all tests run without environment variables
- **Files modified:** __tests__/setup.ts
- **Verification:** `npx jest __tests__/documents.test.ts --no-coverage` → 25 passed
- **Committed in:** 49e7d39 (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (both Rule 3 - blocking issues)
**Impact on plan:** Both fixes necessary to unblock TypeScript compilation and test execution. No scope creep.

## Issues Encountered

- expo-file-system v19 deprecated all legacy APIs and moved them to a `/legacy` subpath — discovered via TypeScript errors. Fixed by importing from `expo-file-system/legacy` rather than guessing new API equivalents.
- Pre-existing test isolation issue (requireEnv blocking all lib/* tests) was resolved in setup.ts as a side effect, which also unblocks payments.test.ts going forward.

## User Setup Required

None — no external service configuration required for this plan. Migration 019 must be applied to the production Supabase database before Phase 7 features ship, but that is a deployment concern, not a dev-time configuration step.

## Next Phase Readiness

- All data-layer primitives are in place for Phase 7 Plan 2 (useDocuments hook)
- Storage path structure is established: `{propertyId}/property/{uuid}.ext` for property-wide, `{propertyId}/{tenantId}/{uuid}.ext` for tenant-specific
- RLS policies enforce visibility rules — landlords see all property docs, tenants see property-wide + own tenant docs
- Icon/label constants (MIME_ICONS, CATEGORY_ICONS, CATEGORY_LABELS) are ready for DocumentCard component

---
*Phase: 07-document-storage*
*Completed: 2026-03-21*
