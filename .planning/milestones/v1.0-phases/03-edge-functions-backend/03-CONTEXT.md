# Phase 3: Edge Functions & Backend - Context

**Gathered:** 2026-03-18
**Status:** Ready for planning

<domain>
## Phase Boundary

Audit and harden all 12 deployed Edge Functions against the Phase 2 confirmed DB contracts. Every function must return correct HTTP status codes, filter archived data, and execute its intended action reliably. Scheduled cron jobs must run on correct schedules. The bot message flow must complete end-to-end. App Store URLs in invite-redirect must be moved to env vars and flagged for manual verification.

Requirements: EDGE-01, EDGE-02, EDGE-03, EDGE-05

Functions in scope (12): `ai-draft-reminders`, `ai-insights`, `ai-search`, `auto-confirm-payments`, `invite-redirect`, `mark-overdue`, `process-bot-message`, `send-push`, `send-reminders`, `telegram-webhook`, `whatsapp-send-code`, `whatsapp-webhook`

</domain>

<decisions>
## Implementation Decisions

### Error response standards
- Simple `{ "error": "Human-readable message" }` JSON shape for all error responses
- Full HTTP status code range: 400 (bad input), 401 (auth failure), 404 (missing resource), 500 (unexpected server error)
- Cron functions (auto-confirm, mark-overdue, send-reminders): `console.error` + continue processing remaining items — one bad record doesn't block others
- Audit and fix all 12 functions in one uniform pass, not prioritized subsets

### Cron schedule verification
- Code review + document approach: verify schedule expressions match intended cadence (hourly, daily midnight, daily 9 AM), document confirmed schedules
- No health-check endpoints — actual pg_cron verification is a Supabase dashboard manual step
- Re-audit soft-delete filtering in all cron function queries (verify `.eq('is_archived', false)` on every tenants/payments/properties query)
- Verify send-reminders timing logic: confirm 3-day-before, on-day, and 3-day-after window calculations are correct
- Verify auto-confirm only targets `status='paid'` rows and 48-hour window calculation is correct, aligned with Phase 2 state machine trigger

### Bot end-to-end flow
- Code-path review only (no live test) — trace webhook → process-bot-message → Claude API → structured JSON → DB mutation → reply
- Verify all 5 bot action DB mutation paths: log_payment, confirm_payment, add_property, add_tenant, send_reminder
- Add runtime validation that Claude's response JSON has required fields (intent, entities, action_description, needs_confirmation) before executing any DB action — prevents malformed AI output from corrupting data
- AI tool functions (ai-insights, ai-draft-reminders, ai-search) get same audit depth: error codes, soft-delete checks, response validation

### App Store URLs
- Current URLs (App Store ID 6760478576, Play Store com.dwella.app) need manual verification — unknown if real or placeholder
- Move URLs from hardcoded constants to environment variables (`APPLE_APP_STORE_URL`, `GOOGLE_PLAY_STORE_URL`) so they can be updated without redeploying
- Audit redirect logic only (iOS → App Store, Android → Play Store, deep link → app) — landing page styling is not in scope
- Flag as pre-launch checkpoint: URLs must be verified correct before App Store submission

### Claude's Discretion
- Exact validation logic for Claude API response schema (lightweight checks vs full schema validation)
- Order of function audits within the single pass
- How to structure the soft-delete re-audit (inline fixes vs separate migration)
- Error message wording in each function

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Edge Functions (all 12 — audit targets)
- `supabase/functions/ai-draft-reminders/index.ts` — AI reminder drafting
- `supabase/functions/ai-insights/index.ts` — AI insights generation
- `supabase/functions/ai-search/index.ts` — AI semantic search
- `supabase/functions/auto-confirm-payments/index.ts` — Hourly auto-confirm (paid → confirmed after 48h)
- `supabase/functions/invite-redirect/index.ts` — Invite landing page + store redirect (placeholder URLs at lines 20-21)
- `supabase/functions/mark-overdue/index.ts` — Daily midnight overdue marking
- `supabase/functions/process-bot-message/index.ts` — Claude API integration, structured JSON parsing, DB action execution
- `supabase/functions/send-push/index.ts` — Push notification dispatch
- `supabase/functions/send-reminders/index.ts` — Daily 9 AM payment reminders (3-day window logic)
- `supabase/functions/telegram-webhook/index.ts` — Telegram bot webhook handler
- `supabase/functions/whatsapp-send-code/index.ts` — WhatsApp OTP dispatch
- `supabase/functions/whatsapp-webhook/index.ts` — WhatsApp webhook handler

### Phase 2 DB contracts (audit baseline)
- `supabase/migrations/` (001-015+) — Full schema including RLS policies and payment state machine trigger
- `.planning/phases/02-security-data-integrity/02-CONTEXT.md` — Payment state machine transitions, webhook validation decisions, soft-delete approach

### Concerns & architecture
- `.planning/codebase/CONCERNS.md` — #12 (generic 500s in Edge Functions), #18 (placeholder App Store URLs)
- `.planning/codebase/INTEGRATIONS.md` — Bot flow diagram, cron schedule documentation, webhook flows
- `.planning/codebase/ARCHITECTURE.md` — RLS policy structure, bot message flow

### Requirements
- `.planning/REQUIREMENTS.md` — EDGE-01, EDGE-02, EDGE-03, EDGE-05 acceptance criteria

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- Phase 2 webhook validation already in telegram-webhook and whatsapp-webhook — audit should verify it's correct, not re-add
- `lib/payments.ts` — Payment status transitions and labels, should match DB trigger from Phase 2
- Phase 2 prompt injection mitigation in process-bot-message — verify it's present, not re-implement

### Established Patterns
- Edge Functions use Deno runtime with `https://esm.sh/@supabase/supabase-js@2` imports
- Service role key (`SUPABASE_SERVICE_ROLE_KEY`) used for cron functions (bypasses RLS)
- Claude API called via direct fetch with `ANTHROPIC_API_KEY` env var
- Error responses currently use `{ error: string }` shape inconsistently — some return plain text

### Integration Points
- Cron functions query `tenants` and `payments` tables — must filter `is_archived = false`
- process-bot-message receives messages from both telegram-webhook and whatsapp-webhook
- send-push is called by send-reminders for notification delivery
- invite-redirect serves HTML + handles redirects based on User-Agent

</code_context>

<specifics>
## Specific Ideas

No specific requirements — standard audit and hardening patterns apply.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 03-edge-functions-backend*
*Context gathered: 2026-03-18*
