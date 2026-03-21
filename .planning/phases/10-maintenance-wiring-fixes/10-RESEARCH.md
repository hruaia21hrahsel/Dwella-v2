# Phase 10: Maintenance Wiring Fixes - Research

**Researched:** 2026-03-21
**Domain:** Expo Router navigation, in-app notification tap handling, property detail screen shortcut cards
**Confidence:** HIGH

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| MAINT-03 | Landlord can view, acknowledge, and update maintenance request status | Gap: notification tap for `maintenance_new` type does not navigate to the request detail. Requires routing logic in `handlePress` in `app/notifications/index.tsx`. |
| MAINT-05 | Tenant receives push notification when request status changes | Gap: notification tap for `maintenance_status_update` type does not navigate to the request detail. Same fix location as MAINT-03. Also requires `requestId` to be stored on the notification row or carried via the existing push data. |
</phase_requirements>

---

## Summary

Phase 8 shipped a complete maintenance request feature but left two integration gaps that reduce its usability:

1. **Notification taps do nothing for maintenance types.** The `handlePress` function in `app/notifications/index.tsx` marks the notification as read then does nothing for `maintenance_new` and `maintenance_status_update` types. The comment explicitly says "// We don't have property_id on the notification, so just go back" — but the push payload already carries `requestId` in `data`. However, the in-app notifications table (`notifications` table) has no `maintenance_request_id` column, and the current Phase 8 code does not INSERT rows into `notifications` at all for maintenance events — it only calls `send-push`. This means there is no `requestId` stored on the notification row to navigate from.

2. **Property detail has a Documents shortcut but no Maintenance shortcut.** `app/(tabs)/properties/[id].tsx` shows a single shortcut card navigating to `/property/${id}/documents`. A matching "Maintenance" shortcut pointing to `/property/${id}/maintenance` is absent.

The fix for gap 1 has two implementation paths depending on what the planner decides: (A) add a `maintenance_request_id` column to the `notifications` table and INSERT rows there during submit/status-change flows, or (B) skip in-app notification rows for maintenance and rely purely on the Expo push `data.requestId` payload — since push taps are already handled in `_layout.tsx` via `addNotificationResponseReceivedListener`. The notification tap in-app (from the bell screen) still needs logic, but the `requestId` from the push payload is not available in the DB row. Path A is cleaner and consistent with how payment notifications work. Path B would leave in-app notification rows without navigation context.

**Primary recommendation:** Add `maintenance_request_id uuid` column to the `notifications` table (new migration 024), INSERT a notification row during both the `submit.tsx` and `[id].tsx` send-push flows, add navigation logic in `handlePress`, and add the Maintenance shortcut card to the property detail screen.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| expo-router | v3 (already installed) | File-based routing + `router.push` | Already the app router |
| React Native (`TouchableOpacity`) | already installed | Shortcut card UI | Matches the existing Documents shortcut pattern exactly |
| `@supabase/supabase-js` | already installed | DB INSERT for notification rows | Existing data layer |

No new libraries are required. This phase is pure wiring — editing existing files and adding a migration.

**Installation:** None needed.

---

## Architecture Patterns

### Recommended Project Structure

No new files or directories are required. The changes touch:

```
app/
  notifications/index.tsx      # Add navigation logic in handlePress
  (tabs)/properties/[id].tsx   # Add Maintenance shortcut card
  maintenance/submit.tsx        # Add notifications.insert after send-push
  maintenance/[id].tsx          # Add notifications.insert after send-push
lib/
  types.ts                      # Add maintenance_request_id to Notification interface
supabase/
  migrations/024_notification_maintenance_fk.sql  # ALTER TABLE notifications ADD COLUMN
```

### Pattern 1: Existing Shortcut Card (Documents)

**What:** A `TouchableOpacity` row with a colored icon circle, label text, and a right chevron. Already exists in `app/(tabs)/properties/[id].tsx` lines 160-170.

**When to use:** Whenever the property detail screen should link to a sub-screen of that property.

**Example (from source — app/(tabs)/properties/[id].tsx lines 160-170):**
```typescript
{/* Documents shortcut */}
<TouchableOpacity
  style={[styles.shortcutCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
  onPress={() => router.push(`/property/${id}/documents` as Href)}
  activeOpacity={0.75}
>
  <View style={[styles.shortcutIcon, { backgroundColor: '#6366F118' }]}>
    <MaterialCommunityIcons name="file-document-outline" size={18} color="#6366F1" />
  </View>
  <Text style={[styles.shortcutLabel, { color: colors.textPrimary }]}>Documents</Text>
  <MaterialCommunityIcons name="chevron-right" size={18} color={colors.textDisabled} />
</TouchableOpacity>
```

The Maintenance shortcut follows identical structure, changing only the icon, tint color, label, and route.

**Maintenance shortcut values to use:**
- Icon: `wrench-outline` (matches the notification icon for `maintenance_new`)
- Tint: `#14B8A6` (teal — already used as the maintenance notification color in `notifications/index.tsx` line 46)
- Background: `#14B8A618`
- Label: `Maintenance`
- Route: `/property/${id}/maintenance`

### Pattern 2: Notification handlePress Navigation

**What:** The `handlePress` function in `app/notifications/index.tsx` currently has routing logic only for payment types (and that routing is itself incomplete — it falls through without navigation). The maintenance types need a case that pushes to `/maintenance/${requestId}`.

**Current state (lines 100-107):**
```typescript
async function handlePress(notif: Notification) {
  track(EVENTS.NOTIFICATION_TAPPED, { type: notif.type });
  if (!notif.is_read) await markRead(notif.id);
  // Navigate based on available context
  if (notif.payment_id && notif.tenant_id) {
    // We don't have property_id on the notification, so just go back
  }
}
```

**After fix:**
```typescript
async function handlePress(notif: Notification) {
  track(EVENTS.NOTIFICATION_TAPPED, { type: notif.type });
  if (!notif.is_read) await markRead(notif.id);
  if (
    (notif.type === 'maintenance_new' || notif.type === 'maintenance_status_update') &&
    notif.maintenance_request_id
  ) {
    router.push(`/maintenance/${notif.maintenance_request_id}` as Href);
  }
}
```

### Pattern 3: INSERT notification row alongside send-push

**What:** Whenever `send-push` is called for a maintenance event, a matching row must be inserted into the `notifications` table so that the in-app bell screen can tap-navigate to the request.

**Existing send-push calls:**
- `app/maintenance/submit.tsx` line 156 — sends `maintenance_new` to the landlord
- `app/maintenance/[id].tsx` line 260 — sends `maintenance_status_update` to the tenant

**Pattern for submit.tsx (after the send-push call):**
```typescript
// Insert in-app notification row for landlord
await supabase.from('notifications').insert({
  user_id: property.owner_id,           // landlord's user id (already fetched)
  maintenance_request_id: inserted.id,  // the new request id
  type: 'maintenance_new',
  title: 'New Maintenance Request',
  body: `${user.full_name ?? 'A tenant'}: ${title.trim().substring(0, 80)}`,
});
```

**Pattern for [id].tsx (after the send-push call):**
```typescript
// Insert in-app notification row for tenant
await supabase.from('notifications').insert({
  user_id: tenant.user_id,
  maintenance_request_id: requestId,
  type: 'maintenance_status_update',
  title: 'Request Update',
  body: `Your maintenance request is now ${STATUS_LABELS[nextStatus]}.`,
});
```

Both inserts must be wrapped in try/catch so notification failures do not block the main flow (consistent with existing push failure handling in submit.tsx lines 170-172).

### Pattern 4: Migration for maintenance_request_id FK on notifications

**What:** Add a nullable FK column to the `notifications` table pointing to `maintenance_requests`.

**Migration 024:**
```sql
ALTER TABLE public.notifications
  ADD COLUMN maintenance_request_id uuid
    REFERENCES public.maintenance_requests(id) ON DELETE SET NULL;

CREATE INDEX idx_notifications_maintenance_request
  ON public.notifications(maintenance_request_id)
  WHERE maintenance_request_id IS NOT NULL;
```

**RLS impact:** None. Existing `notifications_self` policy (SELECT/INSERT/UPDATE WHERE user_id = auth.uid()) already covers the new column automatically — it is a row-level check, not column-level.

### Anti-Patterns to Avoid

- **Do not make notification insert block the main flow.** Wrap in try/catch, consistent with how push failures are handled in submit.tsx.
- **Do not add `maintenance_request_id` as NOT NULL.** Historical notification rows (payment reminders, etc.) would fail. Use nullable with `ON DELETE SET NULL`.
- **Do not duplicate the relativeTime helper.** It already exists in `notifications/index.tsx` locally — no extraction needed (consistent with project decision to keep helpers local).
- **Do not create a separate `maintenance_request_id` field in the push `data` payload.** It is already sent as `data: { type: '...', requestId }` — the in-layout push tap handler (`addNotificationResponseReceivedListener`) already routes via `data.screen` if provided. But the in-app bell screen reads from the DB row, so the DB column is what matters there.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Navigation from notification tap | Custom navigation resolver | `router.push(route as Href)` — already used in _layout.tsx for push taps | Expo Router handles this natively |
| Shortcut card UI | New card component | Duplicate the existing Documents shortcut JSX inline | Card is 11 lines of JSX; no abstraction needed; matches project pattern |
| Notification storage for maintenance | Custom notification system | INSERT into existing `notifications` table | Table, RLS, and useNotifications hook already exist |

**Key insight:** Both changes are pure wiring — connecting existing pieces that were built independently but not linked.

---

## Common Pitfalls

### Pitfall 1: Notification row missing `maintenance_request_id` — tap navigates nowhere

**What goes wrong:** `handlePress` checks `notif.maintenance_request_id` but the INSERT in submit.tsx/[id].tsx did not include it. Navigation silently no-ops.
**Why it happens:** The INSERT and the navigation condition are in two different files; easy to wire only one side.
**How to avoid:** Verify the INSERT includes `maintenance_request_id` in both submit.tsx and [id].tsx before wiring handlePress.
**Warning signs:** Notification row in DB has `maintenance_request_id = null` after submitting a request.

### Pitfall 2: TypeScript error — `maintenance_request_id` not on `Notification` interface

**What goes wrong:** `notif.maintenance_request_id` is referenced in `handlePress` but `lib/types.ts` `Notification` interface does not have the field — TypeScript compile error.
**Why it happens:** Migration adds the DB column but TypeScript interface is not updated.
**How to avoid:** Update `Notification` in `lib/types.ts` to add `maintenance_request_id: string | null`.
**Warning signs:** `npx tsc --noEmit` reports error on `notif.maintenance_request_id`.

### Pitfall 3: Maintenance shortcut shows for tenants on the property detail

**What goes wrong:** The property detail screen (`app/(tabs)/properties/[id].tsx`) renders the shortcut for all users including tenants viewing a landlord's property. Tenants navigating to `/property/${id}/maintenance` will see the property-scoped view which shows all requests — this may be fine (tenants can see their own requests there per RLS), but should be confirmed as intentional.
**Why it happens:** No role gate is applied to the Documents shortcut either — consistent pattern.
**How to avoid:** No change needed — the existing app pattern is to show all shortcut cards to all roles; RLS enforces data visibility. Confirm this is intentional for Maintenance too.
**Warning signs:** Tenants see other tenants' requests — but RLS on `maintenance_requests` prevents this; the existing shortcut to Documents has the same pattern.

### Pitfall 4: INSERT into notifications fails silently — no in-app notification appears

**What goes wrong:** If the Supabase `notifications` INSERT fails (e.g., RLS rejection, network error), the try/catch swallows it and the user sees a success toast but no bell notification appears.
**Why it happens:** Non-blocking try/catch is the correct pattern for notifications (don't break the main flow), but silent failures are invisible.
**How to avoid:** Log the error to console inside the catch block (not a toast, not a re-throw). Matches the existing push failure pattern in submit.tsx line 170.

---

## Code Examples

### 1. Updated Notification interface (lib/types.ts)

```typescript
export interface Notification {
  id: string;
  user_id: string;
  tenant_id: string | null;
  payment_id: string | null;
  maintenance_request_id: string | null;  // ADD THIS
  type: string;
  title: string;
  body: string;
  is_read: boolean;
  created_at: string;
}
```

### 2. Migration 024 (supabase/migrations/024_notification_maintenance_fk.sql)

```sql
-- Migration 024: Add maintenance_request_id FK to notifications
ALTER TABLE public.notifications
  ADD COLUMN maintenance_request_id uuid
    REFERENCES public.maintenance_requests(id) ON DELETE SET NULL;

CREATE INDEX idx_notifications_maintenance_request
  ON public.notifications(maintenance_request_id)
  WHERE maintenance_request_id IS NOT NULL;
```

### 3. handlePress in notifications/index.tsx

```typescript
async function handlePress(notif: Notification) {
  track(EVENTS.NOTIFICATION_TAPPED, { type: notif.type });
  if (!notif.is_read) await markRead(notif.id);
  if (
    (notif.type === 'maintenance_new' || notif.type === 'maintenance_status_update') &&
    notif.maintenance_request_id
  ) {
    router.push(`/maintenance/${notif.maintenance_request_id}` as Href);
  }
}
```

### 4. Maintenance shortcut card in app/(tabs)/properties/[id].tsx

```typescript
{/* Maintenance shortcut */}
<TouchableOpacity
  style={[styles.shortcutCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
  onPress={() => router.push(`/property/${id}/maintenance` as Href)}
  activeOpacity={0.75}
>
  <View style={[styles.shortcutIcon, { backgroundColor: '#14B8A618' }]}>
    <MaterialCommunityIcons name="wrench-outline" size={18} color="#14B8A6" />
  </View>
  <Text style={[styles.shortcutLabel, { color: colors.textPrimary }]}>Maintenance</Text>
  <MaterialCommunityIcons name="chevron-right" size={18} color={colors.textDisabled} />
</TouchableOpacity>
```

Place this immediately after the Documents shortcut card (before the Notes card).

### 5. notifications INSERT in submit.tsx (non-blocking, after send-push)

```typescript
// Insert in-app notification row for landlord (non-blocking)
try {
  await supabase.from('notifications').insert({
    user_id: property.owner_id,
    maintenance_request_id: inserted.id,
    type: 'maintenance_new',
    title: 'New Maintenance Request',
    body: `${user.full_name ?? 'A tenant'}: ${title.trim().substring(0, 80)}`,
  });
} catch (err) {
  console.warn('[Dwella] Failed to insert maintenance_new notification row:', err);
}
```

### 6. notifications INSERT in [id].tsx (non-blocking, after send-push call)

```typescript
// Insert in-app notification row for tenant (non-blocking)
try {
  await supabase.from('notifications').insert({
    user_id: tenant.user_id,
    maintenance_request_id: requestId,
    type: 'maintenance_status_update',
    title: 'Request Update',
    body: `Your maintenance request is now ${STATUS_LABELS[nextStatus]}.`,
  });
} catch (err) {
  console.warn('[Dwella] Failed to insert maintenance_status_update notification row:', err);
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Payment-only notification routing | Add maintenance routing | Phase 10 | In-app notification bell now deep-links to maintenance detail |
| Documents-only property shortcut | Add Maintenance shortcut | Phase 10 | Property detail becomes a launchpad for maintenance list |

**Deprecated/outdated:** None. No patterns being retired.

---

## Open Questions

1. **Should the Maintenance shortcut be landlord-only or visible to tenants too?**
   - What we know: Documents shortcut has no role gate. Tenants on a property CAN access `/property/${id}/maintenance` (RLS shows them their own requests only).
   - What's unclear: Is the UX intent for tenants to use the property detail → maintenance shortcut, or should tenants always access maintenance via Tools → Maintenance?
   - Recommendation: No role gate — mirror the Documents shortcut pattern. If the product owner wants a gate, it can be added as a follow-up using the existing `isOwner` boolean already computed in the screen.

2. **Does the existing RLS on `notifications` allow INSERT with `maintenance_request_id`?**
   - What we know: The `notifications` RLS policy is `notifications_self` — SELECT/INSERT/UPDATE WHERE `user_id = auth.uid()`. Column-level restrictions are not set.
   - What's unclear: Does adding a new nullable FK column require an RLS policy update?
   - Recommendation: No RLS change needed. The policy is row-level; adding a nullable column does not change which rows are accessible. Confidence: HIGH (verified by reading migration 001 and migrations 016 RLS hardening — no column-level grants exist).

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Jest 29 + jest-expo 55 |
| Config file | package.json (`"jest": { ... }`) |
| Quick run command | `npx jest __tests__/maintenance.test.ts --no-coverage` |
| Full suite command | `npx jest --no-coverage` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| MAINT-03 | `maintenance_new` notification tap navigates to `/maintenance/{id}` | unit (pure logic) | `npx jest __tests__/notifications.test.ts --no-coverage` | ❌ Wave 0 |
| MAINT-05 | `maintenance_status_update` notification tap navigates to `/maintenance/{id}` | unit (pure logic) | `npx jest __tests__/notifications.test.ts --no-coverage` | ❌ Wave 0 |
| MAINT-03 | Maintenance shortcut card renders and calls correct route | manual-only | N/A — requires rendered navigation context | manual |
| MAINT-05 | notifications table INSERT includes `maintenance_request_id` | manual-only | N/A — requires live Supabase | manual |

**Note on testability:** The `handlePress` routing logic is a conditional branch on `notif.type` and `notif.maintenance_request_id`. This can be unit-tested by extracting the routing logic into a pure function (`resolveNotificationRoute(notif: Notification): string | null`) and testing it in isolation — no router mock needed.

### Sampling Rate

- **Per task commit:** `npx jest __tests__/notifications.test.ts --no-coverage`
- **Per wave merge:** `npx jest --no-coverage`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `__tests__/notifications.test.ts` — covers MAINT-03, MAINT-05 routing logic

*(Existing `__tests__/maintenance.test.ts` covers pure helpers and does not need changes for this phase.)*

---

## Sources

### Primary (HIGH confidence)

- Source code — `app/notifications/index.tsx` (lines 100-107): confirmed `handlePress` has empty routing for maintenance types
- Source code — `app/(tabs)/properties/[id].tsx` (lines 159-170): confirmed Documents shortcut pattern, no Maintenance shortcut present
- Source code — `app/maintenance/submit.tsx` (line 163): confirmed `requestId` in push data but no `notifications` INSERT
- Source code — `app/maintenance/[id].tsx` (line 266): confirmed `requestId` in push data but no `notifications` INSERT
- Source code — `lib/types.ts` (lines 76-86): confirmed `Notification` interface has no `maintenance_request_id`
- Source code — `supabase/migrations/001_initial_schema.sql` (lines 85-95): confirmed `notifications` table columns
- Source code — `app/_layout.tsx` (lines 221-228): confirmed push tap handler uses `data.screen` for routing

### Secondary (MEDIUM confidence)

- Phase 08 VERIFICATION.md: confirms MAINT-03 and MAINT-05 were marked SATISFIED at the feature level (the data flows work) but the in-app notification tap was not verified as a success criterion

### Tertiary (LOW confidence)

- None.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new libraries; all existing patterns
- Architecture: HIGH — read actual source for every file being changed
- Pitfalls: HIGH — identified from direct code inspection, not inference

**Research date:** 2026-03-21
**Valid until:** 60 days (stable codebase, no fast-moving dependencies)
