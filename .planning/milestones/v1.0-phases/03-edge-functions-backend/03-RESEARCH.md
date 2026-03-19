# Phase 3: Edge Functions & Backend — Research

**Researched:** 2026-03-18
**Domain:** Supabase Edge Functions (Deno runtime), Claude API integration, pg_cron scheduling, invite redirect flow
**Confidence:** HIGH — all findings derived from direct code inspection of the 12 functions in scope

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Error response standards**
- Simple `{ "error": "Human-readable message" }` JSON shape for all error responses
- Full HTTP status code range: 400 (bad input), 401 (auth failure), 404 (missing resource), 500 (unexpected server error)
- Cron functions (auto-confirm, mark-overdue, send-reminders): `console.error` + continue processing remaining items — one bad record doesn't block others
- Audit and fix all 12 functions in one uniform pass, not prioritized subsets

**Cron schedule verification**
- Code review + document approach: verify schedule expressions match intended cadence (hourly, daily midnight, daily 9 AM)
- No health-check endpoints — actual pg_cron verification is a Supabase dashboard manual step
- Re-audit soft-delete filtering in all cron function queries (verify `.eq('is_archived', false)` on every tenants/payments/properties query)
- Verify send-reminders timing logic: confirm 3-day-before, on-day, and 3-day-after window calculations are correct
- Verify auto-confirm only targets `status='paid'` rows and 48-hour window calculation is correct, aligned with Phase 2 state machine trigger

**Bot end-to-end flow**
- Code-path review only (no live test) — trace webhook → process-bot-message → Claude API → structured JSON → DB mutation → reply
- Verify all 5 bot action DB mutation paths: log_payment, confirm_payment, add_property, add_tenant, send_reminder
- Add runtime validation that Claude's response JSON has required fields (intent, entities, action_description, needs_confirmation) before executing any DB action — prevents malformed AI output from corrupting data
- AI tool functions (ai-insights, ai-draft-reminders, ai-search) get same audit depth: error codes, soft-delete checks, response validation

**App Store URLs**
- Current URLs (App Store ID 6760478576, Play Store com.dwella.app) need manual verification — unknown if real or placeholder
- Move URLs from hardcoded constants to environment variables (`APPLE_APP_STORE_URL`, `GOOGLE_PLAY_STORE_URL`) so they can be updated without redeploying
- Audit redirect logic only (iOS → App Store, Android → Play Store, deep link → app) — landing page styling is not in scope
- Flag as pre-launch checkpoint: URLs must be verified correct before App Store submission

### Claude's Discretion
- Exact validation logic for Claude API response schema (lightweight checks vs full schema validation)
- Order of function audits within the single pass
- How to structure the soft-delete re-audit (inline fixes vs separate migration)
- Error message wording in each function

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| EDGE-01 | All Edge Functions return appropriate HTTP status codes (400/404/500, not generic 500) | Code inspection reveals which functions have missing or incorrect status codes — see findings below |
| EDGE-02 | Scheduled functions (auto-confirm, mark-overdue, send-reminders) verified working with correct cron schedules | Code logic audited for each; schedule verification is a Supabase dashboard manual step |
| EDGE-03 | Bot action flow traced end-to-end (message → Claude → structured JSON → DB action → reply) | Full code path traced; missing runtime validation of Claude JSON shape identified |
| EDGE-05 | App Store / Play Store placeholder URLs replaced with real values in invite-redirect | Hardcoded constants identified at invite-redirect/index.ts lines 20-21; env-var migration path defined |
</phase_requirements>

---

## Summary

This phase audits and hardens all 12 deployed Supabase Edge Functions against confirmed DB contracts and security requirements from Phase 2. All 12 functions have been read and analyzed. The findings are precise: several specific gaps exist, and the fixes are surgical — no architectural changes required.

The most impactful gaps are: `process-bot-message` executes DB actions on Claude's JSON output without validating that required fields are present first (EDGE-03 gap); `auto-confirm-payments` and `mark-overdue` do not filter `is_archived = false` on tenant joins (EDGE-02 gap); `send-push` has no input validation and returns the raw Expo API response with no error handling; and `invite-redirect` hardcodes store URLs as constants rather than env vars (EDGE-05).

Error code coverage (EDGE-01) is mostly good in the AI tool functions (`ai-insights`, `ai-draft-reminders`, `ai-search`, `process-bot-message`, `whatsapp-send-code`) which already return 400 for missing required fields. The weakest functions are `send-push` (zero input validation), `auto-confirm-payments` and `mark-overdue` (return 500 JSON without `Content-Type` header), and `invite-redirect` (returns plain text "Missing invite token." without JSON shape).

**Primary recommendation:** Implement fixes as a single linear pass through all 12 functions, ordered from simplest to most complex: send-push → invite-redirect → auto-confirm-payments → mark-overdue → send-reminders → telegram-webhook → whatsapp-webhook → whatsapp-send-code → ai-insights → ai-draft-reminders → ai-search → process-bot-message.

---

## Standard Stack

### Core (already in use — no changes needed)

| Library | Version | Purpose | Notes |
|---------|---------|---------|-------|
| `@supabase/supabase-js` | `2.x` (via `https://esm.sh/@supabase/supabase-js@2`) | Supabase client for DB queries in Edge Functions | Service role key bypasses RLS in cron functions |
| `https://deno.land/std@0.177.0/http/server.ts` | `0.177.0` | `serve()` handler for some functions | Some functions use `Deno.serve()` — both work |
| `https://api.anthropic.com/v1/messages` | API `2023-06-01` | Claude API for bot + AI tools | Model: `claude-sonnet-4-20250514` hardcoded in all functions |

### Runtime Notes

Supabase Edge Functions run on **Deno** (not Node.js). Key constraints:
- No `npm` imports — use `https://esm.sh/` or `https://deno.land/` URLs
- `Deno.env.get()` for environment variables (not `process.env`)
- `crypto.subtle` available globally for HMAC (used in `whatsapp-webhook`)
- `Deno.serve()` and `serve()` from deno std are both valid — existing functions use a mix

---

## Architecture Patterns

### Pattern 1: Standard HTTP Handler Shape

All 12 functions follow or should follow this pattern:

```typescript
// Source: direct code inspection of all 12 functions
Deno.serve(async (req) => {
  // 1. Handle CORS preflight (for client-callable functions)
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // 2. Parse and validate input — return 400 immediately on bad input
    const { required_field } = await req.json();
    if (!required_field) {
      return new Response(JSON.stringify({ error: 'required_field is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 3. Execute logic

    // 4. Return success
    return new Response(JSON.stringify({ result: ... }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('[function-name] error:', err);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
```

### Pattern 2: Claude JSON Response Validation

Before executing any DB action, validate the Claude response shape. This is the missing guard in `process-bot-message`:

```typescript
// Lightweight required-field check (Claude's discretion per CONTEXT.md)
function isValidClaudeIntent(obj: unknown): obj is ClaudeIntent {
  if (typeof obj !== 'object' || obj === null) return false;
  const o = obj as Record<string, unknown>;
  return (
    typeof o.intent === 'string' &&
    typeof o.entities === 'object' && o.entities !== null &&
    typeof o.action_description === 'string' &&
    typeof o.needs_confirmation === 'boolean'
  );
}

// Usage in callClaude() — after JSON.parse:
const parsed = JSON.parse(jsonStr.trim());
if (!isValidClaudeIntent(parsed)) {
  // Fall back to general_chat — never execute DB action on invalid shape
  return {
    intent: 'general_chat',
    entities: {},
    action_description: 'general response',
    needs_confirmation: false,
    reply: rawContent,
  };
}
return parsed;
```

### Pattern 3: Cron Function Error Isolation

Cron functions must not let one bad record abort the entire batch. Current `auto-confirm-payments` does a single bulk `UPDATE` — acceptable. `mark-overdue` also does a bulk `UPDATE` with `.in('id', overdueIds)` — acceptable. `send-reminders` uses a per-tenant loop — the per-tenant `notifications.insert` should be wrapped in try/catch so one failure doesn't abort:

```typescript
// Per-item error isolation in cron loops
for (const tenant of tenants ?? []) {
  try {
    // ... process tenant
  } catch (err) {
    console.error(`send-reminders: failed for tenant ${tenant.id}:`, err);
    // continue to next tenant
  }
}
```

### Pattern 4: Env Var for Configurable URLs

```typescript
// invite-redirect — replace hardcoded constants with env vars
const APP_STORE_URL = Deno.env.get('APPLE_APP_STORE_URL')
  ?? 'https://apps.apple.com/app/id6760478576';  // fallback preserves current behavior
const PLAY_STORE_URL = Deno.env.get('GOOGLE_PLAY_STORE_URL')
  ?? 'https://play.google.com/store/apps/details?id=com.dwella.app';
```

The fallback ensures the function still works if env vars are not yet set in the dashboard.

---

## Per-Function Audit Findings

This section documents the specific gaps found in each function after direct code inspection. The planner should create one task per function group.

### send-push — CRITICAL gaps

**Current state:** 19 lines of code. No input validation. No try/catch. No `Content-Type` header. Passes the raw Expo API response body through to the caller.

**Gaps:**
1. No validation of `messages` field — crashes with unhandled error if body is malformed or `messages` is missing
2. No try/catch — unhandled promise rejection if `fetch` to Expo fails
3. Response passes through raw `res.text()` from Expo API without checking `res.ok`
4. Missing `Content-Type: application/json` header on success response

**Required fixes:**
- Add input validation: `if (!messages || !Array.isArray(messages)) return 400`
- Wrap in try/catch returning 500
- Check `res.ok` before returning — log Expo API errors, return 502 on upstream failure
- Add `Content-Type: application/json` header

### invite-redirect — EDGE-05 + minor EDGE-01

**Current state:** Hardcoded constants on lines 20-21. Error response for missing token returns plain text "Missing invite token." with status 400 (correct code, wrong shape).

**Gaps:**
1. `APP_STORE_URL` and `PLAY_STORE_URL` are hardcoded strings — must move to env vars (EDGE-05)
2. Missing token returns `'Missing invite token.'` as plain text, not `{ "error": "..." }` JSON (EDGE-01 — minor, but required by decision)

**Required fixes:**
- Replace constants with `Deno.env.get()` with fallback (Pattern 4 above)
- Change error response to JSON shape: `JSON.stringify({ error: 'Missing invite token' })` with `Content-Type: application/json`

### auto-confirm-payments — EDGE-02 soft-delete gap

**Current state:** Single bulk UPDATE — correct, efficient. Error response has `Content-Type` missing on success path (it returns JSON but no `Content-Type` header). Good: filters `eq('status', 'paid')` and `lt('paid_at', ...)` correctly.

**Gaps:**
1. The SELECT query for notification recipients joins `tenants` but does NOT filter `is_archived = false` on tenants. Archived tenants' owner_ids could be included in push notifications.
2. Success `Response` is missing `headers: { 'Content-Type': 'application/json' }` on the count=0 early return at line 65.
3. Error response at line 23 (`{ error: error.message }`) is missing `Content-Type` header.

**Required fixes:**
- Add `.eq('tenants.is_archived', false)` to the nested tenant join in the SELECT (or filter owners from archived tenants post-query)
- Add `headers: { 'Content-Type': 'application/json' }` to all `Response` constructors

### mark-overdue — EDGE-02 soft-delete gap

**Current state:** Fetches pending payments, filters by `due_day < currentDay`, bulk updates. No `is_archived` filter on the tenants join.

**Gaps:**
1. The `tenants` join in the SELECT (line 17) does NOT include `is_archived = false` filter. Archived tenants' payments could be marked overdue.
2. The `payments` table query itself doesn't filter on tenant archived status — if a tenant is archived but has a payment row still in `pending`, it will be wrongly marked `overdue`.
3. Both error Response constructors (lines 24, 44) missing `Content-Type` header.

**Required fixes:**
- Add soft-delete filter: query tenants table or add a join filter so archived tenant payments are excluded. Simplest: after fetching `payments`, filter out rows where `p.tenants?.is_archived === true`.
- Add `Content-Type: application/json` to all responses.

**Note:** The `payments` table does not have `is_archived`. Archived tenant filtering must come from the joined `tenants` table.

### send-reminders — EDGE-02 mostly correct

**Current state:** Correctly filters `.eq('is_archived', false)` on tenants query (line 38). Timing logic: daysUntilDue = `tenant.due_day - todayDay`. Sends at +3, 0, -3 days.

**Timing logic analysis:**
- `daysUntilDue === 3`: 3 days before due — CORRECT
- `daysUntilDue === 0`: on due day — CORRECT
- `daysUntilDue === -3`: 3 days after due (overdue) — CORRECT
- The 3-day-after window includes `pending`, `partial`, AND `overdue` statuses — this is intentional and correct

**Gaps:**
1. Per-tenant loop does N+1 queries (one payment SELECT per tenant) — no try/catch isolation around the per-tenant block. If one payment query errors, the function aborts for all remaining tenants.
2. `error` from `supabase.from('tenants').select(...)` is typed `unknown` (cast at line 38) — accessing `error.message` in return would fail at runtime. The return uses `JSON.stringify({ error: error.message })` — but `error` is typed `unknown`. This will produce `undefined` for `message`.

**Required fixes:**
- Wrap per-tenant logic in try/catch with `console.error` + continue (per decision: cron functions isolate per-item errors)
- Fix error message extraction: `const msg = error instanceof Error ? error.message : String(error)`

### telegram-webhook — mostly correct, minor gap

**Current state:** Validates `TELEGRAM_WEBHOOK_SECRET` header (SEC-04 done). Falls back gracefully if secret not configured (dev-friendly). Forwards to `process-bot-message` correctly. Returns 200 to Telegram in all paths (correct — Telegram requires 200 to prevent retries).

**Gaps:**
1. When `process-bot-message` returns a non-OK response, the webhook logs it but continues to send a fallback reply. The error log uses `botData.error` but `botData` is typed as `{ reply?: string; error?: string }` — this is fine.
2. Minor: `TELEGRAM_BOT_TOKEN` uses `!` assertion. If not set, all `sendTelegram` calls will fail with a runtime error but are uncaught at the outer level. This is a pre-existing pattern — low risk since this env var is always required.

**No fixes required** beyond ensuring `process-bot-message` itself is hardened.

### whatsapp-webhook — mostly correct, minor gaps

**Current state:** Correctly reads raw body before parsing (SEC-05 HMAC pattern). HMAC validation is present and correct using `crypto.subtle`. Forwards to `process-bot-message`. Returns 200 in all paths.

**Gaps:**
1. `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_VERIFY_TOKEN` use `!` assertion — if missing, runtime errors. Pre-existing and low risk.
2. The `normalizePhone` function strips the `+` from the input and then adds `+` prefix — correct for E.164.
3. When `botRes` is not OK, `botData.reply` is used as fallback anyway (`botData.reply ?? 'Sorry...'`) — this is fine but could also log the error better.

**No structural fixes required** — webhook validation is correctly implemented.

### whatsapp-send-code — correct

**Current state:** Returns 400 for missing `phone`/`code`. Returns 502 on WhatsApp API failure (correct — upstream error). Returns 500 on unexpected throw. Returns `{ success: true }` on success. CORS headers present.

**No gaps found.** This function already meets all EDGE-01 requirements.

### ai-insights — mostly correct

**Current state:** Returns 400 for missing `user_id`. Filters `is_archived = false` on properties. Has try/catch returning 500. CORS headers present.

**Gaps:**
1. `JSON.parse(jsonStr.trim())` on line 150 is NOT in a try/catch — if Claude returns malformed JSON that the regex extracts incorrectly, this throws and falls through to the outer catch returning 500. This is acceptable but could return a more specific error.
2. The `expenses` query on line 57 references `supabase.from('expenses')` — if the `expenses` table doesn't exist in the current schema (not visible in migration list reviewed), this will silently return `null` rather than error, leading to `totalExpenses = 0`. This is fine but worth noting.
3. No validation that Claude's response JSON matches the expected shape (`summary`, `highlights`, etc.) before returning it to the caller. Malformed Claude output is passed through.

**Recommended fixes:**
- Wrap `JSON.parse` in try/catch returning a structured error response
- Add basic shape check before returning Claude's parsed response

### ai-draft-reminders — mostly correct

**Current state:** Returns 400 for missing `user_id`. Filters `is_archived = false` on properties. Has try/catch returning 500. CORS headers present. Returns early with `{ reminders: [] }` if no tenants need reminders.

**Gaps:**
1. Same as `ai-insights`: `JSON.parse(jsonStr.trim())` on line 135 outside try/catch
2. The `drafts.find(d => d.tenant_name === t.tenant_name)` match on line 139 is case-sensitive exact match — if Claude returns a slightly different name capitalization, no draft is matched and the fallback message is used. This is acceptable behavior.
3. No validation that Claude returns an array — if Claude returns a non-array JSON, `JSON.parse` succeeds but the `.map` fails.

**Recommended fixes:**
- Wrap `JSON.parse` in try/catch
- Validate that parsed result is an array before using it

### ai-search — mostly correct

**Current state:** Returns 400 for missing `user_id`/`query`. Filters `is_archived = false` on tenants and properties queries. CORS headers present. Has try/catch returning 500.

**Gaps:**
1. `JSON.parse(jsonStr.trim())` for Claude's filter response (line 84) is outside try/catch — malformed Claude output throws to outer catch returning generic 500 instead of a structured error.
2. No validation that `filters.type` is one of the expected values (`payments`/`tenants`/`properties`) — if Claude returns an unexpected type, the `else` branch (properties query) runs silently.

**Recommended fixes:**
- Wrap `JSON.parse` in try/catch
- Validate `filters.type` before executing the query branch

### process-bot-message — EDGE-03 validation gap

**Current state:** Full bot pipeline is present and largely correct. Returns 400 for missing `user_id`/`message`. Has outer try/catch returning 500. All 5 action handlers are implemented and use soft-delete filters.

**Critical gap (EDGE-03):**
The `callClaude()` function JSON.parse result is returned directly without validating required fields before the handler dispatch loop. If Claude returns valid JSON but missing required fields (e.g., `intent` is absent), `result.intent` is `undefined`, `ACTION_HANDLERS[undefined]` is `undefined`, and the code falls to the `else` branch (query intent path) — which is actually safe behavior. However, if `result.entities` is missing/null, the handler receives `undefined` as entities and will fail at property access.

**Required fix:**
Add `isValidClaudeIntent()` guard (Pattern 2 above) in `callClaude()` after `JSON.parse`. This is the fix specified in the CONTEXT.md decision.

**Secondary gap:**
`JSON.parse` in `callClaude()` is in a try/catch that returns a fallback object (lines 505-512) — this is already correctly handled. The gap is specifically that the parsed object's shape is not validated before use.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Claude JSON schema validation | Custom schema validator | Lightweight field-presence check (see Pattern 2) | Full schema validation (zod, etc.) requires npm package; Deno ESM import adds complexity. Simple field-presence check is sufficient for this use case. |
| pg_cron schedule strings | Manual cron expression builder | Standard cron syntax verified in Supabase dashboard | pg_cron uses standard cron format; verification is a dashboard step, not code |
| Expo push API client | Custom push client | Direct `fetch` to `https://exp.host/--/api/v2/push/send` | Already in use; no client library needed for Deno |
| HMAC computation | Custom HMAC | `crypto.subtle` (Deno global) | Already implemented correctly in `whatsapp-webhook` |

---

## Common Pitfalls

### Pitfall 1: `Content-Type` header omitted on error responses

**What goes wrong:** Edge Function returns `JSON.stringify({ error: ... })` body with status 500/400 but no `Content-Type: application/json` header. Clients (Supabase JS client, fetch) may not parse the body as JSON.

**Found in:** `auto-confirm-payments` (error response), `mark-overdue` (both responses), `send-push` (all responses).

**How to avoid:** Every `new Response(JSON.stringify(...))` call must include `headers: { 'Content-Type': 'application/json' }`.

### Pitfall 2: Deno `!` assertions on required env vars

**What goes wrong:** `Deno.env.get('KEY')!` suppresses the TypeScript null check. If the env var is unset in Supabase dashboard, the runtime value is `undefined`, causing errors at use site rather than at startup.

**Current state:** All critical env vars use `!` — this is the project's established pattern (from Phase 02 decision: "Optional secret env vars use no ! assertion — webhooks remain functional in dev"). For Phase 3, no change needed — do not add startup validation (that's Phase 4 CLIENT-02).

### Pitfall 3: Soft-delete filtering on joined tables

**What goes wrong:** Filtering `.eq('is_archived', false)` on the root table but not on the joined table. When using `.select('*, tenants(...)')`, the tenants join returns all rows including archived — the root table filter does not propagate.

**Found in:** `auto-confirm-payments` and `mark-overdue` — both join `tenants` without filtering archived.

**How to avoid:** Either (a) filter archived tenants post-query by checking `p.tenants?.is_archived`, or (b) use a separate query that pre-filters tenant IDs. Option (a) is simpler for this codebase pattern.

### Pitfall 4: JSON.parse outside try/catch in Deno

**What goes wrong:** In Edge Functions, an uncaught synchronous throw inside `Deno.serve()` propagates to the runtime and returns a 500 with no JSON body. The outer try/catch only catches awaited async operations.

**Correction:** Actually, the outer `try { ... } catch (err)` in these functions does catch synchronous throws inside the `try` block. The real issue is that some Claude JSON parsing happens inside `callClaude()` which has its own try/catch (returning fallback object) — this is actually correctly handled already. The gap is strictly the shape validation, not the parse itself.

### Pitfall 5: Bot action handler receiving `undefined` entities

**What goes wrong:** If `result.entities` is missing from Claude's response (malformed but valid JSON), action handlers receive `undefined` instead of an object, causing property destructuring errors at runtime.

**Found in:** `process-bot-message` — handler invoked with `result.entities` before shape validation.

**How to avoid:** `isValidClaudeIntent()` guard that requires `entities` to be a non-null object.

---

## Code Examples

### Correct Response Shape (all functions)

```typescript
// Success
return new Response(JSON.stringify({ result: count }), {
  headers: { 'Content-Type': 'application/json' },
});

// Input validation failure
return new Response(JSON.stringify({ error: 'user_id and message required' }), {
  status: 400,
  headers: { 'Content-Type': 'application/json' },
});

// Not found (use in handlers when tenant/payment lookup returns null)
return new Response(JSON.stringify({ error: 'Resource not found' }), {
  status: 404,
  headers: { 'Content-Type': 'application/json' },
});

// Upstream API failure (e.g., WhatsApp API, Expo Push API)
return new Response(JSON.stringify({ error: 'Upstream service error' }), {
  status: 502,
  headers: { 'Content-Type': 'application/json' },
});

// Unexpected error
return new Response(JSON.stringify({ error: 'Internal server error' }), {
  status: 500,
  headers: { 'Content-Type': 'application/json' },
});
```

### send-push hardened version (full replacement)

```typescript
// Source: direct code inspection + CONTEXT.md decision on error standards
Deno.serve(async (req) => {
  try {
    const body = await req.json();
    const { messages } = body;

    if (!messages || !Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: 'messages array required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const payload = messages.map((m: any) => ({
      to: m.token,
      title: m.title,
      body: m.body,
      data: m.data ?? {},
      sound: 'default',
    }));

    const res = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error('send-push: Expo API error:', res.status, err);
      return new Response(JSON.stringify({ error: 'Push notification service error' }), {
        status: 502,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const result = await res.json();
    return new Response(JSON.stringify(result), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('send-push error:', err);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
```

### Soft-delete fix for auto-confirm-payments

```typescript
// After fetching confirmed payments, filter out archived tenants before building push messages
const activePayments = (data ?? []).filter((p: any) => !p.tenants?.is_archived);
// Use activePayments instead of data for owner_id extraction
```

---

## State of the Art

| Old Approach | Current Approach | Status |
|--------------|------------------|--------|
| `serve()` from deno std | `Deno.serve()` native | Both work; existing functions use a mix — no need to normalize |
| Hardcoded store URLs in source | Env vars with fallback | Phase 3 change for EDGE-05 |
| Claude response used without validation | Validate required fields before DB action | Phase 3 addition for EDGE-03 |

---

## Cron Schedule Reference

| Function | Intended Schedule | Verified via Code | pg_cron Verification |
|----------|-------------------|-------------------|---------------------|
| `auto-confirm-payments` | Every hour | Logic is time-based (48hr window via `Date.now()`) — correct | Dashboard manual step |
| `mark-overdue` | Daily midnight | Logic uses `now.getDate()` vs `due_day` — correct, runs once daily | Dashboard manual step |
| `send-reminders` | Daily 9 AM | Logic uses `todayDay` vs `due_day` — correct, runs once daily | Dashboard manual step |

**Important:** The cron schedule expressions (`0 * * * *`, `0 0 * * *`, `0 9 * * *`) are configured in the **Supabase dashboard**, not in the Edge Function code. The planner should document that schedule verification is a manual step the implementer takes in the dashboard, not a code change.

---

## Bot Flow Trace (EDGE-03)

Complete path for a Telegram message:

```
1. Telegram server → POST /functions/v1/telegram-webhook
   - Header: X-Telegram-Bot-Api-Secret-Token: {secret}
   - Body: { message: { chat: { id: 123 }, text: "log rent for Raj" } }

2. telegram-webhook/index.ts
   - Validates secret header → 401 if invalid
   - Extracts chatId and text
   - Looks up users table by telegram_chat_id → returns linkedUser.id
   - If not found: sends "link your account" reply, returns 200

3. telegram-webhook → POST /functions/v1/process-bot-message
   - Header: Authorization: Bearer {SERVICE_ROLE_KEY}
   - Body: { user_id, message, source: 'telegram', telegram_chat_id }

4. process-bot-message/index.ts
   - Validates user_id and message present → 400 if missing
   - buildContext(): queries properties + tenants (is_archived=false) + payments
   - getHistory(): last 10 bot_conversations rows
   - callClaude(): POST to api.anthropic.com/v1/messages
     - System prompt includes context and available actions
     - Returns JSON: { intent, entities, action_description, needs_confirmation, reply }
     [GAP: no shape validation here — Phase 3 adds isValidClaudeIntent() guard]
   - If intent in ACTION_HANDLERS: executes handler(supabase, userId, entities)
     - log_payment: finds tenant, upserts payment row, sets status paid/partial
     - confirm_payment: verifies payment.status === 'paid', sets confirmed
     - add_property: inserts into properties table
     - add_tenant: inserts into tenants table with invite token
     - send_reminder: inserts notification row for tenant
   - saveMessages(): inserts user + assistant messages into bot_conversations
   - Returns { reply, intent, action_taken }

5. telegram-webhook receives { reply }
   - Calls sendTelegram(chatId, reply)
   - Returns 200 OK to Telegram
```

All 5 action handlers verified via code inspection. Each handler:
- Verifies ownership via `verifyOwnership()` before mutating data
- Returns human-readable string (success or failure message)
- Uses `.eq('is_archived', false)` on tenant/property queries

---

## Validation Architecture

> `nyquist_validation` is `true` in `.planning/config.json` — section included.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | None detected — no test files or test framework config in project |
| Config file | None — Wave 0 gap |
| Quick run command | N/A until framework installed |
| Full suite command | N/A until framework installed |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Notes |
|--------|----------|-----------|-------|
| EDGE-01 | All functions return correct HTTP codes | code-review only | No test framework; status codes verified by reading code. Integration tests would require live Supabase env. |
| EDGE-02 | Cron functions filter archived data | code-review only | Soft-delete filter presence verified by reading code |
| EDGE-03 | Bot flow completes end-to-end | code-review + manual | Full chain requires live Telegram bot + Claude API key; code path review is the automated portion |
| EDGE-05 | Store URLs in env vars | code-review only | Verified by checking `Deno.env.get()` call presence |

### Sampling Rate

- Per task commit: code-review verification (read modified function, confirm changes match intent)
- Per wave merge: `npx tsc --noEmit` on the main app (Edge Functions are Deno/TypeScript but not compiled by the app's tsconfig — verify separately if needed)
- Phase gate: All 12 functions reviewed and changes confirmed before `/gsd:verify-work`

### Wave 0 Gaps

- No test framework exists in this project (QUAL-01 is a v2 post-launch requirement)
- Edge Function tests would require Deno test runner + Supabase local dev setup — out of scope for this phase
- Verification for this phase is code-review based, not automated test based

*(Testing infrastructure for Edge Functions is deferred to post-launch per REQUIREMENTS.md QUAL-01)*

---

## Open Questions

1. **Are the App Store ID (6760478576) and Play Store package (com.dwella.app) real or placeholders?**
   - What we know: These values are in the code and were noted as "unknown if real or placeholder" in CONTEXT.md
   - What's unclear: Only the app owner can verify against App Store Connect / Google Play Console
   - Recommendation: Flag as a pre-launch manual verification step in the plan. The Phase 3 code change (move to env var) is independent of whether the current values are correct.

2. **Does the `expenses` table exist in the current schema?**
   - What we know: `ai-insights` queries `supabase.from('expenses')` — but only migrations 001-015+ are confirmed. The migration list in INTEGRATIONS.md mentions the table but it was not in the migration files reviewed.
   - What's unclear: If table doesn't exist, ai-insights silently returns `totalExpenses = 0` — functional but misleading
   - Recommendation: During implementation, check migration files for `expenses` table definition. If absent, the function works but the expenses metric is always 0.

3. **WhatsApp webhook HMAC validation — confirmed from code**
   - What we know: STATE.md noted "WhatsApp webhook HMAC validation pattern not confirmed from research — needs direct code inspection during Phase 3." Code inspection COMPLETE. The implementation in `whatsapp-webhook/index.ts` is correct: reads raw body via `req.text()`, computes HMAC-SHA256 using `crypto.subtle`, compares to `X-Hub-Signature-256` header in constant-time hex comparison.
   - Status: RESOLVED — no gap, implementation is correct per Meta's documented spec.

---

## Sources

### Primary (HIGH confidence)
- Direct code inspection of all 12 Edge Functions — complete reading, line by line
- `.planning/phases/03-edge-functions-backend/03-CONTEXT.md` — locked decisions
- `.planning/REQUIREMENTS.md` — EDGE-01 through EDGE-05 acceptance criteria
- `.planning/codebase/CONCERNS.md` — #12 (generic 500s) and #18 (placeholder URLs)
- `.planning/codebase/INTEGRATIONS.md` — bot flow diagram, cron schedule documentation

### Secondary (MEDIUM confidence)
- Supabase Edge Functions Deno runtime behavior — consistent with project's existing patterns
- Expo Push API format (`https://exp.host/--/api/v2/push/send`) — matches existing `send-push` implementation

---

## Metadata

**Confidence breakdown:**
- Per-function gap findings: HIGH — based on direct code inspection
- Fix patterns: HIGH — based on existing correct patterns in the same codebase
- Cron schedule correctness: HIGH — code logic verified, pg_cron expression verification is a dashboard step
- `expenses` table existence: LOW — not confirmed in migration review

**Research date:** 2026-03-18
**Valid until:** 2026-04-17 (30 days — stable Deno/Supabase patterns)
