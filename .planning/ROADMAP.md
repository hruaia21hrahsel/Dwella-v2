# Roadmap: Dwella v2

## Milestones

- ✅ **v1.0 Launch Audit & Hardening** — Phases 1-5 (shipped 2026-03-19)
- ✅ **v1.1 Tools Expansion** — Phases 6-10 (shipped 2026-03-21)
- 🚧 **v1.2 WhatsApp Bot** — Phases 11-14 (in progress)

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

<details>
<summary>✅ v1.1 Tools Expansion (Phases 6-10) — SHIPPED 2026-03-21</summary>

- [x] Phase 6: AI Tools Removal (1/1 plans) — completed 2026-03-20
- [x] Phase 7: Document Storage (4/4 plans) — completed 2026-03-21
- [x] Phase 8: Maintenance Requests (4/4 plans) — completed 2026-03-21
- [x] Phase 9: Reporting Dashboards (4/4 plans) — completed 2026-03-21
- [x] Phase 10: Maintenance Wiring Fixes (1/1 plans) — completed 2026-03-21

Full details: `.planning/milestones/v1.1-ROADMAP.md`

</details>

### 🚧 v1.2 WhatsApp Bot (In Progress)

**Milestone Goal:** Make the WhatsApp bot fully functional with Meta Business API integration, media support, interactive menus across both platforms, new AI intents, outbound notifications, and PDF report delivery.

- [x] **Phase 11: Setup & Infrastructure** — Meta account setup, WhatsApp linking flow, shared whatsapp-send helper, template submission (completed 2026-03-21)
- [x] **Phase 12: Media Handling** — Inbound photo payment proof and document sharing via WhatsApp (completed 2026-03-21)
- [x] **Phase 13: Rich Messaging & Menus** — Interactive button menus on both WhatsApp and Telegram, welcome message, PDF report delivery (completed 2026-03-21)
- [ ] **Phase 14: Intents & Outbound Notifications** — New AI intents (maintenance, payments, property summary) and outbound template notifications

## Phase Details

### Phase 11: Setup & Infrastructure
**Goal**: WhatsApp Business API is fully operational, users can link their WhatsApp account to Dwella, and the shared outbound messaging helper is in place for all future phases
**Depends on**: Phase 10 (previous milestone complete)
**Requirements**: SETUP-01, SETUP-02, SETUP-03
**Success Criteria** (what must be TRUE):
  1. A developer can follow SETUP-01 documentation to configure Meta Business API end-to-end without needing additional references
  2. User can complete the WhatsApp account linking flow via verification code and see their account confirmed as linked
  3. User can tap "Open WhatsApp" after linking and land directly in the Dwella bot conversation
  4. The shared whatsapp-send Edge Function handles text, interactive, template, and document message types from a single call point
  5. All 4 Meta notification templates are submitted and pending approval before any code in subsequent phases requires them
**Plans**: 2 plans

Plans:
- [x] 11-01: Meta Business API setup guide + System User token + whatsapp-send Edge Function
- [x] 11-02: WhatsApp account linking flow (verification code, SETUP-02, SETUP-03) + DB migration

### Phase 12: Media Handling
**Goal**: Tenants can send a photo via WhatsApp and it attaches as payment proof, and users can exchange documents via the WhatsApp bot
**Depends on**: Phase 11
**Requirements**: MEDIA-01, MEDIA-02
**Success Criteria** (what must be TRUE):
  1. Tenant sends a photo in WhatsApp chat and bot attaches it as payment proof to the correct tenant and month without any app interaction
  2. User sends a document (lease, receipt) via WhatsApp and bot stores and acknowledges it
  3. Bot responds with a confirmation message when media is successfully processed, or a clear error if classification fails
  4. Inbound media is downloaded from Meta CDN within 5 minutes of receipt and stored in Supabase Storage
**Plans**: 2 plans

Plans:
- [x] 12-01-PLAN.md — whatsapp-media Edge Function (two-step CDN download, Claude vision classification, Supabase Storage upload)
- [x] 12-02-PLAN.md — Media type routing in whatsapp-webhook + unsupported media error replies

### Phase 13: Rich Messaging & Menus
**Goal**: Both WhatsApp and Telegram bots present interactive button menus, users can navigate all bot features via buttons or freeform text, new users receive a welcome message, and landlords can download a PDF report by picking month and year
**Depends on**: Phase 12
**Requirements**: RICH-01, RICH-02, RICH-03, RICH-04, RICH-05
**Success Criteria** (what must be TRUE):
  1. First-time user receives a welcome message immediately after WhatsApp account linking that explains what the bot can do
  2. User sees a 5-category main menu (Properties, Payments, History, Maintenance, Others) at the start of each new session on both WhatsApp and Telegram
  3. Tapping any main menu category reveals contextual sub-option buttons that trigger the correct action or explanatory response
  4. User can accomplish any bot action by typing freeform text — buttons are shortcuts, not the only path
  5. User can request a PDF report via the History menu, pick a month and year, and receive the PDF file in the same chat
**Plans**: 3 plans

Plans:
- [x] 13-01-PLAN.md — BUTTON_LOOKUP dispatch table in process-bot-message + callback_query handling and inline keyboard support in telegram-webhook
- [x] 13-02-PLAN.md — Interactive button_reply routing in whatsapp-webhook + session detection (last_bot_message_at migration) + welcome message on account linking
- [x] 13-03-PLAN.md — generate-pdf Edge Function (HTML-to-PDF via html2pdf.app) + pdf_month_ handler wiring + document delivery on both platforms

### Phase 14: Intents & Outbound Notifications
**Goal**: Users can ask the bot about maintenance status, upcoming payments, and property summary in natural language, and tenants and landlords receive proactive WhatsApp notifications for reminders, payment confirmations, and maintenance updates
**Depends on**: Phase 13 (menus complete), Meta template approval (submitted Phase 11)
**Requirements**: INTENT-01, INTENT-02, INTENT-03, OUT-01, OUT-02, OUT-03
**Success Criteria** (what must be TRUE):
  1. User asks bot "what's the status of my sink repair?" and receives a current maintenance status and history summary
  2. User asks bot "what do I owe?" and receives a structured upcoming payments response with amounts and due dates
  3. Landlord asks bot for a property summary and receives occupancy, vacancy, and rent collection status in one message
  4. Tenant receives a WhatsApp rent reminder 3 days before, on, and 3 days after the due date without the bot ever sending a free-form text message outside the 24-hour session window
  5. Tenant receives a WhatsApp payment confirmation receipt when their payment is confirmed
  6. Tenant and landlord both receive a WhatsApp notification when a maintenance request status changes
**Plans**: TBD

Plans:
- [ ] 14-01: New Claude intents (query_maintenance_status, query_upcoming_payments, query_property_summary) + extended buildContext() with maintenance data
- [ ] 14-02: notify-whatsapp Edge Function + auto-confirm-payments hook + send-reminders template fix (replace free-form with dwella_rent_reminder template)

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Compilation & Tooling Baseline | v1.0 | 4/4 | Complete | 2026-03-18 |
| 2. Security & Data Integrity | v1.0 | 4/4 | Complete | 2026-03-18 |
| 3. Edge Functions & Backend | v1.0 | 2/2 | Complete | 2026-03-19 |
| 4. Client Code & UX | v1.0 | 2/2 | Complete | 2026-03-19 |
| 5. Launch Configuration & Store Gate | v1.0 | 2/2 | Complete | 2026-03-19 |
| 6. AI Tools Removal | v1.1 | 1/1 | Complete | 2026-03-20 |
| 7. Document Storage | v1.1 | 4/4 | Complete | 2026-03-21 |
| 8. Maintenance Requests | v1.1 | 4/4 | Complete | 2026-03-21 |
| 9. Reporting Dashboards | v1.1 | 4/4 | Complete | 2026-03-21 |
| 10. Maintenance Wiring Fixes | v1.1 | 1/1 | Complete | 2026-03-21 |
| 11. Setup & Infrastructure | v1.2 | 2/2 | Complete    | 2026-03-21 |
| 12. Media Handling | v1.2 | 2/2 | Complete    | 2026-03-21 |
| 13. Rich Messaging & Menus | v1.2 | 3/3 | Complete   | 2026-03-21 |
| 14. Intents & Outbound Notifications | v1.2 | 0/2 | Not started | - |
