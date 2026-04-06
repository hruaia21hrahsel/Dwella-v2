---
phase: 03-security-hardening
plan: 02
subsystem: edge-functions-auth
tags: [security, telegram, webhook, config-audit]
dependency_graph:
  requires: []
  provides: [telegram-webhook-auth, config-toml-auth-docs]
  affects: [telegram-webhook, config-toml]
tech_stack:
  added: []
  patterns: [secret-token-header-verification, fail-closed-auth]
key_files:
  created: []
  modified:
    - supabase/functions/telegram-webhook/index.ts
    - supabase/config.toml
decisions:
  - "TELEGRAM_WEBHOOK_SECRET env var for secret storage (D-03)"
  - "401 empty body rejection for unauthenticated requests (D-02)"
  - "Fail-closed: if env var unset, all requests rejected (D-01)"
metrics:
  duration: 68s
  completed: "2026-04-06T15:18:54Z"
  tasks_completed: 2
  tasks_total: 2
  files_modified: 2
---

# Phase 3 Plan 02: Webhook Auth + Config Documentation Summary

Telegram webhook secret-token verification (SEC-01) and auth-mechanism documentation for all verify_jwt=false edge functions (SEC-03).

## What Was Done

### Task 1: Telegram webhook secret-token verification

Added `TELEGRAM_WEBHOOK_SECRET` env var read and `X-Telegram-Bot-Api-Secret-Token` header check to `telegram-webhook/index.ts`. The check runs immediately after the POST method gate and before any `req.json()` body parsing, so unauthenticated requests pay zero parse cost. The guard is fail-closed: if the env var is unset or empty, all requests are rejected with HTTP 401.

**Commit:** `3ed660f`

### Task 2: Auth mechanism documentation in config.toml

Replaced the existing comment blocks for all three `verify_jwt = false` entries with standardized `# auth:` annotations documenting the alternative authentication mechanism for each:
- `telegram-webhook`: X-Telegram-Bot-Api-Secret-Token header against TELEGRAM_WEBHOOK_SECRET
- `invite-redirect`: intentionally public, UUID v4 regex validation on token param
- `process-bot-message`: x-bot-internal-secret header against BOT_INTERNAL_SECRET

**Commit:** `2c269bd`

## Manual Steps Required (Post-Deploy)

After deploying the updated `telegram-webhook` function, the user must register the secret token with Telegram's `setWebhook` API. This is a one-time curl command:

```bash
# 1. Generate a 32+ character random secret
TELEGRAM_WEBHOOK_SECRET=$(openssl rand -hex 32)

# 2. Set it as a Supabase secret
supabase secrets set TELEGRAM_WEBHOOK_SECRET=$TELEGRAM_WEBHOOK_SECRET

# 3. Deploy the updated function
supabase functions deploy telegram-webhook

# 4. Register the secret with Telegram (one-time)
curl -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setWebhook" \
  -H "Content-Type: application/json" \
  -d "{
    \"url\": \"https://${SUPABASE_PROJECT_REF}.supabase.co/functions/v1/telegram-webhook\",
    \"secret_token\": \"${TELEGRAM_WEBHOOK_SECRET}\"
  }"
```

**Important:** Until step 4 is completed, the bot will reject ALL Telegram messages with 401 (fail-closed by design). Steps 2-4 should be run in sequence during a single deployment window.

## Commits

| Task | Commit | Type | Description |
|------|--------|------|-------------|
| 1 | `3ed660f` | feat | Add Telegram webhook secret-token verification (SEC-01) |
| 2 | `2c269bd` | docs | Document auth mechanisms for all verify_jwt=false functions (SEC-03) |

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

None.

## Verification Results

| Check | Expected | Actual | Status |
|-------|----------|--------|--------|
| `grep -c "x-telegram-bot-api-secret-token"` in webhook | >= 1 | 1 | PASS |
| `grep -c "TELEGRAM_WEBHOOK_SECRET"` in webhook | >= 2 | 2 | PASS |
| `grep -c "auth:"` in config.toml | 3 | 3 | PASS |
| Secret check before `req.json()` | line < json line | 487 < 494 | PASS |

## Self-Check: PASSED

All created/modified files exist. All commit hashes verified in git log.
