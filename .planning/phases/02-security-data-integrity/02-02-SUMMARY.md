---
phase: 02-security-data-integrity
plan: 02
subsystem: api
tags: [webhook, hmac, authentication, deno, edge-functions, telegram, whatsapp]

# Dependency graph
requires:
  - phase: 01-compilation-tooling
    provides: TypeScript build baseline and Edge Function foundations
provides:
  - Telegram webhook validates X-Telegram-Bot-Api-Secret-Token header before processing
  - WhatsApp webhook validates X-Hub-Signature-256 HMAC-SHA256 on POST requests
  - Both webhooks reject unauthenticated callers with 401 before any DB access
affects: [03-rls-policies, 04-client-auth, 05-e2e-testing]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Webhook auth gate: validate before any body parsing or DB access"
    - "Optional secret pattern: if (SECRET) { validate } else { allow } for dev compatibility"
    - "Raw body text read before JSON.parse when HMAC validation is required"
    - "crypto.subtle HMAC-SHA256 in Deno Edge Functions (no external deps)"

key-files:
  created: []
  modified:
    - supabase/functions/telegram-webhook/index.ts
    - supabase/functions/whatsapp-webhook/index.ts

key-decisions:
  - "Optional secret env vars (no ! assertion) — webhooks remain functional in dev without secrets configured; production MUST set them"
  - "console.warn for auth failures — Sentry is client-side only; Edge Function logs are the monitoring surface"
  - "HMAC validation reads req.text() before JSON.parse — body stream can only be consumed once; raw text needed for signature computation"
  - "GET challenge handler exempt from HMAC — Meta sends no body or signature on verification GETs"

patterns-established:
  - "Auth-gate-first: all webhook auth checks occur before body parse and DB queries"
  - "Graceful dev fallback: if (!SECRET) return true — guards are opt-in via env vars"

requirements-completed: [SEC-04, SEC-05]

# Metrics
duration: 12min
completed: 2026-03-18
---

# Phase 2 Plan 02: Webhook Authentication Summary

**Telegram and WhatsApp webhooks now reject unauthenticated callers with 401 using secret header comparison and HMAC-SHA256 crypto.subtle validation respectively**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-03-18T17:00:00Z
- **Completed:** 2026-03-18T17:12:00Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Telegram webhook validates `X-Telegram-Bot-Api-Secret-Token` header before any processing (SEC-04)
- WhatsApp webhook validates `X-Hub-Signature-256` HMAC-SHA256 signature on POST requests using Deno's built-in `crypto.subtle` (SEC-05)
- Both implementations use optional env vars with dev-fallback so local development works without secrets configured
- Auth failures logged via `console.warn` for Edge Function log monitoring
- WhatsApp GET verification challenge (`hub.verify_token`) unaffected by HMAC changes

## Task Commits

Each task was committed atomically:

1. **Task 1: Add secret token validation to Telegram webhook** - `77e41da` (feat)
2. **Task 2: Add HMAC-SHA256 validation to WhatsApp webhook** - `01ef8c0` (feat)

## Files Created/Modified
- `supabase/functions/telegram-webhook/index.ts` - Added `TELEGRAM_WEBHOOK_SECRET` env var and header validation gate before JSON parse
- `supabase/functions/whatsapp-webhook/index.ts` - Added `WHATSAPP_APP_SECRET` env var, `validateMetaSignature()` helper, and raw body read-then-validate-then-parse pattern

## Decisions Made
- Used optional env var pattern (no `!` assertion) so both webhooks remain functional in local dev without secrets set; production deployments must configure secrets via `supabase secrets set`
- `console.warn` chosen for auth failure logging since Sentry SDK is client-side React Native only; Supabase Edge Function logs serve as the monitoring surface
- `req.text()` must be called before `JSON.parse()` because the Request body stream can only be consumed once; HMAC requires the raw bytes that were actually transmitted
- WhatsApp GET challenge handler runs before the POST guard so Meta's webhook verification flow is unaffected

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

**External services require manual configuration before production deployment.**

### Telegram (SEC-04)
1. Generate a random 32-64 character alphanumeric string
2. `supabase secrets set TELEGRAM_WEBHOOK_SECRET=your_secret_here`
3. Re-register webhook with the secret:
   ```bash
   curl -X POST 'https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/setWebhook' \
     -H 'Content-Type: application/json' \
     -d '{"url": "https://{SUPABASE_URL}/functions/v1/telegram-webhook", "secret_token": "your_secret_here"}'
   ```

### WhatsApp / Meta (SEC-05)
1. Go to Meta Developer Portal -> Your App -> App Settings -> Basic -> App Secret
2. Copy the App Secret value
3. `supabase secrets set WHATSAPP_APP_SECRET=your_app_secret_here`

Both webhooks fall back to open access when the secrets are not configured (dev mode). In production, both secrets MUST be set.

## Next Phase Readiness
- Webhook authentication layer complete; both inbound channels are now authenticated
- Ready to proceed with RLS policy audit (plan 02-03)
- No blockers

---
*Phase: 02-security-data-integrity*
*Completed: 2026-03-18*
