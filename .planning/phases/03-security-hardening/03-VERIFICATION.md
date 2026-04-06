---
phase: 03-security-hardening
verified: 2026-04-06T00:00:00Z
status: human_needed
score: 5/5 must-haves verified (code changes complete; 4 operational steps pending human action)
human_verification:
  - test: "Confirm telegram-webhook rejects unauthenticated requests with 401"
    expected: "curl -X POST <webhook-url> -d '{}' returns HTTP 401"
    why_human: "Requires live deployed function and actual TELEGRAM_WEBHOOK_SECRET env var set in Supabase"
  - test: "Register TELEGRAM_WEBHOOK_SECRET with Telegram's setWebhook API"
    expected: "curl setWebhook call returns {ok: true}; subsequent bot messages work"
    why_human: "One-time manual step requiring TELEGRAM_BOT_TOKEN and SUPABASE_PROJECT_REF; cannot be automated"
  - test: "Apply rate limit migration to Supabase (supabase db push)"
    expected: "rate_limits table and check_rate_limit / cleanup_rate_limits RPC functions appear in Supabase Dashboard"
    why_human: "Schema push requires authenticated Supabase CLI and live DB access; cannot be automated"
  - test: "Verify rate limiting enforces thresholds (10/min invite-redirect, 60/min webhook+bot)"
    expected: "After threshold requests in one minute, endpoint returns 429"
    why_human: "Requires deployed functions + applied migration; depends on human action above"
  - test: "Sentry project setup, DSN configuration, and error-capture verification"
    expected: "EXPO_PUBLIC_SENTRY_DSN and SENTRY_DSN set; test error triggered in mobile app appears in Sentry dashboard within minutes; edge function errors visible in same project; email alert rule active"
    why_human: "Requires creating a Sentry project at sentry.io, obtaining DSN, setting env vars, and visual dashboard confirmation"
  - test: "Mobile app launches without crashing after Sentry SDK installation"
    expected: "App opens on device/simulator without crash; no PAC/Hermes native module error"
    why_human: "Requires physical device or simulator run; cannot verify programmatically"
---

# Phase 3: Security Hardening Verification Report

**Phase Goal:** Close the 5 security gaps identified in the codebase audit — XSS sink, unauthenticated webhook, undocumented verify_jwt bypasses, missing observability, and no rate limiting — so the app can pass a basic security review.
**Verified:** 2026-04-06
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| #  | Truth                                                                                                              | Status      | Evidence                                                                                                          |
|----|--------------------------------------------------------------------------------------------------------------------|-------------|-------------------------------------------------------------------------------------------------------------------|
| 1  | A malicious token containing HTML/JS in the invite-redirect URL returns HTTP 400 with a static error page          | VERIFIED    | UUID_V4_REGEX at line 26; validation at line 38, before isAndroid at line 56; static HTML 400 body, no token interpolation |
| 2  | A valid UUID v4 token continues to render the landing page and Android redirect as before                          | VERIFIED    | Regex only validates; valid UUIDs pass through unchanged to existing Android/iOS handling                         |
| 3  | Telegram webhook rejects requests without a valid X-Telegram-Bot-Api-Secret-Token header with HTTP 401             | VERIFIED    | Lines 492-495 of telegram-webhook/index.ts; fail-closed guard (!TELEGRAM_WEBHOOK_SECRET); empty 401 body          |
| 4  | Every verify_jwt=false entry in config.toml has a comment documenting its alternative auth mechanism               | VERIFIED    | 3 `# auth:` annotations confirmed (grep returns 3); all 3 functions documented with mechanism and env var name    |
| 5  | telegram-webhook returns 429 after 60 requests in 1 minute from the same IP                                        | VERIFIED*   | checkRateLimit(clientIp, 'telegram-webhook', 60) at line 500; code wired correctly; *requires migration pushed    |
| 6  | invite-redirect returns 429 after 10 requests in 1 minute from the same IP                                         | VERIFIED*   | checkRateLimit(clientIp, 'invite-redirect', 10) at line 47; code wired correctly; *requires migration pushed      |
| 7  | process-bot-message returns 429 after 60 requests in 1 minute from the same IP                                     | VERIFIED*   | checkRateLimit(clientIp, 'process-bot-message', 60) at line 1014; code wired correctly; *requires migration pushed |
| 8  | Rate limit table exists in the database with the correct schema                                                     | human_needed | Migration file 029_rate_limit_table.sql exists locally; supabase db push not yet confirmed by user               |
| 9  | JavaScript errors in the mobile app are captured and visible in the Sentry dashboard                                | human_needed | Code changes complete (Sentry.init, enableNative: false, Sentry.wrap); requires DSN setup + dashboard verification |
| 10 | Errors in edge functions are captured and visible in the Sentry dashboard                                           | human_needed | _shared/sentry.ts created; all 3 functions integrated; requires SENTRY_DSN secret set + dashboard verification    |
| 11 | Sentry email alert fires on first occurrence of a new error type                                                    | human_needed | Cannot verify programmatically; requires Sentry project alert configuration                                       |
| 12 | The mobile app does NOT crash on launch due to Sentry native plugin (enableNative: false)                           | human_needed | enableNative: false confirmed in _layout.tsx; @sentry/react-native/expo NOT in app.json plugins; requires device run |

**Score:** 5/5 requirement-mapped truths have complete code implementations; 4 truths require human operational steps to reach full runtime verification.

### Required Artifacts

| Artifact                                               | Expected                                                      | Status     | Details                                                                      |
|--------------------------------------------------------|---------------------------------------------------------------|------------|------------------------------------------------------------------------------|
| `supabase/functions/invite-redirect/index.ts`          | UUID v4 regex validation before any HTML interpolation        | VERIFIED   | UUID_V4_REGEX defined at line 26; .test(token) at line 38; before isAndroid  |
| `supabase/functions/telegram-webhook/index.ts`         | Secret-token header verification before any processing        | VERIFIED   | TELEGRAM_WEBHOOK_SECRET read line 17; header check lines 492-495; before req.json() at 511 |
| `supabase/config.toml`                                 | Auth-mechanism documentation for all verify_jwt=false entries | VERIFIED   | 3 `# auth:` comment blocks, all 3 functions documented                       |
| `supabase/migrations/029_rate_limit_table.sql`         | rate_limits table + check_rate_limit RPC + cleanup function   | VERIFIED   | File exists; CREATE TABLE, check_rate_limit SECURITY DEFINER, cleanup_rate_limits, UNIQUE constraint all present |
| `supabase/functions/_shared/rate-limit.ts`             | Reusable rate-limit check utility (exports checkRateLimit)    | VERIFIED   | File exists; checkRateLimit and getClientIp exported; fail-open on all error paths (return true) |
| `supabase/functions/telegram-webhook/index.ts`         | Rate limiting integrated (checkRateLimit)                     | VERIFIED   | checkRateLimit(clientIp, 'telegram-webhook', 60) at line 500                 |
| `supabase/functions/invite-redirect/index.ts`          | Rate limiting integrated (checkRateLimit)                     | VERIFIED   | checkRateLimit(clientIp, 'invite-redirect', 10) at line 47                   |
| `supabase/functions/process-bot-message/index.ts`      | Rate limiting integrated (checkRateLimit)                     | VERIFIED   | checkRateLimit(clientIp, 'process-bot-message', 60) at line 1014             |
| `app/_layout.tsx`                                      | Sentry.init() with enableNative: false, wrapped root component| VERIFIED   | Sentry.init at line 27 with enableNative: false; Sentry.wrap(RootLayout) at line 311; guarded by if (SENTRY_DSN) |
| `constants/config.ts`                                  | SENTRY_DSN export from EXPO_PUBLIC_SENTRY_DSN env var         | VERIFIED   | Line 12: export const SENTRY_DSN = process.env.EXPO_PUBLIC_SENTRY_DSN ?? ''  |
| `supabase/functions/_shared/sentry.ts`                 | Shared Sentry init + flush helper for all edge functions      | VERIFIED   | File exists; exports initSentry, flushSentry, captureException; defaultIntegrations: false; Sentry.flush(2000) |
| `supabase/functions/telegram-webhook/index.ts`         | Sentry error capture + flush on every response path           | VERIFIED   | initSentry() at top; flushSentry() before 401, 429, and in finally block     |
| `supabase/functions/invite-redirect/index.ts`          | Sentry error capture + flush on every response path           | VERIFIED   | initSentry() at top; try/catch/finally; flushSentry() in finally at line 257 |
| `supabase/functions/process-bot-message/index.ts`      | Sentry error capture + flush on every response path           | VERIFIED   | initSentry() at top; captureException in catch at line 1110; flushSentry in finally at line 1117 |

### Key Link Verification

| From                                        | To                                     | Via                                              | Status   | Details                                                               |
|---------------------------------------------|----------------------------------------|--------------------------------------------------|----------|-----------------------------------------------------------------------|
| `invite-redirect/index.ts`                  | HTML template                          | UUID regex gate before token interpolation        | VERIFIED | UUID_V4_REGEX.test(token) at line 38; 17 lines before any HTML output |
| `telegram-webhook/index.ts`                 | X-Telegram-Bot-Api-Secret-Token header | String comparison against TELEGRAM_WEBHOOK_SECRET | VERIFIED | req.headers.get('x-telegram-bot-api-secret-token') at line 492       |
| `_shared/rate-limit.ts`                     | `029_rate_limit_table.sql`             | RPC call to check_rate_limit function             | VERIFIED | client.rpc('check_rate_limit', ...) in rate-limit.ts                 |
| `app/_layout.tsx`                           | Sentry dashboard                       | Sentry.init with EXPO_PUBLIC_SENTRY_DSN           | VERIFIED | Sentry.init({dsn: SENTRY_DSN, ...}) present; DSN env var setup human-needed |
| `_shared/sentry.ts`                         | Sentry dashboard                       | Sentry.init with SENTRY_DSN env var + flush       | VERIFIED | Sentry.flush(2000) called in flushSentry(); DSN env var setup human-needed |

### Data-Flow Trace (Level 4)

Not applicable — this phase produces security middleware (validation, auth headers, rate limit counters, error reporting) rather than data-rendering UI components. No dynamic data flows to trace.

### Behavioral Spot-Checks

| Behavior                                            | Command                                                                                   | Result      | Status  |
|-----------------------------------------------------|-------------------------------------------------------------------------------------------|-------------|---------|
| UUID_V4_REGEX appears in invite-redirect            | grep -c "UUID_V4_REGEX" supabase/functions/invite-redirect/index.ts                       | 2           | PASS    |
| Regex validation before isAndroid branch            | UUID at line 38, isAndroid at line 56                                                     | Line 38 < 56 | PASS   |
| x-telegram-bot-api-secret-token header check        | grep -c "x-telegram-bot-api-secret-token" supabase/functions/telegram-webhook/index.ts   | 1           | PASS    |
| Secret check before req.json()                      | secret at line 492, req.json at line 511                                                  | 492 < 511   | PASS    |
| 3 auth: annotations in config.toml                  | grep -c "auth:" supabase/config.toml                                                      | 3           | PASS    |
| Rate limit migration exists                         | ls supabase/migrations/029_rate_limit_table.sql                                           | EXISTS      | PASS    |
| Shared rate-limit utility exports checkRateLimit    | grep -n "export.*checkRateLimit" supabase/functions/_shared/rate-limit.ts                 | line 9      | PASS    |
| All 3 functions use checkRateLimit                  | grep -l "checkRateLimit" [3 files] \| wc -l                                               | 3           | PASS    |
| Correct rate limit thresholds                       | invite-redirect=10, telegram-webhook=60, process-bot-message=60                           | All correct | PASS    |
| Sentry SDK in package.json                          | grep "@sentry/react-native" package.json                                                  | ~7.2.0      | PASS    |
| enableNative: false in _layout.tsx                  | grep -c "enableNative: false" app/_layout.tsx                                             | 1           | PASS    |
| Sentry native plugin NOT in app.json                | grep -i sentry app.json (plugins section)                                                 | No match    | PASS    |
| All 3 edge functions have flushSentry               | grep -l "flushSentry" [3 files] \| wc -l                                                  | 3           | PASS    |
| Commits match summaries                             | git log --oneline (6027c86, 3ed660f, 2c269bd, df5f0b6, 6c75e80, d52090f, f2db767)        | All found   | PASS    |
| Rate limiting enforces at threshold after deployment| Requires deployed functions + applied migration                                           | —           | SKIP (human) |
| Sentry dashboard shows errors                       | Requires live Sentry project + DSN configured                                             | —           | SKIP (human) |

### Requirements Coverage

| Requirement | Source Plan | Description                                                                  | Status       | Evidence                                                           |
|-------------|-------------|------------------------------------------------------------------------------|--------------|--------------------------------------------------------------------|
| SEC-01      | 03-02-PLAN  | Telegram webhook secret-token verification, reject with 401 on mismatch      | VERIFIED     | TELEGRAM_WEBHOOK_SECRET header check before body parsing in telegram-webhook |
| SEC-02      | 03-01-PLAN  | XSS sink in invite-redirect:187,193 fixed                                    | VERIFIED     | UUID_V4_REGEX.test(token) at line 38, before HTML interpolation    |
| SEC-03      | 03-02-PLAN  | verify_jwt=false functions audited with documented alternative auth           | VERIFIED     | 3 `# auth:` blocks in config.toml for all 3 public functions       |
| SEC-04      | 03-04-PLAN  | Production observability restored (Sentry or alternative)                    | human_needed | Code complete; DSN setup, dashboard confirmation, and device run needed |
| SEC-05      | 03-03-PLAN  | Rate limiting on telegram-webhook, invite-redirect, process-bot-message       | human_needed | Code and migration file complete; supabase db push not yet confirmed |

All 5 phase requirements (SEC-01 through SEC-05) are addressed. No orphaned requirements. No phase requirements missing from plan coverage.

### Anti-Patterns Found

| File                                                     | Line | Pattern                                           | Severity | Impact                                                                      |
|----------------------------------------------------------|------|---------------------------------------------------|----------|-----------------------------------------------------------------------------|
| `supabase/functions/invite-redirect/index.ts`            | 17   | `TODO before launch: replace the placeholder store URLs below with real ones.` | Info | Pre-existing comment; store URL placeholders tracked as STORE-05 in Phase 6. Not introduced by this phase and does not affect security. |

No blockers or warnings. The TODO is a pre-existing, separately tracked concern (Phase 6 / STORE-05).

### Human Verification Required

#### 1. Apply Rate Limit Migration

**Test:** Run `supabase db push` (requires `supabase login` or `SUPABASE_ACCESS_TOKEN` env var set)
**Expected:** Command exits cleanly; `rate_limits` table appears in Supabase Dashboard > Table Editor; `check_rate_limit` and `cleanup_rate_limits` appear in Dashboard > Database > Functions
**Why human:** Schema push requires authenticated Supabase CLI with live project access; cannot be automated

#### 2. Register Telegram Webhook Secret

**Test:** Generate and register TELEGRAM_WEBHOOK_SECRET:
```bash
TELEGRAM_WEBHOOK_SECRET=$(openssl rand -hex 32)
supabase secrets set TELEGRAM_WEBHOOK_SECRET=$TELEGRAM_WEBHOOK_SECRET
supabase functions deploy telegram-webhook
curl -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{"url":"https://${SUPABASE_PROJECT_REF}.supabase.co/functions/v1/telegram-webhook","secret_token":"${TELEGRAM_WEBHOOK_SECRET}"}'
```
**Expected:** setWebhook returns `{"ok":true}`; bot messages continue to work after deployment
**Why human:** Requires TELEGRAM_BOT_TOKEN and SUPABASE_PROJECT_REF; one-time live API call

#### 3. Verify Rate Limiting at Threshold

**Test:** After applying migration and deploying, run more than 10 rapid requests to invite-redirect from the same IP
**Expected:** Responses 1-10 succeed; response 11+ returns HTTP 429
**Why human:** Requires deployed functions with rate_limits table populated; cannot simulate without live infrastructure

#### 4. Sentry Project Setup and DSN Configuration

**Test:**
1. Create a Sentry project at sentry.io (free tier, React Native type)
2. Copy DSN from Project Settings > Client Keys (DSN)
3. Set `EXPO_PUBLIC_SENTRY_DSN=<dsn>` in `.env`
4. Set `supabase secrets set SENTRY_DSN=<dsn>`
5. Deploy edge functions: `supabase functions deploy telegram-webhook invite-redirect process-bot-message`

**Expected:** DSN values set; edge functions deployed with SENTRY_DSN available
**Why human:** Requires Sentry account creation and dashboard interaction

#### 5. Verify Sentry Error Capture and Alert

**Test:**
1. With DSN configured, run `npx expo start` and open app on device/simulator
2. Trigger a test JS error (temporarily add `throw new Error('sentry-test')` in a screen component)
3. Check Sentry dashboard — error should appear within 2-3 minutes
4. In Sentry > Alerts, confirm the default "first seen" alert rule is active (or create: Conditions = "A new issue is created", Action = "Send email to project members")

**Expected:** Test error visible in Sentry Issues; email alert fires on first new issue
**Why human:** Requires visual dashboard confirmation; cannot verify error delivery programmatically

#### 6. Mobile App Launch Without Crash

**Test:** Run `npx expo start` and open app on an iOS device or simulator after `@sentry/react-native` installation
**Expected:** App opens normally; no crash from native Sentry plugin loading (PAC/Hermes crash)
**Why human:** Requires physical or simulated device run; the `enableNative: false` guard is present in code but crash prevention can only be confirmed at runtime

### Gaps Summary

No code gaps found. All security changes are implemented, committed, and wired correctly:

- **SEC-01:** TELEGRAM_WEBHOOK_SECRET header check is in place, fail-closed, before body parsing.
- **SEC-02:** UUID_V4_REGEX gate is in place, validated before both Android and iOS HTML interpolation paths.
- **SEC-03:** All 3 `verify_jwt=false` functions have `# auth:` documentation blocks in config.toml.
- **SEC-04:** Sentry SDK installed, `enableNative: false` configured, Sentry.wrap applied, shared sentry.ts created, all 3 edge functions integrated. DSN configuration and dashboard verification are operational steps for the user.
- **SEC-05:** Migration file and shared utility are complete and correct. All 3 functions call checkRateLimit at the right thresholds in the right order. The migration must be pushed to the live database to activate runtime enforcement.

The phase is **human_needed** because: (a) the rate limit table must be pushed to Supabase before the rate limiting code can actually enforce limits at runtime, and (b) Sentry requires an account, DSN, and dashboard verification to confirm error capture. The security code itself is complete and correct — no implementation gaps remain.

---

_Verified: 2026-04-06_
_Verifier: Claude (gsd-verifier)_
