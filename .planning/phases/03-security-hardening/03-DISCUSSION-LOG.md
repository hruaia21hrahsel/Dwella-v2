# Phase 3: Security Hardening - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-06
**Phase:** 03-security-hardening
**Areas discussed:** Telegram webhook authentication, XSS fix strategy, Observability restoration, Rate limiting approach

---

## Telegram Webhook Authentication

### How should the telegram-webhook function verify incoming requests?

| Option | Description | Selected |
|--------|-------------|----------|
| Secret-token header | Set a secret_token when registering the webhook with Telegram. Telegram sends it as X-Telegram-Bot-Api-Secret-Token on every request. Simple string comparison. | ✓ |
| IP allowlist + secret-token | Secret-token header PLUS check that the request comes from Telegram's published IP ranges. Defense in depth but IP ranges can change. | |
| You decide | Let Claude pick the most practical approach. | |

**User's choice:** Secret-token header
**Notes:** Simple, standard approach. No need for IP allowlisting complexity.

### What should happen when a request fails authentication?

| Option | Description | Selected |
|--------|-------------|----------|
| HTTP 401 Unauthorized | Return 401 with no body. Clear, standard, easy to spot in logs. | ✓ |
| HTTP 200 silent drop | Return 200 OK but do nothing. Prevents attackers from knowing endpoint is protected. | |
| You decide | Let Claude pick. | |

**User's choice:** HTTP 401 Unauthorized
**Notes:** Standard rejection. Clear for logging.

---

## XSS Fix for invite-redirect

### How should the invite-redirect function validate the token?

| Option | Description | Selected |
|--------|-------------|----------|
| UUID regex gate | Validate token matches UUID v4 regex before ANY interpolation. Reject with static error page if invalid. | ✓ |
| HTML entity encoding | Escape all special characters before interpolation. More permissive for future non-UUID tokens. | |
| Both: UUID gate + encoding | Belt and suspenders. UUID regex as primary gate, HTML encoding as defense-in-depth. | |

**User's choice:** UUID regex gate
**Notes:** Tightest validation. Tokens are already UUIDs — no need for broader encoding.

### Should the fix also address verify_jwt=false on invite-redirect?

| Option | Description | Selected |
|--------|-------------|----------|
| XSS only | invite-redirect MUST be public. Just document why verify_jwt=false is correct. | ✓ |
| XSS + rate limiting | Fix XSS and add rate limiting to prevent token enumeration. | |

**User's choice:** XSS only
**Notes:** verify_jwt=false is intentionally correct for this endpoint. Rate limiting handled separately.

---

## Observability Restoration

### Which observability solution?

| Option | Description | Selected |
|--------|-------------|----------|
| Sentry re-enablement | Re-add @sentry/react-native JS-only SDK. Free tier 5K errors/month. | ✓ |
| Expo Updates crash reports only | Zero new dependencies. Rely on store crash reports. | |
| BugSnag | Alternative with 7.5K events/month free tier. | |
| You decide | Let Claude pick. | |

**User's choice:** Sentry re-enablement
**Notes:** Previously used, known quantity. JS-only SDK avoids the native plugin crash.

### Should edge function errors also be captured?

| Option | Description | Selected |
|--------|-------------|----------|
| Both app + edge functions | Sentry in React Native app AND edge functions. Full coverage. | ✓ |
| Mobile app only | Edge function errors visible in Supabase dashboard logs. Simpler. | |
| You decide | Let Claude assess Deno runtime compatibility. | |

**User's choice:** Both app + edge functions
**Notes:** Full coverage across both mobile and server-side.

---

## Rate Limiting

### Where should rate limiting be implemented?

| Option | Description | Selected |
|--------|-------------|----------|
| In-function with DB counter | Each function checks a Supabase table for request count per IP. Simple, no external deps. | ✓ |
| Shared middleware pattern | Same DB-backed approach but DRY shared utility. More upfront architecture. | |
| External gateway | Cloudflare/Kong reverse proxy. Most robust but adds infra complexity. | |
| You decide | Let Claude pick what's realistic for free tier. | |

**User's choice:** In-function with DB counter
**Notes:** Keep it simple. No external infrastructure.

### What rate limit thresholds?

| Option | Description | Selected |
|--------|-------------|----------|
| Conservative: 30 req/min | Tight. Blocks spray attacks but may false-positive on retries. | |
| Generous: 60 req/min | More headroom for legitimate bursts and spotty connections. | ✓ |
| You decide | Let Claude set per-endpoint defaults. | |

**User's choice:** Generous: 60 req/min per IP
**Notes:** 60/min for webhook/bot endpoints. invite-redirect gets lower threshold (10/min) since it's one-shot.

---

## Claude's Discretion

- Sentry SDK version and init pattern
- Rate limit table schema
- Sliding vs fixed window for rate counting
- Curl commands for abuse simulation
- Whether Sentry Deno SDK works in Supabase Edge Functions or needs HTTP fallback

## Deferred Ideas

- RLS policy audit and test suite — separate hardening milestone
- Bot fuzzy matching improvement — tech debt
- Storage bucket policy audit — separate scope
- PII in edge function logs — good practice but not v1.0 gate
- IP allowlisting for Telegram — reconsider post-launch if abuse detected
