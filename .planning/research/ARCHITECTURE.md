# Architecture Research

**Domain:** Property management mobile app — v1.1 feature expansion
**Researched:** 2026-03-20
**Confidence:** HIGH (based on direct codebase analysis, all patterns verified from source)

## Context: What Already Exists

This is an additive milestone on a complete, shipped codebase. The existing architecture must not be broken.

```
Existing tables:   users → properties → tenants → payments
                                       ↘ expenses (property-level)
                                       ↘ notifications
                                       ↘ bot_conversations

Existing storage:  payment-proofs/{property_id}/{tenant_id}/{year}-{month}.jpg

Existing hooks:    useProperties, useTenants, usePayments, useExpenses,
                   useAllExpenses, useDashboard, useNotifications,
                   useBotConversations, useAiNudge

Existing screens:  app/(tabs)/tools/index.tsx  <- menu hub (MODIFY)
                   app/tools/ai-insights.tsx   <- REMOVE
                   app/tools/ai-search.tsx     <- REMOVE
                   app/tools/smart-reminders.tsx <- REMOVE

Existing Edge Fns: ai-insights, ai-search, ai-draft-reminders <- DELETE
                   auto-confirm-payments, mark-overdue, send-reminders,
                   send-push, invite-redirect, process-bot-message,
                   telegram-webhook, whatsapp-webhook, whatsapp-send-code
                   (all retained unchanged)
```

## Standard Architecture

### System Overview

```
+------------------------------------------------------------------+
|                      Expo Router Screens                          |
|  app/(tabs)/tools/index.tsx  <- hub, 3 AI entries replaced       |
|  app/tools/documents.tsx     NEW: document list + upload          |
|  app/tools/maintenance.tsx   NEW: maintenance request list        |
|  app/tools/maintenance-detail.tsx  NEW: request detail view       |
|  app/tools/reports.tsx       NEW: reporting dashboard             |
+------------------------------------------------------------------+
|                         Hooks Layer                               |
|  useDocuments(propertyId, tenantId?)    NEW                       |
|  useMaintenanceRequests(propertyId)     NEW                       |
|  useReports(year)                       NEW                       |
|  (all existing hooks unchanged)                                   |
+------------------------------------------------------------------+
|                    lib/ Utilities                                  |
|  lib/documents.ts   NEW: document category metadata              |
|  lib/maintenance.ts NEW: status metadata, transition helpers      |
|  lib/types.ts       MODIFY: add Document, MaintenanceRequest      |
|  (all existing lib files unchanged)                               |
+------------------------------------------------------------------+
|                      Supabase Backend                             |
|  Tables (NEW): documents, maintenance_requests                    |
|  Storage (NEW): property-docs, maintenance-photos                 |
|  RLS: mirrors existing pattern (owner_all + tenant_read)         |
|  Edge Fns: NONE new required (direct client ops with RLS)        |
|  Migration 019: single migration for both tables + storage        |
+------------------------------------------------------------------+
```

### Component Responsibilities

| Component | Responsibility | Pattern |
|-----------|----------------|---------|
| `app/(tabs)/tools/index.tsx` | Tool hub menu — remove 3 AI entries, add Documents/Maintenance/Reports | Modify in place (swap TOOLS array entries) |
| `app/tools/documents.tsx` | List + upload documents; filter by property or tenant scope | New screen, mirrors `expenses/index.tsx` structure |
| `app/tools/maintenance.tsx` | List maintenance requests across all properties (landlord) or own requests (tenant) | New screen, FlatList + status filter chips |
| `app/tools/maintenance-detail.tsx` | View/update a single request; link expense; upload photos | New screen, mirrors payment detail pattern |
| `app/tools/reports.tsx` | Aggregate charts: P&L, expense breakdown, occupancy, payment reliability | New screen, consumes `useReports` + existing `useDashboard` stats |
| `useDocuments` | Fetch docs for a property or tenant; Realtime subscription | Mirrors `useExpenses.ts` exactly |
| `useMaintenanceRequests` | Fetch requests with status filter; Realtime subscription | Mirrors `useExpenses.ts`, adds status dimension |
| `useReports` | Aggregate payment + expense data cross-property for full year | No Realtime; `useFocusEffect` reload only |
| `lib/documents.ts` | Document category enum + label/icon/color metadata | Mirrors `lib/expenses.ts` verbatim |
| `lib/maintenance.ts` | Status enum, valid transitions, label/color metadata | New; simpler than payment state machine |

## Recommended Project Structure

New files only — existing structure unchanged:

```
app/
+-- tools/
|   +-- _layout.tsx              EXISTING — no change needed
|   +-- ai-insights.tsx          REMOVE
|   +-- ai-search.tsx            REMOVE
|   +-- smart-reminders.tsx      REMOVE
|   +-- documents.tsx            NEW
|   +-- maintenance.tsx          NEW
|   +-- maintenance-detail.tsx   NEW
|   +-- reports.tsx              NEW
+-- (tabs)/
    +-- tools/
        +-- index.tsx            MODIFY — swap TOOLS entries

hooks/
+-- useDocuments.ts              NEW (mirrors useExpenses.ts)
+-- useMaintenanceRequests.ts    NEW (mirrors useExpenses.ts + status filter)
+-- useReports.ts                NEW (aggregate query hook, no Realtime)

lib/
+-- documents.ts                 NEW (mirrors expenses.ts metadata pattern)
+-- maintenance.ts               NEW (status metadata + transition helpers)
+-- types.ts                     MODIFY — add Document, MaintenanceRequest types

components/
+-- DocumentUploader.tsx         NEW (extends ProofUploader with non-image files)
+-- MaintenanceStatusBadge.tsx   NEW (mirrors PaymentStatusBadge pattern)

supabase/
+-- migrations/
|   +-- 019_documents_maintenance.sql  NEW (single migration, two tables + storage)
+-- functions/
    +-- ai-insights/             DELETE directory
    +-- ai-search/               DELETE directory
    +-- ai-draft-reminders/      DELETE directory
```

### Structure Rationale

- **app/tools/**: All new screens live under the existing `tools/` Stack navigator. Expo Router registers them automatically — `_layout.tsx` needs no changes.
- **hooks/useReports.ts**: Separate from `useDashboard` — reports span all properties and months, require different aggregation, and do not need Realtime. `useDashboard` remains payment-month focused.
- **Single migration 019**: Both new tables share the same access model and are always deployed together. Splitting adds no value.
- **No new Edge Functions**: Document upload, maintenance CRUD, and report aggregation are all client-executable Supabase queries with RLS. Edge Functions are warranted only for cross-user operations (e.g., notifying a landlord when a tenant files a request). That notification reuses the existing `send-push` Edge Function.

## Architectural Patterns

### Pattern 1: Hook Mirrors useExpenses

**What:** Every new data domain gets a `use[Domain](scopeId)` hook with identical structure: `fetch callback` → `useEffect trigger` → `Realtime channel` → `cleanup return`.

**When to use:** `useDocuments` and `useMaintenanceRequests`. `useReports` omits Realtime (analytical, not live).

**Trade-offs:** Repetitive but explicit. Avoided using a generic factory hook because TypeScript generics over Supabase table names are awkward and reduce auto-complete quality. Explicit hooks are preferred — matches all existing hooks in the codebase.

**Example:**
```typescript
// hooks/useDocuments.ts
export function useDocuments(propertyId: string | null, tenantId?: string | null) {
  const [docs, setDocs] = useState<Document[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    if (!propertyId) { setIsLoading(false); return; }
    // query with .eq('is_archived', false)
  }, [propertyId, tenantId]);

  useEffect(() => { fetch(); }, [fetch]);

  useEffect(() => {
    if (!propertyId) return;
    const channel = supabase.channel(`docs-${propertyId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'documents',
          filter: `property_id=eq.${propertyId}` }, () => fetch())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [propertyId, fetch]);

  return { docs, isLoading, error, refresh: fetch };
}
```

### Pattern 2: Storage Path Convention

**What:** Each storage bucket uses a structured path so RLS policies can validate access by parsing path segments with `split_part(name, '/', n)`.

**When to use:** Every file upload. This pattern is established in the codebase.

**New paths:**
```
property-docs/{property_id}/{doc_id}/{filename}
maintenance-photos/{request_id}/{n}.jpg
```

Path segment 1 is always a FK to a property or request row — this is what the RLS `WITH CHECK` clause validates.

**Trade-offs:** Path-based RLS is tightly coupled to path structure. Changing path structure later requires a storage migration. Accept this: the pattern is established and consistent.

**Important:** Store the raw storage path in the database (not signed URLs). Signed URLs expire (default 1 hour). Generate them at read time: `supabase.storage.from(bucket).createSignedUrl(path, 3600)`.

### Pattern 3: Soft-Delete on All New Tables

**What:** Both `documents` and `maintenance_requests` get `is_archived BOOLEAN NOT NULL DEFAULT FALSE` and `archived_at TIMESTAMPTZ`. Deletes are never hard.

**When to use:** Every table in this codebase. Non-negotiable constraint from PROJECT.md.

**Trade-offs:** Slightly more complex queries. Compensated by the existing index pattern: `CREATE INDEX ON table(is_archived)`. All hooks must include `.eq('is_archived', false)` in their queries.

### Pattern 4: Maintenance Status as TEXT CHECK (No DB Trigger)

**What:** Maintenance status uses `TEXT NOT NULL CHECK (status IN ('open', 'in_progress', 'resolved', 'closed'))`.

**When to use:** `maintenance_requests.status` — simpler than payment state machine.

**Why no trigger:** Unlike payments (financial data, invariants must hold at DB level), maintenance status has no financial consequence. Invalid transitions are caught by client TypeScript. This matches the `expenses` pattern (no trigger) rather than the `payments` pattern (BEFORE UPDATE trigger).

## Data Flow

### Document Upload Flow

```
User selects file (expo-document-picker for PDFs, ImagePicker for images)
    |
    v
Insert row into documents table (storage_path: null)
    |
    v
Upload blob to property-docs/{property_id}/{doc_id}/{filename}
    |
    v
UPDATE documents SET storage_path = '{path}' WHERE id = '{doc_id}'
    |
    v
Realtime fires -> useDocuments refetches -> UI updates
```

`DocumentUploader` component handles this flow. Based on `ProofUploader.tsx` but extended with `expo-document-picker` for non-image files (PDFs, DOCX). The two-step INSERT-then-UPDATE prevents orphaned storage objects (the DB row is always the source of truth).

### Maintenance Request Flow

```
Tenant creates request
    |
    v
INSERT maintenance_requests (status: 'open', reported_by: tenant.user_id)
    |
    +-> Client-side call to send-push Edge Function (existing)
        -> Landlord receives push notification
    |
    v
Landlord opens request in maintenance-detail.tsx
    |
    +-> UPDATE status: 'in_progress'
    +-> Upload photos to maintenance-photos/{request_id}/{n}.jpg
    +-> Link expense (UPDATE linked_expense_id)
    |
    v
UPDATE status: 'resolved' -> 'closed'
```

Push notification on INSERT is done client-side (tenant calls `send-push` via the Supabase client after a successful INSERT). This matches how reminders work today. Database Webhooks for automatic server-side triggers are deferred to a later milestone.

### Reporting Data Flow

```
useReports(year) fires on screen mount (no Realtime subscription)
    |
    v
Three parallel queries (Promise.all — same pattern as useDashboard):
  1. payments for year (all user's properties)
  2. expenses for year (all user's properties)
  3. properties list (for occupancy: active tenants / total_units)
    |
    v
Client-side aggregation:
  - P&L: sum(payments.amount_paid) - sum(expenses.amount)
  - Expense breakdown: group expenses by category
  - Payment reliability: (paid+confirmed count) / total tenant-months * 100
  - Occupancy: active (non-archived) tenants / total_units per property
    |
    v
Pass aggregated numbers to chart components in reports.tsx
```

No Edge Function needed. `useDashboard` already demonstrates this pattern for one month. `useReports` extends it to the full year. Client-side aggregation is sufficient at the scale of a single landlord's portfolio (typical: 1-50 properties).

### State Management

```
Zustand store (auth state only — UNCHANGED)
    |
    v
New hooks: useDocuments, useMaintenanceRequests, useReports
(local React state per screen — same pattern as all existing hooks)
```

No Zustand expansion for new features. All state is hook-local, consistent with how expenses, payments, and notifications are handled today.

## New Database Schema

### Table: documents

```sql
CREATE TABLE documents (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id  UUID NOT NULL REFERENCES properties(id) ON DELETE RESTRICT,
  tenant_id    UUID REFERENCES tenants(id) ON DELETE SET NULL,
  uploaded_by  UUID NOT NULL REFERENCES users(id),
  title        TEXT NOT NULL,
  category     TEXT NOT NULL CHECK (category IN (
    'lease', 'inspection', 'notice', 'invoice', 'insurance', 'other'
  )),
  storage_path TEXT,
  file_name    TEXT,
  file_size    INTEGER,
  mime_type    TEXT,
  notes        TEXT,
  is_archived  BOOLEAN NOT NULL DEFAULT FALSE,
  archived_at  TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

`tenant_id` is nullable: property-level docs have no tenant; tenant-level docs are scoped to one tenant. Both landlord and tenant can upload (bidirectional). `storage_path` is nullable during the upload window — it is set after the storage PUT succeeds.

### Table: maintenance_requests

```sql
CREATE TABLE maintenance_requests (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id       UUID NOT NULL REFERENCES properties(id) ON DELETE RESTRICT,
  tenant_id         UUID NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  reported_by       UUID NOT NULL REFERENCES users(id),
  title             TEXT NOT NULL,
  description       TEXT,
  category          TEXT NOT NULL CHECK (category IN (
    'plumbing', 'electrical', 'structural', 'appliance', 'pest', 'other'
  )),
  priority          TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN (
    'low', 'normal', 'urgent'
  )),
  status            TEXT NOT NULL DEFAULT 'open' CHECK (status IN (
    'open', 'in_progress', 'resolved', 'closed'
  )),
  photo_paths       TEXT[] DEFAULT '{}',
  linked_expense_id UUID REFERENCES expenses(id) ON DELETE SET NULL,
  landlord_notes    TEXT,
  resolved_at       TIMESTAMPTZ,
  is_archived       BOOLEAN NOT NULL DEFAULT FALSE,
  archived_at       TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

`photo_paths` is a TEXT array of raw storage paths — consistent with how `proof_url` is stored in payments. Signed URLs generated at read time. `linked_expense_id` is nullable; if the expense is later deleted, the FK is set NULL (not cascade delete — the request itself persists).

### Storage Buckets

| Bucket | Path Pattern | Who Reads | Who Writes |
|--------|--------------|-----------|------------|
| `property-docs` (NEW) | `{property_id}/{doc_id}/{filename}` | Owner: all. Tenant: own tenant-scoped docs only. | Owner: all. Tenant: own tenant-scoped. |
| `maintenance-photos` (NEW) | `{request_id}/{n}.jpg` | Owner: all. Tenant: own requests only. | Owner: all. Tenant: own requests only. |
| `payment-proofs` (EXISTING) | `{property_id}/{tenant_id}/{year}-{month}.jpg` | Unchanged. | Unchanged. |

### RLS Policies for New Tables

Pattern mirrors existing `payments` and `expenses` policies.

**documents — 4 policies:**
- `documents_owner_all` — FOR ALL USING (property.owner_id = auth.uid())
- `documents_tenant_read` — FOR SELECT USING (tenant.user_id = auth.uid() AND tenant_id IS NOT NULL)
- `documents_tenant_insert` — FOR INSERT WITH CHECK (tenant.user_id = auth.uid() AND tenant_id IS NOT NULL)
- `documents_tenant_update_own` — FOR UPDATE USING (tenant.user_id = auth.uid() AND tenant_id IS NOT NULL)

**maintenance_requests — 4 policies:**
- `maintenance_owner_all` — FOR ALL USING (property.owner_id = auth.uid())
- `maintenance_tenant_read` — FOR SELECT USING (tenant.user_id = auth.uid())
- `maintenance_tenant_insert` — FOR INSERT WITH CHECK (tenant.user_id = auth.uid())
- `maintenance_tenant_update_open` — FOR UPDATE USING (tenant.user_id = auth.uid() AND status = 'open') — tenants can only edit their own still-open requests

**Storage RLS for new buckets** follows the `split_part(name, '/', 1)` pattern from `002_storage.sql`:
- `property-docs`: split_part path segment 1 = property_id — check property.owner_id OR tenants.user_id with tenant_id match
- `maintenance-photos`: split_part path segment 1 = request_id — check maintenance_requests row ownership

## Integration Points

### Existing Code Modified

| File | Change | Detail |
|------|--------|--------|
| `app/(tabs)/tools/index.tsx` | Swap TOOLS array | Remove ai-insights, smart-reminders, ai-search entries. Add documents, maintenance, reports entries pointing to new routes. |
| `lib/types.ts` | Add types | Add `Document`, `MaintenanceRequest`, `MaintenanceStatus`, `DocumentCategory` TypeScript interfaces. |

### Existing Code Deleted

| Path | Reason |
|------|--------|
| `app/tools/ai-insights.tsx` | AI tools removal |
| `app/tools/ai-search.tsx` | AI tools removal |
| `app/tools/smart-reminders.tsx` | AI tools removal |
| `supabase/functions/ai-insights/` | AI tools removal |
| `supabase/functions/ai-search/` | AI tools removal |
| `supabase/functions/ai-draft-reminders/` | AI tools removal |
| `hooks/useAiNudge.ts` | Only used by AI insight card on dashboard |
| `components/AiInsightCard.tsx` | AI tools removal |
| `components/AiDisclosureModal.tsx` | No longer needed without AI features in Tools |

Note: Verify `AiDisclosureModal` and `useAiNudge` are not referenced anywhere outside the AI tools screens before deleting. The dashboard currently imports `AiInsightCard` — that import must be removed from `app/(tabs)/dashboard/index.tsx`.

### Existing Code Unchanged

| Component | Why |
|-----------|-----|
| `ProofUploader.tsx` | Not reused directly (documents need non-image files) but serves as implementation reference for `DocumentUploader` |
| `useExpenses.ts`, `useAllExpenses.ts` | `useReports` queries expense data directly — no hook changes needed |
| `useDashboard.ts` | Reports screen can read stats from `useDashboard` as a secondary data source |
| All auth, property, tenant, payment screens | Zero dependency on AI tools or new features |
| `app/tools/_layout.tsx` | Stack navigator works as-is for new tool screens |
| All Edge Functions except the 3 deleted | No changes to bot, scheduled jobs, notifications, invite flow |

### New Components

| Component | Purpose | Basis |
|-----------|---------|-------|
| `DocumentUploader.tsx` | Upload files (images + PDFs) to `property-docs` | `ProofUploader.tsx` — add `expo-document-picker` support for PDFs/DOCX alongside existing `expo-image-picker` path |
| `MaintenanceStatusBadge.tsx` | Colored chip for open/in_progress/resolved/closed | `PaymentStatusBadge.tsx` pattern verbatim |
| Chart components (inline in reports.tsx) | P&L bar chart, expense pie, reliability and occupancy metrics | See STACK.md for chart library recommendation |

### External Services

| Service | Integration | Notes |
|---------|-------------|-------|
| Supabase Storage | Two new buckets: `property-docs`, `maintenance-photos` | Same client pattern as `payment-proofs`. `supabase.storage.from(bucket).upload()` |
| `send-push` Edge Function | Called client-side after maintenance request INSERT | Existing function at `supabase/functions/send-push/index.ts` — new call site in maintenance creation |
| `expo-document-picker` | Pick PDF/DOCX files on device | Not currently installed — requires `npx expo install expo-document-picker` |

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| 0-1k users | Current approach sufficient. Report aggregation client-side is fast. |
| 1k-10k users | `useReports` full-year query may slow if landlord has 50+ properties. Move to a Postgres RPC function `get_annual_report(user_id, year)` with server-side GROUP BY. |
| 10k+ users | Materialized views for report data, refreshed on payment/expense INSERT via Database Webhooks. |

### Scaling Priorities

1. **First bottleneck:** `useReports` fetches all payments and expenses for the full year across all of the user's properties. At 50 properties with 10 tenants each = 6,000 payment rows. Still fast, but add a Postgres RPC aggregation function as a performance escape hatch when needed.
2. **Second bottleneck:** `maintenance-photos` bucket grows unbounded. Not a concern at this scale. If needed: implement soft-delete on photo storage (add `is_archived` flag to photo records) rather than physical deletion.

## Anti-Patterns

### Anti-Pattern 1: Realtime on Reports

**What people do:** Subscribe to Realtime on the reports screen so charts update live.

**Why it's wrong:** Reports are analytical, not operational. Adding Realtime on aggregated views means re-running expensive multi-table queries on every payment change anywhere in the user's portfolio, causing constant screen refreshes.

**Do this instead:** `useFocusEffect` to reload on screen focus. The same pattern used by `useDashboard`. No Realtime subscription in `useReports`.

### Anti-Pattern 2: New Edge Function for Every Operation

**What people do:** Create an Edge Function for document listing, maintenance CRUD, and report generation.

**Why it's wrong:** All these operations are direct Supabase table queries protected by RLS. Edge Functions add latency, a deployment step, and operational surface with no benefit when the client already has row-level security.

**Do this instead:** Direct client queries in hooks. Edge Functions are warranted only for cross-user operations (push notifications to another user's device) or complex server-side work. Use the existing `send-push` function for maintenance notifications.

### Anti-Pattern 3: Storing Signed URLs in the Database

**What people do:** Generate a signed URL on upload and store it in `storage_path`.

**Why it's wrong:** Signed URLs expire (default 1 hour in Supabase). Stored URLs become invalid and regenerating them requires UPDATE per row.

**Do this instead:** Store the raw storage path (`{property_id}/{doc_id}/{filename}`). Generate signed URLs at read time in the hook using `supabase.storage.from(bucket).createSignedUrl(path, 3600)`.

### Anti-Pattern 4: Hard-Deleting Documents or Requests

**What people do:** Add a DELETE button that calls `supabase.from('documents').delete().eq('id', id)`.

**Why it's wrong:** This codebase uses soft-delete everywhere (`is_archived = TRUE`). Hard-deleting breaks the audit trail and orphans storage objects (the storage file remains but the DB row is gone).

**Do this instead:** `UPDATE documents SET is_archived = TRUE, archived_at = NOW()`. Storage cleanup is a separate background job (deferred to a future milestone).

### Anti-Pattern 5: Separate Navigator for New Tool Screens

**What people do:** Create a new `app/tools/_layout.tsx` or route group for the new features.

**Why it's wrong:** The existing `app/tools/_layout.tsx` Stack navigator already handles all sub-routes. Expo Router registers new files automatically.

**Do this instead:** Drop new screen files into `app/tools/`. No layout changes needed.

## Build Order

Dependencies determine sequence. Each step unblocks the next.

```
Step 1: AI Tools Removal (no deps — pure deletion)
  - Delete 3 screen files, 3 Edge Function directories
  - Remove AiInsightCard import from dashboard
  - Update app/(tabs)/tools/index.tsx: remove 3 AI entries, stub 3 new entries
  - Verify: app builds, Tools tab renders, no import errors

Step 2: Migration 019 (no dep on client code)
  - documents table + RLS
  - maintenance_requests table + RLS
  - property-docs storage bucket + RLS
  - maintenance-photos storage bucket + RLS
  - Verify: supabase db reset passes

Step 3: Types + Lib (depends on Step 2 schema)
  - lib/types.ts: add Document, MaintenanceRequest interfaces
  - lib/documents.ts: category metadata (mirrors lib/expenses.ts)
  - lib/maintenance.ts: status metadata, getCategoryLabel/Icon/Color helpers

Step 4: Document Storage (depends on Steps 2 + 3)
  - Install expo-document-picker
  - hooks/useDocuments.ts
  - components/DocumentUploader.tsx
  - app/tools/documents.tsx
  - Wire route in tools/index.tsx

Step 5: Maintenance Requests (depends on Steps 2 + 3)
  - hooks/useMaintenanceRequests.ts
  - components/MaintenanceStatusBadge.tsx
  - app/tools/maintenance.tsx
  - app/tools/maintenance-detail.tsx
  - Wire route in tools/index.tsx

Step 6: Reporting Dashboard (depends only on existing tables — independent of Steps 4-5)
  - Install chart library (see STACK.md)
  - hooks/useReports.ts
  - app/tools/reports.tsx
  - Wire route in tools/index.tsx
```

Steps 4, 5, and 6 can proceed in any order after Steps 1-3 complete. Steps 4 and 5 can be built in parallel. Step 6 can begin as soon as Step 3 is done since it reads only existing tables.

## Sources

- Direct codebase analysis: `supabase/migrations/001_initial_schema.sql`, `004_expenses.sql`, `002_storage.sql`
- Existing hook implementations: `hooks/useExpenses.ts`, `hooks/useDashboard.ts`, `hooks/usePayments.ts`
- Existing screen pattern: `app/property/[id]/expenses/index.tsx`, `app/(tabs)/tools/index.tsx`
- Existing component patterns: `components/ProofUploader.tsx`, `components/PaymentStatusBadge.tsx`
- Project constraints: `.planning/PROJECT.md` (soft-delete, migration-based, no ejecting, no breaking changes)
- CLAUDE.md architecture decisions: soft-delete pattern, RLS design, storage path conventions

---
*Architecture research for: Dwella v2 v1.1 — Document Storage, Maintenance Requests, Reporting Dashboards*
*Researched: 2026-03-20*
