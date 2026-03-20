# Project Research Summary

**Project:** Dwella v2 — v1.1 Tools Expansion
**Domain:** React Native / Expo property management — Document Storage, Maintenance Requests, Reporting Dashboards, AI Tools Removal
**Researched:** 2026-03-20
**Confidence:** HIGH

## Executive Summary

Dwella v1.1 is an additive milestone on a complete, shipped codebase (Expo SDK 54, Supabase, Zustand). All four feature areas — Document Storage, Maintenance Requests, Reporting Dashboards, and AI Tools Removal — can be built by extending existing patterns rather than introducing new architectural paradigms. Only three new npm packages are required (`expo-document-picker`, `react-native-webview`, `react-native-gifted-charts`), all Expo managed-workflow compatible with zero native config plugins. The existing hook pattern (`useExpenses`), storage bucket pattern (`payment-proofs`), and RLS design are directly reusable templates for every new feature.

The recommended build order is: (1) remove AI tools first to free navigation slots and eliminate dead Edge Function references, (2) write the single database migration that creates both new tables and storage buckets, (3) build Document Storage and Maintenance Requests (these are independent of each other and can proceed in parallel after the migration), (4) build Reporting Dashboards last since it reads only existing tables and has no new schema dependencies. Reporting is the lowest-risk feature because all data already exists in `payments`, `expenses`, `tenants`, and `properties`.

The critical risk area is storage and data integrity: Supabase Storage RLS policies require `WITH CHECK` on INSERT (not `USING`), signed URLs expire after 1 hour by default, and deleting a document metadata row without calling `storage.remove()` leaves orphaned files consuming storage quota indefinitely. These are not difficult to prevent but are silent failures that only surface in production. A dedicated `lib/documents.ts` helper must enforce the correct delete sequence before any delete UI is wired. A secondary risk is reporting query performance: aggregate queries against tables with EXISTS-subquery RLS policies cause per-row evaluation that degrades at 100+ rows — composite indexes on `(property_id, year, month, status)` must be included in the migration, not added later.

## Key Findings

### Recommended Stack

The stack is almost entirely fixed by the existing codebase. Only three new packages are needed, all installed via `npx expo install` with no native config plugins or EAS rebuild required. `expo-document-picker` (~14.0.0) is the first-party Expo document picker for managed workflow. `react-native-gifted-charts` (^1.4.76) covers all four chart types needed using the already-installed `react-native-svg` and `expo-linear-gradient` as peers — zero additional installs. `react-native-webview` (~14.1.1) is the only viable path to inline PDF rendering in Expo managed workflow; native PDF libraries like `react-native-pdf` require a custom dev build and break OTA update compatibility.

**Core technologies (net-new additions only):**
- `expo-document-picker` (~14.0.0): Pick PDF, DOCX, and images from device and cloud drives — first-party, SDK 54 pinned, no eject required
- `react-native-gifted-charts` (^1.4.76): Bar, line, pie, and donut charts — SVG-based using already-installed peers, zero new native modules, actively maintained
- `react-native-webview` (~14.1.1): Inline PDF rendering via Google Docs Viewer URL — the only managed-workflow-compatible PDF viewer option that preserves OTA compatibility

### Expected Features

The AI Tools Removal must happen before any new screens are added to navigation. Document Storage and Maintenance Requests are independent of each other. Reporting Dashboards require no new schema at all.

**Must have for v1.1 (P1 — table stakes):**
- AI Tools screens and Edge Functions removed, navigation slots freed
- Document upload (landlord and tenant) with property-level and tenant-level scoping
- Document listing and signed URL download with expiry-aware caching
- Maintenance request submission (tenant) and status management (landlord)
- Maintenance status flow: open → in_progress → resolved → closed
- Push notification on maintenance status change (reuses existing `send-push` Edge Function)
- Financial P&L dashboard per property and portfolio rollup
- Expense breakdown by category chart
- Rent collection rate and occupancy rate per property

**Should have after validation (P2 — differentiators):**
- Maintenance request photos (separate `maintenance-photos` storage bucket, adds upload complexity)
- Maintenance cost linking to existing expenses table (high value, FK is the only new schema addition)
- Priority levels on maintenance requests (low/normal/urgent — simple filter/sort addition)
- Tenant payment reliability score (computed from existing `payments` table, no new schema)
- Document expiry tracking (`expires_at` field on documents, dashboard warning within 30 days)
- Date-range filtering on reports (essential for tax-year use cases, date picker on all report queries)

**Defer to v2+:**
- Maintenance comment thread (meaningful Realtime infrastructure addition; validate base messaging is insufficient first)
- E-signature integration (legal liability and third-party SDK complexity)
- Preventive maintenance scheduling (calendar/cron complexity; different product scope)
- CSV export for reports (defer until large-portfolio landlords request it)

### Architecture Approach

All new features slot into the existing `app/tools/` Stack navigator without layout changes — Expo Router registers new screen files automatically. The pattern is consistent: new screen in `app/tools/`, new hook in `hooks/`, metadata helpers in `lib/`, shared components modeled on existing equivalents (`PaymentStatusBadge` → `MaintenanceStatusBadge`, `ProofUploader` → `DocumentUploader`). No Zustand expansion is needed; all state is hook-local. A single migration (019) creates both new tables and both new storage buckets. No new Edge Functions are required — document CRUD, maintenance CRUD, and report aggregation are all direct Supabase client operations protected by RLS; the existing `send-push` Edge Function handles maintenance notifications client-side.

**Major components:**
1. `app/tools/documents.tsx` — document list and upload screen, mirrors `expenses/index.tsx` structure
2. `app/tools/maintenance.tsx` + `maintenance-detail.tsx` — request list and detail, mirrors payment detail pattern
3. `app/tools/reports.tsx` — aggregate chart dashboard, consumes `useReports(year)` hook with no Realtime subscription
4. `hooks/useDocuments`, `useMaintenanceRequests`, `useReports` — new hooks, all mirror `useExpenses.ts` pattern exactly
5. `lib/documents.ts` + `lib/maintenance.ts` — metadata helpers and the critical `deleteDocument()` function enforcing storage + DB atomicity
6. Migration 019 — `documents` table, `maintenance_requests` table, `property-docs` bucket, `maintenance-photos` bucket, all 8 RLS policies, and composite reporting index on `payments`

### Critical Pitfalls

1. **Storage RLS INSERT policy uses USING instead of WITH CHECK** — Supabase Storage evaluates `WITH CHECK` for writes and `USING` for reads only; using the wrong clause means write access restrictions silently do nothing. Every `FOR INSERT` storage policy must use `WITH CHECK (...)`. Mirror `002_storage.sql` and run the Supabase security linter after every migration.

2. **Signed URL expiry causes silently broken document links** — Private bucket URLs expire after 1 hour by default. Store URLs with an `expiresAt` timestamp and regenerate 60 seconds before expiry. Use 24-hour `expiresIn` for documents. Never persist signed URLs in Zustand across app restarts.

3. **Document metadata deleted without removing the storage object** — Deleting a `documents` table row does not delete the file from Supabase Storage. Always call `supabase.storage.from('documents').remove([path])` before deleting the metadata row. Enforce this invariant via a single `deleteDocument()` function in `lib/documents.ts` — callers must never invoke storage and DB deletes separately.

4. **Reporting aggregate queries degrade due to per-row RLS subquery evaluation** — EXISTS-subquery RLS is re-evaluated per row during aggregate queries, causing 200-800ms latency per chart card. Add composite indexes on `(property_id, year, month, status)` in the migration and rewrite report queries to use `property_id IN (SELECT id FROM properties WHERE owner_id = auth.uid())` — a subquery evaluated once.

5. **AI tools route strings remain in navigation after screen files are deleted** — Expo Router routes are plain strings; TypeScript does not catch dead routes unless `typedRoutes: true` is enabled. Search the codebase for route strings before deleting screen files, update `tools/index.tsx` simultaneously, and verify `npx tsc --noEmit` passes after deletion. Also audit `process-bot-message` for Claude API tool definitions referencing removed features.

## Implications for Roadmap

The dependency chain is unambiguous: AI removal unblocks navigation and eliminates dead Edge Function references. The migration unblocks all client code. Document Storage and Maintenance Requests are independent of each other after the migration. Reporting Dashboards depend only on existing tables and can technically proceed as soon as types are defined, but benefit from the Tools tab being populated first.

### Phase 1: AI Tools Removal

**Rationale:** Zero dependencies — pure deletion. Must happen first to free navigation slots and remove dead Edge Function references that would conflict with new screens. Removing broken references before adding new ones prevents hard-to-diagnose runtime crashes and keeps the build clean throughout subsequent phases.
**Delivers:** Clean navigation, no dead routes, `tools/index.tsx` ready for three new entries, `process-bot-message` free of removed tool definitions, `hooks/useAiNudge.ts` and `components/AiInsightCard.tsx` removed.
**Addresses:** AI Tools Removal (P1), unblocks navigation placement for all three new feature areas.
**Avoids:** Pitfall 5 (AI tools routes still referenced after screen deletion) and Pitfall 10 (Edge Function dead references causing bot malfunction from stale Claude tool definitions).

### Phase 2: Database Foundation (Migration 019)

**Rationale:** Both new tables and both new storage buckets must exist before any client code is testable. A single migration ensures RLS is audited once, together, before upload code is written. Composite reporting indexes belong here so they are present before any aggregate query is run — adding them post-launch requires a second migration and may require `REINDEX` in production.
**Delivers:** `documents` table (with soft-delete, FK references, CHECK constraints), `maintenance_requests` table (status CHECK, priority CHECK, `photo_paths TEXT[]`, `linked_expense_id ON DELETE SET NULL`), `property-docs` bucket, `maintenance-photos` bucket, all 8 RLS policies with correct `WITH CHECK` on INSERT, composite index on `payments(property_id, year, month, status)`.
**Avoids:** Pitfall 1 (missing WITH CHECK on storage INSERT policies), Pitfall 2 (soft-delete not present on new tables), Pitfall 6 (maintenance expense FK must be `ON DELETE SET NULL` not CASCADE), Pitfall 9 (maintenance photos reusing wrong bucket with colliding RLS).

### Phase 3: Document Storage

**Rationale:** After migration exists, Document Storage has no further dependencies. `lib/documents.ts` with atomic `deleteDocument()` must be written before any delete UI — the lib layer enforces storage invariants. Install `expo-document-picker` and `react-native-webview` here. Signed URL expiry handling must be implemented on day one, not added after a user reports broken links.
**Delivers:** `useDocuments` hook with Realtime subscription and `is_archived` filter, `DocumentUploader` component (extends `ProofUploader` with `expo-document-picker` support for PDFs and DOCX), `app/tools/documents.tsx` screen with property-level and tenant-level scoping, expiry-aware signed URL rendering, atomic document delete.
**Uses:** `expo-document-picker` (new install), `react-native-webview` (new install, PDF inline view via Google Docs Viewer URL), `expo-image-picker` (already installed, for image documents), Supabase Storage `property-docs` bucket.
**Implements:** Document Upload Flow (two-step INSERT-then-UPDATE prevents orphaned DB rows), Storage Path Convention, Signed URL Expiry Pattern.
**Avoids:** Pitfall 3 (signed URL expiry), Pitfall 4 (orphaned storage objects on delete), Pitfall 8 (using `storage.list()` for document listing instead of the metadata table).

### Phase 4: Maintenance Requests

**Rationale:** Independent of Document Storage — both Phase 3 and Phase 4 can proceed after Phase 2 in a single-developer sequential workflow, or in parallel with two developers. Maintenance Requests reuse the same hook pattern and the existing `send-push` Edge Function for notifications. Build the base workflow (submit, list, status update) before adding photos or expense linking.
**Delivers:** `useMaintenanceRequests` hook, `MaintenanceStatusBadge` component, `app/tools/maintenance.tsx` (list view filtered by status), `app/tools/maintenance-detail.tsx` (status transitions, expense linking, landlord notes), push notification to landlord on request creation via existing `send-push` Edge Function.
**Uses:** `expo-image-picker` (already installed) for request photos, Supabase Storage `maintenance-photos` bucket, existing `send-push` Edge Function (called client-side after INSERT).
**Implements:** Maintenance Request Flow, Soft-Delete Pattern, status as TEXT CHECK without DB trigger (simpler than payment state machine — no financial invariants to enforce at DB level).
**Avoids:** Pitfall 6 (expense FK behavior — `ON DELETE SET NULL` enforced in migration), Pitfall 9 (separate bucket from `payment-proofs`).

### Phase 5: Reporting Dashboards

**Rationale:** Lowest risk — reads only existing tables, zero new schema. Install `react-native-gifted-charts` here. `useReports` omits Realtime (analytical data; `useFocusEffect` reload is sufficient). Parallel `Promise.all` for three aggregate queries. Performance must be validated via `EXPLAIN ANALYZE` before shipping — the composite index added in Phase 2 is the primary mitigation, but the production query plan should be confirmed.
**Delivers:** `useReports(year)` hook with year-scoped parallel aggregate queries, `app/tools/reports.tsx` with P&L bar chart, expense category pie chart, rent collection rate, and occupancy rate per property. Year selector as primary filter. Portfolio-level rollup card.
**Uses:** `react-native-gifted-charts` (new install), `expo-linear-gradient` (already installed, gradient bar fills), existing `payments`, `expenses`, `tenants`, `properties` tables.
**Implements:** Reporting Data Flow (no Realtime subscription, no Edge Function, client-side aggregation sufficient at single-landlord scale up to 50 properties).
**Avoids:** Anti-Pattern 1 from ARCHITECTURE.md (no Realtime on reports), Anti-Pattern 2 (no Edge Function for direct table queries), Pitfall 7 (RLS per-row aggregate degradation — mitigated by composite index from Phase 2).

### Phase Ordering Rationale

- Phase 1 before everything: AI removal has no dependencies, and dead route strings cause runtime crashes in subsequent phases if left in place.
- Phase 2 before Phases 3-5: Client code cannot be tested without the schema. Single migration ensures RLS is audited once and composite reporting indexes are present from the start.
- Phases 3 and 4 are parallel after Phase 2: they share no schema dependencies. In a single-developer workflow, build 3 then 4 sequentially in either order.
- Phase 5 can technically begin after types are defined (Phase 2), but placing it last ensures the Tools tab is populated and the reporting screen is not the sole new user-visible feature in a release.

### Research Flags

Phases with well-documented patterns (no additional research needed):
- **Phase 1 (AI Tools Removal):** Pure file deletion and route cleanup. Standard Expo Router and Supabase CLI operations.
- **Phase 2 (Migration 019):** Full DDL for both tables and all 8 RLS policies is specified in ARCHITECTURE.md. Execute directly.
- **Phase 4 (Maintenance Requests):** Mirrors `useExpenses` pattern exactly. Status flow is simpler than the payment state machine with no DB trigger required.

Phases that warrant targeted review during planning:
- **Phase 3 (Document Storage — PDF rendering):** The `react-native-webview` + Google Docs Viewer approach has known edge cases with large files, OAuth-protected signed URLs, and offline usage. Validate against a real Supabase signed URL on a physical device before wiring the full documents screen. If Google Docs Viewer proves unreliable, the fallback is a PDF.js HTML string rendered inside WebView (documented in STACK.md).
- **Phase 5 (Reporting — production query plan):** Client-side aggregation performance is sufficient at small scale, but the Postgres query plan in production Supabase can differ from `supabase start` locally. Run `EXPLAIN ANALYZE` on the report queries against production data before shipping. The escape hatch (Postgres RPC function with server-side GROUP BY) is documented in ARCHITECTURE.md and can be added without a screen change.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All three new libraries verified against official Expo SDK 54 docs and package changelogs. Alternatives ruled out with clear technical rationale (react-native-pdf ejects, Victory Native XL requires Skia, recharts is DOM-only). |
| Features | HIGH | Grounded in analysis of AppFolio, Buildium, TenantCloud, and RentRedi feature sets. Feature boundaries and P1/P2/P3 prioritization are clear and consistent. Anti-features are well-justified with alternatives. |
| Architecture | HIGH | Based on direct codebase analysis of existing migrations, hooks, screens, and components. All patterns verified from source files. No speculative design — every new component has an explicit existing analog. |
| Pitfalls | HIGH | Cross-verified with official Supabase Storage docs, Expo docs, and known codebase structure from the v1.0 audit. Specific warning signs and recovery steps provided for each of the 10 identified pitfalls. |

**Overall confidence:** HIGH

### Gaps to Address

- **PDF viewer reliability with Supabase signed URLs:** The Google Docs Viewer URL approach (`https://docs.google.com/viewer?url={encodeURIComponent(signedUrl)}&embedded=true`) is widely used but has intermittent failures with large files and may not work if the signed URL contains certain query parameter characters. Validate against a real signed URL during Phase 3 before committing to this approach. The PDF.js HTML string approach is the documented fallback.

- **iOS iCloud Drive access requirement:** `expo-document-picker` requires `usesIcloudStorage: true` in `app.json` for iCloud Drive documents to appear on iOS. This is a one-line config change but requires an EAS build to validate — it cannot be tested in Expo Go. Flag this for an early EAS build during Phase 3.

- **Reporting query performance on production data:** The composite index on `payments(property_id, year, month, status)` is added in Phase 2, but the actual query plan depends on the production row count and Postgres statistics. Validate with `EXPLAIN ANALYZE` during Phase 5 before release. If the seq scan advisor flag (`auth_rls_initplan`) appears, move to the Postgres RPC function escape hatch documented in ARCHITECTURE.md.

## Sources

### Primary (HIGH confidence)
- Expo DocumentPicker Documentation (SDK 54): https://docs.expo.dev/versions/latest/sdk/document-picker/
- expo-document-picker CHANGELOG — version 14.0.0 targets SDK 54
- react-native-gifted-charts GitHub (v1.4.76): https://github.com/Abhinandan-Kushwaha/react-native-gifted-charts
- react-native-webview Expo Documentation (Fabric support, SDK 54 pin): https://docs.expo.dev/versions/latest/sdk/webview/
- Supabase Storage access control — WITH CHECK vs USING: https://supabase.com/docs/guides/storage/security/access-control
- Supabase Storage signed URL API: https://supabase.com/docs/reference/javascript/storage-from-createsignedurl
- Supabase Storage inefficient folder operations design guide: https://supabase.com/docs/guides/storage/schema/design
- Supabase RLS Database Advisors (auth_rls_initplan): https://supabase.com/docs/guides/database/database-advisors
- Supabase cascade deletes guide: https://supabase.com/docs/guides/database/postgres/cascade-deletes
- Expo Router typed routes: https://docs.expo.dev/router/reference/typed-routes/
- Direct codebase analysis: existing migrations (001, 002, 004, 016), hooks (useExpenses, useDashboard, usePayments), screens (expenses/index.tsx, tools/index.tsx), components (ProofUploader.tsx, PaymentStatusBadge.tsx)

### Secondary (MEDIUM confidence)
- AppFolio, Buildium, TenantCloud, RentRedi feature set analysis (marketing pages and help documentation)
- Property management dashboard KPI guides: secondnature.com, turbotenant.com
- LogRocket: Top React Native Chart Libraries 2025 — comparative analysis confirming gifted-charts maintenance advantage over react-native-chart-kit
- Maintenance request workflow best practices: ftmaintenance.com

### Tertiary (LOW confidence — validate during implementation)
- Supabase RLS performance community discussion: https://github.com/orgs/supabase/discussions/14576 — aggregate query per-row degradation pattern; confirm with EXPLAIN ANALYZE on production data during Phase 5

---
*Research completed: 2026-03-20*
*Ready for roadmap: yes*
