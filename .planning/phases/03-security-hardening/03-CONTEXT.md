# Phase 3: Security Hardening - Context

**Gathered:** 2026-04-06
**Status:** Ready for planning

<domain>
## Phase Boundary

Close the edge-function attack surface and restore production observability so the privacy policy's "we monitor for incidents" claim is truthful. This phase touches Supabase Edge Functions and mobile app instrumentation only — no new product features, no UI changes, no database schema changes.

**In scope:** Telegram webhook secret-token verification, invite-redirect XSS fix, config.toml documentation for verify_jwt=false functions, Sentry re-enablement (mobile + edge functions), rate limiting on public endpoints.

**Out of scope:** Account deletion flow (Phase 4), in-app consent UI (Phase 5), store submission (Phase 6), RLS policy audit (separate hardening milestone), bot tenant-name fuzzy matching improvements (tech debt, not security-critical for v1.0).

</domain>

<decisions>
## Implementation Decisions

### Telegram Webhook Authentication (SEC-01)
- **D-01:** Verify incoming requests using the `X-Telegram-Bot-Api-Secret-Token` header. Register the secret token with Telegram's `setWebhook` API. Simple string comparison inside `telegram-webhook/index.ts` before any processing.
- **D-02:** Reject unauthenticated requests with HTTP 401 Unauthorized and an empty body. No retry suppression needed — legitimate Telegram requests will always carry the correct header.
- **D-03:** The secret token value must be set as a Supabase Edge Function environment variable (e.g., `TELEGRAM_WEBHOOK_SECRET`), NOT hardcoded. High-entropy random string (32+ chars).

### invite-redirect XSS Fix (SEC-02)
- **D-04:** Validate the `token` query parameter against a strict UUID v4 regex (`/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i`) before ANY interpolation into HTML. Reject with a static error page if the token doesn't match.
- **D-05:** `verify_jwt = false` on invite-redirect is intentionally correct — browsers hit this URL with no auth token. Add a comment in `supabase/config.toml` documenting this is a public endpoint by design and why.
- **D-06:** No additional encoding layer beyond UUID validation — if the token passes the regex, it contains only hex digits and hyphens, which are HTML-safe by construction.

### verify_jwt=false Documentation (SEC-03)
- **D-07:** Every edge function with `verify_jwt = false` in `supabase/config.toml` must have a comment documenting its alternative auth mechanism:
  - `telegram-webhook`: Telegram secret-token header (D-01)
  - `process-bot-message`: `BOT_INTERNAL_SECRET` shared-secret header (already implemented)
  - `invite-redirect`: intentionally public, UUID-validated input only (D-04/D-05)

### Observability Restoration (SEC-04)
- **D-08:** Re-enable Sentry using `@sentry/react-native` JS-only SDK (no native crash symbolication plugin — that was what caused the original crash). Free tier covers 5K errors/month, sufficient for v1.0 launch.
- **D-09:** Instrument Supabase Edge Functions with Sentry Deno SDK (`@sentry/deno` or equivalent) for server-side error capture. Both mobile app AND edge function errors must be visible in a single Sentry dashboard.
- **D-10:** "Visible within 24 hours" means: Sentry alerts configured to send email on first occurrence of a new error. Solo dev checks email daily — no PagerDuty or real-time alerting needed at v1.0.
- **D-11:** Sentry DSN stored as environment variables: `EXPO_PUBLIC_SENTRY_DSN` for the mobile app, `SENTRY_DSN` for edge functions. No DSN in source code.

### Rate Limiting (SEC-05)
- **D-12:** Implement rate limiting inside each public edge function using a Supabase table as a request counter (IP-based). No external gateway or proxy — keep infrastructure simple for solo dev on free tier.
- **D-13:** Default threshold: 60 requests/minute per IP for `telegram-webhook` and `process-bot-message`. Lower threshold of 10 requests/minute per IP for `invite-redirect` (one-shot per invite, no reason for rapid requests).
- **D-14:** Rate limit exceeded returns HTTP 429 Too Many Requests. Telegram will back off on 429 automatically.
- **D-15:** Rate limit table should be lightweight — IP + function name + window timestamp + count. Old entries cleaned up periodically (can piggyback on an existing scheduled function or use a simple TTL approach).
- **D-16:** Manual abuse simulation test: curl the webhook endpoint rapidly and verify 429 fires at the configured threshold. Document the test command in the plan's verification section.

### Claude's Discretion
- Sentry SDK version selection and initialization pattern (error boundary, navigation integration)
- Rate limit table schema design (single table vs per-function)
- Whether to use sliding window or fixed window for rate counting
- Exact curl commands for abuse simulation testing
- Whether Sentry Deno SDK works in Supabase Edge Functions or if a simpler HTTP-based error reporter is needed (fallback: POST errors to Sentry ingest API directly)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Security-critical source files (must read before implementing)
- `supabase/functions/telegram-webhook/index.ts` — Entry point for all Telegram bot traffic; currently has NO secret-token verification
- `supabase/functions/invite-redirect/index.ts` lines 187, 193 — XSS sink where token is interpolated into HTML without validation
- `supabase/functions/process-bot-message/index.ts` lines 998-1002 — Existing BOT_INTERNAL_SECRET auth pattern (reference for how shared-secret auth is already done)
- `supabase/config.toml` lines 382-401 — verify_jwt=false settings for all 3 public functions

### Project-level
- `.planning/PROJECT.md` — Critical blockers list includes all SEC-* items
- `.planning/REQUIREMENTS.md` §§ SEC-01, SEC-02, SEC-03, SEC-04, SEC-05
- `.planning/ROADMAP.md` Phase 3 section — goal + success criteria
- `.planning/codebase/CONCERNS.md` §3 (Security Concerns) — detailed analysis of each vulnerability

### Prior phase outputs
- `.planning/legal/tracker-audit.md` — confirms zero analytics SDKs currently in the app (Sentry starts from scratch)

### External references (not in repo)
- Telegram Bot API `setWebhook` docs — `secret_token` parameter for webhook verification
- Sentry React Native SDK docs — JS-only mode setup (no native plugin)
- Sentry Deno SDK docs — edge function instrumentation

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `supabase/functions/process-bot-message/index.ts` lines 998-1002 — existing `BOT_INTERNAL_SECRET` check pattern can be adapted for telegram-webhook secret-token verification
- `supabase/config.toml` — already has comments explaining why verify_jwt=false; extend with auth-mechanism documentation per D-07
- Supabase client creation pattern in edge functions (`createClient` with service role key) — rate limit table queries will follow this pattern

### Established Patterns
- Edge functions use Deno runtime with `Deno.env.get()` for secrets — all new secrets (TELEGRAM_WEBHOOK_SECRET, SENTRY_DSN) follow this pattern
- `supabase/functions/` has one directory per function with `index.ts` entry point — Sentry init and rate-limit utility can be shared via a `_shared/` directory pattern if Supabase supports it
- Mobile app uses `constants/config.ts` with `requireEnv()` for env vars — SENTRY_DSN follows this pattern

### Integration Points
- `app/_layout.tsx` — Sentry.init() goes here (app root, before any navigation)
- `supabase/functions/telegram-webhook/index.ts` — secret-token check added at top of handler (early return)
- `supabase/functions/invite-redirect/index.ts` — UUID validation added before template interpolation
- `supabase/config.toml` — comments updated for all verify_jwt=false entries

</code_context>

<specifics>
## Specific Ideas

- Sentry JS-only SDK (no native plugin) to avoid the crash that caused the original removal — this is a deliberate downgrade from full native crash symbolication to avoid the PAC/Hermes conflict
- Rate limit table can be very simple — don't over-engineer for v1.0 traffic volumes
- The `setWebhook` call to register the secret token with Telegram needs to happen once (can be a manual curl command documented in the plan, not automated)

</specifics>

<deferred>
## Deferred Ideas

- **RLS policy audit and test suite** — CONCERNS.md §3.4 flags no RLS tests; important but separate hardening milestone
- **Bot fuzzy matching improvement** — `ilike('%name%')` matches across tenants before scoping; tech debt, not a v1.0 security blocker
- **Storage bucket policy audit** — CONCERNS.md §3.5 flags fragile path parsing; separate scope
- **PII in edge function console.log/console.warn** — CONCERNS.md §4.8; cleanup is good practice but not a security gate for v1.0
- **IP allowlisting for Telegram** — discussed as option but rejected in favor of simpler secret-token approach; reconsider if abuse is detected post-launch

### Reviewed Todos (not folded)
None — no pending todos matched Phase 3.

</deferred>

---

*Phase: 03-security-hardening*
*Context gathered: 2026-04-06*
