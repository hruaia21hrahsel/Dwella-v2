---
phase: 12-media-handling
plan: 01
subsystem: api
tags: [whatsapp, meta-graph-api, claude-vision, supabase-storage, deno, edge-functions]

# Dependency graph
requires:
  - phase: 11-setup-infrastructure
    provides: whatsapp-send Edge Function used for all replies

provides:
  - whatsapp-media Edge Function — complete download/classify/store/reply pipeline
  - Two-step Meta CDN download (getMediaDownloadUrl + downloadMediaBinary)
  - Claude vision payment proof classification with structured JSON output
  - Supabase Storage upload for payment-proofs and documents buckets
  - DB update for payments.proof_url and documents table insert
  - Multi-tenancy resolution heuristic (current-month open payment wins)
  - MIME type normalization with octet-stream filename fallback
  - Chunked ArrayBuffer-to-base64 conversion for large images

affects: [12-media-handling-plan-02, phase-13-outbound, phase-14-templates]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Two-step Meta CDN download: GET graph.facebook.com/v21.0/{id} -> GET CDN URL (both with Bearer token, within same invocation)"
    - "Claude vision classification: base64 image + text context block in messages array, parse JSON from response"
    - "Chunked base64 conversion: process ArrayBuffer in 8192-byte slices to prevent stack overflow"
    - "Effective MIME resolution: CDN response > webhook payload > filename extension fallback"

key-files:
  created:
    - supabase/functions/whatsapp-media/index.ts
  modified: []

key-decisions:
  - "buildContext() and sanitizeForContext() copied verbatim from process-bot-message — single source of truth not yet needed given pipeline isolation"
  - "Multi-tenancy heuristic: current-month pending/partial payment wins; first tenant is fallback — avoids ambiguity clarification round-trip for common case"
  - "Create payment row with status 'paid' when none exists — bot upload implies payment was made"
  - "upsert: true on payment-proofs upload — tenant re-sends overwrite gracefully"
  - "Error handler attempts best-effort reply via parsed phone field — error replies require body re-parse which may fail silently"

patterns-established:
  - "Pattern 1: All whatsapp-media replies go through sendWhatsApp() -> whatsapp-send Edge Function (single outbound path)"
  - "Pattern 2: Service role Supabase client for all bot-side Storage operations (bypasses user RLS)"
  - "Pattern 3: Always return HTTP 200 from Edge Functions with success/error in JSON body"

requirements-completed: [MEDIA-01, MEDIA-02]

# Metrics
duration: 12min
completed: 2026-03-21
---

# Phase 12 Plan 01: whatsapp-media Edge Function Summary

**Self-contained WhatsApp media processing pipeline: two-step Meta CDN download, Claude vision payment classification, Supabase Storage upload for both image and document types, DB writes, and confirmation replies via whatsapp-send.**

## Performance

- **Duration:** 12 min
- **Started:** 2026-03-21T14:17:32Z
- **Completed:** 2026-03-21T14:29:00Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments

- Built complete `whatsapp-media` Edge Function (521 lines) handling both image and document media types
- Implemented two-step Meta CDN download with immediate sequencing to avoid 5-minute URL expiry
- Integrated Claude vision classification for payment proof detection with structured JSON output and user context
- Wired Supabase Storage uploads for `payment-proofs` (upsert) and `documents` (insert) buckets
- Applied multi-tenancy resolution heuristic with current-month open payment preference

## Task Commits

Each task was committed atomically:

1. **Task 1: Create whatsapp-media Edge Function** - `8502e06` (feat)

## Files Created/Modified

- `supabase/functions/whatsapp-media/index.ts` — Complete media processing pipeline: CDN download, Claude vision classification, Storage upload, DB update, WhatsApp reply

## Decisions Made

- **buildContext copy vs import:** Copied `buildContext()` and `sanitizeForContext()` from `process-bot-message` verbatim. These Edge Functions are independently deployed Deno modules — there is no shared import mechanism. Duplication is the correct pattern here.
- **Payment row creation on proof upload:** If no payment row exists for the month, create one with `status: 'paid'`. A tenant sending a proof implies they made the payment. If the row already exists, only the `proof_url` is updated.
- **Error handler phone re-parse:** The outer try/catch re-reads the raw body to extract `phone` for a best-effort error reply. This may fail if the body was malformed — in that case the error is swallowed silently (no reply sent), which is acceptable since there is no phone to reply to.
- **Chunked base64 conversion:** `String.fromCharCode(...new Uint8Array(buffer))` spread operator crashes Deno V8 on large buffers (>65K). Implemented 8192-byte chunk loop to prevent stack overflow on real WhatsApp images.

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None — TypeScript compiled cleanly on first attempt, all 13 acceptance criteria verified.

## User Setup Required

None - this plan creates a new Edge Function but no new environment variables. Required env vars (`WHATSAPP_ACCESS_TOKEN`, `ANTHROPIC_API_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`) are already configured from Phase 11.

To deploy: `supabase functions deploy whatsapp-media`

## Next Phase Readiness

- `whatsapp-media` is ready to receive calls from `whatsapp-webhook`
- Plan 02 (webhook routing) will add `WHATSAPP_MEDIA_URL` env var and route inbound `image`/`document` messages to this function
- The function is fully self-contained — Plan 02 only needs to add the delegation call in the webhook

---
*Phase: 12-media-handling*
*Completed: 2026-03-21*
