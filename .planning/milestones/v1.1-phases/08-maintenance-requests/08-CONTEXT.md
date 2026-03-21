# Phase 8: Maintenance Requests - Context

**Gathered:** 2026-03-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Tenants can submit maintenance requests with photos and priority, landlords can manage status and log costs, and both parties receive push notifications at the right moments. Covers migration 022, storage bucket for request photos, RLS policies, status state machine trigger, push notification integration, and full UI (submit/list/detail/status management/cost logging). Requirements: MAINT-01 through MAINT-06.

</domain>

<decisions>
## Implementation Decisions

### Request Submission UX
- **D-01:** Photo input offers both camera capture and gallery selection (two buttons)
- **D-02:** Up to 5 photos per request
- **D-03:** Priority picker is a horizontal segmented control: Low | Normal | Urgent
- **D-04:** Default priority is Normal (pre-selected)
- **D-05:** Form fields: description (required text area), photos (optional, up to 5), priority (segmented, defaults to Normal)

### Request List & Filtering
- **D-06:** Two entry points: property detail screen (contextual, that property's requests) AND tools menu card (standalone, all requests across properties with property picker)
- **D-07:** List is grouped by status sections: Open, In Progress, Resolved/Closed
- **D-08:** Full filter bar at top with status filter AND priority filter, plus sort toggle (newest/oldest)
- **D-09:** Each request card shows: description preview, colored status chip, priority indicator, relative timestamp. Tap opens detail.

### Status Management UX
- **D-10:** Landlord updates status via a primary action button on the detail screen for the next logical step (e.g., "Acknowledge" when open, "Start Work" when acknowledged, "Mark Resolved" when in progress, "Close" when resolved)
- **D-11:** Notes are optional on every status change — text field appears but is not required
- **D-12:** Full vertical activity timeline on the request detail screen showing every status change with timestamp, who changed it, and any notes. Visible to both tenant and landlord.
- **D-13:** Database BEFORE UPDATE trigger enforces valid status transitions (matches payment state machine pattern from migration 017). Valid transitions: open → acknowledged, acknowledged → in_progress, in_progress → resolved, resolved → closed

### Cost Logging Flow
- **D-14:** When landlord marks a request as "resolved," an optional cost field appears inline: "Log repair cost?" with amount input
- **D-15:** Add nullable `maintenance_request_id` FK column to existing `expenses` table to link expense back to the request
- **D-16:** Expense form auto-fills: category='Maintenance', description='Repair: [request title]', property_id from the request. Landlord just enters the amount.

### Claude's Discretion
- Upload progress UI (progress bar vs spinner for photo uploads)
- Exact card styling, spacing, and animations
- Loading skeleton design for request lists
- Error state handling for failed uploads
- Activity timeline visual design (icons, colors, connector lines)
- Empty state illustrations and copy
- Photo gallery/viewer on detail screen (can reuse DocumentViewer pattern)
- Notification body text wording

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & Roadmap
- `.planning/REQUIREMENTS.md` — MAINT-01 through MAINT-06 define all maintenance request requirements
- `.planning/ROADMAP.md` — Phase 8 success criteria (5 acceptance tests)

### Prior Decisions (STATE.md)
- `.planning/STATE.md` — "Accumulated Context > Decisions" section contains locked decisions:
  - No new Edge Functions — direct Supabase client calls protected by RLS; existing `send-push` handles notifications
  - `is_property_owner()` helper function for RLS (migration 005)

### Existing Patterns to Follow
- `supabase/migrations/017_payment_state_machine.sql` — BEFORE UPDATE trigger pattern for status transitions
- `supabase/migrations/019_documents.sql` — Table + storage bucket + RLS in single migration, soft-delete pattern
- `supabase/migrations/016_rls_with_check.sql` — RLS policy pattern with separate SELECT/INSERT/UPDATE/DELETE and WITH CHECK
- `components/DocumentUploader.tsx` — File upload component pattern (adapt for photo capture)
- `components/DocumentViewer.tsx` — Full-screen viewer pattern (reuse for request photos)
- `components/CategoryFilterBar.tsx` — Filter chip bar component (reuse for status/priority filters)
- `hooks/useExpenses.ts` — Hook with Realtime subscription pattern
- `lib/documents.ts` — Upload via base64 ArrayBuffer pattern, signed URL generation
- `lib/expenses.ts` — Category helpers pattern (getCategoryLabel, getCategoryColor)
- `app/property/[id]/expenses/add.tsx` — Expense form pattern (amount, category, description, date)
- `supabase/functions/send-push/index.ts` — Push notification Edge Function (invoke from client after DB write)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `DocumentUploader` component: Adapt for photo capture (add camera option alongside gallery)
- `DocumentViewer` component: Reuse for viewing request photos full-screen
- `CategoryFilterBar` component: Reuse for status and priority filter chips
- `EmptyState` component: Reuse for empty request lists
- `ConfirmDialog` component: Reuse for delete/close confirmation dialogs
- `ListSkeleton` component: Reuse for loading states
- `GlassCard` / `AnimatedCard`: Card components for request list items
- `DwellaHeader`: Standard screen header
- `send-push` Edge Function: Already handles batched Expo push notifications

### Established Patterns
- Supabase Storage upload: base64 → ArrayBuffer → `storage.from(bucket).upload()` (lib/documents.ts)
- RLS with `is_property_owner()` SECURITY DEFINER helper (migration 005)
- Soft-delete: `is_archived` + `archived_at` columns, all queries filter `WHERE is_archived = FALSE`
- Hooks with Realtime: `supabase.channel()` subscription for live updates
- Toast: `useToastStore.getState().showToast()` for success/error feedback
- Analytics: `useTrack()` hook with named events
- Navigation: `useLocalSearchParams()` + `useRouter()` in Expo Router

### Integration Points
- `app/(tabs)/tools/index.tsx` — Add Maintenance Requests card (flip comingSoon flag or add new card)
- `app/property/[id]/` — Add maintenance requests section/link to property detail
- `supabase/migrations/022_maintenance_requests.sql` — New migration for table, storage bucket, RLS, trigger
- `lib/types.ts` — Add `MaintenanceRequest` and `MaintenanceStatusLog` interfaces
- `constants/colors.ts` — Add request status colors (open→gray, acknowledged→blue, in_progress→amber, resolved→green, closed→teal)
- `expenses` table — Add nullable `maintenance_request_id` FK column
- `lib/notifications.ts` — Push token already registered; invoke `send-push` after status changes
- `app/notifications/index.tsx` — Add icon/color cases for new notification types

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches within the decisions captured above.

</specifics>

<deferred>
## Deferred Ideas

- Maintenance request categories (plumbing, electrical, HVAC, etc.) — MAINT-F01, deferred to v2
- Vendor assignment and dispatch — MAINT-F02, deferred to v2
- Preventive maintenance scheduling — MAINT-F03, deferred to v2
- Auto-escalation of stale requests (cron job) — possible future enhancement
- Tenant ability to reopen closed requests — not in current scope

</deferred>

---

*Phase: 08-maintenance-requests*
*Context gathered: 2026-03-21*
