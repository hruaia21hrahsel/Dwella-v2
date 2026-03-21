---
phase: 12-media-handling
plan: 02
subsystem: api
tags: [whatsapp, meta-graph-api, edge-functions, media-routing, deno]

# Dependency graph
requires:
  - phase: 12-media-handling
    plan: 01
    provides: whatsapp-media Edge Function that receives delegated media messages

provides:
  - Media type detection in whatsapp-webhook (image, document, unsupported types)
  - Delegation of image/document messages to whatsapp-media with correct payload shape
  - Unsupported media type rejection with user-friendly reply
  - Unlinked number guard on media path

affects: [phase-13-outbound, phase-14-templates]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Media routing before text-empty guard: msgType check sits above !text.trim() so media is never silently dropped"
    - "Inline createClient for media user lookup: created before the main supabase client (which is created post-text-check) — intentional, avoids handler restructure"
    - "Unsupported type guard: array includes() check covers video/audio/sticker/location/contacts as a group"

key-files:
  created: []
  modified:
    - supabase/functions/whatsapp-webhook/index.ts

key-decisions:
  - "Inline createClient for media path: The main supabase client is created at line 178, after the text check. Media routing must happen before that. Rather than restructuring the whole handler, an inline createClient is used for the media user lookup. The Supabase client is lightweight and does not hold a connection pool."
  - "No await on whatsapp-media fetch: The delegation call is awaited so the webhook can catch and send an error reply if the fetch itself throws. However whatsapp-media is fire-and-forget from a user perspective — the function handles its own reply internally."

# Metrics
duration: 5min
completed: 2026-03-21
---

# Phase 12 Plan 02: whatsapp-webhook Media Routing Summary

**Media type detection and delegation added to whatsapp-webhook: image and document messages now route to whatsapp-media; unsupported types (video, audio, sticker, location, contacts) receive an informative rejection reply.**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-21T14:22:17Z
- **Completed:** 2026-03-21T14:27:00Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments

- Added `WHATSAPP_MEDIA_URL` constant alongside existing URL constants at line 10
- Replaced the silent `!text.trim()` early-return with a three-branch routing block:
  1. `image` / `document` — user lookup + delegation to whatsapp-media with `{ user_id, phone, msg_type, media }` payload
  2. `video`, `audio`, `sticker`, `location`, `contacts` — reply "I can only accept photos..." if user is linked
  3. Empty text — original silent OK (preserved)
- All existing behavior preserved: HMAC validation, verification code linking, text message forwarding to process-bot-message

## Task Commits

Each task was committed atomically:

1. **Task 1: Add media type detection and routing to whatsapp-webhook** - `07deed7` (feat)

## Files Created/Modified

- `supabase/functions/whatsapp-webhook/index.ts` — Added WHATSAPP_MEDIA_URL constant and media-aware routing block (63 lines added)

## Decisions Made

- **Inline createClient for media path:** The main `supabase` client is created at line 178, after the text-empty check. Media routing must happen before that. Rather than restructuring the entire handler, a fresh `createClient` call is made inline for the media user lookup. This is intentional — the Supabase JS client is lightweight and does not hold a connection pool in the Deno runtime.
- **Await on delegation fetch:** The `fetch(WHATSAPP_MEDIA_URL, ...)` call is awaited so the catch block can send an error reply if the delegation call itself throws a network error. The whatsapp-media function handles its own success/failure reply to the user — this is only for delegation-level errors.

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None — TypeScript compiled cleanly, all 10 acceptance criteria verified.

## User Setup Required

None — no new environment variables. The `WHATSAPP_MEDIA_URL` constant is derived from the existing `SUPABASE_URL` env var.

To deploy: `supabase functions deploy whatsapp-webhook`

## Known Stubs

None.

---

## Self-Check

### Files exist:
- `supabase/functions/whatsapp-webhook/index.ts` — FOUND (verified via Read)

### Commits exist:
- `07deed7` — FOUND

## Self-Check: PASSED

---
*Phase: 12-media-handling*
*Completed: 2026-03-21*
