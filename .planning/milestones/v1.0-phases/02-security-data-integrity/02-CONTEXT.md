# Phase 2: Security & Data Integrity - Context

**Gathered:** 2026-03-18
**Status:** Ready for planning

<domain>
## Phase Boundary

Close every security-class vulnerability at the root cause layer. RLS policies protect all tables, tokens are cryptographically secure, webhooks reject unauthenticated callers, payment state transitions are enforced at the DB level, and soft-delete filtering is verified everywhere. No new features — hardening only.

Requirements: SEC-01, SEC-02, SEC-03, SEC-04, SEC-05, SEC-06, DATA-01, DATA-02, DATA-03, DATA-04

</domain>

<decisions>
## Implementation Decisions

### Payment state machine transitions
- Valid transitions enforced via `BEFORE UPDATE` trigger on `payments` table:
  - `pending` → `partial`, `paid`, `overdue`
  - `partial` → `paid`, `overdue`
  - `overdue` → `partial`, `paid`
  - `paid` → `confirmed`
  - `confirmed` → `paid` (reversal — landlord correction)
- Invalid transitions raise a Postgres exception with a clear message: `RAISE EXCEPTION 'Invalid payment transition: % → %', OLD.status, NEW.status`
- Client receives a Postgres error on invalid transitions — handle gracefully in hooks
- Overdue can receive both partial and full late payments (not terminal)
- Confirmed → paid reversal allowed for landlord corrections only

### Webhook validation
- Both Telegram and WhatsApp webhooks validate authentication before any processing
- Failed validation returns `401 Unauthorized` (standard HTTP, per Telegram docs)
- Failed auth attempts logged to Sentry as warnings (enables alerting on attack volume spikes)
- Telegram: validate bot secret/token from request
- WhatsApp: validate HMAC signature from Meta — exact spec needs research during planning (noted in STATE.md as unconfirmed)

### Prompt injection mitigation
- User-controlled strings (property names, tenant names) XML-escaped in Claude bot context
- Wrap user data in clearly-marked XML tags so Claude distinguishes data from instructions
- Names with apostrophes, #, accented chars are preserved (no aggressive stripping)
- 200-character length limit on names in bot context (truncate at Edge Function level, not DB)
- Prevents both instruction injection and context stuffing attacks

### Soft-delete enforcement
- Patch-at-query-level approach: fix any missing `.eq('is_archived', false)` filters found during audit
- No new DB views or abstractions — minimal change footprint pre-launch
- Audit scope: ALL hooks + ALL screens + ALL 13 Edge Functions (complete coverage per DATA-01)
- Document audit results as a checklist for future reference

### Crypto-secure token generation
- Replace `Math.random()` UUID in `lib/bot.ts` with `expo-crypto` `randomUUID()` (SEC-01)
- Replace `Math.random()` verification code generation with crypto-secure alternative (SEC-02)
- No user decision needed — clear best practice

### RLS policy audit
- Audit all 8 tables for correct `USING` + `WITH CHECK` clauses on UPDATE policies (SEC-03)
- Fix gaps found — no user decision needed on specific policies

### Claude's Discretion
- Exact RLS policy SQL structure (as long as USING + WITH CHECK are both present)
- Crypto-secure verification code implementation details (expo-crypto vs getRandomValues)
- Soft-delete audit order (hooks first vs Edge Functions first)
- Invite flow edge case handling approach (DATA-04)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Security concerns
- `.planning/codebase/CONCERNS.md` — Items #2-5 (crypto, webhooks, token leakage), #7-8 (soft-delete, payment state machine)
- `.planning/codebase/ARCHITECTURE.md` — RLS policy structure, auth flow, invite tokens, bot message flow

### Database schema
- `supabase/migrations/001_initial_schema.sql` — Base schema with RLS policies, payment status CHECK constraint
- `supabase/migrations/` (all 001-015) — Full migration history for understanding current DB state

### Bot integration
- `lib/bot.ts` — Math.random() UUID (line 39-44) and verification code (line 79) to replace; bot message sending
- `supabase/functions/process-bot-message/` — Claude API context construction (where prompt injection mitigation applies)
- `supabase/functions/telegram-webhook/` — Telegram webhook handler (needs secret validation)
- `supabase/functions/whatsapp-webhook/` — WhatsApp webhook handler (needs HMAC validation)

### Requirements
- `.planning/REQUIREMENTS.md` — SEC-01 through SEC-06, DATA-01 through DATA-04

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `lib/sentry.ts` — Sentry already initialized (Phase 1); can be used for webhook auth failure logging in Edge Functions
- `eslint-plugin-security` — Already configured (Phase 1); will flag new security issues automatically
- `lib/payments.ts` — Payment status colors, labels, and transitions already defined; DB trigger must match these

### Established Patterns
- Supabase RLS: policies exist on all tables but may have gaps (UPDATE policies missing WITH CHECK)
- Soft-delete: `.eq('is_archived', false)` pattern used in hooks but not centralized
- Edge Functions: Deno-based, use Supabase client directly for DB access
- Bot context: `process-bot-message` constructs Claude context from user's properties/tenants list

### Integration Points
- Payment state machine trigger connects to: `auto-confirm-payments` (paid → confirmed), `mark-overdue` (pending/partial → overdue), all payment mutation screens
- Webhook validation sits before all processing in `telegram-webhook` and `whatsapp-webhook`
- Prompt injection mitigation applies in `process-bot-message` context construction
- Soft-delete audit touches all hooks (6+), multiple screens, and 13 Edge Functions

</code_context>

<specifics>
## Specific Ideas

No specific requirements — standard security hardening patterns apply.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 02-security-data-integrity*
*Context gathered: 2026-03-18*
