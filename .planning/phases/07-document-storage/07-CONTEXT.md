# Phase 7: Document Storage - Context

**Gathered:** 2026-03-20
**Status:** Ready for planning

<domain>
## Phase Boundary

Landlords and tenants can upload, view, download, and delete documents scoped to properties or individual tenancies, with correct visibility and atomic deletes. Covers migration 019, storage bucket, RLS policies, and full UI (upload/view/download/delete). Requirements: DOC-01 through DOC-08.

</domain>

<decisions>
## Implementation Decisions

### Document Organization
- Categorized folders: Lease, ID, Insurance, Receipts, Other
- Property documents section at top, tenant-specific documents section below (separate sections, not mixed)
- Two entry points: property detail screen (contextual) AND tools menu card (standalone with property picker)
- Landlord sees all sections; tenant sees property-wide docs + their own tenant docs only

### Upload Experience
- One file at a time (matches existing ProofUploader pattern)
- User names the document after picking file (pre-fill with original filename as default)
- Supported file types: PDF, images (JPEG/PNG), Word documents (.doc/.docx)
- 10 MB per file size limit
- Upload progress indication (Claude's discretion on exact implementation)

### Viewing & Sharing
- Full-screen modal overlay for document preview
- PDFs render in WebView (react-native-webview, already decided in STATE.md)
- Word documents render via Google Docs Viewer in WebView
- Images render inline with zoom/pan capability
- Close button at top, share button at bottom
- Native share sheet via expo-sharing (single button: download to temp + open OS share sheet)

### Visibility & Permissions
- Tenants CAN upload documents to their own tenancy (DOC-03)
- Tenants can only upload to their own tenant record, NOT property-wide (property-wide is landlord-only)
- Property-wide documents visible to all tenants in that property (DOC-06)
- Tenant-specific documents visible only to that tenant and the landlord (DOC-07)
- Only the uploader can delete their own documents (clean ownership model via RLS)
- Atomic delete: storage file + DB row removed together (DOC-08)

### Archive Behavior
- When a tenant is archived (soft-deleted), their documents are also soft-deleted (is_archived = TRUE on document rows)
- Documents can be restored if tenant is un-archived
- Document queries must filter `WHERE is_archived = FALSE` (consistent with existing soft-delete pattern)

### Claude's Discretion
- Upload progress UI implementation (progress bar vs spinner)
- Exact modal/overlay styling and animations
- Loading skeleton design for document lists
- Error state handling for failed uploads/downloads
- Google Docs Viewer fallback if signed URL approach has issues (PDF.js HTML string as documented fallback)
- Storage path structure within the bucket

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/REQUIREMENTS.md` -- DOC-01 through DOC-08 define all document storage requirements
- `.planning/ROADMAP.md` -- Phase 7 success criteria (5 acceptance tests)

### Prior Decisions (STATE.md)
- `.planning/STATE.md` -- "Accumulated Context > Decisions" section contains locked decisions:
  - `react-native-webview` for PDF rendering (PDF.js fallback documented)
  - `expo-document-picker` needs `usesIcloudStorage: true` in app.json
  - Single migration 019 for new tables + storage buckets
  - No new Edge Functions -- direct Supabase client calls with RLS
  - Validate Google Docs Viewer against real Supabase signed URL on device

### Existing Patterns
- `components/ProofUploader.tsx` -- Reference upload pattern (ImagePicker + Supabase Storage)
- `constants/config.ts` -- STORAGE_BUCKET constant pattern for bucket name
- `lib/types.ts` -- TypeScript interface pattern for DB tables
- `supabase/migrations/016_rls_with_check.sql` -- RLS policy pattern with WITH CHECK

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `ProofUploader` component: Upload pattern with ImagePicker, Supabase Storage, preview, and progress. Adapt for document picker instead of image picker.
- `EmptyState` component: Reuse for empty document lists
- `GlassCard` / `AnimatedCard`: Card components for document list items
- `ConfirmDialog`: Reuse for delete confirmation
- `DwellaHeader`: Standard screen header
- Theme system (`useTheme`): Colors, shadows, dark mode support

### Established Patterns
- Supabase Storage: `payment-proofs` bucket with `{property_id}/{tenant_id}/` path structure
- RLS: 28 policies with per-operation WITH CHECK clauses (migration 016)
- Soft-delete: `is_archived` + `archived_at` columns, all queries filter `WHERE is_archived = FALSE`
- Hooks pattern: `useProperties`, `useTenants`, `usePayments` -- new `useDocuments` hook follows same pattern
- Toast notifications: `useToastStore.getState().showToast()` for success/error feedback
- Tools screen: Card-based menu with `comingSoon` flag ready to be flipped

### Integration Points
- `app/(tabs)/tools/index.tsx` -- Remove `comingSoon: true` from Documents card, add route
- `app/property/[id]/` -- Add documents section/tab to property detail
- `supabase/migrations/019_*.sql` -- New migration for `documents` table + storage bucket
- `lib/types.ts` -- Add `Document` interface
- `constants/config.ts` -- Add `DOCUMENTS_BUCKET` constant

</code_context>

<specifics>
## Specific Ideas

No specific requirements -- open to standard approaches within the decisions captured above.

</specifics>

<deferred>
## Deferred Ideas

None -- discussion stayed within phase scope.

</deferred>

---

*Phase: 07-document-storage*
*Context gathered: 2026-03-20*
