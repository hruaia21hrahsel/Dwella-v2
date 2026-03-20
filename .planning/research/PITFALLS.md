# Pitfalls Research

**Domain:** React Native / Expo property management app — v1.1 Tools Expansion (Document Storage, Maintenance Requests, Reporting Dashboards, AI Tools Removal)
**Researched:** 2026-03-20
**Confidence:** HIGH (findings cross-verified with official Supabase docs, Expo docs, and known codebase structure)

---

## Critical Pitfalls

### Pitfall 1: New Storage Bucket RLS Policies Missing WITH CHECK

**What goes wrong:**
A `documents` bucket is created with RLS policies that use only a `USING` clause on INSERT, allowing a tenant to upload a document to a path they do not own. For example, a tenant could upload to `{other_property_id}/{their_tenant_id}/lease.pdf` and the INSERT succeeds because the path check only runs on SELECT (USING), not on write (WITH CHECK).

**Why it happens:**
The `payment-proofs` bucket in migration 002 used `WITH CHECK` correctly, but it is easy to copy the pattern incorrectly when creating a second bucket. The existing 28 RLS policies were audited for the v1.0 milestone — any new policies added in v1.1 are outside that audit scope and start without coverage.

**How to avoid:**
- Every `FOR INSERT` storage policy must use `WITH CHECK (...)`, not `USING (...)`. Supabase Storage evaluates `WITH CHECK` for writes and `USING` for reads — using the wrong clause means the check silently does nothing.
- Mirror the pattern from `002_storage.sql`: `CREATE POLICY "landlord_upload_doc" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'documents' AND EXISTS (SELECT 1 FROM public.properties p WHERE p.id::text = split_part(name, '/', 1) AND p.owner_id = auth.uid()))`.
- Run Supabase's security linter (Dashboard → Database → Linter → Security) after adding every new migration.

**Warning signs:**
- Any new `CREATE POLICY ... FOR INSERT` on `storage.objects` that contains `USING (...)` instead of `WITH CHECK (...)`.
- Storage policy created without a corresponding read policy — documents uploaded but inaccessible to the intended reader.

**Phase to address:**
Phase 1 (Document Storage DB + Storage setup) — every new bucket policy must include `WITH CHECK` before any upload code is written.

---

### Pitfall 2: Document Metadata Table Missing Soft-Delete or Not Filtering is_archived

**What goes wrong:**
The `documents` metadata table stores `property_id` and optionally `tenant_id`. When a property or tenant is archived (soft-deleted), the documents table keeps rows with non-null foreign keys pointing to archived records. Queries that join `documents` with `properties` or `tenants` either return documents for archived records or fail with confusing empty results depending on whether the join filters `is_archived`.

**Why it happens:**
This project uses a consistent soft-delete pattern — `is_archived = FALSE` on every query involving properties or tenants. New tables that reference those entities do not automatically inherit the filter. The query is written once; the archived-record case is only discovered when a beta user archives a property and still sees its documents in an unrelated screen.

**How to avoid:**
- Every query joining `documents` to `properties` or `tenants` must add `.eq('is_archived', false)` on the joined table.
- Add a partial index on `documents` filtering by property so queries are fast: `CREATE INDEX idx_documents_active_property ON documents(property_id) WHERE property_id IS NOT NULL`.
- Add soft-delete to the documents table itself (`is_archived BOOLEAN NOT NULL DEFAULT FALSE`) so documents can be hidden without deleting the file from storage, since deleting a bucket object via SQL metadata is not the same as deleting the actual file (see Pitfall 4).

**Warning signs:**
- A landlord archives a property and the document library screen still shows the archived property's documents.
- A tenant archives flow completes but the tenant's documents still appear in the landlord's document library.

**Phase to address:**
Phase 1 (Document Storage DB schema) — add `is_archived` column and write query helpers before any UI is built.

---

### Pitfall 3: Signed URL Expiry Not Handled — Documents Appear Broken

**What goes wrong:**
Private bucket files in Supabase Storage are served via signed URLs that expire (default 1 hour, configurable up to 1 year via `expiresIn` seconds). The document library renders a list of documents with signed URLs fetched on screen load. If the user leaves the screen open for an hour, or returns to the screen from cache, all document thumbnails and download links show broken/expired URL errors. The existing `payment-proofs` bucket in Dwella already has this risk (noted in v1.0 PITFALLS.md) and the documents feature will amplify it because document lists are more static — users bookmark a document list screen and return to it repeatedly.

**Why it happens:**
Developers fetch signed URLs once and store them in component state or Zustand. The URL expires silently — there is no network error on the React Native side, just a failed image load or a 400 from the presigned URL endpoint.

**How to avoid:**
- Store signed URLs with their expiry timestamp: `{ url: string, expiresAt: number }`.
- Before rendering, check `Date.now() > expiresAt - 60_000` (1-minute buffer) and re-fetch if expired.
- Use a 24-hour `expiresIn` for documents (vs. 1-hour default) to reduce re-fetch frequency: `supabase.storage.from('documents').createSignedUrl(path, 86400)`.
- Do not persist signed URLs in Zustand across app restarts — re-fetch on mount.

**Warning signs:**
- Document download button triggers a 400 or 403 error after the app has been open for more than an hour.
- Broken image icons in the document list thumbnail view.
- `expiresIn` not passed to `createSignedUrl` calls — means the default (1 hour) is used.

**Phase to address:**
Phase 1 (Document Storage screens) — implement expiry-aware URL cache from day one, not as a post-launch fix.

---

### Pitfall 4: Deleting Document Metadata Without Deleting the Storage Object (Orphaned Files)

**What goes wrong:**
A document is deleted from the `documents` table (the metadata row is removed), but the actual file in the Supabase Storage bucket is not deleted. The file remains in storage, consuming storage quota and remaining accessible to anyone who still has a signed URL. Over time, orphaned files accumulate silently.

**Why it happens:**
Supabase Storage stores file metadata in `storage.objects` (internal schema) and the actual bytes in S3-compatible object storage. Deleting a row from your own `documents` table only removes your metadata — it does not call the storage API. Official Supabase docs explicitly warn: "Deleting the metadata doesn't remove the object in the underlying storage provider. This results in your object being inaccessible, but you'll still be billed for it."

**How to avoid:**
- Never delete document records via a plain `DELETE FROM documents`. Always delete through the storage API first: `supabase.storage.from('documents').remove([path])`, then delete the metadata row.
- Write a single `deleteDocument(id)` function in `lib/documents.ts` that handles both operations atomically (storage delete then DB delete). Callers must never call them separately.
- For the soft-delete case: set `is_archived = TRUE` on the metadata row without touching storage. Only physically delete from storage when the user explicitly purges archived documents.

**Warning signs:**
- A `DELETE FROM documents WHERE id = $1` query anywhere in the codebase not preceded by a storage `remove()` call.
- Storage bucket usage growing faster than active document count would explain.

**Phase to address:**
Phase 1 (Document Storage lib layer) — `lib/documents.ts` must enforce this invariant before any delete UI is wired up.

---

### Pitfall 5: AI Tools Screens Removed But Routes Still Referenced — TypeScript Misses It at Runtime

**What goes wrong:**
The three AI tools screens (`/tools/ai-insights`, `/tools/smart-reminders`, `/tools/ai-search`) are deleted from `app/(tabs)/tools/`. The `tools/index.tsx` menu still contains `route: '/tools/ai-insights'` in the TOOLS array. The app builds and passes TypeScript checks because Expo Router's typed routes only detect invalid hrefs when `typedRoutes: true` is enabled in `app.json`. If typed routes are not enabled, or the `router-typegen.d.ts` file is stale, pressing the removed menu items causes a runtime "no route found" crash rather than a compile-time error.

**Why it happens:**
Expo Router uses file-system-based routing. Removing a file removes the route, but string references to that route in navigation calls (`router.push('/tools/ai-insights')`) are plain strings at runtime — TypeScript only catches them if typed routes are active. The tools menu in `index.tsx` is a data-driven array with string literals, which is even less likely to produce a TS error.

**How to avoid:**
- Before deleting any screen file, search the entire codebase for the route string: `grep -r "ai-insights\|smart-reminders\|ai-search" app/ components/ lib/`.
- Remove or replace all references in `tools/index.tsx`, `_layout.tsx` files, and any deeplink handlers before deleting the screen files.
- Enable `typedRoutes: true` in `app.json` (Expo Router experimental feature) so that removed route strings cause compile-time TypeScript errors.
- After deletion, verify the tools tab renders without errors and no dead cards remain in the menu.

**Warning signs:**
- The TOOLS array in `tools/index.tsx` still has items with routes pointing to deleted files after the AI removal phase.
- Any `_layout.tsx` in `app/(tabs)/tools/` that still defines screens for the removed routes.
- Bot/AI-related imports remaining in `lib/bot.ts` or referenced from screens that should be clean.

**Phase to address:**
Phase 4 (AI Tools Removal) — audit all route references before file deletion; verify with `npx tsc --noEmit` after deletion.

---

### Pitfall 6: Maintenance Request Expense Link Creates Orphaned Expenses on Request Deletion

**What goes wrong:**
Maintenance requests are linked to expenses (landlord can log the cost of a repair). The `expenses` table uses `ON DELETE RESTRICT` for payment FKs (from the existing schema). If maintenance requests can be deleted and the linked expense is not also deleted, the expense becomes an orphan — it still appears in reporting totals but has no associated work order context. Alternatively, if the FK is set to CASCADE, deleting a maintenance request silently wipes the expense record from the landlord's P&L history.

**Why it happens:**
The existing `expenses` table was designed for general property expenses, not workflow-linked expenses. Adding a `maintenance_request_id` FK to `expenses` without carefully choosing the delete behavior (RESTRICT vs CASCADE vs SET NULL) creates a data integrity trap. RESTRICT prevents cleanup; CASCADE destroys audit history; SET NULL is correct but requires the UI to handle the orphaned expense gracefully.

**How to avoid:**
- Use `maintenance_request_id UUID REFERENCES maintenance_requests(id) ON DELETE SET NULL` on the `expenses` table — expenses survive request deletion, the link is simply cleared.
- In the reporting dashboard, display expenses without a maintenance request link as "Unlinked" rather than hiding them.
- Do not add a `CASCADE` delete from `maintenance_requests` to `expenses` — a landlord's P&L must never silently lose expense records.

**Warning signs:**
- Any migration that adds `maintenance_request_id` to `expenses` with `ON DELETE CASCADE`.
- Any application code that deletes a maintenance request and separately deletes linked expenses in the same transaction — this is fine for intentional purge but must be an explicit user action, not automatic.

**Phase to address:**
Phase 2 (Maintenance Requests DB schema) — FK delete behavior must be defined correctly in the migration, not changed later.

---

### Pitfall 7: Reporting Dashboard Runs Full Table Scans via RLS — Visible Latency at Small Scale

**What goes wrong:**
The reporting dashboard aggregates `payments`, `expenses`, and `tenants` across a landlord's portfolio. The RLS policies on these tables use EXISTS subqueries that join back to `properties` to verify ownership. For an aggregate query like `SELECT SUM(amount_paid) FROM payments WHERE ...`, Postgres evaluates the RLS EXISTS subquery for every candidate row — even with a WHERE clause. On a table with 500+ payment rows, this causes query times of 200-800ms per aggregate, making a dashboard with 5-6 aggregate cards take 3-5 seconds to load.

**Why it happens:**
RLS subqueries using `EXISTS (SELECT 1 FROM properties WHERE owner_id = auth.uid())` are re-evaluated per row. The existing RLS on `payments` in Dwella uses this pattern. It works acceptably for paginated list queries (few rows) but becomes expensive for aggregate queries that touch many rows. The Supabase advisor flags this as `auth_rls_initplan`.

**How to avoid:**
- Add a `property_id` direct column to all tables that need it (payments already has `property_id`). Add a composite index: `CREATE INDEX idx_payments_owner_reporting ON payments(property_id, year, month, status)`.
- Rewrite reporting queries to filter `property_id IN (SELECT id FROM properties WHERE owner_id = auth.uid() AND is_archived = FALSE)` — a single subquery evaluated once, not per row.
- Consider using a Postgres `SECURITY DEFINER` function for dashboard aggregates (existing pattern in Dwella via `is_property_owner()`) — this bypasses RLS for the aggregate while still enforcing ownership in the function body.
- Use Supabase Edge Functions for dashboard aggregates if queries exceed 200ms — offload the computation and return a pre-computed JSON payload.

**Warning signs:**
- Dashboard cards take >1 second to render on a phone with 3+ properties.
- Supabase query logs (Dashboard → Database → Query Performance) showing `payments` SELECT queries with high `mean_exec_time`.
- The Supabase advisor flagging `auth_rls_initplan` on `payments` or `expenses`.

**Phase to address:**
Phase 3 (Reporting Dashboards) — write queries with indexes from day one; do not defer optimization to post-launch.

---

### Pitfall 8: Storage.list() Used for Document Browsing — Degrades at Scale

**What goes wrong:**
`supabase.storage.from('documents').list(prefix)` is used to browse documents in a folder. The Supabase Storage `.list()` method is described in official docs as "quite generic" — it fetches both folders and objects in a single query and degrades when a bucket contains a large number of objects. For a multi-property landlord with years of accumulated documents, this causes slow load times and can hit query limits.

**Why it happens:**
`.list()` is the obvious API for a file browser UI. It works correctly in development with few files. The metadata table pattern (storing file path + metadata in a Postgres `documents` table) is more robust but requires an additional abstraction layer.

**How to avoid:**
- Use the `documents` metadata table as the primary source for listing documents in the UI — query `SELECT * FROM documents WHERE property_id = $1 AND is_archived = FALSE ORDER BY created_at DESC`.
- Use `supabase.storage.from('documents').list()` only for admin/debug purposes, never as the production document list source.
- The storage path is stored in the metadata row — signed URL generation is a secondary API call on demand, not a list operation.

**Warning signs:**
- Any UI component that calls `supabase.storage.from('documents').list(...)` to populate the document list screen.
- Document list load time increasing linearly as more files are uploaded.

**Phase to address:**
Phase 1 (Document Storage design) — use the metadata table as the source of truth for listing from the start; the storage API is only for upload/download/delete operations.

---

### Pitfall 9: Maintenance Request Photo Uploads Use Same Bucket as Payment Proofs — RLS Collision

**What goes wrong:**
Maintenance request photos are uploaded to the existing `payment-proofs` bucket (re-using the same bucket for convenience). The existing RLS policies on `payment-proofs` use path-based access control structured as `{property_id}/{tenant_id}/{year-month}.jpg`. Maintenance photos with a different path structure (e.g., `maintenance/{request_id}/photo.jpg`) do not match any existing policy and silently fail with a 403. Alternatively, if the path is forced into the payment-proof format, data from different domains is mixed in one bucket, making cleanup and auditing harder.

**Why it happens:**
Developers see an existing bucket and avoid the overhead of creating a new one. The path-based RLS pattern in `payment-proofs` is opaque — it looks like generic file storage when it is actually domain-specific.

**How to avoid:**
- Create a separate `maintenance-photos` bucket with its own RLS policies tuned for the maintenance request domain: `{property_id}/{request_id}/{index}.jpg`.
- Similarly, create a `documents` bucket separately from `payment-proofs`.
- One bucket per domain: `payment-proofs`, `maintenance-photos`, `documents`. This keeps RLS policies readable and auditable.

**Warning signs:**
- Any new storage path written to the `payment-proofs` bucket that does not match the `{property_id}/{tenant_id}/{year-month}` format.
- Maintenance photo upload failing with a 403 error when the user has correct property ownership.

**Phase to address:**
Phase 2 (Maintenance Requests storage setup) — create the `maintenance-photos` bucket in a new migration, do not reuse existing buckets.

---

### Pitfall 10: Edge Function Deletion Leaves Dead Invocation Entries and Claude Tool Definitions

**What goes wrong:**
When the AI tools Edge Functions are removed (`ai-insights`, `smart-reminders`, `ai-search` or equivalent), the Supabase dashboard may still show previous deployment history for those functions. More critically, if `process-bot-message` referenced these tools as Claude API function definitions, those tool definitions remain in the function code and Claude continues to hallucinate calls to them, causing the bot to attempt tool executions that no longer exist. The bot starts returning malformed responses or errors.

**Why it happens:**
Edge Function removal in Supabase is not automatic — you must delete via the Supabase CLI (`supabase functions delete <name>`) or the dashboard. Function-to-function references (e.g., `process-bot-message` calling `ai-insights`) may not throw a clear error until the calling function actually executes at runtime.

**How to avoid:**
- Before deleting AI tools Edge Functions, grep the entire `supabase/functions/` directory for references to the functions being removed: `grep -r "ai-insights\|smart-reminders\|ai-search" supabase/functions/`.
- Remove all Claude API tool definitions for the removed features from `process-bot-message` before deploying the removal.
- After deletion, verify `process-bot-message` still works with a test bot message that would have previously triggered AI tools.
- Delete functions via CLI: `supabase functions delete ai-insights` — the CLI validates the slug and removes from the deployment.

**Warning signs:**
- The bot returns structured JSON with an `action` field referencing a removed tool name.
- `process-bot-message` logs show `Error: Cannot find function ai-insights` or similar.
- Any `fetch('...supabase.co/functions/v1/ai-insights', ...)` remaining in Edge Function source code.

**Phase to address:**
Phase 4 (AI Tools Removal) — audit function-to-function calls before deletion; test the bot end-to-end after removal.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Re-using `payment-proofs` bucket for maintenance photos | No migration needed | RLS collision, mixed domain data, harder to audit | Never — bucket creation is a one-line migration |
| `supabase.storage.list()` for document browsing UI | Simple API, no metadata table needed | Degrades with scale, no filtering, no soft-delete | Never in production — use metadata table |
| Storing signed URLs in Zustand without expiry tracking | Simple, fast to implement | Broken document links after 1 hour | Never for private buckets — always track expiry |
| Aggregate queries without indexes on reporting columns | No extra migration | Dashboard latency visible at 3+ properties | Never — add indexes in same migration as table |
| Cascade delete from maintenance requests to expenses | Simple cleanup | Destroys P&L audit history silently | Never for financial data |
| Leaving AI tool route strings in `tools/index.tsx` while deleting screen files | Saves one edit | Runtime crash on navigation, confusing for testers | Never — remove together |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Supabase Storage (documents bucket) | `FOR INSERT WITH USING (...)` instead of `WITH CHECK (...)` | All insert policies must use `WITH CHECK`; `USING` is for reads only |
| Supabase Storage (delete) | Delete metadata row without calling `storage.remove()` | Always call `storage.from('documents').remove([path])` first, then delete the metadata row |
| Supabase Storage (signed URLs) | Generate once and store permanently in state or Zustand | Store with expiry timestamp; regenerate 60 seconds before expiry |
| expo-document-picker | Not setting `copyToCacheDirectory: true` | `expo-file-system` cannot reliably read a picked file without copying it to app cache first |
| expo-document-picker (large files) | Picking files > 100MB — URI property may be empty on some platforms | Validate file size before upload attempt; show error for files exceeding bucket limit (5MB for payment-proofs — set appropriate limit for documents bucket) |
| Supabase aggregate queries with RLS | Running `SUM()` / `COUNT()` on tables with EXISTS-subquery RLS | Add composite indexes on `(property_id, ...)` columns; rewrite RLS to use `IN` subquery evaluated once |
| Claude API tool definitions in `process-bot-message` | Leaving removed tool definitions in the tools array | Remove tool definitions for all AI tool features before deploying the removal migration |
| Expo Router typed routes | Deleting screen files without updating string route references | Enable `typedRoutes: true` in `app.json`; search for route strings manually before deletion |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Reporting dashboard fires 5-6 separate aggregate queries on mount | Dashboard blank for 3-5 seconds; each card loads independently | Combine all aggregates into a single Edge Function call that returns a JSON payload; or use parallel `Promise.all` with composite indexes | Visible at 3+ properties / 100+ payments |
| Document list re-fetches signed URLs for every item on every render | Each list render causes N storage API calls (N = document count) | Fetch signed URLs lazily on item expand/tap, not on list render | Visible at 10+ documents |
| Maintenance request list loads all requests + joins (tenant, property, linked expense) in a single N+1 query | Maintenance list takes >2 seconds; N+1 visible in Supabase query logs | Use a joined select: `maintenance_requests.select('*, tenants(tenant_name), expenses(amount)')` — single query | Visible at 20+ requests |
| Dashboard reporting queries lack indexes on `year`, `month`, `status` columns | Slow aggregate queries even with few rows because Postgres does a seq scan on `payments` | Add `CREATE INDEX idx_payments_reporting ON payments(property_id, year, month, status)` in the migration that creates reporting queries | Visible at 200+ payment rows; performance cliff at 1000+ |
| FlatList for document/maintenance lists without `keyExtractor` | Reconciliation errors, incorrect scroll position, items rendering twice | Always provide `keyExtractor={(item) => item.id}` for lists backed by UUID-keyed DB rows | Immediate — causes subtle rendering bugs from first use |

---

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| New document bucket with public access enabled | Any unauthenticated user can download lease agreements, IDs, and financial documents | Always create document buckets with `public: FALSE`; verify in Supabase dashboard after migration |
| Document upload path not validated before insert | Tenant uploads to `{other_property_id}/...` path, bypassing property ownership | RLS `WITH CHECK` must parse the first path segment as a UUID and verify it matches a property owned by `auth.uid()` |
| Maintenance request photos accessible to tenants of other units in the same property | A tenant can see maintenance photos uploaded for a different flat | RLS on `maintenance-photos` bucket must scope to `tenant_id` (second path segment), not just `property_id` |
| Maintenance request status editable by tenant (should be landlord-only for some transitions) | Tenant closes their own maintenance request before landlord has reviewed it | RLS `WITH CHECK` on UPDATE for `maintenance_requests` must restrict `status` transitions: tenants can set `open`/`cancelled`, landlords can set `in_progress`/`resolved`/`closed` |
| Reporting dashboard queries bypass RLS via service role in Edge Function | All properties' data visible regardless of ownership | If using an Edge Function for dashboard aggregates, pass `Authorization: Bearer <user_jwt>` and use a user-scoped Supabase client, not the service role client |

---

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Document upload progress not shown | User taps upload, nothing appears to happen for 5-10 seconds, taps again uploading twice | Show a progress indicator using Supabase Storage's upload progress callback: `onUploadProgress: (progress) => setPercent(progress.loaded / progress.total)` |
| Maintenance request status labels using internal enum values | Tenant sees "in_progress" — unclear if anyone has looked at the issue | Map to plain language: "open" → "Submitted", "in_progress" → "Being looked at", "resolved" → "Fixed — awaiting confirmation", "closed" → "Closed" |
| AI tools menu items shown to users during the removal phase | Users tap AI Insights and see a crash or empty screen | Remove menu items from `tools/index.tsx` before or at the same time as removing the screen files — never have a menu item with no destination |
| Reporting dashboard shows all-time totals with no date filter | Landlord sees cumulative numbers that are confusing for tax year planning | Default to current calendar year; add a year selector as the primary filter control |
| Document library shows no empty state | New users see a blank screen with no context | Add an empty state: "No documents yet. Upload a lease agreement or notice to keep your records in one place." |

---

## "Looks Done But Isn't" Checklist

- [ ] **Document bucket:** Created and migration applied — verify bucket is `public: FALSE` and RLS policies have `WITH CHECK` on INSERT, not `USING`.
- [ ] **Document metadata table:** Migration creates `documents` table with `is_archived` column — verify all list queries filter `is_archived = FALSE`.
- [ ] **Signed URL expiry:** Documents render correctly on screen load — verify URLs are re-fetched after 1 hour by simulating an expired URL (use a 5-second expiry in dev and wait).
- [ ] **Delete document:** Document removed from UI — verify file is also deleted from storage bucket (check Supabase Storage dashboard, not just DB row count).
- [ ] **Maintenance-photos bucket:** Created separately from `payment-proofs` — verify path structure `{property_id}/{request_id}/{index}` matches RLS policies exactly.
- [ ] **Maintenance expense link:** Request deleted — verify linked expense still exists with `maintenance_request_id = NULL` (not cascade-deleted).
- [ ] **Reporting dashboard:** Cards render with data — verify queries run via `EXPLAIN ANALYZE` in Supabase SQL editor; confirm no seq scans on `payments` or `expenses` for property-scoped aggregates.
- [ ] **AI tools removal:** Three screen files deleted — verify `tools/index.tsx` TOOLS array has no routes pointing to deleted files; verify `npx tsc --noEmit` passes.
- [ ] **AI Edge Functions removed:** Functions deleted from Supabase — verify `process-bot-message` no longer includes tool definitions for removed features; test bot with a message that would have triggered an AI tool.
- [ ] **New RLS policies:** All new table policies added — run Supabase security linter after each migration; verify cross-user test (user B cannot read user A's documents or maintenance requests).

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Orphaned files in storage (metadata deleted, object retained) | LOW | Write a one-off script using Supabase Admin API to list all objects in the bucket, compare with documents table, and delete any paths not in the table |
| Expired signed URLs causing broken document links in production | LOW | Re-fetch all signed URLs for the user's document list on next app open; no data loss |
| Maintenance expense cascade-deleted a P&L record | HIGH | Restore from Supabase PITR snapshot to the point before deletion; replay any mutations since that point |
| AI tools screens deleted but routes still referenced in menu | LOW | Re-add the screen files as redirect stubs pointing to the new tools, deploy OTA update, then clean up in next release |
| Document bucket created as public instead of private | HIGH | Change bucket visibility to private immediately in Supabase dashboard; rotate any signed URLs that were issued during the public window; notify affected users if lease/ID documents were exposed |
| New RLS policy hole discovered (documents or maintenance requests cross-user readable) | HIGH | Same as v1.0 protocol: rotate anon keys, audit access logs, deploy fix migration, notify affected users per GDPR 72-hour window |

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| New storage bucket RLS missing WITH CHECK | Phase 1: Document Storage (DB + Storage) | Supabase security linter pass; test tenant cannot upload to another property's path |
| Document metadata missing soft-delete filter | Phase 1: Document Storage (DB schema) | Archive a property; verify its documents disappear from all list screens |
| Signed URL expiry not handled | Phase 1: Document Storage (screens) | Simulate expired URL in dev; verify auto-refresh occurs |
| Storage delete without removing bucket object | Phase 1: Document Storage (lib layer) | Delete a document; verify object absent in Supabase Storage dashboard |
| AI tools routes still referenced after screen deletion | Phase 4: AI Tools Removal | `npx tsc --noEmit` passes; all tools menu items navigate correctly |
| Maintenance expense FK cascade deletes P&L record | Phase 2: Maintenance Requests (DB schema) | Delete a maintenance request; verify linked expense still exists with NULL request ID |
| Reporting aggregate queries slow (RLS per-row subquery) | Phase 3: Reporting Dashboards | `EXPLAIN ANALYZE` shows index scan, not seq scan; dashboard loads in < 1s on device |
| Storage.list() used for document browsing | Phase 1: Document Storage (design) | Document list screen queries `documents` table, not `storage.list()` |
| Maintenance photos in wrong bucket (RLS collision) | Phase 2: Maintenance Requests (storage setup) | Verify `maintenance-photos` bucket exists separately; RLS policies scoped to request path |
| Edge Function dead references after AI tools removal | Phase 4: AI Tools Removal | Test bot with a message that previously triggered AI tools; verify clean JSON response |

---

## Sources

- Supabase Storage access control — WITH CHECK vs USING: https://supabase.com/docs/guides/storage/security/access-control
- Supabase Storage inefficient folder operations and RLS: https://supabase.com/docs/guides/storage/schema/design
- Supabase critical API-only operations warning (metadata vs object deletion): https://chat2db.ai/resources/blog/supabase-storage-file-management-guide
- Supabase RLS performance and best practices discussion: https://github.com/orgs/supabase/discussions/14576
- Supabase RLS initplan advisor: https://supabase.com/docs/guides/database/database-advisors
- expo-document-picker copyToCacheDirectory requirement: https://docs.expo.dev/versions/latest/sdk/document-picker/
- Expo Router typed routes for dead-link detection: https://docs.expo.dev/router/reference/typed-routes/
- React Native FlatList optimization for large lists: https://reactnative.dev/docs/optimizing-flatlist-configuration
- Supabase Storage signed URL expiry: https://supabase.com/docs/reference/javascript/storage-from-createsignedurl
- Supabase cascade deletes: https://supabase.com/docs/guides/database/postgres/cascade-deletes
- Dwella v2 `lib/types.ts` — existing schema for integration reference
- Dwella v2 `supabase/migrations/002_storage.sql` — existing storage RLS pattern to mirror
- Dwella v2 `supabase/migrations/016_rls_with_check.sql` — WITH CHECK pattern established in v1.0

---
*Pitfalls research for: React Native / Expo property management app — v1.1 Document Storage, Maintenance Requests, Reporting Dashboards*
*Researched: 2026-03-20*
