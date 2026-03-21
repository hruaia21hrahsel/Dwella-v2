---
gsd_state_version: 1.0
milestone: v1.2
milestone_name: WhatsApp Bot
status: unknown
stopped_at: Completed 14-intents-outbound-notifications-02-PLAN.md
last_updated: "2026-03-21T16:05:25.918Z"
progress:
  total_phases: 4
  completed_phases: 4
  total_plans: 9
  completed_plans: 9
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-21)

**Core value:** Every user-facing workflow (auth, property CRUD, payments, invites, documents, maintenance, reports, bot) works correctly and securely.
**Current focus:** Phase 14 — intents-outbound-notifications

## Current Position

Phase: 14 (intents-outbound-notifications) — EXECUTING
Plan: 2 of 2

## Performance Metrics

**Velocity (v1.1 reference):**

- Total plans completed: 14
- Average duration: ~10 min
- Total execution time: ~2.3 hours

**By Phase (v1.1):**

| Phase | Plans | Avg/Plan |
|-------|-------|----------|
| Phase 6 | 1 | ~8 min |
| Phase 7 | 4 | ~12 min |
| Phase 8 | 4 | ~11 min |
| Phase 9 | 4 | ~10 min |
| Phase 10 | 1 | ~7 min |
| Phase 11 P01 | 3m | 2 tasks | 2 files |
| Phase 11 P02 | 2m | 2 tasks | 3 files |
| Phase 12-media-handling P01 | 2m | 1 tasks | 1 files |
| Phase 12-media-handling P02 | 5 | 1 tasks | 1 files |
| Phase 13-rich-messaging P02 | 2 | 2 tasks | 2 files |
| Phase 13-rich-messaging P01 | 6 | 2 tasks | 2 files |
| Phase 13-rich-messaging P03 | 3 | 2 tasks | 4 files |
| Phase 14 P01 | 5 | 2 tasks | 1 files |
| Phase 14 P02 | 12 | 3 tasks | 4 files |

## Accumulated Context

### Decisions

See PROJECT.md Key Decisions table for full list.

- [v1.2 setup]: whatsapp-send is a prerequisite for all other phases — built in Phase 11 before any outbound calls
- [v1.2 setup]: All 4 Meta templates submitted in Phase 11 because approval takes 2-7 days (external blocking dependency for Phase 14)
- [v1.2 menus]: Stateless button_id scheme (e.g., menu_payments, action_log_payment) — no sessions table needed
- [v1.2 menus]: Menu taps bypass Claude via lookup table — only freeform text routes to Claude
- [v1.2 outbound]: Two code paths required: template (scheduled/triggered) vs. interactive (in-session) — 24-hour window constraint
- [Phase 11]: whatsapp-send returns HTTP 200 for all responses with success/error in JSON body for caller simplicity
- [Phase 11]: Webhook delegates all outbound messaging to whatsapp-send Edge Function (single source of truth)
- [Phase 11]: Verification codes sent via template type through whatsapp-send instead of deprecated whatsapp-send-code
- [Phase 12-media-handling]: buildContext() copied verbatim from process-bot-message — Deno Edge Functions have no shared import; duplication is correct pattern
- [Phase 12-media-handling]: Payment row created with status 'paid' when none exists on proof upload — sending proof implies payment was made
- [Phase 12-media-handling]: Chunked base64 conversion in 8192-byte slices to prevent stack overflow on large image ArrayBuffers
- [Phase 12-media-handling]: Inline createClient for media path in whatsapp-webhook — main client created post-text-check; media routing needs to happen before that block so fresh inline client is correct pattern
- [Phase 12-media-handling]: Await delegation fetch to whatsapp-media so catch block can send error reply on network failure; whatsapp-media handles its own user-facing reply for success/failure
- [Phase 13-rich-messaging]: sendBotResponse() flattens button rows to flat array for WhatsApp's 3-button max — mirrors Telegram multi-message pattern
- [Phase 13-rich-messaging]: Welcome message replaces old linking confirmation text on WhatsApp verification success — user gets menu immediately
- [Phase 13-rich-messaging]: BUTTON_LOOKUP bypass: button_id check before Claude dispatch — no LLM call for menu taps
- [Phase 13-rich-messaging]: Telegram callback_query handled before message early-return (Pitfall 6 fix) — supabase client moved above both branches
- [Phase 13-rich-messaging]: answerCallbackQuery fires first before async work — prevents loading spinner hanging in Telegram
- [Phase 13-rich-messaging]: html2pdf.app response field uncertainty handled by trying multiple field names (pdf ?? base64 ?? content ?? data) with key logging on failure
- [Phase 13-rich-messaging]: pdf-reports Storage bucket is private with 1-hour signed URL — PDF not publicly accessible
- [Phase 13-rich-messaging]: handleButtonPress made async to support pdf_month_ PDF generation — only that branch is truly async
- [Phase 14]: Query handlers registered in ACTION_HANDLERS so Claude freeform and button dispatch share same implementation
- [Phase 14]: D-04 intercept: sub-menu button IDs checked inside startsWith('sub_') block before falling through to handleSubAction
- [Phase 14]: notify-whatsapp fetches push_token from users table directly since send-push requires token not userId
- [Phase 14]: WhatsApp receipt on auto-confirm goes only to tenant (not landlord) per D-07; landlord gets push only
- [Phase 14]: All outbound WhatsApp routed through whatsapp-send Edge Function as single source of truth; no direct Meta API calls in scheduled functions

### Pending Todos

None.

### Blockers/Concerns

- [Phase 14]: Meta template approval is an external dependency (2-7 days). Templates must be submitted in Phase 11 or Phase 14 will be blocked.
- [Phase 13]: PDF generation library for Deno not yet selected (deno-puppeteer ruled out). Must research Deno-compatible HTML-to-PDF during Phase 13 planning.
- [Phase 14]: WhatsApp opt-in requirement for cold outbound — first message to users who never initiated needs documented opt-in tracking design.
- Pre-launch (carry over): iOS App Store [APP_ID] in UpdateGate.tsx, Sentry DSN in .env, pg_cron schedule verification, invite-redirect store URLs.

## Session Continuity

Last session: 2026-03-21T16:05:25.915Z
Stopped at: Completed 14-intents-outbound-notifications-02-PLAN.md
Resume file: None
