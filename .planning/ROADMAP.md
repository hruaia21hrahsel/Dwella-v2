# Roadmap: Dwella v2

## Milestones

- ✅ **v1.0 Launch Audit & Hardening** — Phases 1-5 (shipped 2026-03-19)
- 🚧 **v1.1 Tools Expansion** — Phases 6-9 (in progress)

## Phases

<details>
<summary>✅ v1.0 Launch Audit & Hardening (Phases 1-5) — SHIPPED 2026-03-19</summary>

- [x] Phase 1: Compilation & Tooling Baseline (4/4 plans) — completed 2026-03-18
- [x] Phase 2: Security & Data Integrity (4/4 plans) — completed 2026-03-18
- [x] Phase 3: Edge Functions & Backend (2/2 plans) — completed 2026-03-19
- [x] Phase 4: Client Code & UX (2/2 plans) — completed 2026-03-19
- [x] Phase 5: Launch Configuration & Store Gate (2/2 plans) — completed 2026-03-19

Full details: `.planning/milestones/v1.0-ROADMAP.md`

</details>

### 🚧 v1.1 Tools Expansion (In Progress)

**Milestone Goal:** Replace deprecated AI tools screens with Document Storage, Maintenance Requests, and Reporting Dashboards; remove AI tools backend artifacts.

- [x] **Phase 6: AI Tools Removal** - Delete deprecated screens, Edge Functions, and route references; free navigation slots (completed 2026-03-20)
- [x] **Phase 7: Document Storage** - Migration 019 + storage buckets + full upload/view/download/delete UI for property and tenant documents (completed 2026-03-21)
- [x] **Phase 8: Maintenance Requests** - Tenant submission, landlord status management, photos, expense linking, push notifications (completed 2026-03-21)
- [x] **Phase 9: Reporting Dashboards** - P&L, expense breakdown, payment reliability, occupancy, and portfolio summary charts (completed 2026-03-21)

## Phase Details

### Phase 6: AI Tools Removal
**Goal**: The tools menu is clean — deprecated AI screens are gone, navigation has no dead routes, and the bot backend has no stale tool definitions
**Depends on**: Nothing (pure deletion, no dependencies)
**Requirements**: CLEAN-01, CLEAN-02
**Success Criteria** (what must be TRUE):
  1. AI insights, smart reminders, and AI search items do not appear in the tools menu
  2. Tapping any former AI tool route does not produce a navigation crash or blank screen
  3. `npx tsc --noEmit` passes with zero errors after all screen files are deleted
  4. `process-bot-message` Edge Function no longer references removed Claude tool definitions
**Plans:** 1/1 plans complete
Plans:
- [ ] 06-01-PLAN.md — Delete AI files, update tools menu with Coming Soon cards, clean dashboard

### Phase 7: Document Storage
**Goal**: Landlords and tenants can upload, view, download, and delete documents scoped to properties or individual tenancies, with correct visibility and atomic deletes
**Depends on**: Phase 6
**Requirements**: DOC-01, DOC-02, DOC-03, DOC-04, DOC-05, DOC-06, DOC-07, DOC-08
**Success Criteria** (what must be TRUE):
  1. Landlord can pick a PDF, image, or Word file and upload it to a property; the document appears in the property's document list
  2. Landlord can upload a document tied to a specific tenant; tenant can see it; other tenants in the same property cannot
  3. Property-wide documents uploaded by the landlord are visible to all tenants in that property
  4. User can open a document in-app (PDF renders via WebView, images render inline) and tap to download or share
  5. Deleting a document removes both the storage file and the database row; no orphaned files remain
**Plans:** 4/4 plans complete
Plans:
- [x] 07-01-PLAN.md — Migration 019, install packages, types, config, utility functions
- [x] 07-02-PLAN.md — useDocuments hook with realtime subscription
- [x] 07-03-PLAN.md — UI components (DocumentCard, DocumentUploader, DocumentViewer, CategoryFilterBar)
- [x] 07-04-PLAN.md — Screens, tools menu wiring, end-to-end verification

### Phase 8: Maintenance Requests
**Goal**: Tenants can submit maintenance requests with photos and priority, landlords can manage status and log costs, and both parties receive push notifications at the right moments
**Depends on**: Phase 7
**Requirements**: MAINT-01, MAINT-02, MAINT-03, MAINT-04, MAINT-05, MAINT-06
**Success Criteria** (what must be TRUE):
  1. Tenant can submit a request with a text description, one or more photos, and a priority level (low / normal / urgent)
  2. Landlord receives a push notification immediately when a new request is submitted
  3. Landlord can advance a request through the full status flow (open → acknowledged → in progress → resolved → closed) and add notes at any step
  4. Tenant receives a push notification each time the landlord changes the request status
  5. Landlord can log the repair cost against the request and it appears as a property expense
**Plans:** 4/4 plans complete
Plans:
- [x] 08-01-PLAN.md — Migration 022, types, helpers, unit tests
- [x] 08-02-PLAN.md — Hook with Realtime, UI components (card, photo uploader, filter bar, timeline)
- [x] 08-03-PLAN.md — Submit screen, list screens (standalone + contextual), tools menu wiring
- [x] 08-04-PLAN.md — Detail screen with status management, cost logging, push notifications

### Phase 9: Reporting Dashboards
**Goal**: Landlords can see financial and operational health for each property and across their portfolio without leaving the app
**Depends on**: Phase 8
**Requirements**: RPT-01, RPT-02, RPT-03, RPT-04, RPT-05
**Success Criteria** (what must be TRUE):
  1. Landlord can view a P&L chart (income vs expenses by month) for any property, with a year selector
  2. Landlord can view an expense breakdown donut chart showing spend by category for a selected year
  3. Landlord can view each tenant's payment reliability (on-time percentage and average days late)
  4. Landlord can view occupancy tracking (filled vs vacant units over time) per property
  5. Landlord can view a portfolio-level summary card that rolls up P&L and occupancy across all properties
**Plans:** 4/4 plans complete
Plans:
- [x] 09-01-PLAN.md — Install victory-native@36, TDD aggregation helpers and types
- [x] 09-02-PLAN.md — Chart components (PLBarChart, DonutChart, OccupancyChart, SparklineChart, ChartTooltip, ChartSectionCard)
- [x] 09-03-PLAN.md — Control and display components (TimeControlBar, KpiCard, ReliabilityTable, PropertyReportCard, ReportSkeleton)
- [x] 09-04-PLAN.md — Report screens, data hook, tools menu wiring

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Compilation & Tooling Baseline | v1.0 | 4/4 | Complete | 2026-03-18 |
| 2. Security & Data Integrity | v1.0 | 4/4 | Complete | 2026-03-18 |
| 3. Edge Functions & Backend | v1.0 | 2/2 | Complete | 2026-03-19 |
| 4. Client Code & UX | v1.0 | 2/2 | Complete | 2026-03-19 |
| 5. Launch Configuration & Store Gate | v1.0 | 2/2 | Complete | 2026-03-19 |
| 6. AI Tools Removal | v1.1 | 1/1 | Complete | 2026-03-20 |
| 7. Document Storage | v1.1 | 4/4 | Complete   | 2026-03-21 |
| 8. Maintenance Requests | v1.1 | 4/4 | Complete   | 2026-03-21 |
| 9. Reporting Dashboards | v1.1 | 4/4 | Complete   | 2026-03-21 |
