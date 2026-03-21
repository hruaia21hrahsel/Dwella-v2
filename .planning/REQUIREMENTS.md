# Requirements: Dwella v2

**Defined:** 2026-03-21
**Core Value:** Every user-facing workflow (auth, property CRUD, payments, invites, documents, maintenance, reports, bot) works correctly and securely.

## v1.2 Requirements

Requirements for WhatsApp Bot milestone. Each maps to roadmap phases.

### Setup & Linking

- [x] **SETUP-01**: Meta Business API setup guide with step-by-step instructions for WhatsApp Business Account, phone registration, and access token configuration
- [x] **SETUP-02**: User can link WhatsApp account via verification code flow (env vars configured, Edge Function deployed, end-to-end working)
- [x] **SETUP-03**: User can tap "Open WhatsApp" button to jump directly to Dwella bot conversation after linking

### Media Messages

- [ ] **MEDIA-01**: Tenant can send a photo via WhatsApp and bot attaches it as payment proof to the correct tenant/month
- [ ] **MEDIA-02**: User can send/receive documents (leases, receipts) via WhatsApp bot

### Outbound Messaging

- [ ] **OUT-01**: Tenant receives rent reminder via WhatsApp (3 days before, on due date, 3 days after)
- [ ] **OUT-02**: Tenant receives payment confirmation receipt via WhatsApp when payment is confirmed
- [ ] **OUT-03**: Tenant and landlord receive maintenance status change notifications via WhatsApp

### New Bot Intents

- [ ] **INTENT-01**: User can ask bot about maintenance request status and history
- [ ] **INTENT-02**: User can ask bot about upcoming payments (what's due, when, how much)
- [ ] **INTENT-03**: User can ask bot for property summary (occupancy, vacancy, rent collection status)

### Rich Messaging

- [ ] **RICH-01**: Bot sends warm welcome message to first-time users upon account linking
- [ ] **RICH-02**: Bot presents main menu with 5 categories on each new session (Properties, Payments, History, Maintenance, Others)
- [ ] **RICH-03**: Each main menu category expands into contextual sub-option buttons:
  - **Properties**: view, add, edit, occupancy, summary, delete (responds with explanatory message directing user to the app)
  - **Payments**: log, confirm, upcoming, remind
  - **History**: payments, maintenance, recent activity, download PDF report (user picks month/year)
  - **Maintenance**: submit, status, update
  - **Others**: upload doc, link/unlink account, help, contact landlord/tenant, chat with bot
- [ ] **RICH-04**: Bot supports freeform text alongside button navigation (buttons are shortcuts, not the only path)
- [ ] **RICH-05**: Menu-driven flow works on both Telegram and WhatsApp bots

## Future Requirements

### Deferred from v2 scope

- **DOC-01**: Document expiry dates with reminder notifications
- **DOC-02**: E-signature integration for leases
- **DOC-03**: Document version history
- **MAINT-01**: Maintenance request categories (plumbing, electrical, HVAC)
- **MAINT-02**: Vendor assignment and dispatch
- **MAINT-03**: Preventive maintenance scheduling
- **RPT-01**: Custom date range filters for reports
- **RPT-02**: Year-over-year comparison charts

## Out of Scope

| Feature | Reason |
|---------|--------|
| List messages (structured lists in WhatsApp) | Interactive buttons sufficient for v1.2; lists add complexity |
| Property deletion via bot | Destructive action restricted to app UI for safety |
| WhatsApp-only features diverging from Telegram | Both bots share the same menu-driven experience |
| Video/voice message handling | Photo + document covers primary use cases |
| WhatsApp Business API paid tier features | Start with free tier; upgrade if needed |
| PDF/CSV export of reports from app | Covered via bot PDF download; app export deferred |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| SETUP-01 | Phase 11 | Complete |
| SETUP-02 | Phase 11 | Complete |
| SETUP-03 | Phase 11 | Complete |
| MEDIA-01 | Phase 12 | Pending |
| MEDIA-02 | Phase 12 | Pending |
| OUT-01 | Phase 14 | Pending |
| OUT-02 | Phase 14 | Pending |
| OUT-03 | Phase 14 | Pending |
| INTENT-01 | Phase 14 | Pending |
| INTENT-02 | Phase 14 | Pending |
| INTENT-03 | Phase 14 | Pending |
| RICH-01 | Phase 13 | Pending |
| RICH-02 | Phase 13 | Pending |
| RICH-03 | Phase 13 | Pending |
| RICH-04 | Phase 13 | Pending |
| RICH-05 | Phase 13 | Pending |

**Coverage:**
- v1.2 requirements: 16 total
- Mapped to phases: 16
- Unmapped: 0

---
*Requirements defined: 2026-03-21*
*Last updated: 2026-03-21 after roadmap creation — all 16 requirements mapped*
