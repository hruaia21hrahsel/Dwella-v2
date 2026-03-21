# Phase 8: Maintenance Requests - Research

**Researched:** 2026-03-21
**Domain:** React Native + Expo (ImagePicker / camera), Supabase (Postgres triggers, Storage, RLS), push notifications via existing `send-push` Edge Function
**Confidence:** HIGH — All findings are based on direct inspection of the existing codebase, which is the primary source of truth for this phase.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Request Submission UX**
- D-01: Photo input offers both camera capture and gallery selection (two buttons)
- D-02: Up to 5 photos per request
- D-03: Priority picker is a horizontal segmented control: Low | Normal | Urgent
- D-04: Default priority is Normal (pre-selected)
- D-05: Form fields: description (required text area), photos (optional, up to 5), priority (segmented, defaults to Normal)

**Request List & Filtering**
- D-06: Two entry points: property detail screen (contextual, that property's requests) AND tools menu card (standalone, all requests across properties with property picker)
- D-07: List is grouped by status sections: Open, In Progress, Resolved/Closed
- D-08: Full filter bar at top with status filter AND priority filter, plus sort toggle (newest/oldest)
- D-09: Each request card shows: description preview, colored status chip, priority indicator, relative timestamp. Tap opens detail.

**Status Management UX**
- D-10: Landlord updates status via a primary action button on the detail screen for the next logical step
- D-11: Notes are optional on every status change — text field appears but is not required
- D-12: Full vertical activity timeline on the request detail screen showing every status change with timestamp, who changed it, and any notes. Visible to both tenant and landlord.
- D-13: Database BEFORE UPDATE trigger enforces valid status transitions. Valid transitions: open → acknowledged, acknowledged → in_progress, in_progress → resolved, resolved → closed

**Cost Logging Flow**
- D-14: When landlord marks a request as "resolved," an optional cost field appears inline: "Log repair cost?" with amount input
- D-15: Add nullable `maintenance_request_id` FK column to existing `expenses` table to link expense back to the request
- D-16: Expense form auto-fills: category='Maintenance', description='Repair: [request title]', property_id from the request. Landlord just enters the amount.

**Architecture (from STATE.md)**
- No new Edge Functions — all CRUD is direct Supabase client calls protected by RLS; existing `send-push` handles notifications
- `is_property_owner()` SECURITY DEFINER helper (migration 005) must be used in RLS to avoid recursion

### Claude's Discretion
- Upload progress UI (progress bar vs spinner for photo uploads)
- Exact card styling, spacing, and animations
- Loading skeleton design for request lists
- Error state handling for failed uploads
- Activity timeline visual design (icons, colors, connector lines)
- Empty state illustrations and copy
- Photo gallery/viewer on detail screen (can reuse DocumentViewer pattern)
- Notification body text wording

### Deferred Ideas (OUT OF SCOPE)
- Maintenance request categories (plumbing, electrical, HVAC, etc.) — MAINT-F01
- Vendor assignment and dispatch — MAINT-F02
- Preventive maintenance scheduling — MAINT-F03
- Auto-escalation of stale requests (cron job)
- Tenant ability to reopen closed requests

</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| MAINT-01 | Tenant can submit a maintenance request with description, photos, and priority level | Storage bucket `maintenance-photos` + `maintenance_requests` table; adapt `DocumentUploader` for camera+gallery; priority enum column |
| MAINT-02 | Landlord receives push notification when a new request is submitted | Client-side invoke of `send-push` Edge Function after INSERT; look up landlord push_token via property.owner_id → users.push_token |
| MAINT-03 | Landlord can view, acknowledge, and update maintenance request status (open → acknowledged → in progress → resolved → closed) | BEFORE UPDATE trigger (mirrors migration 017 pattern); primary action button advances to next state |
| MAINT-04 | Landlord can add notes to a maintenance request | `maintenance_status_logs` table records who changed status + optional note text |
| MAINT-05 | Tenant receives push notification when request status changes | Client-side invoke of `send-push` after UPDATE; look up tenant push_token via tenant.user_id → users.push_token |
| MAINT-06 | Completed maintenance request can log cost as a property expense | ALTER TABLE expenses ADD COLUMN maintenance_request_id; auto-fill expense insert on "resolved" |

</phase_requirements>

---

## Summary

Phase 8 introduces the Maintenance Requests feature, which is the most structurally complex phase of v1.1. It requires a new table (`maintenance_requests`), a child table for the activity timeline (`maintenance_status_logs`), a new storage bucket for photos, a BEFORE UPDATE trigger for the status state machine, two notification dispatch calls, an ALTER to the existing `expenses` table, and full UI across four screens.

The codebase provides nearly all required building blocks. The `DocumentUploader` component already handles gallery selection + ImagePicker; it needs a camera button added. The `CategoryFilterBar` component is directly reusable for status and priority filters. The `send-push` Edge Function is already deployed and its API is understood. The payment state machine trigger in migration 017 is the exact pattern to copy for maintenance status transitions. Migration 019 is the template for the combined table + storage bucket + RLS migration.

The most important architectural nuance is the two-table design: `maintenance_requests` holds the mutable current state, and `maintenance_status_logs` is the append-only history that powers the activity timeline. Every status change writes to both. RLS on the log table must be set up so both tenant and landlord can SELECT but only the landlord can INSERT (status changes are landlord-only after submission).

**Primary recommendation:** Follow migration 019 structure exactly: create both tables, the storage bucket, RLS, and the state machine trigger all in a single migration 022. Use the `send-push` client invocation pattern already established in the payment flow.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `expo-image-picker` | bundled with Expo SDK 54 | Camera capture + gallery selection for photos | Already installed; used in DocumentUploader for gallery path |
| `@supabase/supabase-js` | ^2.45.0 | All DB writes and storage uploads | Already installed; all CRUD is direct client calls per project decision |
| `expo-crypto` | bundled with Expo SDK 54 | UUID generation for storage paths | Already in use in `lib/documents.ts` |
| `expo-file-system/legacy` | bundled (legacy import) | Read file as base64 for upload | Already used for document uploads — same pattern applies |
| `base64-arraybuffer` | ^1.0.2 | Decode base64 to ArrayBuffer for storage | Already in use; same upload path as documents |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `react-native-paper` | bundled | UI primitives (TextInput, Button, ActivityIndicator, Surface) | All form and card UI |
| `@expo/vector-icons` MaterialCommunityIcons | bundled | Status icons, priority icons, wrench icons | Icon set already in use project-wide |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Inline cost field at "resolved" step | Separate add-expense screen | Inline is the decision (D-14); avoids extra navigation |
| Append-only `maintenance_status_logs` | Single `notes` column on request | Log table gives full timeline; single column loses history |
| Client-side `send-push` invoke | New Edge Function that sends push | Project decision: no new Edge Functions; client invoke is the pattern |

**Installation:** No new packages required. All dependencies are already present.

---

## Architecture Patterns

### Recommended File/Route Structure

```
lib/
  maintenance.ts           # Pure helpers: storage path, status label/color/icon, priority label/color
lib/types.ts               # Add MaintenanceRequest + MaintenanceStatusLog interfaces
constants/colors.ts        # No change needed (colors added to theme via useTheme)

hooks/
  useMaintenanceRequests.ts  # Realtime hook: list + filtering (mirrors useDocuments.ts)

supabase/migrations/
  022_maintenance_requests.sql  # Table, storage bucket, RLS, trigger, expenses ALTER

app/
  maintenance/
    index.tsx              # Standalone list (tools menu entry point) — all properties, with property picker
  property/[id]/
    maintenance.tsx        # Contextual list (property detail entry point)
  maintenance/
    [id].tsx               # Request detail + status management + timeline (shared by both entry points)
    submit.tsx             # Submit new request form (tenant) — or Modal if preferred

components/
  MaintenanceRequestCard.tsx   # Request list card
  MaintenancePhotoUploader.tsx # Adapted from DocumentUploader — camera + gallery, multi-photo, 5-photo limit
  MaintenanceFilterBar.tsx     # Adapted from CategoryFilterBar — status chips + priority chips
  MaintenanceTimeline.tsx      # Vertical activity timeline
```

### Pattern 1: Multi-Photo Storage Path

Each request gets a folder. Each photo gets its own UUID-named file within it.

```typescript
// Source: lib/documents.ts (adapted pattern)
// Path: {property_id}/{request_id}/{uuid}.jpg
export function getMaintenancePhotoPath(
  propertyId: string,
  requestId: string,
  ext: string,
): string {
  const uuid = Crypto.randomUUID();
  return `${propertyId}/${requestId}/${uuid}.${ext}`;
}
```

Photos are uploaded one at a time after the request row is inserted (request ID is needed for the path). The insert happens first, then photos are uploaded and their paths inserted into a `maintenance_request_photos` join table (or stored as an array column — see schema note below).

### Pattern 2: Status State Machine Trigger (Migration 017 exact copy)

```sql
-- Source: supabase/migrations/017_payment_state_machine.sql
CREATE OR REPLACE FUNCTION public.validate_maintenance_transition()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status = NEW.status THEN
    RETURN NEW;  -- same-status update (e.g., adding note) always allowed
  END IF;

  IF (OLD.status = 'open'         AND NEW.status = 'acknowledged') OR
     (OLD.status = 'acknowledged' AND NEW.status = 'in_progress')  OR
     (OLD.status = 'in_progress'  AND NEW.status = 'resolved')     OR
     (OLD.status = 'resolved'     AND NEW.status = 'closed')
  THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Invalid maintenance transition: % → %', OLD.status, NEW.status;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER validate_maintenance_transition
  BEFORE UPDATE ON public.maintenance_requests
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION public.validate_maintenance_transition();
```

### Pattern 3: Base64 Upload (lib/documents.ts exact copy)

```typescript
// Source: lib/documents.ts uploadDocument()
// Same pattern applies for maintenance photos — no changes needed
const base64 = await FileSystem.readAsStringAsync(asset.uri, {
  encoding: FileSystem.EncodingType.Base64,
});
const { decode } = await import('base64-arraybuffer');
const buffer = decode(base64);
await supabase.storage.from('maintenance-photos').upload(storagePath, buffer, {
  contentType: 'image/jpeg',
  upsert: false,
});
```

### Pattern 4: Push Notification After DB Write

```typescript
// Source: existing payment notification flow
// After inserting a new request, look up landlord push_token and call send-push
const { data: owner } = await supabase
  .from('users')
  .select('push_token')
  .eq('id', property.owner_id)
  .single();

if (owner?.push_token) {
  await supabase.functions.invoke('send-push', {
    body: {
      messages: [{
        token: owner.push_token,
        title: 'New Maintenance Request',
        body: `${tenantName}: ${description.substring(0, 80)}`,
        data: { type: 'maintenance_new', requestId },
      }],
    },
  });
}
```

### Pattern 5: RLS Using is_property_owner() Helper

```sql
-- Source: supabase/migrations/016_rls_with_check.sql + 019_documents.sql pattern
-- Must use is_property_owner() to avoid RLS recursion (migration 005)

-- Landlord SELECT: all requests for their properties
CREATE POLICY "maintenance_requests_landlord_select" ON public.maintenance_requests
  FOR SELECT USING (public.is_property_owner(property_id));

-- Tenant SELECT: their own requests
CREATE POLICY "maintenance_requests_tenant_select" ON public.maintenance_requests
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.tenants t
      WHERE t.id = maintenance_requests.tenant_id
        AND t.user_id = auth.uid()
    )
  );

-- Tenant INSERT: only for their own tenancy
CREATE POLICY "maintenance_requests_tenant_insert" ON public.maintenance_requests
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.tenants t
      WHERE t.id = tenant_id AND t.user_id = auth.uid()
    )
  );

-- Landlord UPDATE only (status changes)
CREATE POLICY "maintenance_requests_landlord_update" ON public.maintenance_requests
  FOR UPDATE USING (public.is_property_owner(property_id))
  WITH CHECK (public.is_property_owner(property_id));
```

### Pattern 6: Realtime Hook (useExpenses.ts / useDocuments.ts pattern)

```typescript
// Source: hooks/useExpenses.ts
export function useMaintenanceRequests(propertyId: string | null) {
  // ... fetch + useState pattern identical to useExpenses
  useEffect(() => {
    if (!propertyId) return;
    const channel = supabase
      .channel(`maintenance-${propertyId}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'maintenance_requests',
        filter: `property_id=eq.${propertyId}`,
      }, () => { fetch(); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [propertyId, fetch]);
}
```

### Anti-Patterns to Avoid

- **INSERT photo paths before inserting the request row:** The storage path includes the request ID, which doesn't exist until the INSERT. Always INSERT the request first, then upload photos.
- **Letting tenant call UPDATE on maintenance_requests:** The RLS UPDATE policy must be landlord-only. Tenant submits (INSERT) but cannot change status.
- **Using FOR ALL RLS policies:** Migration 016 established the pattern of per-operation policies with explicit WITH CHECK. Follow this on every new table.
- **Loading all status logs eagerly in the list view:** Only fetch logs on the detail screen, not in the list query. The list needs `maintenance_requests.*` only.
- **Firing push notifications inside the DB trigger:** No PG function can call the Edge Function. Push must be sent from client code after the DB write succeeds.

---

## Database Schema Design

### Table: maintenance_requests

```sql
CREATE TABLE public.maintenance_requests (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id   uuid NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  tenant_id     uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  title         text NOT NULL,           -- short summary (required, used in expense auto-fill)
  description   text NOT NULL,
  priority      text NOT NULL DEFAULT 'normal'
                CHECK (priority IN ('low', 'normal', 'urgent')),
  status        text NOT NULL DEFAULT 'open'
                CHECK (status IN ('open', 'acknowledged', 'in_progress', 'resolved', 'closed')),
  photo_paths   text[] NOT NULL DEFAULT '{}',  -- array of storage paths (up to 5)
  is_archived   boolean NOT NULL DEFAULT FALSE,
  archived_at   timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
```

**Note on photo_paths vs join table:** Storing photo paths as a `text[]` column is simpler than a join table and sufficient for up to 5 photos. The paths are used to generate signed URLs on demand. This matches the project's preference for simplicity.

### Table: maintenance_status_logs

```sql
CREATE TABLE public.maintenance_status_logs (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id    uuid NOT NULL REFERENCES public.maintenance_requests(id) ON DELETE CASCADE,
  changed_by    uuid NOT NULL REFERENCES auth.users(id),
  from_status   text,                    -- null for the initial creation log entry
  to_status     text NOT NULL,
  note          text,                    -- optional note (D-11)
  created_at    timestamptz NOT NULL DEFAULT now()
);
```

### ALTER TABLE expenses

```sql
ALTER TABLE public.expenses
  ADD COLUMN maintenance_request_id uuid REFERENCES public.maintenance_requests(id) ON DELETE SET NULL;
```

### Indexes

```sql
CREATE INDEX idx_maintenance_requests_property ON public.maintenance_requests(property_id) WHERE is_archived = FALSE;
CREATE INDEX idx_maintenance_requests_tenant   ON public.maintenance_requests(tenant_id)   WHERE is_archived = FALSE;
CREATE INDEX idx_maintenance_requests_status   ON public.maintenance_requests(status)       WHERE is_archived = FALSE;
CREATE INDEX idx_maintenance_status_logs_request ON public.maintenance_status_logs(request_id);
```

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Multi-photo upload | Custom upload queue | Sequential loop over existing `uploadDocument` pattern | Upload is async but simple; loop with error handling is sufficient for 5 photos |
| Status transition enforcement | Client-side if/else checks | DB BEFORE UPDATE trigger (migration 017 pattern) | Client checks can be bypassed; DB trigger is the authoritative guard |
| Push notification delivery | Custom HTTP fetch to Expo Push API | `supabase.functions.invoke('send-push', ...)` | `send-push` already deployed, handles batching, error logging |
| Camera + gallery picker | Native module code | `expo-image-picker` (already installed) | `launchCameraAsync` + `launchImageLibraryAsync` cover both D-01 sources |
| Signed URL for photos | Storing public URLs | `supabase.storage.from('maintenance-photos').createSignedUrl()` | Bucket must be private (same as documents); signed URLs are the access pattern |
| Filter + sort UI | Custom filter component | Adapt `CategoryFilterBar` | Already a horizontal scrollable chip bar; needs generic typing |
| Full-screen photo viewer | New component from scratch | Reuse `DocumentViewer` with image mode | DocumentViewer already handles full-screen modal + ScrollView pinch-to-zoom |
| Empty state UI | New illustration | Reuse `EmptyState` component | Already exists, accepts icon and message props |

**Key insight:** This phase is almost entirely composition of existing patterns. The only genuinely new code is the migration SQL, `lib/maintenance.ts` helpers, `useMaintenanceRequests` hook, and the screen-level UI.

---

## Common Pitfalls

### Pitfall 1: Photo Upload Before Request ID Exists

**What goes wrong:** Storage path includes the request ID for organization (`{propertyId}/{requestId}/{uuid}.jpg`). If photos are uploaded before the INSERT, no request ID exists.

**Why it happens:** Natural desire to show upload progress before saving.

**How to avoid:** INSERT the request row first (with `photo_paths = '{}'`), then upload photos sequentially, then UPDATE `photo_paths` with the final array. Show the spinner on the full submit action.

**Warning signs:** "Cannot read properties of undefined: requestId" errors at upload time.

### Pitfall 2: Tenant Can Update Status (RLS Gap)

**What goes wrong:** If UPDATE policy uses `OR` with both tenant and landlord predicates, a tenant could call UPDATE and set any status.

**Why it happens:** Copy-pasting SELECT policy for UPDATE.

**How to avoid:** UPDATE policy is landlord-only (`is_property_owner(property_id)`). Tenant only has INSERT (submit) rights.

### Pitfall 3: Status Log Not Inserted on Initial Submit

**What goes wrong:** Activity timeline is empty on a freshly submitted request because nothing logged the "open" state.

**Why it happens:** Forgetting to insert the initial log entry (from_status: null, to_status: 'open') after the request INSERT.

**How to avoid:** Always INSERT one `maintenance_status_logs` row immediately after the request INSERT, with `from_status = null`, `to_status = 'open'`, and `changed_by = auth.uid()`.

### Pitfall 4: Push Token May Be Null

**What goes wrong:** `send-push` is called with `token: null`, which causes the Expo Push API to return an error for that message.

**Why it happens:** Users who haven't granted notification permission have `push_token = null` in the `users` table.

**How to avoid:** Always guard: `if (owner?.push_token)` before invoking `send-push`. A missing token is not an error — just skip silently.

### Pitfall 5: Storage RLS Path Must Match Exactly

**What goes wrong:** Storage RLS policies use `split_part(name, '/', N)` to extract segments. If the path schema changes (e.g., adding a folder level), the policy breaks silently — uploads succeed but reads return 403.

**Why it happens:** Seen in migration 020/021 (two consecutive hotfixes for documents storage).

**How to avoid:** Use the path schema `{property_id}/{request_id}/{uuid}.jpg` — two-segment prefix. Write storage RLS policies to match this exact split_part logic. Test with a real signed URL before shipping.

### Pitfall 6: `expenses` UPDATE Policy Doesn't Cover the New Column

**What goes wrong:** The existing `expenses_update` policy (migration 016) only checks `user_id = auth.uid()`. Adding a FK column doesn't change policy logic, but any new expense insert with `maintenance_request_id` must also pass the INSERT WITH CHECK. Because the policy checks `user_id = auth.uid()` only, this is fine — no additional RLS change needed.

**Why it happens:** Over-engineering concern about the new FK column requiring new policy.

**How to avoid:** No change needed to expenses RLS. The new column is nullable and inert from a security perspective. Document this explicitly in the migration.

### Pitfall 7: Notification Type String Not Handled in notifications/index.tsx

**What goes wrong:** New notification types (`maintenance_new`, `maintenance_status_update`) fall through to the `default` case in `iconForType` and `useIconColorForType` — showing a generic bell icon.

**Why it happens:** `app/notifications/index.tsx` has a switch statement for known types that must be extended.

**How to avoid:** Add cases for the two new types to both `iconForType` and `useIconColorForType` in the notifications screen as part of this phase.

---

## Code Examples

### Camera Capture Addition to DocumentUploader Pattern

```typescript
// Source: components/DocumentUploader.tsx (handleChooseFromGallery) + expo-image-picker docs
async function handleTakePhoto() {
  const { status } = await ImagePicker.requestCameraPermissionsAsync();
  if (status !== 'granted') {
    showToast('Camera permission is required.', 'error');
    return;
  }
  const result = await ImagePicker.launchCameraAsync({
    mediaTypes: ['images'],
    quality: 0.8,
    allowsEditing: false,
  });
  if (result.canceled || !result.assets?.[0]) return;
  // add to photos array (capped at 5 per D-02)
}
```

### Status Label / Color Helpers (lib/maintenance.ts pattern)

```typescript
// Mirror of lib/expenses.ts getCategoryLabel/getCategoryColor
export type MaintenanceStatus = 'open' | 'acknowledged' | 'in_progress' | 'resolved' | 'closed';
export type MaintenancePriority = 'low' | 'normal' | 'urgent';

export const STATUS_LABELS: Record<MaintenanceStatus, string> = {
  open: 'Open',
  acknowledged: 'Acknowledged',
  in_progress: 'In Progress',
  resolved: 'Resolved',
  closed: 'Closed',
};

// Status colors (per CONTEXT.md code_context section)
export const STATUS_COLORS: Record<MaintenanceStatus, string> = {
  open: '#94A3B8',        // Gray
  acknowledged: '#3B82F6', // Blue
  in_progress: '#F59E0B',  // Amber
  resolved: '#10B981',     // Green
  closed: '#0D9488',       // Teal
};

// Next valid status for primary action button (D-10)
export const NEXT_STATUS: Partial<Record<MaintenanceStatus, MaintenanceStatus>> = {
  open: 'acknowledged',
  acknowledged: 'in_progress',
  in_progress: 'resolved',
  resolved: 'closed',
};

// Primary action button label (D-10)
export const NEXT_STATUS_LABEL: Partial<Record<MaintenanceStatus, string>> = {
  open: 'Acknowledge',
  acknowledged: 'Start Work',
  in_progress: 'Mark Resolved',
  resolved: 'Close',
};
```

### Expense Auto-Fill on "Resolved" (D-14, D-16)

```typescript
// In the request detail screen, when landlord presses "Mark Resolved"
// After status UPDATE succeeds, optionally create expense
if (costAmount && parseFloat(costAmount) > 0) {
  await supabase.from('expenses').insert({
    property_id: request.property_id,
    user_id: currentUser.id,
    amount: parseFloat(costAmount),
    category: 'maintenance',
    description: `Repair: ${request.title}`,
    expense_date: new Date().toISOString().split('T')[0],
    maintenance_request_id: request.id,
  });
}
```

### Tools Menu Integration (app/(tabs)/tools/index.tsx)

```typescript
// Change comingSoon: true → false and add route: '/maintenance'
{
  label: 'Maintenance',
  description: 'Track and manage maintenance requests',
  icon: 'wrench-outline',
  color: '#14B8A6',
  route: '/maintenance',
  // comingSoon removed
},
```

---

## Integration Points Summary

All integration points are inside the existing codebase — no external services need configuration.

| File | Change |
|------|--------|
| `supabase/migrations/022_maintenance_requests.sql` | Create tables, bucket, RLS, trigger, ALTER expenses |
| `lib/types.ts` | Add `MaintenanceRequest`, `MaintenanceStatusLog` interfaces + `MaintenanceStatus`, `MaintenancePriority` types |
| `lib/maintenance.ts` | New file: storage path helper, status/priority labels, colors, next-status map |
| `hooks/useMaintenanceRequests.ts` | New file: list hook with Realtime (mirrors useExpenses.ts) |
| `app/(tabs)/tools/index.tsx` | Remove `comingSoon` from Maintenance card, add `route: '/maintenance'` |
| `app/property/[id]/` | Add `maintenance.tsx` screen (contextual list) |
| `app/maintenance/index.tsx` | New screen (standalone list, all properties) |
| `app/maintenance/[id].tsx` | New screen (detail + timeline + status actions) |
| `app/maintenance/submit.tsx` | New screen (tenant submit form) |
| `app/notifications/index.tsx` | Add `maintenance_new` and `maintenance_status_update` to iconForType + useIconColorForType |
| `constants/colors.ts` / theme | No structural change needed — colors defined in `lib/maintenance.ts` |

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Jest 29 + jest-expo preset |
| Config file | `jest.config.js` |
| Quick run command | `npx jest __tests__/maintenance.test.ts --no-coverage` |
| Full suite command | `npx jest --no-coverage` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| MAINT-01 | `getMaintenancePhotoPath` returns `{propId}/{reqId}/{uuid}.{ext}` | unit | `npx jest __tests__/maintenance.test.ts --no-coverage` | ❌ Wave 0 |
| MAINT-01 | `validatePriority` accepts low/normal/urgent, rejects other strings | unit | `npx jest __tests__/maintenance.test.ts --no-coverage` | ❌ Wave 0 |
| MAINT-03 | `NEXT_STATUS` map covers all valid transitions | unit | `npx jest __tests__/maintenance.test.ts --no-coverage` | ❌ Wave 0 |
| MAINT-03 | `STATUS_LABELS` has an entry for every status value | unit | `npx jest __tests__/maintenance.test.ts --no-coverage` | ❌ Wave 0 |
| MAINT-06 | Expense auto-fill description is `'Repair: ' + title` | unit | `npx jest __tests__/maintenance.test.ts --no-coverage` | ❌ Wave 0 |
| MAINT-02 | Push notification after INSERT (Supabase client invoked with correct payload) | manual | Device test: submit request, verify landlord push | manual-only — requires device + live Supabase |
| MAINT-05 | Push notification on status change | manual | Device test: landlord changes status, verify tenant push | manual-only — requires device + live Supabase |
| DB trigger | Invalid transition raises exception | manual | Supabase SQL editor: UPDATE with invalid status | manual-only — requires live DB |

### Sampling Rate
- **Per task commit:** `npx jest __tests__/maintenance.test.ts --no-coverage`
- **Per wave merge:** `npx jest --no-coverage`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `__tests__/maintenance.test.ts` — covers MAINT-01, MAINT-03, MAINT-06 pure logic
  - `getMaintenancePhotoPath` path structure
  - `NEXT_STATUS` map completeness
  - `STATUS_LABELS` and `STATUS_COLORS` completeness
  - Expense description auto-fill string format

*(Existing `__tests__/setup.ts` already mocks expo-crypto and supabase — no setup changes needed)*

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `expo-image-picker` v13 mediaTypes string enum | v14+ accepts `['images']` array literal | Expo SDK 52+ | Use `['images']` not `MediaTypeOptions.Images` |
| `FileSystem.EncodingType` direct import | `expo-file-system/legacy` import required | Expo SDK 54 | Use `import * as FileSystem from 'expo-file-system/legacy'` (project decision from Phase 07) |
| Storage RLS with `FOR ALL` | Per-operation policies with explicit `WITH CHECK` | Migration 016 | All new tables must use this pattern |
| `split_part(name, '/', N)` in storage RLS | Same, but requires careful path design | Migration 020/021 hotfixes | Path must be designed before RLS is written |

**Deprecated/outdated:**
- `ImagePicker.MediaTypeOptions.Images`: replaced by array literal `['images']` in Expo SDK 52+. The existing `DocumentUploader` already uses the correct form.

---

## Open Questions

1. **Photo path: INSERT request first, then upload photos — what if upload fails?**
   - What we know: The request row will exist with `photo_paths = '{}'` if uploads fail. The request is submitted but has no photos.
   - What's unclear: Should the tenant see the request as submitted (and add photos later) or should the whole operation be atomic?
   - Recommendation: Submit the DB row first, then attempt uploads. If any upload fails, show an error toast but keep the request (no partial rollback). The tenant can resubmit with the description. This matches the documents pattern where DB insert and storage are not atomic.

2. **notifications table: add `maintenance_request_id` FK column?**
   - What we know: The `notifications` table has `payment_id` for payment notifications. Adding `maintenance_request_id` would allow tapping a notification to navigate to the correct request.
   - What's unclear: The existing notification tap handler in `notifications/index.tsx` currently does nothing with the payment_id either (there's a comment: "We don't have property_id on the notification, so just go back").
   - Recommendation: For this phase, do NOT add a new FK column to notifications. The notification serves as an alert; the user navigates from the Maintenance list. Keep scope clean. Deep-link navigation from notification tap is deferred.

---

## Sources

### Primary (HIGH confidence)
- Direct codebase inspection — `supabase/migrations/017_payment_state_machine.sql`, `019_documents.sql`, `016_rls_with_check.sql`, `005_fix_rls_recursion.sql` — state machine trigger, storage RLS, and per-operation policy patterns
- Direct codebase inspection — `lib/documents.ts`, `components/DocumentUploader.tsx`, `hooks/useExpenses.ts`, `lib/expenses.ts` — upload, hook, and helper patterns
- Direct codebase inspection — `supabase/functions/send-push/index.ts` — push notification API contract
- Direct codebase inspection — `app/(tabs)/tools/index.tsx` — tools card integration point
- Direct codebase inspection — `app/notifications/index.tsx` — notification type switch statement
- Direct codebase inspection — `__tests__/setup.ts`, `jest.config.js` — test infrastructure

### Secondary (MEDIUM confidence)
- `expo-image-picker` camera API: `launchCameraAsync` is part of the same package already installed; camera permission uses `requestCameraPermissionsAsync()`. Verified against existing gallery usage in `DocumentUploader.tsx`.

### Tertiary (LOW confidence)
- None — all findings are from direct codebase inspection.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all dependencies are already installed and in use
- Architecture: HIGH — direct pattern match to existing migrations and components
- Pitfalls: HIGH — three of the seven pitfalls are based on actual issues already encountered in migrations 020/021
- Test map: HIGH — test framework and setup are confirmed operational

**Research date:** 2026-03-21
**Valid until:** 2026-04-21 (stable codebase; no external dependencies changing)
