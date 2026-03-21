# Milestones

## v1.2 WhatsApp Bot (Shipped: 2026-03-21)

**Phases completed:** 4 phases, 9 plans, 13 tasks

**Key accomplishments:**

- Self-contained WhatsApp media processing pipeline: two-step Meta CDN download, Claude vision payment classification, Supabase Storage upload for both image and document types, DB writes, and confirmation replies via whatsapp-send.
- Media type detection and delegation added to whatsapp-webhook: image and document messages now route to whatsapp-media; unsupported types (video, audio, sticker, location, contacts) receive an informative rejection reply.
- BUTTON_LOOKUP dispatch with Telegram inline keyboard support, callback_query handling, welcome message on linking, and 1-hour session detection
- One-liner:
- generate-pdf Edge Function converts HTML payment reports to PDF via html2pdf.app, stores in Supabase Storage, and delivers via signed URL through both WhatsApp and Telegram bots
- Three query intent handlers (maintenance status, upcoming payments, property summary) added to process-bot-message with real DB queries callable via Claude freeform dispatch and direct button intercept
- Multi-channel outbound notification system: WhatsApp templates (dwella_rent_reminder, dwella_payment_confirmed, dwella_maintenance_update) + Telegram parity + push fallback via DB trigger and upgraded Edge Functions

---

## v1.1 Tools Expansion (Shipped: 2026-03-21)

**Phases completed:** 5 phases, 14 plans, 20 tasks

**Key accomplishments:**

- One-liner:
- Postgres documents table with per-operation RLS (is_property_owner SECURITY DEFINER), 10 MB Supabase Storage bucket, archive cascade trigger, Document TypeScript interface, and 9-function documents utility library with 25 passing unit tests
- React hook for documents data-fetching with property/tenant tri-state filtering and Supabase Realtime subscription following the established usePayments pattern
- Four theme-aware document UI components — DocumentCard, CategoryFilterBar, DocumentUploader, DocumentViewer — wired to lib/documents.ts utility layer with expo-document-picker and react-native-webview integration
- Standalone and property-contextual document screens wired with upload/view/delete flows, tools menu activated, human-verified
- Postgres migration with maintenance state machine trigger, per-operation RLS, maintenance-photos bucket, TypeScript interfaces, and pure helper module with 16 passing unit tests
- Realtime maintenance_requests hook + 4 reusable UI components (card, photo uploader, filter bar, timeline) ready for screen integration
- app/maintenance/submit.tsx
- One-liner:
- One-liner:
- Six Victory Native @36 chart components with per-datum tap-to-highlight, floating tooltip overlay, empty-state frames, and theme-aware colors throughout.
- 5 UI components for time selection (TimeControlBar), KPI display (KpiCard), loading states (ReportSkeleton), tenant reliability scoring (ReliabilityTable), and tappable property summaries with sparklines (PropertyReportCard)
- hooks/useReportData.ts

---

## v1.0 Launch Audit & Hardening (Shipped: 2026-03-19)

**Phases completed:** 5 phases, 14 plans
**Timeline:** 15 days (2026-03-04 → 2026-03-19)
**Files changed:** 125 files, +13,553 / -545 lines

**Key accomplishments:**

1. Zero TypeScript compilation errors, ESLint with security rules enforced at error severity, Sentry crash monitoring wired
2. RLS policies hardened (28 per-operation policies with WITH CHECK), payment state machine enforced at DB level via BEFORE UPDATE trigger
3. Webhook authentication added (Telegram secret validation, WhatsApp HMAC-SHA256), prompt injection mitigation in Claude bot context
4. All 12 Edge Functions hardened with proper HTTP status codes, soft-delete filtering, and Claude response shape validation
5. Client resilience: auth error toasts with Sentry capture, env var fail-fast, Realtime subscription cleanup in all 10 hooks, push token registration fix
6. App Store readiness: privacy checklist (8 services), AI data disclosure modal on all AI screens, fingerprint OTA policy with forced-update gate

**Requirements:** 26/26 satisfied (TS-01..03, SEC-01..06, DATA-01..04, EDGE-01..05, CLIENT-01..04, LAUNCH-01..04)
**Audit:** tech_debt — all requirements met, 10 non-blocking items tracked (see milestones/v1.0-MILESTONE-AUDIT.md)

**Archives:**

- `milestones/v1.0-ROADMAP.md` — full phase details
- `milestones/v1.0-REQUIREMENTS.md` — requirements with traceability
- `milestones/v1.0-MILESTONE-AUDIT.md` — 3-source cross-reference audit

---
