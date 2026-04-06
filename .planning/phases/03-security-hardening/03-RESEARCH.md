# Phase 3: Security Hardening - Research

**Researched:** 2026-04-06
**Domain:** Supabase Edge Function security, Telegram webhook auth, XSS prevention, observability (Sentry), rate limiting
**Confidence:** HIGH

## Summary

Phase 3 closes five security gaps in the Supabase Edge Functions layer and restores production observability. All five requirements (SEC-01 through SEC-05) are well-scoped with locked decisions from the CONTEXT.md discussion. The primary technologies involved are: Telegram Bot API webhook secret verification, HTML output sanitization via input validation, Sentry SDKs for both React Native (mobile) and Deno (edge functions), and a lightweight Postgres-based rate limiter.

The riskiest area is SEC-04 (observability restoration). The Sentry Deno SDK works in Supabase Edge Functions but requires manual `Sentry.flush()` before function return due to the serverless execution model. The Sentry React Native SDK v8.x works with Expo SDK 54 managed workflow, but the project previously removed it due to a native crash -- the JS-only initialization approach (skipping the Expo Sentry plugin for native symbolication) should avoid that issue while still capturing JavaScript errors.

**Primary recommendation:** Implement in order: SEC-02 (XSS fix, smallest change), SEC-01 (webhook auth), SEC-03 (config.toml comments), SEC-05 (rate limiting table + middleware), SEC-04 (Sentry, most complex). This ordering front-loads the quick security wins.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Verify Telegram webhook via `X-Telegram-Bot-Api-Secret-Token` header. Register secret with `setWebhook` API. Simple string comparison in `telegram-webhook/index.ts`.
- **D-02:** Reject unauthenticated requests with HTTP 401, empty body.
- **D-03:** Secret token as Supabase env var `TELEGRAM_WEBHOOK_SECRET`, 32+ char high-entropy string.
- **D-04:** Validate token query param against strict UUID v4 regex before any HTML interpolation. Reject with static error page on mismatch.
- **D-05:** `verify_jwt = false` on invite-redirect is intentionally correct. Add config.toml comment.
- **D-06:** No additional encoding beyond UUID validation (hex+hyphens are HTML-safe).
- **D-07:** Every `verify_jwt = false` function gets a config.toml comment documenting its auth mechanism.
- **D-08:** Re-enable Sentry using `@sentry/react-native` JS-only SDK (no native crash symbolication plugin).
- **D-09:** Instrument Edge Functions with Sentry Deno SDK. Both mobile and edge function errors in one Sentry dashboard.
- **D-10:** "Visible within 24 hours" = Sentry email alerts on first occurrence. No PagerDuty needed.
- **D-11:** Sentry DSN as env vars: `EXPO_PUBLIC_SENTRY_DSN` (mobile), `SENTRY_DSN` (edge functions).
- **D-12:** Rate limiting inside each public edge function using a Supabase table as request counter (IP-based). No external gateway.
- **D-13:** Thresholds: 60 req/min for telegram-webhook and process-bot-message; 10 req/min for invite-redirect.
- **D-14:** Rate limit exceeded returns HTTP 429.
- **D-15:** Rate limit table: IP + function name + window timestamp + count. Old entries cleaned periodically.
- **D-16:** Manual abuse simulation via curl, document test commands.

### Claude's Discretion
- Sentry SDK version selection and initialization pattern (error boundary, navigation integration)
- Rate limit table schema design (single table vs per-function)
- Whether to use sliding window or fixed window for rate counting
- Exact curl commands for abuse simulation testing
- Whether Sentry Deno SDK works in Supabase Edge Functions or if a simpler HTTP-based error reporter is needed

### Deferred Ideas (OUT OF SCOPE)
- RLS policy audit and test suite
- Bot fuzzy matching improvement
- Storage bucket policy audit
- PII in edge function console.log/console.warn cleanup
- IP allowlisting for Telegram
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SEC-01 | Telegram webhook secret-token verification | Telegram Bot API `setWebhook` `secret_token` param verified; header name is `X-Telegram-Bot-Api-Secret-Token`; 1-256 char string; existing `BOT_INTERNAL_SECRET` pattern at process-bot-message lines 998-1002 serves as reference |
| SEC-02 | XSS sink fix in invite-redirect | Lines 187 and 193 confirmed as injection points; UUID v4 regex validation before interpolation is sufficient (hex+hyphens only); no encoding library needed |
| SEC-03 | verify_jwt=false documentation | Three functions identified: telegram-webhook, process-bot-message, invite-redirect; existing comments in config.toml lines 380-401 need auth-mechanism annotations |
| SEC-04 | Observability restoration (Sentry) | `@sentry/react-native` v8.7.0 works with Expo SDK 54; Sentry Deno SDK works in Edge Functions with manual `flush()`; JS-only init avoids native crash that caused original removal |
| SEC-05 | Rate limiting on public endpoints | Postgres table approach is viable; Supabase official docs recommend Upstash Redis but Postgres works for low-traffic v1.0; fixed-window counter is simplest |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@sentry/react-native` | 8.7.0 | Mobile app error tracking | Official Sentry SDK for React Native + Expo; captures JS errors, navigation breadcrumbs, unhandled rejections [VERIFIED: npm registry] |
| Sentry Deno SDK | latest from deno.land/x | Edge Function error tracking | Official Sentry SDK for Deno runtime; documented by Supabase for Edge Functions [CITED: supabase.com/docs/guides/functions/examples/sentry-monitoring] |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| None | - | Rate limiting | No external library needed -- use raw Supabase Postgres queries from within edge functions |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Postgres rate limit table | Upstash Redis | Redis is faster but adds external dependency + paid service; Postgres sufficient for v1.0 traffic |
| `@sentry/react-native` | `@sentry/browser` | Browser SDK is lighter but misses React Native-specific breadcrumbs, navigation integration, and Expo support |
| In-function rate limiting | Supabase Kong gateway config | Gateway config is cleaner but requires Supabase Pro tier or self-hosted setup |

**Installation:**
```bash
npx expo install @sentry/react-native
```

**Version verification:**
- `@sentry/react-native`: 8.7.0 [VERIFIED: npm registry, 2026-04-06]
- Sentry Deno SDK: imported via `https://deno.land/x/sentry/index.mjs` (no pinned version in Supabase docs) [CITED: supabase.com/docs/guides/functions/examples/sentry-monitoring]

## Architecture Patterns

### Recommended Project Structure Changes
```
supabase/functions/
  _shared/
    sentry.ts          # Sentry init + flush helper for all edge functions
    rate-limit.ts      # Rate limit check utility
  telegram-webhook/
    index.ts           # + secret-token check at top of handler
  invite-redirect/
    index.ts           # + UUID validation before HTML interpolation
  process-bot-message/
    index.ts           # (already has BOT_INTERNAL_SECRET check)
supabase/migrations/
  029_rate_limit_table.sql   # New rate limit tracking table
app/
  _layout.tsx          # + Sentry.init() before navigation
```

### Pattern 1: Telegram Webhook Secret Verification
**What:** Compare `X-Telegram-Bot-Api-Secret-Token` header against stored secret before processing any update [CITED: core.telegram.org/bots/api]
**When to use:** First check in telegram-webhook handler, before JSON parsing
**Example:**
```typescript
// Source: Telegram Bot API docs + existing BOT_INTERNAL_SECRET pattern
const TELEGRAM_WEBHOOK_SECRET = Deno.env.get('TELEGRAM_WEBHOOK_SECRET') ?? '';

serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('OK', { status: 200 });
  }

  // Secret-token verification — reject before parsing body
  const secretHeader = req.headers.get('x-telegram-bot-api-secret-token') ?? '';
  if (!TELEGRAM_WEBHOOK_SECRET || secretHeader !== TELEGRAM_WEBHOOK_SECRET) {
    return new Response('', { status: 401 });
  }

  // ... existing handler continues
});
```

### Pattern 2: UUID Input Validation for XSS Prevention
**What:** Validate token against UUID v4 regex before any HTML interpolation [VERIFIED: codebase inspection of invite-redirect/index.ts]
**When to use:** Before the HTML template string at line 48
**Example:**
```typescript
// Source: D-04 locked decision
const UUID_V4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const token = url.searchParams.get('token')?.trim();
if (!token || !UUID_V4_REGEX.test(token)) {
  return new Response(
    '<html><body><h1>Invalid invite link</h1><p>This invite link is malformed. Please ask your landlord for a new invite.</p></body></html>',
    { status: 400, headers: { 'Content-Type': 'text/html; charset=utf-8' } },
  );
}
// Now safe to interpolate token into HTML — only hex digits and hyphens
```

### Pattern 3: Sentry Init in Edge Functions with Manual Flush
**What:** Initialize Sentry once, wrap handler, flush before return [CITED: supabase.com/docs/guides/functions/examples/sentry-monitoring, github.com/supabase/supabase/issues/36489]
**When to use:** Every edge function that should report errors
**Example:**
```typescript
// Source: Supabase Sentry monitoring docs + Issue #36489 fix
// supabase/functions/_shared/sentry.ts
import * as Sentry from 'https://deno.land/x/sentry/index.mjs';

let initialized = false;

export function initSentry() {
  if (initialized) return;
  const dsn = Deno.env.get('SENTRY_DSN');
  if (!dsn) return;
  Sentry.init({
    dsn,
    defaultIntegrations: false,  // Prevent data sharing between requests
    tracesSampleRate: 1.0,
  });
  initialized = true;
}

export async function flushSentry() {
  await Sentry.flush(2000);  // CRITICAL: must flush before function returns
}

export { Sentry };
```

### Pattern 4: Postgres-Based Rate Limiting
**What:** Fixed-window counter using a Postgres table, queried at the start of each public edge function [ASSUMED]
**When to use:** telegram-webhook, invite-redirect, process-bot-message
**Example:**
```typescript
// supabase/functions/_shared/rate-limit.ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

export async function checkRateLimit(
  supabaseClient: ReturnType<typeof createClient>,
  ip: string,
  functionName: string,
  maxRequests: number,
  windowMinutes: number = 1,
): Promise<boolean> {
  // Fixed-window: truncate current time to minute boundary
  const now = new Date();
  const windowStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(),
    now.getHours(), now.getMinutes());

  // Upsert: increment counter or insert new row
  const { data, error } = await supabaseClient.rpc('check_rate_limit', {
    p_ip: ip,
    p_function_name: functionName,
    p_window_start: windowStart.toISOString(),
    p_max_requests: maxRequests,
  });

  if (error) {
    console.error('[rate-limit] check failed:', error);
    return true; // Allow on error — fail open to avoid blocking legitimate traffic
  }

  return data as boolean; // true = allowed, false = rate limited
}
```

### Pattern 5: Sentry Init in React Native (JS-Only)
**What:** Initialize Sentry in app root without native plugin [ASSUMED - based on SDK docs pattern]
**When to use:** At top of `app/_layout.tsx`
**Example:**
```typescript
// Source: @sentry/react-native docs
import * as Sentry from '@sentry/react-native';

Sentry.init({
  dsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
  // JS-only: don't enable native crash reporting
  enableNative: false,
  tracesSampleRate: 0.2,  // Low sample rate for free tier
  beforeSend(event) {
    // Strip PII from error reports
    return event;
  },
});

// Wrap root component
export default Sentry.wrap(RootLayout);
```

### Anti-Patterns to Avoid
- **Timing-vulnerable string comparison for secrets:** Use constant-time comparison (`crypto.timingSafeEqual` or equivalent) for the webhook secret check to prevent timing attacks. However, for a low-traffic v1.0 app behind HTTPS, simple `===` is pragmatically acceptable [ASSUMED].
- **Forgetting Sentry.flush() in edge functions:** The function will terminate before errors are sent. Every edge function code path that calls Sentry must end with `await Sentry.flush(2000)` [VERIFIED: github.com/supabase/supabase/issues/36489].
- **Rate limiting with fail-closed on DB error:** If the rate limit table query fails, blocking all requests is worse than allowing a few extra through. Fail open [ASSUMED].

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Error tracking | Custom error logging to a table | Sentry (`@sentry/react-native` + Deno SDK) | Aggregation, deduplication, alerting, source maps, stack traces — all built in |
| Telegram webhook verification | Custom HMAC or IP-based filtering | Telegram's built-in `secret_token` param on `setWebhook` | Telegram sends the header automatically; IP ranges change |
| HTML escaping for XSS | Custom escape function | Input validation (UUID regex) | UUID regex is simpler and more restrictive than output encoding; prevents the problem at input level |

**Key insight:** All five security requirements have standard, documented solutions. None require novel security engineering.

## Common Pitfalls

### Pitfall 1: Sentry Deno SDK Not Flushing
**What goes wrong:** Errors captured in edge functions never appear in the Sentry dashboard
**Why it happens:** Supabase Edge Functions terminate the Deno isolate immediately after the response is sent; pending Sentry HTTP requests are dropped
**How to avoid:** Call `await Sentry.flush(2000)` before returning every Response. Use a wrapper pattern in `_shared/sentry.ts`
**Warning signs:** Sentry dashboard shows zero errors from edge functions despite known test errors [VERIFIED: github.com/supabase/supabase/issues/36489]

### Pitfall 2: Sentry Native Plugin Crash on iOS
**What goes wrong:** App crashes on TestFlight/production launch — the original reason Sentry was removed from Dwella
**Why it happens:** Sentry's native iOS plugin conflicts with Expo SDK 54's Hermes + PAC (Pointer Authentication) on newer Apple Silicon
**How to avoid:** Use `enableNative: false` in Sentry.init() and do NOT add `@sentry/react-native/expo` to app.json plugins. JS-only mode captures JavaScript errors without touching native crash symbolication
**Warning signs:** Crash on app launch with no JS error — means native plugin loaded and failed [VERIFIED: project memory, .planning/codebase/CONCERNS.md]

### Pitfall 3: setWebhook Not Called with Secret
**What goes wrong:** Code checks for `X-Telegram-Bot-Api-Secret-Token` but Telegram never sends it, so all legitimate requests are rejected with 401
**Why it happens:** The secret must be registered with Telegram via a `setWebhook` API call that includes the `secret_token` parameter. This is a one-time setup step, not automatic
**How to avoid:** Include a curl command in the plan to call `setWebhook` with the secret after deploying the updated function. Test with a second curl that omits the header and verify 401
**Warning signs:** Bot stops responding to all Telegram messages after deployment [CITED: core.telegram.org/bots/api]

### Pitfall 4: Rate Limit Table Bloat
**What goes wrong:** The `rate_limits` table grows indefinitely, slowing down queries
**Why it happens:** Every request inserts a row; without cleanup, months of traffic accumulate
**How to avoid:** Add a cleanup step: either a periodic DELETE of rows older than 1 hour (piggyback on `auto-confirm-payments` hourly schedule), or use a Postgres TRIGGER / pg_cron job
**Warning signs:** Rate limit queries taking >100ms [ASSUMED]

### Pitfall 5: XSS Fix Breaking Android Intent Redirect
**What goes wrong:** The UUID validation rejects tokens on the Android redirect path
**Why it happens:** The Android path (line 38) also uses the `token` variable in the intent URL. If validation is placed after the Android redirect check, Android is still vulnerable; if placed before, both paths are protected
**How to avoid:** Place UUID validation at the very top, before the `isAndroid` check, so both Android intent URLs and iOS HTML pages are protected
**Warning signs:** Android users getting "Invalid invite link" errors — means validation is too strict or placed wrong [VERIFIED: codebase inspection]

## Code Examples

### setWebhook Registration (One-Time Manual Step)
```bash
# Source: Telegram Bot API docs (core.telegram.org/bots/api#setwebhook)
# Run ONCE after deploying the updated telegram-webhook function
curl -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://${SUPABASE_PROJECT_REF}.supabase.co/functions/v1/telegram-webhook",
    "secret_token": "${TELEGRAM_WEBHOOK_SECRET}"
  }'
```

### Rate Limit Migration SQL
```sql
-- Source: D-12, D-15 locked decisions
CREATE TABLE IF NOT EXISTS rate_limits (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  ip_address text NOT NULL,
  function_name text NOT NULL,
  window_start timestamptz NOT NULL,
  request_count int NOT NULL DEFAULT 1,
  UNIQUE(ip_address, function_name, window_start)
);

-- Index for fast lookups
CREATE INDEX idx_rate_limits_lookup
  ON rate_limits (ip_address, function_name, window_start);

-- RPC function: atomic increment-or-insert, returns true if under limit
CREATE OR REPLACE FUNCTION check_rate_limit(
  p_ip text,
  p_function_name text,
  p_window_start timestamptz,
  p_max_requests int
) RETURNS boolean
LANGUAGE plpgsql
AS $$
DECLARE
  current_count int;
BEGIN
  INSERT INTO rate_limits (ip_address, function_name, window_start, request_count)
  VALUES (p_ip, p_function_name, p_window_start, 1)
  ON CONFLICT (ip_address, function_name, window_start)
  DO UPDATE SET request_count = rate_limits.request_count + 1
  RETURNING request_count INTO current_count;

  RETURN current_count <= p_max_requests;
END;
$$;
```

### Abuse Simulation Test (curl)
```bash
# Source: D-16 locked decision
# Test rate limit on telegram-webhook (threshold: 60/min)
for i in $(seq 1 65); do
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
    -X POST "https://${PROJECT_REF}.supabase.co/functions/v1/telegram-webhook" \
    -H "Content-Type: application/json" \
    -H "X-Telegram-Bot-Api-Secret-Token: ${TELEGRAM_WEBHOOK_SECRET}" \
    -d '{"message":{"chat":{"id":0},"text":"test"}}')
  echo "Request $i: $STATUS"
done
# Requests 1-60 should return 200, requests 61+ should return 429
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `sentry-expo` package | `@sentry/react-native` with Expo plugin | 2024 (Expo SDK 50+) | `sentry-expo` is legacy; `@sentry/react-native` is the official path [CITED: docs.sentry.io/platforms/react-native/manual-setup/expo/] |
| No webhook secret on Telegram | `secret_token` param on `setWebhook` | 2022 (Bot API 6.1) | Eliminates need for IP allowlisting [CITED: core.telegram.org/bots/api] |
| Sentry Deno SDK auto-flush | Manual `Sentry.flush()` required | Ongoing limitation | Supabase docs updated to document this [VERIFIED: github.com/supabase/supabase/issues/36489] |

**Deprecated/outdated:**
- `sentry-expo`: Legacy package, replaced by `@sentry/react-native` for Expo SDK 50+ [CITED: docs.expo.dev/guides/using-sentry/]

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `enableNative: false` in Sentry.init() disables native crash reporting and avoids the PAC/Hermes crash | Architecture Patterns / Pattern 5 | HIGH - if flag doesn't work or SDK still loads native modules, app crashes again on TestFlight. Verify by building and testing on physical device before shipping |
| A2 | Postgres-based rate limiting with fixed-window counter is performant enough for v1.0 traffic | Architecture Patterns / Pattern 4 | LOW - v1.0 has minimal traffic; even slow queries won't matter. Upgrade to Redis post-launch if needed |
| A3 | Fail-open on rate limit DB errors is the right choice | Anti-Patterns | LOW - alternative (fail-closed) would block all traffic on a DB hiccup. Fail-open is standard for availability-first services |
| A4 | Simple `===` comparison for webhook secret is sufficient (vs constant-time compare) | Anti-Patterns | LOW - timing attacks require many thousands of requests and nanosecond precision; behind HTTPS + rate limiting, this is not exploitable in practice |
| A5 | The `_shared/` directory pattern works for Supabase Edge Functions imports | Architecture Patterns | MEDIUM - Supabase docs reference importing from relative paths; need to verify `_shared/` imports work in deployed functions |

## Open Questions

1. **Does `enableNative: false` actually prevent the PAC crash?**
   - What we know: The crash was caused by Sentry's native iOS plugin. The `enableNative` flag exists in the SDK.
   - What's unclear: Whether the native module is still loaded (and crashes) even when the flag is false, or whether it's truly skipped.
   - Recommendation: After installing, build a TestFlight version and verify no crash before shipping to production. If it still crashes, fall back to `@sentry/browser` instead of `@sentry/react-native`.

2. **Can `_shared/` directory be imported across edge functions?**
   - What we know: Supabase docs show edge functions importing from relative paths. No `_shared/` directory exists yet in this project.
   - What's unclear: Whether deployed functions can import from `../_shared/` or if each function is isolated.
   - Recommendation: Create `_shared/sentry.ts` and `_shared/rate-limit.ts`, test locally with `supabase functions serve`, then deploy. If imports fail, inline the code into each function.

3. **Sentry Deno SDK version pinning**
   - What we know: Supabase docs import from `https://deno.land/x/sentry/index.mjs` without version pin.
   - What's unclear: Whether this is stable in production or if a specific version should be pinned.
   - Recommendation: Pin to a specific version (e.g., `https://deno.land/x/sentry@8.x.x/index.mjs`) after testing locally.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Manual testing (no automated test framework exists) |
| Config file | none |
| Quick run command | Manual curl commands |
| Full suite command | Manual smoke test checklist |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SEC-01 | Telegram webhook rejects requests without secret header | manual | `curl -s -o /dev/null -w "%{http_code}" -X POST $WEBHOOK_URL -d '{}' # expect 401` | N/A |
| SEC-02 | Malicious token in invite-redirect is rejected | manual | `curl -s -o /dev/null -w "%{http_code}" "$INVITE_URL?token=</script><script>alert(1)</script>" # expect 400` | N/A |
| SEC-03 | config.toml has auth-mechanism comments | manual | `grep -c "auth:" supabase/config.toml # expect 3` | N/A |
| SEC-04 | Sentry captures errors from mobile + edge functions | manual | Trigger test error, check Sentry dashboard within minutes | N/A |
| SEC-05 | Rate limit returns 429 after threshold | manual | See abuse simulation curl loop above | N/A |

### Sampling Rate
- **Per task commit:** Run relevant curl test for the changed function
- **Per wave merge:** Run all 5 manual tests
- **Phase gate:** All 5 success criteria from ROADMAP.md verified via manual test

### Wave 0 Gaps
- No automated test framework exists (FUT-01 is deferred). All verification is manual curl + visual Sentry dashboard check.

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | Yes | Telegram secret-token header, BOT_INTERNAL_SECRET shared secret |
| V3 Session Management | No | Edge functions are stateless |
| V4 Access Control | Yes | verify_jwt=false documented with alternative auth per function |
| V5 Input Validation | Yes | UUID v4 regex validation on invite-redirect token |
| V6 Cryptography | No | No custom crypto; secrets are env vars compared as strings |

### Known Threat Patterns for Supabase Edge Functions

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Unauthenticated webhook abuse | Spoofing | Telegram secret-token header verification (SEC-01) |
| XSS via invite token | Tampering | UUID regex input validation before HTML interpolation (SEC-02) |
| Brute-force/DDoS on public endpoints | Denial of Service | IP-based rate limiting with 429 responses (SEC-05) |
| Silent errors in production | Information Disclosure (inverted: lack of info) | Sentry observability restoration (SEC-04) |

## Sources

### Primary (HIGH confidence)
- [Telegram Bot API docs](https://core.telegram.org/bots/api) - `setWebhook` `secret_token` parameter, `X-Telegram-Bot-Api-Secret-Token` header
- [Supabase Sentry Monitoring docs](https://supabase.com/docs/guides/functions/examples/sentry-monitoring) - Deno SDK init pattern, `defaultIntegrations: false`
- [Supabase Issue #36489](https://github.com/supabase/supabase/issues/36489) - Manual `Sentry.flush()` required before function return
- npm registry - `@sentry/react-native` version 8.7.0 verified 2026-04-06
- Codebase inspection - `telegram-webhook/index.ts`, `invite-redirect/index.ts`, `process-bot-message/index.ts`, `config.toml`

### Secondary (MEDIUM confidence)
- [Sentry React Native Expo docs](https://docs.sentry.io/platforms/react-native/manual-setup/expo/) - Setup wizard, Expo plugin configuration
- [Expo Sentry guide](https://docs.expo.dev/guides/using-sentry/) - Managed workflow integration
- [Supabase Rate Limiting docs](https://supabase.com/docs/guides/functions/examples/rate-limiting) - Upstash Redis pattern (adapted to Postgres for this project)

### Tertiary (LOW confidence)
- `enableNative: false` flag behavior - based on SDK API surface, not verified against PAC crash scenario

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Sentry versions verified via npm, Deno SDK verified via Supabase docs
- Architecture: HIGH - All patterns derived from existing codebase patterns + official docs
- Pitfalls: HIGH - Sentry flush issue verified via GitHub issue; PAC crash verified via project history
- Rate limiting: MEDIUM - Postgres approach is sound but not the officially recommended Supabase pattern (they recommend Upstash Redis)

**Research date:** 2026-04-06
**Valid until:** 2026-05-06 (stable domain, 30-day validity)
