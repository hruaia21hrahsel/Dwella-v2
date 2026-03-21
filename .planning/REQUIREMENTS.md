# Requirements: Dwella v2

**Defined:** 2026-03-20
**Core Value:** Every user-facing workflow (auth, property CRUD, payments, invites, bot) works correctly and securely.

## v1.1 Requirements

Requirements for v1.1 Tools Expansion. Each maps to roadmap phases.

### AI Cleanup

- [x] **CLEAN-01**: AI insights, smart reminders, and AI search screens are removed from the tools menu
- [x] **CLEAN-02**: Corresponding Edge Functions and Claude tool definitions are removed from the backend

### Document Storage

- [x] **DOC-01**: Landlord can upload documents (PDF, images, Word) to a property
- [x] **DOC-02**: Landlord can upload documents tied to a specific tenant
- [x] **DOC-03**: Tenant can upload documents tied to their own tenancy
- [x] **DOC-04**: User can view uploaded documents in-app (PDF via WebView, images inline)
- [ ] **DOC-05**: User can download or share documents from the app
- [x] **DOC-06**: Property-wide documents are visible to all tenants in that property
- [x] **DOC-07**: Tenant-specific documents are visible only to that tenant and the landlord
- [x] **DOC-08**: User can delete their own uploaded documents (atomic: storage file + DB row)

### Maintenance Requests

- [ ] **MAINT-01**: Tenant can submit a maintenance request with description, photos, and priority level
- [ ] **MAINT-02**: Landlord receives push notification when a new request is submitted
- [ ] **MAINT-03**: Landlord can view, acknowledge, and update maintenance request status (open → acknowledged → in progress → resolved → closed)
- [ ] **MAINT-04**: Landlord can add notes to a maintenance request
- [ ] **MAINT-05**: Tenant receives push notification when request status changes
- [ ] **MAINT-06**: Completed maintenance request can log cost as a property expense

### Reporting Dashboards

- [ ] **RPT-01**: Landlord can view property P&L (income vs expenses per month) with bar/line charts
- [ ] **RPT-02**: Landlord can view expense breakdown by category as pie/donut chart
- [ ] **RPT-03**: Landlord can view tenant payment reliability scores (on-time %, average days late)
- [ ] **RPT-04**: Landlord can view occupancy tracking (filled vs vacant units over time)
- [ ] **RPT-05**: Landlord can view portfolio-level summary across all properties

## Future Requirements

### Document Storage (v2)

- **DOC-F01**: Document expiry dates with reminder notifications
- **DOC-F02**: E-signature integration for leases
- **DOC-F03**: Document version history

### Maintenance Requests (v2)

- **MAINT-F01**: Maintenance request categories (plumbing, electrical, HVAC, etc.)
- **MAINT-F02**: Vendor assignment and dispatch
- **MAINT-F03**: Preventive maintenance scheduling

### Reporting (v2)

- **RPT-F01**: PDF/CSV export of reports
- **RPT-F02**: Custom date range filters
- **RPT-F03**: Year-over-year comparison charts

## Out of Scope

| Feature | Reason |
|---------|--------|
| E-signature | High complexity, third-party dependency — defer to v2 |
| Vendor management / dispatch | Enterprise feature, not needed for SMB landlords |
| Preventive maintenance scheduling | Requires recurring task engine — defer to v2 |
| Real-time collaborative document editing | Not a property management need |
| AI-powered maintenance categorization | Removing AI tools in this milestone — keep scope clean |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| CLEAN-01 | Phase 6 | Complete |
| CLEAN-02 | Phase 6 | Complete |
| DOC-01 | Phase 7 | Complete |
| DOC-02 | Phase 7 | Complete |
| DOC-03 | Phase 7 | Complete |
| DOC-04 | Phase 7 | Complete |
| DOC-05 | Phase 7 | Pending |
| DOC-06 | Phase 7 | Complete |
| DOC-07 | Phase 7 | Complete |
| DOC-08 | Phase 7 | Complete |
| MAINT-01 | Phase 8 | Pending |
| MAINT-02 | Phase 8 | Pending |
| MAINT-03 | Phase 8 | Pending |
| MAINT-04 | Phase 8 | Pending |
| MAINT-05 | Phase 8 | Pending |
| MAINT-06 | Phase 8 | Pending |
| RPT-01 | Phase 9 | Pending |
| RPT-02 | Phase 9 | Pending |
| RPT-03 | Phase 9 | Pending |
| RPT-04 | Phase 9 | Pending |
| RPT-05 | Phase 9 | Pending |

**Coverage:**
- v1.1 requirements: 21 total
- Mapped to phases: 21
- Unmapped: 0 ✓

---
*Requirements defined: 2026-03-20*
*Last updated: 2026-03-20 after roadmap creation*
