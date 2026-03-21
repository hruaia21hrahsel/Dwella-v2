# Phase 14: Intents & Outbound Notifications - Research

**Researched:** 2026-03-21
**Domain:** Supabase Edge Functions, Postgres triggers with pg_net, WhatsApp template messaging, Telegram bot API, Claude intent routing
**Confidence:** HIGH

## Summary

Phase 14 has two parallel tracks: (1) making three bot sub-menu buttons execute real database queries instead of instructional text, and (2) wiring proactive outbound WhatsApp and Telegram notifications for reminders, payment confirmations, and maintenance status changes.

The codebase already has every building block in place. The `whatsapp-send` Edge Function supports `type: 'template'` with component arrays. The `ACTION_HANDLERS` dispatch table in `process-bot-message` accepts new intents by adding entries to the `Record<string, ActionHandler>` map. The `pg_net` extension is already enabled (migration 018) and used by pg_cron — the same pattern applies to an AFTER UPDATE trigger. The Telegram webhook already has `sendTelegram()`, `sendBotResponse()`, and `sendTelegramDocument()` helpers.

The only net-new artifact is the `notify-whatsapp` Edge Function (invoked by the DB trigger) and migration `026_maintenance_notify_trigger.sql`. Everything else is additive changes to files that already exist.

**Primary recommendation:** Build in two waves — Wave 1: intent handlers + sub-menu rewiring in `process-bot-message`; Wave 2: outbound notifications across `send-reminders`, `auto-confirm-payments`, and the new `notify-whatsapp` + trigger.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Intent response formatting**
- D-01: Query responses use structured text with emoji markers AND follow-up action buttons. E.g. maintenance status shows status + history with an "Update Request" button; upcoming payments shows amounts + dates with "Log Payment" / "Send Reminder" buttons.
- D-02: All intent query responses re-show the main menu after the answer (consistent with Phase 13 behavior where menu appends to every response via additional_messages).
- D-03: Property summary intent shows occupancy + collection only: occupied/total units, this month's collection rate (collected vs expected), overdue count. One message, easy to scan.
- D-04: New intents are wired into existing Phase 13 sub-menu buttons — `sub_maint_status`, `sub_payments_upcoming`, and `sub_properties_summary` buttons execute actual queries instead of returning instructional text. Dual access: both button tap and freeform text trigger the same handler.

**Notification trigger mechanism**
- D-05: Maintenance status change notifications use a Postgres AFTER UPDATE trigger on `maintenance_requests` that calls `pg_net.http_post` to invoke a `notify-whatsapp` Edge Function. Fully automatic — any status change from any source fires the notification.
- D-06: Both tenant AND landlord receive maintenance status change notifications. Same template, same content.
- D-07: Payment confirmation receipts (OUT-02) are sent inside the existing `auto-confirm-payments` Edge Function, right after the status update. WhatsApp template call added to the existing hourly cron. Manual confirms from the app do NOT trigger WhatsApp (only auto-confirms).

**Template fallback behavior**
- D-08: If WhatsApp template send fails (not approved, user not linked, API error), fall back to push notification via `send-push` Edge Function. Log the WhatsApp failure for debugging. The notification DB row is always created regardless of delivery channel.
- D-09: Telegram users also receive outbound notifications (reminders, confirmations, maintenance updates). Telegram doesn't need templates — just plain text via `sendTelegram`. Full parity with WhatsApp.
- D-10: send-reminders template switch is minimal: replace the free-form `sendWhatsApp` call with a `dwella_rent_reminder` template call. Keep existing 3-day-before / on-day / 3-day-after timing unchanged. Telegram reminders are a separate addition in the same function.

### Claude's Discretion
- Exact emoji choice for structured responses
- How to handle edge cases (no maintenance requests found, no upcoming payments)
- buildContext() query structure for maintenance data
- Error message wording for failed queries
- Notification deduplication (if user has both WhatsApp + Telegram, send to both or pick one)

### Deferred Ideas (OUT OF SCOPE)
- Manual payment confirmation triggering WhatsApp receipt (only auto-confirm sends notification in this phase)
- Notification preferences (user opts out of WhatsApp/Telegram/push per category)
- Rate limiting on outbound messages
- Notification deduplication across channels (currently sends to all linked channels)
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| INTENT-01 | User can ask bot about maintenance request status and history | New `query_maintenance_status` ACTION_HANDLER reads `maintenance_requests` + `maintenance_status_logs` for the user's tenants/properties; also rewires `sub_maint_status` button |
| INTENT-02 | User can ask bot about upcoming payments (what's due, when, how much) | New `query_upcoming_payments` ACTION_HANDLER queries `payments` with pending/partial/overdue status; rewires `sub_payments_upcoming` button |
| INTENT-03 | User can ask bot for property summary (occupancy, vacancy, rent collection status) | New `query_property_summary` ACTION_HANDLER aggregates tenants/payments; rewires `sub_properties_summary` button |
| OUT-01 | Tenant receives rent reminder via WhatsApp (3 days before, on due date, 3 days after) | Replace free-form text in `send-reminders` with `dwella_rent_reminder` template; add Telegram parallel send |
| OUT-02 | Tenant receives payment confirmation receipt via WhatsApp when payment is confirmed | Add WhatsApp template + Telegram send inside `auto-confirm-payments` after status update |
| OUT-03 | Tenant and landlord receive maintenance status change notifications via WhatsApp | New `notify-whatsapp` Edge Function + Postgres AFTER UPDATE trigger via pg_net |
</phase_requirements>

## Standard Stack

### Core
| Library / API | Version | Purpose | Why Standard |
|---------------|---------|---------|--------------|
| Supabase Edge Functions (Deno) | Runtime: Deno 1.x | All server-side logic | Already the project's only Edge Function runtime |
| `@supabase/supabase-js` | `2` (via esm.sh) | DB queries from Edge Functions | Project standard, all functions use it |
| `pg_net` extension | Built into Supabase | HTTP calls from Postgres triggers | Already enabled in migration 018; used by pg_cron cron jobs |
| WhatsApp Cloud API (Meta) | v21.0 | Outbound notifications via templates | Project standard; `whatsapp-send` wraps this |
| Telegram Bot API | Current | Telegram outbound notifications | Project standard; `sendTelegram()` already implemented |
| Claude API (`claude-sonnet-4-20250514`) | Current | Intent parsing for freeform queries | Already wired in `process-bot-message` |

### Supporting
| Component | Purpose | When to Use |
|-----------|---------|-------------|
| `whatsapp-send` Edge Function | Centralised WhatsApp sender — supports `text`, `template`, `interactive`, `document` | Every outbound WhatsApp message in this phase goes through it |
| `send-push` Edge Function | Expo push notification delivery | Fallback when WhatsApp fails (D-08) |
| `bot_conversations` table | AI history + metadata for context window | Already used by `buildContext()` and `callClaude()` |
| `maintenance_status_logs` table | Full status history per request | Intent-01 response includes transition history |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| pg_net DB trigger for maintenance notifications | Polling from cron job | Trigger is instant and fires from any client (app, bot, future admin). Cron adds minutes of lag. D-05 locks trigger approach. |
| Separate Edge Function for intent queries | Inline Claude entities | ACTION_HANDLERS already pattern-match; inline queries in `process-bot-message` keep codebase consistent |
| WhatsApp free-form text for reminders | WhatsApp template | Free-form violates Meta 24-hour session window — blocked outside active sessions. Templates are mandatory for scheduled outbound. |

## Architecture Patterns

### Recommended Project Structure (Phase 14 additions)
```
supabase/
├── functions/
│   ├── process-bot-message/index.ts    # Add 3 ACTION_HANDLERS + rewire 3 sub-menu buttons
│   ├── send-reminders/index.ts         # Replace free-form WA with template; add Telegram
│   ├── auto-confirm-payments/index.ts  # Add WA template + Telegram after confirm
│   └── notify-whatsapp/index.ts        # NEW — invoked by DB trigger for maintenance updates
└── migrations/
    └── 026_maintenance_notify_trigger.sql  # NEW — AFTER UPDATE trigger + pg_net call
```

### Pattern 1: Adding ACTION_HANDLERS for Query Intents

The existing `ACTION_HANDLERS` map at line 618 of `process-bot-message/index.ts` uses the type alias:

```typescript
type ActionHandler = (
  supabase: ReturnType<typeof createClient>,
  userId: string,
  entities: Record<string, unknown>,
) => Promise<string>;

const ACTION_HANDLERS: Record<string, ActionHandler> = {
  log_payment: handleLogPayment,
  // ... existing handlers
};
```

New query intents return a formatted string — same return type. No change to dispatch infrastructure.

**What:** Add three new handlers: `handleQueryMaintenanceStatus`, `handleQueryUpcomingPayments`, `handleQueryPropertySummary`. Register them in `ACTION_HANDLERS` under `query_maintenance_status`, `query_upcoming_payments`, `query_property_summary`.

**When to use:** These handlers are called both from Claude freeform dispatch AND from button dispatch (D-04).

**Example structure:**
```typescript
const handleQueryMaintenanceStatus: ActionHandler = async (supabase, userId, _entities) => {
  // Fetch requests where user is landlord OR tenant
  // Return formatted string with emoji markers
  // Edge case: no requests found → return friendly "no requests" message
};
```

### Pattern 2: Sub-Menu Button Rewiring (D-04)

Currently `handleSubAction()` returns instructional text for `sub_maint_status`, `sub_payments_upcoming`, and `sub_properties_summary`. Phase 14 replaces these three cases to call the same handler logic that Claude dispatches.

The `handleButtonPress()` function is `async` (already made async in Phase 13 for PDF generation). The three sub-menu rewires follow the same pattern:

```typescript
// In handleButtonPress():
if (buttonId === 'sub_maint_status') {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  const result = await handleQueryMaintenanceStatus(supabase, userId!, {});
  return [{ reply: result, buttons: [[{ id: 'back_main', title: 'Main Menu' }]] }];
}
```

`handleButtonPress` already receives `userId` as the second argument (line 307). The supabase client must be created inline (same pattern as Phase 12 media handling — Deno Edge Functions have no shared import).

### Pattern 3: pg_net AFTER UPDATE Trigger

`pg_net` is already enabled in migration 018. The cron jobs use `net.http_post()` — the trigger uses the same function.

**Migration 026 pattern:**
```sql
CREATE OR REPLACE FUNCTION public.notify_maintenance_status_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    PERFORM net.http_post(
      url := current_setting('app.settings.supabase_url') || '/functions/v1/notify-whatsapp',
      headers := jsonb_build_object(
        'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key'),
        'Content-Type', 'application/json'
      ),
      body := jsonb_build_object(
        'request_id', NEW.id,
        'tenant_id', NEW.tenant_id,
        'property_id', NEW.property_id,
        'old_status', OLD.status,
        'new_status', NEW.status,
        'title', NEW.title
      )
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER notify_maintenance_status_change
  AFTER UPDATE ON public.maintenance_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_maintenance_status_change();
```

**Critical:** `net.http_post()` is non-blocking — the trigger returns immediately and the HTTP call happens asynchronously. This is correct behavior for notifications.

**Critical:** `SECURITY DEFINER` is required so the trigger function can read `app.settings.*` without being scoped to the row's user context.

### Pattern 4: notify-whatsapp Edge Function Structure

Follows the same structure as all existing Edge Functions: `serve()`, CORS headers, service key auth.

```typescript
// notify-whatsapp/index.ts
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const WHATSAPP_SEND_URL = `${SUPABASE_URL}/functions/v1/whatsapp-send`;

serve(async (req) => {
  const { request_id, tenant_id, property_id, new_status, title } = await req.json();

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  // Look up tenant.user_id → whatsapp_phone
  // Look up property.owner_id → whatsapp_phone
  // For each found phone: call whatsapp-send with dwella_maintenance_update template
  // On failure: fall back to send-push; always create notifications row
});
```

### Pattern 5: WhatsApp Template Call Format

From `whatsapp-send/index.ts` — the template format is already implemented:

```typescript
// Calling whatsapp-send with a template
await fetch(WHATSAPP_SEND_URL, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
  },
  body: JSON.stringify({
    to: phoneNumber,           // E.164 format, e.g. "919876543210"
    type: 'template',
    template: {
      name: 'dwella_rent_reminder',
      language: 'en',
      components: [{
        type: 'body',
        parameters: [
          { type: 'text', text: tenantName },    // {{name}}
          { type: 'text', text: String(amount) }, // {{amount}}
          { type: 'text', text: dueDateStr },     // {{due_date}}
        ],
      }],
    },
  }),
});
```

**Template variables (from Phase 11 D-11):**
- `dwella_rent_reminder`: `{{name}}`, `{{amount}}`, `{{due_date}}`
- `dwella_payment_confirmed`: `{{name}}`, `{{amount}}`, `{{month}}`
- `dwella_maintenance_update`: `{{name}}`, `{{description}}`, `{{status}}`

### Pattern 6: Telegram Outbound (D-09)

Telegram does not require templates. The `sendTelegram()` function in `telegram-webhook/index.ts` sends to a `chat_id`. For scheduled functions (`send-reminders`, `auto-confirm-payments`), the pattern is:

1. Look up `users.telegram_chat_id` for the target user (column exists — migration 003)
2. Call the Telegram Bot API `sendMessage` endpoint directly (no `telegram-webhook` needed — that file is for inbound only)

For `notify-whatsapp`, the function must also look up `telegram_chat_id` and send to both channels.

The Telegram API call from non-webhook functions:
```typescript
const TELEGRAM_BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN')!;

async function sendTelegramDirect(chatId: number, text: string) {
  await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text }),
  });
}
```

### Anti-Patterns to Avoid

- **Building a new sender for WhatsApp:** Always route through `whatsapp-send`. The `send-reminders` function currently calls the Meta API directly (lines 136-151) — this is the old pattern to replace with a `whatsapp-send` call.
- **BEFORE UPDATE trigger for notifications:** Maintenance already has a BEFORE UPDATE trigger for state-machine validation. The notification trigger must be AFTER UPDATE to fire only on successful transitions.
- **Creating `notify-whatsapp` as a cron job:** It must be a request/response Edge Function invoked by the DB trigger via pg_net, not scheduled.
- **Using `supabase.functions.invoke()` from a trigger:** pg_net uses raw HTTP — `net.http_post()` with explicit auth headers. `supabase.functions.invoke()` is only available in JS/TS clients.
- **Omitting `userId` check in sub-menu button handler:** `handleButtonPress` receives `userId?: string`. For the three new query buttons, `userId` is required — guard against `undefined`.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| WhatsApp outbound | Direct fetch to Meta API | `whatsapp-send` Edge Function | Retry logic, logging, consistent payload building already there |
| Push fallback | Custom Expo push caller | `send-push` Edge Function | Already handles error cases and Expo API format |
| Maintenance data fetching | New DB client setup | Reuse `createClient()` pattern from existing handlers | Same auth and RLS already used throughout |
| Intent-to-button sync | Two separate code paths | Extract handler function, call from both Claude dispatch AND button handler | D-04 requires dual access; single function prevents drift |

**Key insight:** Every external API call in this project goes through a dedicated Edge Function wrapper. Don't break this pattern for notifications — it preserves the single deploy point and retry logic.

## Common Pitfalls

### Pitfall 1: pg_net requires `app.settings.*` to be set

**What goes wrong:** The DB trigger calls `current_setting('app.settings.supabase_url')`. If this is not configured in your Supabase project settings, the trigger silently fails with a "parameter not found" error.

**Why it happens:** Unlike edge functions where env vars are explicit, pg_net triggers rely on Postgres `app.settings` configuration set via the Supabase dashboard or SQL (`ALTER DATABASE postgres SET app.settings.supabase_url = '...'`).

**How to avoid:** Migration 018 already uses this pattern for cron jobs — verify both `app.settings.supabase_url` and `app.settings.service_role_key` are set in the Supabase SQL editor before applying migration 026. The cron jobs would be broken already if they weren't set, so this is likely already configured.

**Warning signs:** Maintenance status changes in the app produce no notifications; check pg_net queue in `net._http_response` for errors.

### Pitfall 2: AFTER UPDATE trigger fires on every column update, not just status

**What goes wrong:** The trigger fires when ANY column on `maintenance_requests` is updated. Without an explicit status-change guard, notifications fire on title edits, archive operations, etc.

**Why it happens:** Postgres `AFTER UPDATE` with `FOR EACH ROW` fires on all updates.

**How to avoid:** Guard with `IF OLD.status IS DISTINCT FROM NEW.status THEN` inside the trigger function body (shown in Pattern 3). Alternatively use `WHEN (OLD.status IS DISTINCT FROM NEW.status)` on the trigger definition itself — same as the existing `validate_maintenance_transition` trigger.

### Pitfall 3: WhatsApp template not yet approved

**What goes wrong:** Template call returns a 400 with `template_not_found` or approval-pending error. The function logs this and falls back to push — but the fallback must be implemented or notifications silently drop.

**Why it happens:** Meta template approval takes 2-7 days (noted as a blocker in STATE.md). Templates were submitted in Phase 11 but may not be approved by the time Phase 14 runs.

**How to avoid:** Always implement the push fallback (D-08) before relying on templates. Test with a known-approved template first (`dwella_verification` exists and is approved). Log the specific error body from `whatsapp-send` responses.

### Pitfall 4: `handleButtonPress` called without `userId` for new query buttons

**What goes wrong:** `handleButtonPress(buttonId, userId?)` — `userId` is optional. The three new query buttons need it for DB lookups. If the caller doesn't pass it, the query returns empty results or throws.

**Why it happens:** The existing `handleButtonPress` calls from `whatsapp-webhook` and `telegram-webhook` pass `userId` correctly. The issue only arises if the sub-menu handler forgets to guard: `if (!userId) return [{ reply: 'Could not identify your account.' }]`.

**How to avoid:** Add a `userId` guard at the top of each new query branch in `handleButtonPress`.

### Pitfall 5: Telegram users looking up chat_id in wrong column

**What goes wrong:** `users.telegram_chat_id` is `BIGINT` (migration 003). If you query with a string comparison or miss the column, the lookup fails silently.

**Why it happens:** `telegram_chat_id` is stored as a number — all Telegram chat IDs are integers. Verify the select query uses the correct column name and type.

**How to avoid:** `SELECT id, telegram_chat_id FROM users WHERE id = $user_id` — cast to `number` before calling `sendMessage`.

### Pitfall 6: send-reminders still sends amount/due_date but lacks the data

**What goes wrong:** The `dwella_rent_reminder` template requires `{{name}}`, `{{amount}}`, `{{due_date}}`. The current `send-reminders` query fetches `due_day` (the day of month integer) but not `monthly_rent` or a formatted date string.

**Why it happens:** The old free-form code only used the notification body string. The template needs exact parameter values.

**How to avoid:** Extend the `send-reminders` Supabase query to also select `monthly_rent` from tenants. Construct `due_date` string from `due_day` + current month/year.

## Code Examples

### Verified: Maintenance status query with join

The `maintenance_requests` table has `tenant_id` and `property_id`. To fetch requests for a landlord:

```typescript
// Landlord: requests across all owned properties
const { data: requests } = await supabase
  .from('maintenance_requests')
  .select(`
    id, title, description, status, priority, created_at, updated_at,
    maintenance_status_logs(from_status, to_status, note, created_at)
  `)
  .in('property_id', propertyIds)
  .eq('is_archived', false)
  .order('updated_at', { ascending: false })
  .limit(10);

// Tenant: their own requests
const { data: requests } = await supabase
  .from('maintenance_requests')
  .select(`
    id, title, description, status, priority, created_at, updated_at,
    maintenance_status_logs(from_status, to_status, note, created_at)
  `)
  .eq('tenant_id', tenantId)
  .eq('is_archived', false)
  .order('updated_at', { ascending: false });
```

### Verified: Upcoming payments query

```typescript
// Payments that are pending, partial, or overdue for current/future months
const { data: payments } = await supabase
  .from('payments')
  .select('id, month, year, amount_due, amount_paid, status, due_date, tenants(tenant_name, flat_no)')
  .in('tenant_id', tenantIds)
  .in('status', ['pending', 'partial', 'overdue'])
  .gte('year', currentYear)
  .order('year', { ascending: true })
  .order('month', { ascending: true });
```

### Verified: Property summary aggregate

```typescript
// Aggregate occupancy and payment collection for current month
const { data: properties } = await supabase
  .from('properties')
  .select(`
    id, name, total_units,
    tenants!inner(
      id, monthly_rent, is_archived,
      payments(status, amount_due, amount_paid, month, year)
    )
  `)
  .eq('owner_id', userId)
  .eq('is_archived', false);

// Then compute: occupied = tenants with user_id linked, collection = paid/confirmed count vs total
```

### Verified: Template send via whatsapp-send (from existing pattern in whatsapp-webhook)

```typescript
const WHATSAPP_SEND_URL = `${SUPABASE_URL}/functions/v1/whatsapp-send`;

await fetch(WHATSAPP_SEND_URL, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
  },
  body: JSON.stringify({
    to: waPhone,
    type: 'template',
    template: {
      name: 'dwella_payment_confirmed',
      language: 'en',
      components: [{
        type: 'body',
        parameters: [
          { type: 'text', text: tenantName },
          { type: 'text', text: String(amountPaid) },
          { type: 'text', text: monthLabel },   // e.g. "March 2026"
        ],
      }],
    },
  }),
});
```

### Verified: Telegram direct send from a non-webhook Edge Function

```typescript
const TELEGRAM_BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN')!;

async function sendTelegramDirect(chatId: number, text: string): Promise<void> {
  try {
    await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text }),
    });
  } catch (err) {
    console.error(`Telegram send failed for chat ${chatId}:`, err);
  }
}
```

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|------------------|--------|
| Free-form WhatsApp text in send-reminders (lines 136-151) | WhatsApp template via whatsapp-send | Required for Meta compliance outside 24-hour session window |
| Sub-menu buttons return instructional text | Sub-menu buttons execute real DB queries | D-04: dual access pattern; buttons become functional |
| Push-only for auto-confirm | WhatsApp template + Telegram + push | Full multi-channel notification parity |

**Deprecated in this phase:**
- Direct Meta API calls in `send-reminders` (inline fetch to graph.facebook.com): replaced by `whatsapp-send` call to maintain single source of truth.

## Open Questions

1. **notify-whatsapp invocation auth**
   - What we know: The trigger uses service role key from `app.settings.service_role_key` — same as cron jobs in migration 018.
   - What's unclear: Whether `notify-whatsapp` validates the Authorization header (the incoming request is from Postgres, not a user). Existing Edge Functions validate the service key via Supabase's built-in JWT verification. pg_net sends the raw bearer token which Supabase will validate as a service-role JWT.
   - Recommendation: Use standard Supabase Edge Function auth — the `SUPABASE_SERVICE_ROLE_KEY` passed as `Authorization: Bearer ...` will be accepted by the Supabase edge runtime without additional custom validation.

2. **Meta template approval status**
   - What we know: Templates were submitted in Phase 11. Approval takes 2-7 days (STATE.md blocker note).
   - What's unclear: Whether all three notification templates (`dwella_rent_reminder`, `dwella_payment_confirmed`, `dwella_maintenance_update`) are approved by now.
   - Recommendation: Implement the fallback (D-08) first. Test each template by calling `whatsapp-send` manually before wiring into cron/trigger. Log the error body from failed template sends to distinguish "not approved" from "wrong parameters".

3. **Property summary intent — tenant vs landlord context**
   - What we know: `buildContext()` already distinguishes landlord and tenant rows. D-03 says summary shows occupancy + collection only.
   - What's unclear: What a tenant sees when they request "property summary" — they don't own properties. The landlord summary is straightforward.
   - Recommendation: If user is landlord, show property-level summary (D-03 spec). If user is only a tenant with no owned properties, return a tenant-focused view: their own payment status for this month, their lease details. Claude's Discretion covers this edge case.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | None detected — no jest.config, no vitest.config, no pytest.ini, no tests/ directory |
| Config file | None — see Wave 0 |
| Quick run command | Manual: deploy functions and trigger via curl |
| Full suite command | Manual end-to-end: message bot via WhatsApp/Telegram, verify DB state + notification rows |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| INTENT-01 | Maintenance status query returns structured response | manual-smoke | Deploy process-bot-message, send "check maintenance status" via WhatsApp/Telegram | N/A |
| INTENT-02 | Upcoming payments query returns amounts and dates | manual-smoke | Send "upcoming payments" freeform text | N/A |
| INTENT-03 | Property summary returns occupancy + collection rate | manual-smoke | Send "property summary" freeform text | N/A |
| INTENT-01/02/03 | Sub-menu buttons execute queries (not instructional text) | manual-smoke | Tap sub_maint_status / sub_payments_upcoming / sub_properties_summary buttons | N/A |
| OUT-01 | Tenant receives WhatsApp reminder at correct timing | manual-smoke | Temporarily set due_day to today+3 / today / today-3, trigger send-reminders via curl | N/A |
| OUT-02 | Tenant receives WhatsApp confirmation when payment auto-confirms | manual-smoke | Set payment to 'paid' with paid_at 49h ago, trigger auto-confirm-payments | N/A |
| OUT-03 | Maintenance status change triggers WhatsApp to both parties | manual-smoke | Update a maintenance_requests.status via app, check notifications table + WA delivery | N/A |

**Note:** This codebase has no automated test infrastructure. All validation is manual smoke testing against a deployed Supabase environment.

### Sampling Rate
- **Per task commit:** Deploy modified function, send one test message, verify response
- **Per wave merge:** Full flow test across both WhatsApp and Telegram channels
- **Phase gate:** All 6 requirements manually verified with real notifications delivered before `/gsd:verify-work`

### Wave 0 Gaps
- No test infrastructure exists in this repo — Wave 0 for Phase 14 has no setup tasks required, since validation is manual.
- Ensure `TELEGRAM_BOT_TOKEN` env var is set in `notify-whatsapp` deploy (new function needs it for Telegram sends).

## Sources

### Primary (HIGH confidence)
- Direct code inspection: `supabase/functions/process-bot-message/index.ts` — ACTION_HANDLERS pattern, buildContext(), handleButtonPress(), handleSubAction()
- Direct code inspection: `supabase/functions/whatsapp-send/index.ts` — template format, payload structure, retry behavior
- Direct code inspection: `supabase/functions/send-reminders/index.ts` — current reminder logic lines 114-157
- Direct code inspection: `supabase/functions/auto-confirm-payments/index.ts` — current push-only notification pattern
- Direct code inspection: `supabase/migrations/022_maintenance_requests.sql` — table schema, status enum, BEFORE UPDATE trigger pattern
- Direct code inspection: `supabase/migrations/018_cron_schedules.sql` — pg_net usage pattern, `net.http_post()` call shape, `app.settings.*` variables
- Direct code inspection: `supabase/functions/telegram-webhook/index.ts` — sendTelegram(), sendBotResponse(), toTelegramKeyboard()
- `.planning/phases/14-intents-outbound-notifications/14-CONTEXT.md` — all locked decisions D-01 through D-10

### Secondary (MEDIUM confidence)
- `.planning/phases/11-setup-infrastructure/11-CONTEXT.md` — template names and variables (D-11), template tone (D-12/D-14)
- `.planning/STATE.md` — prior decisions on two code paths (template vs interactive), Meta template approval blocker

### Tertiary (LOW confidence)
- None — all findings verified against project source files.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — every component already exists in the codebase
- Architecture: HIGH — patterns directly observed in working code; pg_net trigger follows exact cron job pattern from migration 018
- Pitfalls: HIGH — derived from direct code inspection of existing patterns and known project constraints (Meta 24-hour window policy documented in CONTEXT.md specifics)

**Research date:** 2026-03-21
**Valid until:** 2026-04-21 (stable domain — no fast-moving dependencies)
