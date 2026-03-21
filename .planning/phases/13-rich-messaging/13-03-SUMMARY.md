---
phase: 13-rich-messaging
plan: "03"
subsystem: api
tags: [pdf, html2pdf, edge-function, supabase-storage, telegram, whatsapp, bot]

# Dependency graph
requires:
  - phase: 13-rich-messaging-01
    provides: BUTTON_LOOKUP dispatch, buildMonthPickerMessages, pdf_month_ placeholder, sendTelegramDocument
  - phase: 13-rich-messaging-02
    provides: sendWhatsAppDocument, sendBotResponse in whatsapp-webhook

provides:
  - generate-pdf Edge Function (HTML-to-PDF via html2pdf.app, Supabase Storage upload, signed URL)
  - handlePdfGeneration in process-bot-message (replaces placeholder, triggers generation)
  - document field in ButtonResponse and BotResponse types
  - Document delivery handling in both whatsapp-webhook and telegram-webhook sendBotResponse
  - GENERATE_PDF_URL constant in process-bot-message
  - Async handleButtonPress with userId parameter

affects: [14-outbound-messaging]

# Tech tracking
tech-stack:
  added: [html2pdf.app (external API via fetch)]
  patterns:
    - External API PDF generation pattern (POST HTML, receive base64, decode chunked, upload to Storage)
    - Signed URL document delivery pattern (1-hour expiry, stored in pdf-reports private bucket)
    - Async BUTTON_LOOKUP dispatch (handleButtonPress now async to support PDF generation)
    - Multi-field response extension (document field in BotResponse propagated through all 3 services)

key-files:
  created:
    - supabase/functions/generate-pdf/index.ts
  modified:
    - supabase/functions/process-bot-message/index.ts
    - supabase/functions/whatsapp-webhook/index.ts
    - supabase/functions/telegram-webhook/index.ts

key-decisions:
  - "html2pdf.app response field name uncertainty handled by trying pdf ?? base64 ?? content ?? data — logs keys on failure"
  - "Chunked base64 decode (byte-by-byte loop) prevents stack overflow on large PDF buffers — same pattern as Phase 12 media"
  - "handleButtonPress made async only when needed — pdf_month_ is the only async case, all others return synchronously"
  - "document field sent alongside buttons in response — webhook decides send order (reply text, then PDF, then navigation buttons)"
  - "pdf-reports Storage bucket is private with 1-hour signed URL — PDF not publicly accessible, expires after delivery window"

patterns-established:
  - "Pattern: External API PDF — POST HTML to html2pdf.app, receive base64, chunked decode to Uint8Array, upload to Storage, return signed URL"
  - "Pattern: Bot document delivery — process-bot-message adds document field to BotResponse, both webhooks check and call their send-document helper"

requirements-completed: [RICH-03]

# Metrics
duration: 3min
completed: 2026-03-21
---

# Phase 13 Plan 03: PDF Report Generation and Delivery Summary

**generate-pdf Edge Function converts HTML payment reports to PDF via html2pdf.app, stores in Supabase Storage, and delivers via signed URL through both WhatsApp and Telegram bots**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-03-21T15:23:11Z
- **Completed:** 2026-03-21T15:26:00Z
- **Tasks:** 2
- **Files modified:** 4 (1 created, 3 modified)

## Accomplishments

- Created generate-pdf Edge Function: fetches per-property payment data, builds branded HTML report with tenant table and status colors, converts to PDF via html2pdf.app, uploads to private pdf-reports Storage bucket, returns 1-hour signed URL
- Wired pdf_month_ button handler in process-bot-message: replaced placeholder with async handlePdfGeneration that calls generate-pdf and returns document delivery instructions
- Extended document delivery across both webhooks: whatsapp-webhook and telegram-webhook sendBotResponse now checks botData['document'] and calls their respective send-document helpers

## Task Commits

Each task was committed atomically:

1. **Task 1: Create generate-pdf Edge Function** - `901242a` (feat)
2. **Task 2: Wire pdf_month_ handler and document delivery** - `04f864b` (feat)

## Files Created/Modified

- `supabase/functions/generate-pdf/index.ts` - New Edge Function: fetchReportData, buildReportHtml, htmlToPdf, escapeHtml, serve handler; produces signed_url + filename + caption
- `supabase/functions/process-bot-message/index.ts` - Added GENERATE_PDF_URL, handlePdfGeneration, async handleButtonPress with userId; extended ButtonResponse and BotResponse types with document field; serve handler passes user_id to handleButtonPress
- `supabase/functions/whatsapp-webhook/index.ts` - sendBotResponse checks botData['document'] and calls sendWhatsAppDocument
- `supabase/functions/telegram-webhook/index.ts` - sendBotResponse checks botData['document'] and calls sendTelegramDocument

## Decisions Made

- html2pdf.app response field name is LOW confidence — tried multiple candidates (pdf, base64, content, data) with console.error logging response keys on failure for easy debugging when live API is available
- Chunked base64 decode (byte-by-byte loop) matches the Phase 12 media pattern — prevents stack overflow on large PDF ArrayBuffers
- handleButtonPress made async instead of creating a separate async wrapper — cleaner, and only pdf_month_ case is async; all other branches return synchronously via `return buildMainMenu()` etc.
- Document is sent after the text reply but before navigation buttons — user reads confirmation text, then receives PDF, then sees navigation

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

Two items require manual setup before this feature works end-to-end:

1. **html2pdf.app API key** — Register at html2pdf.app, copy API key from dashboard, then set in Supabase secrets: `supabase secrets set HTML2PDF_API_KEY=your_key_here`

2. **pdf-reports Storage bucket** — Create via Supabase Dashboard: Storage → New bucket → name: `pdf-reports` → Private (no public access)

## Known Stubs

None. The pdf_month_ placeholder from Plan 13-01 is now fully replaced with real PDF generation.

## Next Phase Readiness

- Phase 13 (rich-messaging) is now complete — all 3 plans executed
- PDF report delivery fully wired for both WhatsApp and Telegram
- generate-pdf can be deployed: `supabase functions deploy generate-pdf`
- Phase 14 (outbound messaging) can proceed — generate-pdf is available for receipt delivery

---
*Phase: 13-rich-messaging*
*Completed: 2026-03-21*
