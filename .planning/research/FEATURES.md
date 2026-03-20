# Feature Research

**Domain:** Property management mobile app — Document Storage, Maintenance Requests, Reporting Dashboards
**Researched:** 2026-03-20
**Confidence:** HIGH (grounded in industry analysis of AppFolio, Buildium, TenantCloud, RentRedi, and Supabase/Expo capability research)

---

## Feature Landscape

This document maps features for three new areas being added in v1.1: Document Storage, Maintenance Requests, and Reporting Dashboards. AI Tools Removal is also scoped here as it unblocks clean navigation structure.

---

### Table Stakes (Users Expect These)

Features users assume exist. Missing these = product feels incomplete.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Upload documents (landlord and tenant) | Landlords need lease storage; tenants expect to access their own docs | MEDIUM | Extends existing Supabase Storage pattern (`payment-proofs` bucket). New bucket `documents` with path `{property_id}/{tenant_id?}/{filename}` |
| View / download uploaded documents | Users assume they can retrieve what they uploaded | MEDIUM | Signed URLs for private bucket access. Expo `FileSystem.downloadAsync` for local save; `Linking.openURL` to open in device viewer |
| Property-level documents (rules, notices) | Landlords share house rules, entry notices, etc. with all tenants | LOW | Documents attached to a property, visible to all linked tenants of that property |
| Tenant-level documents (lease, ID) | Lease agreement is the most important document in the relationship | LOW | Documents attached to a specific tenant row, visible only to that tenant + landlord |
| Document name / type metadata | Users need to know what a file is without opening it | LOW | Store `display_name`, `document_type` enum, `uploaded_by`, `created_at` in `documents` table |
| Delete a document | Landlords need to remove outdated notices; tenants may need to replace ID uploads | LOW | Soft-delete or hard-delete acceptable for docs (not financial records). Supabase Storage `remove()` + DB row update |
| Tenant submits a maintenance request | Core tenant action — "something is broken, report it" | MEDIUM | Form with description (required), category, photos (optional). Writes to `maintenance_requests` table |
| Landlord views all open requests | Landlord must see all pending issues across all properties | MEDIUM | List view grouped by property, filterable by status. Realtime subscription for new requests |
| Maintenance request status flow | Both parties need to track progress of a request | MEDIUM | Status enum: `open → acknowledged → in_progress → resolved → closed`. Landlord drives transitions; tenant sees updates |
| Push notifications on status change | Tenant must know when landlord acknowledges or resolves their request | LOW | Reuses existing Expo push notification infrastructure |
| Maintenance request photos | Tenants provide visual evidence of the problem | MEDIUM | Multiple photos per request. Supabase Storage bucket `maintenance-photos`, path `{property_id}/{request_id}/{filename}` |
| Financial summary dashboard (P&L) | Landlords need to know if the property makes money | MEDIUM | Income (rent collected) vs expenses (tracked via existing expense table) per property and portfolio-wide |
| Expense breakdown by category | Landlords review spend by type (repairs, utilities, etc.) | LOW | Bar or pie chart from existing `expenses` table which already has category. Reuse existing data |
| Rent collection rate | Core KPI — what % of rent owed was collected | LOW | `paid + confirmed / total expected` per property per month. Derived from existing `payments` table |
| Occupancy rate | Landlords need to know vacancy | LOW | `occupied units / total units` per property. Derived from `tenants` where `is_archived = FALSE` |
| Remove AI Tools screens | Navigation currently has AI insights, smart reminders, AI search — these need clean removal | LOW | Delete screens, remove from tab nav, remove Edge Function definitions. No user-facing loss if replacement screens are present |

---

### Differentiators (Competitive Advantage)

Features that set the product apart. Not required, but valued.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Maintenance request cost tracking (linked to expenses) | Closing the loop — maintenance work costs money; link request to expense entry | MEDIUM | Optional `expense_id` FK on `maintenance_requests`. When landlord marks resolved, prompt to log expense. Connects to existing `expenses` table |
| Priority levels on maintenance requests | Landlords triage — water leak vs broken drawer are different urgencies | LOW | `priority` enum: `low / medium / high / emergency`. Landlord sets on acknowledgment (or tenant hints on submission). Simple filter/sort |
| Tenant payment reliability score | At-a-glance read on a tenant's history — useful at lease renewal | MEDIUM | Computed from `payments` table: on-time rate, average days late, overdue count. Display per-tenant on reporting screen |
| Document expiry tracking | Lease agreements expire; tenant IDs may have renewal dates | MEDIUM | Optional `expires_at` field on `documents` table. Dashboard warning for docs expiring within 30 days |
| Maintenance request comments/thread | Back-and-forth between landlord and tenant without leaving the app | HIGH | Simple `maintenance_comments` table: `request_id`, `user_id`, `body`, `created_at`. Adds in-app communication that replaces external WhatsApp/Telegram for maintenance |
| Portfolio summary (multi-property rollup) | Landlords with multiple properties want a single number: total portfolio income and vacancy | LOW | Aggregate all property P&Ls into a single summary card. Pure computation on existing data |
| Date-range filtering on reports | Month-to-date, year-to-date, custom range — landlords need this for tax prep | MEDIUM | Date picker filter applied to all report queries. Standard but often absent in lightweight apps |

---

### Anti-Features (Commonly Requested, Often Problematic)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| E-signature on documents | Seems like obvious next step after document storage | Requires third-party signing SDK (HelloSign, DocuSign) or custom implementation. Out of scope for v1.1; adds legal liability and significant complexity | Store and display documents; note e-signature as v2 feature |
| Vendor / contractor management | Landlords want to assign maintenance to vendors directly | Full vendor database, scheduling, and communication layer — a different product | Keep maintenance requests landlord-managed; notes field covers vendor contact information |
| Preventive maintenance scheduling | PM software differentiator — recurring inspections, filter changes | Calendar/scheduler complexity; Expo managed workflow has no native calendar APIs; cron at DB level requires schema rework | Out of scope for v1.1. Document as v2 consideration |
| Real-time chat in maintenance requests | Modern feel — chat threads per request | Realtime subscription per conversation; message history; read receipts — meaningful infra complexity with Supabase Realtime | Simple comment thread (table stakes differentiator above) covers 80% of the use case at fraction of the cost |
| AI-generated maintenance cost estimates | Novelty value | Claude API removed from tools — adding it back for maintenance creates the same concerns that drove the AI Tools Removal in this milestone | Use historical expense data and manual entry |
| Document OCR / text extraction | Automatically read lease terms from uploaded PDF | Not available in Expo managed workflow. Requires server-side processing and a third-party OCR service | Display documents as-is; manual data entry for key fields |
| In-app PDF editor / annotation | Users want to mark up leases | No viable Expo managed workflow solution for PDF annotation; WebView-based tools are fragile | Link to OS-native apps via `Sharing.shareAsync` or `Linking.openURL` |
| Chart drill-down / export to CSV | Power users want data export | Scope creep; export to CSV requires file generation and share flow. Value is low for most small landlords | Provide clear summary numbers; defer export to v2 |

---

## Feature Dependencies

```
Document Storage
    └──requires──> Supabase Storage bucket (new: `documents`)
    └──requires──> `documents` DB table (new migration)
    └──requires──> RLS policies on `documents` (landlord owns, tenant reads own)

Document Expiry Warnings
    └──requires──> Document Storage (base feature)
    └──requires──> `expires_at` column on `documents` table

Maintenance Requests
    └──requires──> `maintenance_requests` DB table (new migration)
    └──requires──> Supabase Storage bucket (new: `maintenance-photos`)
    └──requires──> RLS policies on `maintenance_requests`

Maintenance Cost Linking
    └──requires──> Maintenance Requests (base feature)
    └──requires──> existing `expenses` table (already built)
    └──requires──> `expense_id` FK on `maintenance_requests`

Maintenance Comments
    └──requires──> Maintenance Requests (base feature)
    └──requires──> `maintenance_comments` table (new migration)

Push Notifications on Status Change
    └──requires──> Maintenance Requests (base feature)
    └──requires──> existing push notification infrastructure (already built)

Reporting Dashboards (P&L, Expense Breakdown)
    └──requires──> existing `payments` table (already built)
    └──requires──> existing `expenses` table (already built)
    └──requires──> existing `tenants` / `properties` tables (already built)
    └──no new DB schema needed for basic reports

Tenant Payment Reliability Score
    └──requires──> existing `payments` table (already built)
    └──computed field, no new schema needed

AI Tools Removal
    └──no dependencies (removals unlock tab nav slots for replacement screens)
    └──unblocks──> document storage screen placement in nav
    └──unblocks──> maintenance screen placement in nav
    └──unblocks──> reporting screen placement in nav
```

### Dependency Notes

- **AI Tools Removal must happen first:** It frees up tab navigation slots and removes deprecated Edge Function calls that would conflict with the new screens. Clean nav structure before adding new screens.
- **Document Storage and Maintenance Requests are independent:** They share no DB dependencies. Can be built in parallel or sequentially without blocking each other.
- **Reporting Dashboards require no new DB schema:** All data is already present in `payments`, `expenses`, `tenants`, `properties`. Pure read/aggregate queries against existing tables. This makes it the lowest-risk feature of the three.
- **Maintenance cost linking requires both Maintenance Requests and the existing expenses table:** The `expenses` table already exists; the FK column is the only new schema addition beyond the base `maintenance_requests` table.
- **Push notifications on maintenance status change reuses existing Expo push infrastructure:** No new setup needed. The `send-reminders` Edge Function pattern can be referenced for the notification send pattern.

---

## MVP Definition

For this milestone, "MVP" means: the minimum feature set that makes each area usable end-to-end by a real landlord and tenant.

### Launch With (v1.1 — Required for this milestone)

- [ ] Document upload (landlord and tenant roles) — without upload, the feature doesn't exist
- [ ] Document listing and signed URL download — without retrieval, upload is useless
- [ ] Property-level and tenant-level document scoping — the two distinct use cases
- [ ] Maintenance request submission (tenant) — core tenant action
- [ ] Maintenance request list and status management (landlord) — core landlord action
- [ ] Maintenance request status flow (open → acknowledged → in_progress → resolved → closed)
- [ ] Push notification on maintenance status change — closes the feedback loop
- [ ] Financial summary dashboard: P&L per property and portfolio rollup
- [ ] Expense breakdown by category chart
- [ ] Rent collection rate per property
- [ ] Occupancy rate per property
- [ ] AI Tools screens and Edge Function definitions removed

### Add After Validation (v1.x)

- [ ] Maintenance request photos — add once base workflow is validated; photos add storage complexity
- [ ] Maintenance cost linking to expenses — high value but requires UX to prompt on resolve
- [ ] Priority levels on maintenance requests — add once landlords are using the base flow
- [ ] Tenant payment reliability score — add once reporting screen is in use
- [ ] Document expiry tracking — add once document storage is in use and landlords request lease renewal alerts
- [ ] Date-range filtering on reports — add when landlords request tax-year reporting

### Future Consideration (v2+)

- [ ] Maintenance request comment thread — meaningful infra addition; validate that base messaging (push) is insufficient first
- [ ] E-signature integration — legal and SDK complexity; validate that document storage alone is used before adding signing
- [ ] Preventive maintenance scheduling — different product scope; validate maintenance request volume first
- [ ] CSV export for reports — defer until landlords with large portfolios request it

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| AI Tools Removal | HIGH (unblocks nav) | LOW | P1 |
| Document upload + listing | HIGH | MEDIUM | P1 |
| Property + tenant doc scoping | HIGH | LOW | P1 |
| Document download (signed URL) | HIGH | LOW | P1 |
| Maintenance request submission | HIGH | MEDIUM | P1 |
| Maintenance request list (landlord) | HIGH | MEDIUM | P1 |
| Maintenance status flow | HIGH | LOW | P1 |
| Push notification on status change | HIGH | LOW | P1 |
| P&L dashboard | HIGH | MEDIUM | P1 |
| Expense category breakdown | MEDIUM | LOW | P1 |
| Rent collection rate | HIGH | LOW | P1 |
| Occupancy rate | MEDIUM | LOW | P1 |
| Maintenance request photos | MEDIUM | MEDIUM | P2 |
| Maintenance cost → expense link | HIGH | MEDIUM | P2 |
| Priority levels on requests | MEDIUM | LOW | P2 |
| Tenant payment reliability score | MEDIUM | MEDIUM | P2 |
| Document expiry tracking | MEDIUM | LOW | P2 |
| Date-range filtering on reports | MEDIUM | MEDIUM | P2 |
| Portfolio summary rollup | MEDIUM | LOW | P2 |
| Maintenance comment thread | LOW | HIGH | P3 |
| E-signature | LOW | HIGH | P3 |
| CSV export | LOW | MEDIUM | P3 |

**Priority key:**
- P1: Must have for v1.1 launch
- P2: Should have, add when possible — v1.1 stretch or v1.2
- P3: Future consideration — v2+

---

## Competitor Feature Analysis

| Feature | AppFolio / Buildium (enterprise) | TenantCloud / RentRedi (SMB) | Our Approach |
|---------|----------------------------------|------------------------------|--------------|
| Document storage | Unlimited, e-signature, templates, audit trail | Basic upload/download, tenant portal access | Upload + download + scoping (property vs tenant). No e-signature in v1.1 |
| Maintenance requests | Full work order system, vendor dispatch, preventive schedules | Submit/track flow, landlord notes, basic status | Submit + status flow + cost link. No vendor dispatch |
| Maintenance photos | Multiple photos, before/after | Photo upload on submission | Photos as P2 stretch — base flow first |
| P&L reporting | GAAP-standard statements, accountant export | Basic income/expense summary | Summary P&L per property, no GAAP formatting needed for small landlords |
| Expense breakdown | Chart + export + category drill-down | Category chart, no export | Chart from existing expenses table. No export in v1.1 |
| Occupancy / vacancy | Dashboard widget with trend lines | Occupancy %, no trends | Static rate from current tenant count. Trends deferred |
| Tenant payment score | Tenant screening integration (external) | Not present | Derived from existing payments table — unique differentiator for our app |
| AI features | AppFolio AI for lease abstraction; Buildium has none | None | Removed from tools screens in v1.1. Bot (Telegram/WhatsApp) remains |

---

## Existing Infrastructure Reuse Map

The following existing systems can be reused directly without new schema or infrastructure:

| Existing System | Reused By |
|-----------------|-----------|
| Supabase Storage (`payment-proofs` bucket pattern) | Document Storage bucket (`documents`), Maintenance Photos bucket (`maintenance-photos`) |
| `expenses` table with `category`, `amount`, `property_id` | Reporting expense breakdown chart, maintenance cost linking |
| `payments` table with `status`, `due_date`, `paid_date`, `amount` | P&L income side, rent collection rate, tenant payment reliability score |
| `tenants` / `properties` tables with `is_archived` | Occupancy rate calculation |
| Expo push notification infrastructure (tokens, `send-reminders` pattern) | Maintenance status change notifications |
| Zustand store + hooks pattern | New hooks: `useDocuments`, `useMaintenance`, `useReports` |
| RLS policy patterns (owner_id checks, tenant user_id checks) | Document and maintenance request access control |
| Soft-delete pattern (`is_archived`) | Maintenance requests and documents should follow same pattern |

---

## Sources

- AppFolio property management feature set (MEDIUM confidence — marketing pages): https://www.appfolio.com/property-manager/maintenance
- Buildium maintenance request management (MEDIUM confidence): https://www.buildium.com/features/maintenance-request-management/
- Capterra property management document management feature list (MEDIUM confidence): https://www.capterra.com/real-estate-property-management-software/features/2709-document-management/
- Property management essential documents guide (MEDIUM confidence): https://ppmnva.com/documents-property-managers-need/
- Rentec Direct records guide (MEDIUM confidence): https://www.rentecdirect.com/blog/property-management-records/
- Supabase Storage with React Native / Expo (HIGH confidence — official docs): https://supabase.com/blog/react-native-storage
- Expo FileSystem docs (HIGH confidence — official): https://docs.expo.dev/versions/latest/sdk/filesystem/
- Property management dashboard KPIs (MEDIUM confidence): https://www.secondnature.com/blog/property-management-dashboard
- P&L for rental property guide (MEDIUM confidence): https://www.turbotenant.com/accounting/profit-and-loss-statements-for-rental-property/
- Maintenance request workflow best practices (MEDIUM confidence): https://ftmaintenance.com/maintenance-management/service-request-management-best-practices/

---

*Feature research for: Dwella v2 v1.1 milestone — Document Storage, Maintenance Requests, Reporting Dashboards*
*Researched: 2026-03-20*
