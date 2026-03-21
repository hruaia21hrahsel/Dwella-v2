# Phase 7: Document Storage - Research

**Researched:** 2026-03-20
**Domain:** React Native file picking, Supabase Storage, WebView document rendering, RLS policies
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **Document organization:** Categorized folders: Lease, ID, Insurance, Receipts, Other
- **Layout:** Property documents section at top, tenant-specific documents section below — separate sections, not mixed
- **Entry points:** Property detail screen (contextual) AND tools menu card (standalone with property picker)
- **Role visibility:** Landlord sees all sections; tenant sees property-wide docs + their own tenant docs only
- **Upload:** One file at a time, user names the document after picking (pre-fill with original filename as default)
- **File types:** PDF, images (JPEG/PNG), Word documents (.doc/.docx)
- **File size limit:** 10 MB per file
- **Viewer:** Full-screen modal overlay; PDFs in WebView; Word docs via Google Docs Viewer in WebView; Images inline with zoom/pan
- **Share:** Close button at top, share button at bottom; native share sheet via expo-sharing (download to temp + open OS share sheet)
- **Tenant upload:** Tenants CAN upload to their own tenancy, NOT property-wide
- **Delete:** Only the uploader can delete (RLS ownership); atomic: storage file + DB row together
- **Archive behavior:** When tenant archived, their documents soft-deleted (is_archived = TRUE); restorable; queries filter WHERE is_archived = FALSE
- **Backend:** No new Edge Functions — direct Supabase client calls with RLS; single migration 019
- **PDF rendering:** react-native-webview (PDF.js HTML string is documented fallback if Google Docs Viewer unreliable)
- **iCloud:** expo-document-picker requires `usesIcloudStorage: true` in app.json for iOS iCloud Drive

### Claude's Discretion

- Upload progress UI implementation (progress bar vs spinner)
- Exact modal/overlay styling and animations
- Loading skeleton design for document lists
- Error state handling for failed uploads/downloads
- Google Docs Viewer fallback if signed URL approach has issues
- Storage path structure within the bucket

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| DOC-01 | Landlord can upload documents (PDF, images, Word) to a property | expo-document-picker for file selection; Supabase Storage upload with property-scoped path; MIME type validation |
| DOC-02 | Landlord can upload documents tied to a specific tenant | Same uploader, property_id=null + tenant_id set; RLS WITH CHECK confirms ownership via is_property_owner() |
| DOC-03 | Tenant can upload documents tied to their own tenancy | expo-document-picker; RLS WITH CHECK confirms auth.uid() = tenant.user_id for the tenant_id column |
| DOC-04 | User can view uploaded documents in-app (PDF via WebView, images inline) | react-native-webview for PDF/Word; Image component for JPEG/PNG; Supabase createSignedUrl to generate time-limited URL |
| DOC-05 | User can download or share documents from the app | expo-file-system to download to temp dir; expo-sharing to open OS share sheet |
| DOC-06 | Property-wide documents visible to all tenants in that property | RLS SELECT policy checks tenant membership via tenants table; property_id not null and tenant_id null = property-wide |
| DOC-07 | Tenant-specific documents visible only to that tenant and the landlord | RLS SELECT policy: uploader_id = auth.uid() OR is_property_owner(property_id) OR tenant.user_id = auth.uid() |
| DOC-08 | User can delete their own uploaded documents (atomic: storage file + DB row) | Delete storage object first (supabase.storage.from().remove()), then delete DB row; wrap in try/catch; if storage delete fails, abort DB delete |
</phase_requirements>

---

## Summary

Phase 7 adds a complete document management system on top of the existing Supabase Storage infrastructure. The project already uses `expo-file-system` and `expo-sharing` (both installed), but `expo-document-picker` and `react-native-webview` are NOT yet in `package.json` and must be installed. The `app.json` also needs `usesIcloudStorage: true` added to the `expo-document-picker` plugin entry for iOS iCloud Drive support.

The data model is a new `documents` table with `property_id` (nullable), `tenant_id` (nullable), `uploader_id`, `name`, `category`, `storage_path`, `mime_type`, `file_size`, `is_archived`, `archived_at`. Property-wide documents have `tenant_id = NULL`; tenant-specific documents have both `property_id` and `tenant_id` set. RLS policies enforce visibility: tenants see property-wide docs (via membership check) plus their own tenant docs; landlords see all docs for their properties.

The UI follows established patterns closely: `useDocuments` hook mirrors `usePayments`; upload flow adapts `ProofUploader` to use document picker instead of image picker; document list uses `EmptyState` and existing card components; the full-screen viewer is a Modal with WebView or Image depending on MIME type. Atomic delete is achieved by deleting the storage object first, then the DB row — if either step fails, surface a toast.

**Primary recommendation:** Install `expo-document-picker` and `react-native-webview`, write migration 019 with the `documents` table + storage bucket + RLS, implement `useDocuments` hook, then build the UI screens.

---

## Standard Stack

### Core (already installed unless noted)

| Library | Version | Purpose | Status |
|---------|---------|---------|--------|
| `expo-document-picker` | 13.x (install via `npx expo install`) | Pick PDF/image/Word files from device or iCloud | NOT INSTALLED — must add |
| `react-native-webview` | 13.16.1 (latest) | Render PDFs and Google Docs Viewer in-app | NOT INSTALLED — must add |
| `expo-file-system` | ~19.0.21 | Download file to temp dir before sharing | INSTALLED |
| `expo-sharing` | ~14.0.8 | Open OS native share sheet | INSTALLED |
| `@supabase/supabase-js` | ^2.45.0 | Storage upload/download/delete, DB queries | INSTALLED |

### Version Verification

```
expo-document-picker: 13.0.9 (latest stable as of 2026-03-20)
expo-sharing: 14.0.8 (installed, matches)
expo-file-system: 19.0.21 (installed, matches)
react-native-webview: 13.16.1 (latest stable as of 2026-03-20)
```

Note: Use `npx expo install` not `npm install` for Expo-managed packages — ensures SDK-compatible versions.

### Installation

```bash
npx expo install expo-document-picker react-native-webview
```

After installing, add plugin to `app.json`:
```json
{
  "plugins": [
    ["expo-document-picker", { "usesIcloudStorage": true }]
  ]
}
```

---

## Architecture Patterns

### Recommended Project Structure (new files)

```
supabase/migrations/
└── 019_documents.sql          # documents table + bucket + RLS

lib/
└── types.ts                   # Add Document interface + DocumentCategory type

constants/
└── config.ts                  # Add DOCUMENTS_BUCKET = 'documents'

hooks/
└── useDocuments.ts            # Fetch docs by property_id / tenant_id

components/
├── DocumentUploader.tsx       # File picker + name input + upload logic
├── DocumentCard.tsx           # Single document row (icon, name, category, date, size)
└── DocumentViewer.tsx         # Full-screen modal: WebView (PDF/Word) or Image

app/
├── (tabs)/tools/index.tsx     # Remove comingSoon from Documents card, add route
├── documents/
│   └── index.tsx              # Standalone screen: property picker + doc list
└── property/[id]/
    └── documents.tsx          # Property-contextual doc list (property-wide + per-tenant sections)
```

### Pattern 1: Database Schema — documents table

```sql
-- migration 019_documents.sql
CREATE TABLE public.documents (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id   uuid REFERENCES public.properties(id) ON DELETE CASCADE,
  tenant_id     uuid REFERENCES public.tenants(id) ON DELETE SET NULL,
  uploader_id   uuid NOT NULL REFERENCES auth.users(id),
  name          text NOT NULL,
  category      text NOT NULL CHECK (category IN ('lease','id','insurance','receipts','other')),
  storage_path  text NOT NULL UNIQUE,
  mime_type     text NOT NULL,
  file_size     bigint NOT NULL,
  is_archived   boolean NOT NULL DEFAULT FALSE,
  archived_at   timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_documents_property ON public.documents(property_id) WHERE is_archived = FALSE;
CREATE INDEX idx_documents_tenant   ON public.documents(tenant_id)   WHERE is_archived = FALSE;
CREATE INDEX idx_documents_uploader ON public.documents(uploader_id);

ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
```

### Pattern 2: Storage Bucket

```sql
-- In migration 019, after table creation
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'documents',
  'documents',
  FALSE,
  10485760, -- 10 MB
  ARRAY[
    'application/pdf',
    'image/jpeg',
    'image/png',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]
)
ON CONFLICT (id) DO NOTHING;
```

### Pattern 3: Storage Path Structure (Claude's discretion — recommended)

```
documents/{property_id}/property/{uuid}.{ext}      -- property-wide
documents/{property_id}/{tenant_id}/{uuid}.{ext}    -- tenant-specific
```

This mirrors the `payment-proofs` bucket structure and makes RLS path-parsing straightforward via `split_part(name, '/', N)`.

### Pattern 4: RLS Policies — DB table

```sql
-- SELECT: landlord sees all their property docs; tenant sees property-wide + their own
CREATE POLICY "documents_select" ON public.documents
  FOR SELECT USING (
    -- Uploader always sees their own
    uploader_id = auth.uid()
    -- Landlord sees all docs for their properties
    OR public.is_property_owner(property_id)
    -- Tenant sees property-wide docs in their property
    OR (
      tenant_id IS NULL
      AND EXISTS (
        SELECT 1 FROM public.tenants t
        WHERE t.property_id = documents.property_id
          AND t.user_id = auth.uid()
          AND t.is_archived = FALSE
      )
    )
    -- Tenant sees their own tenant-specific docs
    OR EXISTS (
      SELECT 1 FROM public.tenants t
      WHERE t.id = documents.tenant_id
        AND t.user_id = auth.uid()
    )
  );

-- INSERT: uploader_id must be auth.uid(); landlord uploads to property; tenant uploads to their tenancy only
CREATE POLICY "documents_insert" ON public.documents
  FOR INSERT WITH CHECK (
    uploader_id = auth.uid()
    AND (
      -- Landlord can upload to any scope in their property
      public.is_property_owner(property_id)
      -- Tenant can only upload to their own tenant record (not property-wide)
      OR (
        tenant_id IS NOT NULL
        AND EXISTS (
          SELECT 1 FROM public.tenants t
          WHERE t.id = tenant_id AND t.user_id = auth.uid()
        )
      )
    )
  );

-- DELETE: only uploader can delete
CREATE POLICY "documents_delete" ON public.documents
  FOR DELETE USING (uploader_id = auth.uid());

-- UPDATE: only uploader can update (rename)
CREATE POLICY "documents_update" ON public.documents
  FOR UPDATE USING (uploader_id = auth.uid())
  WITH CHECK (uploader_id = auth.uid());
```

### Pattern 5: Storage RLS Policies

```sql
-- Mirrors payment-proofs pattern using split_part on storage path
-- Path: documents/{property_id}/... or documents/{property_id}/{tenant_id}/...
-- Note: storage.objects.name does NOT include the bucket name prefix

CREATE POLICY "documents_storage_landlord_all" ON storage.objects
  FOR ALL TO authenticated
  USING (
    bucket_id = 'documents'
    AND EXISTS (
      SELECT 1 FROM public.properties p
      WHERE p.id::text = split_part(name, '/', 2)
        AND p.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    bucket_id = 'documents'
    AND EXISTS (
      SELECT 1 FROM public.properties p
      WHERE p.id::text = split_part(name, '/', 2)
        AND p.owner_id = auth.uid()
    )
  );

CREATE POLICY "documents_storage_tenant_read" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'documents'
    AND (
      -- Tenant can read property-wide docs (path segment 3 = 'property')
      (
        split_part(name, '/', 3) = 'property'
        AND EXISTS (
          SELECT 1 FROM public.tenants t
          WHERE t.property_id::text = split_part(name, '/', 2)
            AND t.user_id = auth.uid()
            AND t.is_archived = FALSE
        )
      )
      -- Tenant can read their own tenant-scoped docs
      OR EXISTS (
        SELECT 1 FROM public.tenants t
        WHERE t.id::text = split_part(name, '/', 3)
          AND t.user_id = auth.uid()
      )
    )
  );

CREATE POLICY "documents_storage_tenant_upload" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'documents'
    AND EXISTS (
      SELECT 1 FROM public.tenants t
      WHERE t.id::text = split_part(name, '/', 3)
        AND t.user_id = auth.uid()
    )
  );
```

### Pattern 6: TypeScript Interface

```typescript
// Add to lib/types.ts
export type DocumentCategory = 'lease' | 'id' | 'insurance' | 'receipts' | 'other';

export interface Document {
  id: string;
  property_id: string | null;
  tenant_id: string | null;
  uploader_id: string;
  name: string;
  category: DocumentCategory;
  storage_path: string;
  mime_type: string;
  file_size: number;
  is_archived: boolean;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
}
```

### Pattern 7: useDocuments Hook

```typescript
// hooks/useDocuments.ts — follows usePayments pattern exactly
export function useDocuments(propertyId: string | null, tenantId?: string | null) {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    if (!propertyId) { setIsLoading(false); return; }
    setIsLoading(true);
    let query = supabase
      .from('documents')
      .select('*')
      .eq('property_id', propertyId)
      .eq('is_archived', false)
      .order('created_at', { ascending: false });

    if (tenantId !== undefined) {
      // null = property-wide only; string = tenant-specific only
      query = tenantId === null
        ? query.is('tenant_id', null)
        : query.eq('tenant_id', tenantId);
    }

    const { data, error: fetchError } = await query;
    if (fetchError) setError(fetchError.message);
    else setDocuments((data as Document[]) ?? []);
    setIsLoading(false);
  }, [propertyId, tenantId]);

  // ... useEffect + realtime subscription (channel: `documents-${propertyId}`)
  return { documents, isLoading, error, refresh: fetch };
}
```

### Pattern 8: expo-document-picker Usage

```typescript
// Source: expo-document-picker docs
import * as DocumentPicker from 'expo-document-picker';

const result = await DocumentPicker.getDocumentAsync({
  type: [
    'application/pdf',
    'image/jpeg',
    'image/png',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ],
  copyToCacheDirectory: true, // Required for reading the file
  multiple: false,
});

if (result.canceled) return;
const asset = result.assets[0];
// asset.uri, asset.name, asset.mimeType, asset.size
```

### Pattern 9: Upload Flow

```typescript
// Adapted from ProofUploader — replace blob fetch with FileSystem.readAsStringAsync
import * as FileSystem from 'expo-file-system';

async function uploadDocument(asset: DocumentPickerAsset, storagePath: string) {
  // Read as base64 for binary-safe upload
  const base64 = await FileSystem.readAsStringAsync(asset.uri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  const buffer = decode(base64); // use atob or a base64 decode helper

  const { error } = await supabase.storage
    .from(DOCUMENTS_BUCKET)
    .upload(storagePath, buffer, {
      contentType: asset.mimeType ?? 'application/octet-stream',
    });

  if (error) throw error;
}
```

Note: The `fetch(uri).blob()` pattern used in `ProofUploader` works for local file URIs in React Native but can be unreliable for content:// URIs on Android (common with document picker). Reading via `expo-file-system` as base64 is the more reliable approach for document files.

### Pattern 10: Signed URL for Viewing

```typescript
// Signed URLs expire — generate fresh URL on each view (60 minute TTL is sufficient)
const { data, error } = await supabase.storage
  .from(DOCUMENTS_BUCKET)
  .createSignedUrl(storagePath, 3600); // 1 hour

const signedUrl = data?.signedUrl;
```

### Pattern 11: PDF/Word in WebView

```typescript
// PDFs: direct signed URL works in react-native-webview
// Word docs: route through Google Docs Viewer
function getViewerUrl(signedUrl: string, mimeType: string): string {
  if (mimeType === 'application/pdf') {
    return signedUrl; // WebView renders PDF natively on both platforms
  }
  if (mimeType.includes('word') || mimeType.includes('document')) {
    return `https://docs.google.com/viewer?url=${encodeURIComponent(signedUrl)}&embedded=true`;
  }
  return signedUrl; // images handled separately, not via WebView
}
```

**Validation flag (from STATE.md):** Test Google Docs Viewer + signed URL on a real device before committing — signed URLs with special characters in query strings can break the Google Docs Viewer URL. If broken, the fallback is serving PDF.js as an inline HTML string in the WebView `source={{ html: pdfJsHtml }}`.

### Pattern 12: Atomic Delete

```typescript
async function deleteDocument(doc: Document) {
  // Step 1: Remove from storage
  const { error: storageError } = await supabase.storage
    .from(DOCUMENTS_BUCKET)
    .remove([doc.storage_path]);

  if (storageError) {
    // Do NOT delete DB row if storage delete failed — preserves consistency
    throw new Error('Failed to remove file: ' + storageError.message);
  }

  // Step 2: Delete DB row (RLS ensures only uploader can delete)
  const { error: dbError } = await supabase
    .from('documents')
    .delete()
    .eq('id', doc.id);

  if (dbError) {
    // Storage object is gone but DB row remains — log this as an anomaly
    // In practice this is very rare; the row will be "orphaned" in DB only
    throw new Error('File removed but record delete failed: ' + dbError.message);
  }
}
```

### Pattern 13: Share/Download via expo-sharing

```typescript
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';

async function shareDocument(doc: Document, signedUrl: string) {
  // Derive file extension from mime type
  const ext = mimeToExt(doc.mime_type); // e.g. 'pdf', 'jpg', 'docx'
  const localUri = FileSystem.cacheDirectory + doc.name + '.' + ext;

  const { uri } = await FileSystem.downloadAsync(signedUrl, localUri);

  const canShare = await Sharing.isAvailableAsync();
  if (canShare) {
    await Sharing.shareAsync(uri, { mimeType: doc.mime_type });
  }
}
```

### Anti-Patterns to Avoid

- **Using `fetch().blob()` for document URIs on Android:** Content URI scheme (`content://`) may not be fetchable. Use `expo-file-system readAsStringAsync` with base64 encoding instead.
- **Hard-deleting from storage before DB transaction is confirmed:** Always delete storage first, abort if storage fails. Orphaned storage objects are harder to clean up than orphaned DB rows.
- **Generating signed URLs at list render time:** Batch or lazy-generate; don't create 20 signed URLs on list mount. Generate on document open/tap only.
- **Storing signed URLs in state long-term:** They expire (1 hour). Always regenerate on view open, never cache across sessions.
- **Using `FOR ALL` RLS policies:** Established project pattern is explicit per-operation policies with `WITH CHECK` (see migration 016). Always use separate SELECT/INSERT/UPDATE/DELETE policies.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| File picking from device/cloud | Custom native module | `expo-document-picker` | Handles iOS iCloud, Android provider permissions, temp copy |
| PDF rendering | Custom PDF renderer | `react-native-webview` + signed URL | Platform-provided rendering, works in managed workflow |
| File sharing | Direct OS API calls | `expo-sharing` | Cross-platform, handles MIME type, temp file cleanup |
| File download to local | `fetch` + manual write | `expo-file-system.downloadAsync` | Handles redirects, chunked downloads, progress events |
| MIME type → icon mapping | Custom lookup | Simple object map, ~5 entries | Trivial enough to inline, no library needed |

**Key insight:** All required capabilities are covered by already-installed packages except `expo-document-picker` and `react-native-webview`. Do not reach for third-party PDF libraries like `react-native-pdf` — they are not compatible with Expo managed workflow.

---

## Common Pitfalls

### Pitfall 1: expo-document-picker Missing from app.json Plugins

**What goes wrong:** On iOS, the picker cannot access iCloud Drive (NSUbiquitousContainers entitlement missing). The picker still works for local files but iCloud documents are unavailable.
**Why it happens:** The `usesIcloudStorage: true` config option must be present in the plugin array in `app.json` — it is not default.
**How to avoid:** Add `["expo-document-picker", { "usesIcloudStorage": true }]` to `app.json` plugins array before first build.
**Warning signs:** iOS picker shows no iCloud Drive option in the file browser.

### Pitfall 2: Google Docs Viewer Breaks with Supabase Signed URLs

**What goes wrong:** The signed URL contains query parameters (`?token=...`). When wrapped in another URL (`docs.google.com/viewer?url=<encoded>`), the double-encoding can cause 400 errors or "Could not preview file" in the WebView.
**Why it happens:** Google Docs Viewer has known reliability issues with URLs containing query parameters; the encoding must be exact.
**How to avoid:** Test on a real device (not simulator) with an actual Supabase signed URL before committing to this approach. Implement the PDF.js fallback as the tested backup.
**Warning signs:** WebView shows "No preview available" or perpetual loading spinner for Word documents.

### Pitfall 3: Content URI Upload Failure on Android

**What goes wrong:** After picking a file on Android, uploading via `fetch(uri).blob()` fails with a network error or returns an empty blob.
**Why it happens:** Android document picker returns `content://` URIs which are not directly fetchable via the standard Fetch API in React Native. The file must be copied to a cache location first.
**How to avoid:** Pass `copyToCacheDirectory: true` to `getDocumentAsync()` (default is true but make it explicit). Then use `FileSystem.readAsStringAsync(uri, { encoding: Base64 })` to get uploadable bytes.
**Warning signs:** Upload appears to succeed (no error) but the storage object is 0 bytes, or throws a network error on Android only.

### Pitfall 4: RLS Infinite Recursion on documents table

**What goes wrong:** RLS policies that query `public.properties` from a policy on `documents` can trigger recursion if Postgres tries to check properties' RLS while evaluating documents' RLS.
**Why it happens:** Same issue that required `is_property_owner()` SECURITY DEFINER function (migration 005). Direct subqueries to `properties` in documents RLS re-enter RLS evaluation.
**How to avoid:** Use the existing `public.is_property_owner(property_id)` SECURITY DEFINER function in all documents RLS policies instead of raw `EXISTS (SELECT 1 FROM public.properties WHERE ...)`.
**Warning signs:** `infinite recursion detected in policy for relation "properties"` Postgres error when inserting or querying documents.

### Pitfall 5: Tenant-Upload Bypassing Property-Wide Restriction

**What goes wrong:** A tenant could potentially upload a document with `tenant_id = NULL` (claiming it is property-wide) if the INSERT RLS is not strict enough.
**Why it happens:** If the INSERT policy only checks `uploader_id = auth.uid()` without enforcing that tenants must always provide a non-null `tenant_id`, the restriction is bypassable.
**How to avoid:** The INSERT RLS must branch explicitly: landlord (owner) can set `tenant_id = NULL`; tenant must always provide a `tenant_id` that matches their own tenant record. See Pattern 4 INSERT policy above.
**Warning signs:** Tenants can see documents in the property-wide section that they uploaded.

### Pitfall 6: Soft-Delete Cascade Not Applied to Documents on Tenant Archive

**What goes wrong:** When a tenant is archived, their documents remain visible (is_archived = FALSE) because the archive operation only sets the flag on the `tenants` row.
**Why it happens:** Unlike a CASCADE constraint, soft-delete cascades require explicit application logic or a DB trigger.
**How to avoid:** When archiving a tenant (setting `tenants.is_archived = TRUE`), also run:
```sql
UPDATE public.documents SET is_archived = TRUE, archived_at = now()
WHERE tenant_id = $1 AND is_archived = FALSE;
```
This can be done in the app code immediately after the tenant archive update, or in migration 019 as a `BEFORE UPDATE` trigger on `tenants`.
**Warning signs:** Archived tenants' documents still appear in landlord document lists.

---

## Code Examples

### Verified Pattern: Storage Bucket Creation (from migration 002)

```sql
-- Source: supabase/migrations/002_storage.sql (established project pattern)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'documents', 'documents', FALSE,
  10485760, -- 10 MB
  ARRAY['application/pdf', 'image/jpeg', 'image/png',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
)
ON CONFLICT (id) DO NOTHING;
```

### Verified Pattern: Signed URL (from tenant detail screen)

```typescript
// Source: app/property/[id]/tenant/[tenantId]/index.tsx (existing codebase)
const { data: urlData } = await supabase.storage
  .from('tenant-photos')
  .createSignedUrl(data.photo_url, 3600);
const signedUrl = urlData?.signedUrl ?? null;
```

### Verified Pattern: SECURITY DEFINER Helper for RLS

```sql
-- Source: supabase/migrations/005_fix_rls_recursion.sql
-- is_property_owner() SECURITY DEFINER function already exists
-- USE THIS in documents RLS — do not write raw property subqueries
SELECT public.is_property_owner(property_id)
```

### Verified Pattern: Tools Screen Integration

```typescript
// Source: app/(tabs)/tools/index.tsx
// Change comingSoon: true → add route: '/documents'
{
  label: 'Documents',
  description: 'Upload and manage property documents',
  icon: 'file-document-outline',
  color: '#6366F1',
  route: '/documents', // remove comingSoon, add route
}
```

---

## State of the Art

| Old Approach | Current Approach | Notes |
|--------------|------------------|-------|
| `react-native-pdf` for PDFs | `react-native-webview` + URL | `react-native-pdf` incompatible with Expo managed workflow |
| `expo-document-picker` v11 blob API | v13 assets array API | v13 returns `result.assets[0]` not `result.uri` directly |
| Storage FOR ALL policies | Per-operation policies with WITH CHECK | Project standard since migration 016 |

**Deprecated/outdated:**
- `DocumentPicker.DocumentResult.uri` (old API): Use `result.assets[0].uri` — the v13 API returns an assets array, same pattern as `expo-image-picker`.

---

## Open Questions

1. **Google Docs Viewer reliability with Supabase signed URLs**
   - What we know: Signed URLs contain `?token=...` query params; Google Docs Viewer has documented issues with parameterized URLs
   - What's unclear: Whether current Supabase signed URL format works reliably
   - Recommendation: Build DocumentViewer with both strategies implemented; use feature flag or try/catch to switch to PDF.js fallback. The planner should include a task to validate on device.

2. **Soft-delete cascade — app code vs DB trigger**
   - What we know: Tenant archive is done via app code (handleArchive in tenant detail screen); no existing DB trigger for cascade
   - What's unclear: Whether migration 019 should include a trigger or whether it is simpler to update the app-side archive handler
   - Recommendation: App-code cascade (update documents in the same archive handler) is simpler and keeps all logic visible; a trigger adds robustness but another trigger to maintain. The planner may choose either; app-code is lower risk.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Jest 29 + jest-expo |
| Config file | `jest.config.js` (exists) |
| Quick run command | `npx jest __tests__/documents.test.ts --no-coverage` |
| Full suite command | `npx jest --no-coverage` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DOC-01 | getDocumentStoragePath returns correct path for property-wide | unit | `npx jest __tests__/documents.test.ts -t "getDocumentStoragePath"` | Wave 0 |
| DOC-02 | getDocumentStoragePath returns correct path for tenant-specific | unit | `npx jest __tests__/documents.test.ts -t "tenant-specific path"` | Wave 0 |
| DOC-03 | Tenant upload path uses tenant_id, not null | unit | `npx jest __tests__/documents.test.ts -t "tenant upload"` | Wave 0 |
| DOC-04 | getViewerUrl returns direct URL for PDF, Google Docs URL for Word | unit | `npx jest __tests__/documents.test.ts -t "getViewerUrl"` | Wave 0 |
| DOC-05 | mimeToExt returns correct extension for all supported types | unit | `npx jest __tests__/documents.test.ts -t "mimeToExt"` | Wave 0 |
| DOC-06 | Property-wide visibility: manual test via RLS (Supabase integration) | manual-only | n/a — requires live Supabase + two user sessions | n/a |
| DOC-07 | Tenant isolation: manual test via RLS | manual-only | n/a — requires live Supabase + two user sessions | n/a |
| DOC-08 | deleteDocument calls storage.remove then db.delete; aborts if storage fails | unit | `npx jest __tests__/documents.test.ts -t "deleteDocument"` | Wave 0 |

Note: RLS policy correctness (DOC-06, DOC-07) requires live Supabase and is tested manually during verification, not automated. All pure logic functions are unit-testable.

### Sampling Rate

- **Per task commit:** `npx jest __tests__/documents.test.ts --no-coverage`
- **Per wave merge:** `npx jest --no-coverage`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `__tests__/documents.test.ts` — covers DOC-01, DOC-02, DOC-03, DOC-04, DOC-05, DOC-08 (pure logic functions)

---

## Sources

### Primary (HIGH confidence)

- Existing codebase — `ProofUploader.tsx`, `002_storage.sql`, `016_rls_with_check.sql`, `app/(tabs)/tools/index.tsx`, `hooks/usePayments.ts`: direct code inspection
- `package.json` — confirmed installed packages and versions
- `app.json` — confirmed iCloud plugin is absent (must be added)
- npm registry — verified `expo-document-picker@13.0.9`, `react-native-webview@13.16.1` as current versions

### Secondary (MEDIUM confidence)

- STATE.md documented decisions: react-native-webview as PDF renderer, Google Docs Viewer for Word, PDF.js fallback, expo-document-picker iCloud requirement, single migration 019, no Edge Functions

### Tertiary (LOW confidence)

- Google Docs Viewer + signed URL reliability: anecdotal community reports of issues with parameterized URLs — flagged as validation required

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — verified against package.json and npm registry
- Architecture: HIGH — directly derived from existing codebase patterns (ProofUploader, migration 002, migration 016, hooks pattern)
- Pitfalls: HIGH (RLS recursion, soft-delete cascade, FOR ALL vs per-op) — verified against existing migrations; MEDIUM (Google Docs Viewer) — community-reported, needs device validation

**Research date:** 2026-03-20
**Valid until:** 2026-04-20 (stable stack)
