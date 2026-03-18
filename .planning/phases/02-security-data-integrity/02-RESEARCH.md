# Phase 2: Security & Data Integrity - Research

**Researched:** 2026-03-18
**Domain:** Supabase RLS, PostgreSQL triggers, Deno Edge Functions, expo-crypto, Telegram/Meta webhook auth, prompt injection
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Payment state machine transitions**
- Valid transitions enforced via `BEFORE UPDATE` trigger on `payments` table:
  - `pending` → `partial`, `paid`, `overdue`
  - `partial` → `paid`, `overdue`
  - `overdue` → `partial`, `paid`
  - `paid` → `confirmed`
  - `confirmed` → `paid` (reversal — landlord correction)
- Invalid transitions raise: `RAISE EXCEPTION 'Invalid payment transition: % → %', OLD.status, NEW.status`
- Client receives a Postgres error on invalid transitions — handle gracefully in hooks
- Overdue can receive both partial and full late payments (not terminal)
- Confirmed → paid reversal allowed for landlord corrections only

**Webhook validation**
- Both Telegram and WhatsApp webhooks validate authentication before any processing
- Failed validation returns `401 Unauthorized`
- Failed auth attempts logged to Sentry as warnings
- Telegram: validate bot secret/token from request
- WhatsApp: validate HMAC signature from Meta

**Prompt injection mitigation**
- User-controlled strings XML-escaped in Claude bot context
- Wrap user data in clearly-marked XML tags
- Names with apostrophes, #, accented chars are preserved (no aggressive stripping)
- 200-character length limit on names in bot context (truncate at Edge Function level)

**Soft-delete enforcement**
- Patch-at-query-level: fix any missing `.eq('is_archived', false)` filters
- No new DB views or abstractions
- Audit scope: ALL hooks + ALL screens + ALL 13 Edge Functions

**Crypto-secure token generation**
- Replace `Math.random()` with `expo-crypto` `randomUUID()` and `getRandomValues()`

**RLS policy audit**
- Audit all 8 tables for correct `USING` + `WITH CHECK` clauses on UPDATE policies

### Claude's Discretion
- Exact RLS policy SQL structure (as long as USING + WITH CHECK are both present)
- Crypto-secure verification code implementation details
- Soft-delete audit order (hooks first vs Edge Functions first)
- Invite flow edge case handling approach (DATA-04)

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| SEC-01 | `Math.random()` UUID generation in `lib/bot.ts` replaced with `expo-crypto` randomUUID() | Already done — `lib/bot.ts` already uses `Crypto.randomUUID()` and `Crypto.getRandomBytes()`. Verify no other Math.random() call paths exist. |
| SEC-02 | `Math.random()` verification code generation replaced with crypto-secure alternative | Already done — `lib/bot.ts` uses `secureRandomDigits()` via `Crypto.getRandomBytes()`. Verify no regression. |
| SEC-03 | RLS policies audited on all tables with correct `USING` + `WITH CHECK` clauses on UPDATE | Current RLS uses `FOR ALL` policies without `WITH CHECK` — needs audit and migration to add split INSERT/UPDATE policies with both clauses. |
| SEC-04 | Telegram webhook validates bot secret/signature before processing | `telegram-webhook/index.ts` has no secret validation — processes all POST requests. Must add `X-Telegram-Bot-Api-Secret-Token` header check. |
| SEC-05 | WhatsApp webhook validates HMAC/shared secret before processing | `whatsapp-webhook/index.ts` has no HMAC validation — processes all POST requests. Must add `X-Hub-Signature-256` HMAC-SHA256 validation. |
| SEC-06 | User-controlled strings sanitized in Claude bot context to prevent prompt injection | `process-bot-message/index.ts` interpolates tenant/property names directly into context string — no escaping. Must add XML-tag wrapping and length truncation. |
| DATA-01 | Soft-delete filtering verified across all hooks, screens, and Edge Functions | Hooks mostly correct; `useDashboard` has a filter gap in recent transactions query; `useExpenses`, `useAllExpenses` don't touch is_archived (N/A); `useNotifications`, `useBotConversations` (N/A). Edge Functions: `send-reminders`, `ai-insights`, `ai-search`, `ai-draft-reminders`, `process-bot-message` all have is_archived filters. `auto-confirm-payments` and `mark-overdue` query payments only (no is_archived field on payments — N/A). Screens: `app/payments/index.tsx`, `app/log-payment.tsx`, `app/(tabs)/properties/index.tsx`, `app/reminders/index.tsx` all filter correctly. Need to verify remaining screens. |
| DATA-02 | Payment state machine transitions audited for correctness | Current app code makes valid transitions. The trigger enforces this at DB level. |
| DATA-03 | Payment state machine enforced at DB level via trigger migration | No trigger exists yet — must write migration 016 with BEFORE UPDATE trigger on payments. |
| DATA-04 | Invite flow verified end-to-end (token generation → deep link → acceptance → edge cases) | `lib/invite.ts` checks invite_status = 'pending' before accepting. Edge case: archived tenant's invite token can still be accepted — needs verification whether this is a real gap. |
</phase_requirements>

---

## Summary

Phase 2 is a pure hardening phase — no new features, only closing security vulnerabilities. Research reveals that two of the ten requirements (SEC-01, SEC-02) are **already complete**: `lib/bot.ts` was updated prior to this research to use `expo-crypto` `randomUUID()` and `getRandomBytes()` instead of `Math.random()`. The planner should treat these as verification-only tasks.

The most complex work items are: the RLS audit and migration (SEC-03), the payment state machine trigger (DATA-03), and the two webhook authentication patches (SEC-04, SEC-05). The Telegram fix is well-documented and straightforward. The WhatsApp HMAC validation follows Meta's documented `X-Hub-Signature-256` pattern. The RLS gap is specific: all current policies use `FOR ALL` with only a `USING` clause — Postgres's `FOR ALL` does apply `USING` to both reads and writes, but Supabase Security Advisor flags this as missing an explicit `WITH CHECK`. The fix is to split `FOR ALL` into separate `FOR SELECT`, `FOR INSERT`, `FOR UPDATE`, `FOR DELETE` policies on the tables where writes occur, with `WITH CHECK` on INSERT/UPDATE.

The soft-delete audit is largely complete in the existing codebase: hooks, Edge Functions, and screens that query properties/tenants already have `.eq('is_archived', false)`. The one verified gap is the recent transactions query in `useDashboard` which queries payments joined to tenants but does not add `.eq('tenants.is_archived', false)` on the payments query (it relies on post-fetch filtering with `ownedPropertyIds` set from the properties query).

**Primary recommendation:** Execute in this order — (1) RLS audit + migration, (2) webhook auth patches, (3) payment state machine trigger migration, (4) prompt injection mitigation, (5) soft-delete audit checklist, (6) crypto verification pass.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `expo-crypto` | bundled with Expo 54 | `randomUUID()`, `getRandomBytes()` | Only crypto-quality PRNG in managed Expo workflow |
| Supabase Postgres | 15+ (managed) | RLS policies, triggers, plpgsql | DB-level enforcement is root-cause fix |
| Deno (Edge Functions) | 1.x (managed) | Webhook auth logic | Already used; `crypto.subtle` built in for HMAC |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@sentry/react-native` | 6.x (already installed) | Log webhook auth failures as warnings | SEC-04, SEC-05 — alert on attack volume spikes |
| Deno built-in `crypto.subtle` | native | HMAC-SHA256 for WhatsApp signature | No npm install needed — Deno standard |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `expo-crypto` | `crypto.getRandomValues()` (Web Crypto) | Works in React Native 0.73+ but expo-crypto is the idiomatic Expo choice and already imported |
| Separate RLS policies per operation | Row-level security function helper | More lines but explicit — Supabase Security Advisor expects explicit WITH CHECK |

**Installation:** No new packages needed for this phase. All tooling is already installed.

---

## Architecture Patterns

### Recommended Migration Structure
```
supabase/migrations/
├── 016_rls_with_check.sql     — Fix RLS policies on all 8 tables
└── 017_payment_trigger.sql    — BEFORE UPDATE trigger for state machine
```

### Pattern 1: Supabase RLS with explicit WITH CHECK

**What:** Split `FOR ALL` policies into per-operation policies so UPDATE policies have both `USING` (which rows can be seen/targeted) and `WITH CHECK` (which values are allowed after the write).

**When to use:** Any table where UPDATE is a meaningful operation (all 8 tables here).

**The gap in current code:** Every policy in `001_initial_schema.sql` and `004_expenses.sql` uses `FOR ALL USING (...)` with no `WITH CHECK`. Supabase Security Advisor flags this. For UPDATE specifically, Postgres applies the `USING` predicate as the row filter but without `WITH CHECK`, no constraint exists on what the row can be updated *to*.

**Example — correct pattern:**
```sql
-- Source: Supabase RLS documentation
-- Split FOR ALL into explicit operations

-- Users table: self-only access
DROP POLICY IF EXISTS "users_self" ON public.users;

CREATE POLICY "users_select" ON public.users
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "users_insert" ON public.users
  FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "users_update" ON public.users
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "users_delete" ON public.users
  FOR DELETE USING (auth.uid() = id);
```

**Key rule for WITH CHECK:** On UPDATE, `USING` filters which rows can be targeted; `WITH CHECK` ensures the post-update row still satisfies the policy. Without `WITH CHECK`, a user could update their own user row to set `id = another_user_id`, bypassing the USING predicate after the fact.

**Tables requiring this treatment (all 8):**
1. `users` — `users_self`
2. `properties` — `properties_owner_all`, `properties_tenant_read` (SELECT only — no UPDATE needed for tenant read)
3. `tenants` — `tenants_owner_all` (currently via `is_property_owner()` helper), `tenants_self_read`
4. `payments` — `payments_owner_all`, `payments_tenant_read`
5. `notifications` — `notifications_self`
6. `bot_conversations` — `bot_conversations_self`
7. `expenses` — `owner_all`
8. Storage policies — already have `WITH CHECK` in most cases (002, 007, 014)

### Pattern 2: PostgreSQL BEFORE UPDATE trigger for state machine

**What:** A PL/pgSQL function that validates the `OLD.status → NEW.status` transition before committing.

**When to use:** Any financial state machine where invalid transitions must be rejected at the DB level regardless of which code path triggers the update.

**Example:**
```sql
-- Source: PostgreSQL trigger documentation
CREATE OR REPLACE FUNCTION public.validate_payment_transition()
RETURNS TRIGGER AS $$
BEGIN
  -- Allow no-op status updates (same status)
  IF OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

  -- Define valid transitions
  IF (OLD.status = 'pending'   AND NEW.status IN ('partial', 'paid', 'overdue')) OR
     (OLD.status = 'partial'   AND NEW.status IN ('paid', 'overdue')) OR
     (OLD.status = 'overdue'   AND NEW.status IN ('partial', 'paid')) OR
     (OLD.status = 'paid'      AND NEW.status = 'confirmed') OR
     (OLD.status = 'confirmed' AND NEW.status = 'paid')
  THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Invalid payment transition: % → %', OLD.status, NEW.status;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER validate_payment_transition
  BEFORE UPDATE ON public.payments
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION public.validate_payment_transition();
```

**Critical note for auto-confirm-payments:** This Edge Function does `pending → confirmed` via a bulk UPDATE. This is an **invalid transition** under the trigger (pending must go through paid first). The current function only updates rows with `status = 'paid'`, so this is fine — but the planner must verify this does not run a bulk update that could hit pending rows. Current code:
```typescript
.eq('status', 'paid')   // Only 'paid' rows — trigger allows paid → confirmed
.is('confirmed_at', null)
.lt('paid_at', ...)
```

**Critical note for mark-overdue:** Updates `status = 'overdue'` where current status is `'pending'`. This is valid (`pending → overdue` is allowed). But the trigger must be written to allow this transition.

### Pattern 3: Telegram Webhook Secret Validation

**What:** Telegram sends an optional `X-Telegram-Bot-Api-Secret-Token` header when you configure a webhook with a secret token. Validate this header before processing.

**How to configure:** When registering the webhook, set `secret_token` parameter:
```
POST https://api.telegram.org/bot{token}/setWebhook
{
  "url": "https://your-edge-function.com/telegram-webhook",
  "secret_token": "your_secret_here"
}
```

**Validation in Deno:**
```typescript
// Source: Telegram Bot API documentation
const TELEGRAM_WEBHOOK_SECRET = Deno.env.get('TELEGRAM_WEBHOOK_SECRET')!;

serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('OK', { status: 200 });
  }

  // Validate secret before reading body
  const secretHeader = req.headers.get('X-Telegram-Bot-Api-Secret-Token');
  if (!secretHeader || secretHeader !== TELEGRAM_WEBHOOK_SECRET) {
    // Log to Sentry before returning
    console.warn('Telegram webhook: invalid secret token');
    return new Response('Unauthorized', { status: 401 });
  }

  // ... rest of handler
});
```

**Environment variable needed:** `TELEGRAM_WEBHOOK_SECRET` — a random string set when calling `setWebhook`. Must be 1-256 chars, only `A-Z`, `a-z`, `0-9`, `_`, `-`.

**Important:** The existing `TELEGRAM_BOT_TOKEN` is for outbound API calls, not for validating inbound webhook requests. Two separate secrets are needed.

### Pattern 4: WhatsApp Webhook HMAC-SHA256 Validation

**What:** Meta sends an `X-Hub-Signature-256` header containing `sha256=<HMAC-SHA256 of the raw body>` using your App Secret as the key.

**Validation in Deno (using built-in crypto.subtle):**
```typescript
// Source: Meta Webhooks documentation
const WHATSAPP_APP_SECRET = Deno.env.get('WHATSAPP_APP_SECRET')!;

async function validateMetaSignature(req: Request, body: string): Promise<boolean> {
  const signature = req.headers.get('X-Hub-Signature-256');
  if (!signature || !signature.startsWith('sha256=')) return false;

  const expectedHex = signature.slice('sha256='.length);

  // Import key for HMAC
  const keyData = new TextEncoder().encode(WHATSAPP_APP_SECRET);
  const key = await crypto.subtle.importKey(
    'raw', keyData, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );

  // Compute HMAC of raw body bytes
  const bodyBytes = new TextEncoder().encode(body);
  const sigBytes = await crypto.subtle.sign('HMAC', key, bodyBytes);
  const computedHex = Array.from(new Uint8Array(sigBytes))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');

  return computedHex === expectedHex;
}

serve(async (req) => {
  if (req.method !== 'POST') { ... }

  // Read body as text FIRST (for HMAC) before parsing as JSON
  const rawBody = await req.text();

  if (!(await validateMetaSignature(req, rawBody))) {
    console.warn('WhatsApp webhook: HMAC validation failed');
    return new Response('Unauthorized', { status: 401 });
  }

  const body = JSON.parse(rawBody);
  // ... rest of handler
});
```

**Critical:** Must read raw body text for HMAC before JSON.parse. `req.json()` consumes the stream — cannot be called first.

**Environment variable needed:** `WHATSAPP_APP_SECRET` — from Meta Developer Portal > App > App Settings > App Secret. This is different from `WHATSAPP_ACCESS_TOKEN` and `WHATSAPP_VERIFY_TOKEN`.

**GET verification challenge:** The existing `hub.verify_token` check for GET requests is NOT the same as HMAC auth. GET is webhook setup verification (one-time). POST HMAC validation is for ongoing message security. Both must be present.

### Pattern 5: Prompt Injection Mitigation via XML Tagging

**What:** Wrap user-controlled values in XML-style delimiter tags so Claude can distinguish data from instructions. Truncate long strings to prevent context stuffing.

**In `process-bot-message/index.ts` `buildContext()` function:**

```typescript
function sanitizeForContext(value: string, maxLength = 200): string {
  // Preserve apostrophes, accents, special chars — only escape XML metacharacters
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .slice(0, maxLength);
}

// Usage in buildContext:
ctx += `\nProperty: <property_name>${sanitizeForContext(p.name)}</property_name> (ID: ${p.id})\n`;
ctx += `  Tenant: <tenant_name>${sanitizeForContext(t['tenant_name'] as string)}</tenant_name>\n`;
```

**Why XML tags help:** Even if a tenant name contains `Ignore previous instructions and`, the surrounding `<tenant_name>` tags signal to Claude that this is a data value, not an instruction. This is standard LLM injection defense.

**What NOT to do:** Do not aggressively strip characters. A tenant named "O'Brien" or "José" must remain readable. Only escape `&`, `<`, `>` which are XML metacharacters.

### Anti-Patterns to Avoid

- **FOR ALL without WITH CHECK:** Postgres applies USING as default WITH CHECK for FOR ALL policies, but Supabase Security Advisor flags this and it leaves ambiguous intent. Always be explicit.
- **Reading req.json() before HMAC check:** Destroys the raw body stream needed for HMAC computation.
- **Timing-attack-vulnerable string comparison:** For HMAC and secret comparisons, use constant-time comparison or hex comparison (hex comparison is safe for HMAC since the attacker controls neither input — the body is already received).
- **Assuming auto-confirm trigger will pass without verification:** The trigger blocks all invalid transitions. The auto-confirm function must be audited to confirm it only touches `paid` rows.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Crypto-secure UUID | `Math.random()` UUID | `expo-crypto` `Crypto.randomUUID()` | Math.random is PRNG, not CSPRNG |
| HMAC-SHA256 | Custom SHA-256 implementation | Deno built-in `crypto.subtle` | Browser standard, no deps, runs in Deno |
| Timing-safe comparison | `===` string compare | Compare hex digests (safe for HMAC) | For HMAC, hex-compare is sufficient |
| Payment state validation | if/else in every mutation | Postgres BEFORE UPDATE trigger | Trigger catches ALL code paths including direct DB access |

**Key insight:** Security controls must live at the layer closest to the data. Application-level checks can be bypassed by any other code path (Edge Functions, direct DB queries, future code). The trigger is the only way to make the payment state machine unconditional.

---

## Common Pitfalls

### Pitfall 1: FOR ALL policies silently pass without WITH CHECK in Postgres
**What goes wrong:** Supabase Security Advisor reports zero warnings but then flags all `FOR ALL` policies without explicit `WITH CHECK` as potential issues. The advisor uses stricter rules than Postgres itself — Postgres does apply USING as WITH CHECK implicitly for FOR ALL. However, for explicit, auditable security, the advisor wants both clauses.
**Why it happens:** `FOR ALL USING (condition)` is valid Postgres SQL and works correctly; Supabase adds a static analysis layer that requires explicitness.
**How to avoid:** Always write separate SELECT/INSERT/UPDATE/DELETE policies with explicit clauses. Drop the old FOR ALL policy and replace.
**Warning signs:** Supabase Security Advisor dashboard shows yellow/orange warnings on tables.

### Pitfall 2: Trigger blocks auto-confirm and mark-overdue if not audited
**What goes wrong:** New trigger migration is applied, then `auto-confirm-payments` or `mark-overdue` fails silently or errors because a payment somehow in an unexpected state is targeted.
**Why it happens:** If any payment row has a corrupted status not in the valid set, or if the bulk update hits rows the developer didn't intend (e.g., a future code change to auto-confirm that adds `.eq('status', 'partial')`).
**How to avoid:** Audit both Edge Functions against the allowed transition table before deploying the trigger migration. Document which transition each function uses.
**Warning signs:** Edge Function logs showing Postgres exceptions after migration 017 is applied.

### Pitfall 3: WhatsApp GET handler and POST handler must stay separate
**What goes wrong:** Adding HMAC validation at the top of the handler and applying it to GET requests, which breaks webhook subscription verification.
**Why it happens:** Meta sends a GET request for initial webhook setup (no body, no signature) and POST for messages (with body and signature). A blanket auth check breaks the GET flow.
**How to avoid:** Gate HMAC validation on `req.method === 'POST'` only. The GET handler checks `hub.verify_token` — keep that check separate.

### Pitfall 4: Telegram secret token is separate from bot token
**What goes wrong:** Developer thinks validating against `TELEGRAM_BOT_TOKEN` is sufficient for webhook security, but this token is already public (embedded in webhook URL).
**Why it happens:** The bot token appears in URLs like `https://api.telegram.org/bot{TOKEN}/...` — it identifies the bot but doesn't authenticate inbound requests.
**How to avoid:** Use a completely separate `TELEGRAM_WEBHOOK_SECRET` value only known to Telegram (set via `setWebhook`) and your Edge Function. Never reuse the bot token as a webhook secret.

### Pitfall 5: invite.ts does not check is_archived on tenant
**What goes wrong:** An archived tenant's invite token is still valid — `getInviteDetails` only checks `invite_status = 'pending'`, not `is_archived = false`. A user could accept an invite to an archived tenant slot.
**Why it happens:** Archiving a tenant sets `is_archived = true` but does not change `invite_status`. If the token was generated before archiving, it remains technically valid.
**How to avoid:** Add `.eq('is_archived', false)` to the `getInviteDetails` query in `lib/invite.ts`.

### Pitfall 6: useDashboard recent transactions query leaks cross-user data
**What goes wrong:** The `recentPromise` query in `useDashboard` fetches recent payments globally filtered only by status `paid/confirmed` — it then filters client-side by `ownedPropertyIds`. This means the query returns payments from other users' properties and discards them client-side. It's functionally correct due to RLS, but relies on RLS rather than a proper server-side filter.
**Why it happens:** The `recentPromise` doesn't add `.in('property_id', propertyIds)` — this is a gap in the query, not a security hole (RLS prevents cross-user leakage), but it's a cleanliness issue. The DATA-01 audit should document this as acceptable since RLS covers it.

---

## Code Examples

### SEC-03: RLS migration template

```sql
-- Migration 016_rls_with_check.sql
-- Source: Supabase RLS documentation + PostgreSQL documentation

-- ---- USERS ----
DROP POLICY IF EXISTS "users_self" ON public.users;

CREATE POLICY "users_select" ON public.users
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "users_insert" ON public.users
  FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "users_update" ON public.users
  FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

CREATE POLICY "users_delete" ON public.users
  FOR DELETE USING (auth.uid() = id);

-- ---- PROPERTIES ----
DROP POLICY IF EXISTS "properties_owner_all" ON public.properties;

CREATE POLICY "properties_owner_select" ON public.properties
  FOR SELECT USING (auth.uid() = owner_id);

CREATE POLICY "properties_owner_insert" ON public.properties
  FOR INSERT WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "properties_owner_update" ON public.properties
  FOR UPDATE USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "properties_owner_delete" ON public.properties
  FOR DELETE USING (auth.uid() = owner_id);

-- properties_tenant_read is SELECT only — no WITH CHECK needed
-- (no change required for this policy)

-- ---- TENANTS ----
DROP POLICY IF EXISTS "tenants_owner_all" ON public.tenants;

CREATE POLICY "tenants_owner_select" ON public.tenants
  FOR SELECT USING (public.is_property_owner(property_id));

CREATE POLICY "tenants_owner_insert" ON public.tenants
  FOR INSERT WITH CHECK (public.is_property_owner(property_id));

CREATE POLICY "tenants_owner_update" ON public.tenants
  FOR UPDATE
  USING (public.is_property_owner(property_id))
  WITH CHECK (public.is_property_owner(property_id));

CREATE POLICY "tenants_owner_delete" ON public.tenants
  FOR DELETE USING (public.is_property_owner(property_id));

-- tenants_self_read is SELECT only — no change needed

-- ---- PAYMENTS ----
DROP POLICY IF EXISTS "payments_owner_all" ON public.payments;

CREATE POLICY "payments_owner_select" ON public.payments
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.properties p WHERE p.id = property_id AND p.owner_id = auth.uid())
  );

CREATE POLICY "payments_owner_insert" ON public.payments
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.properties p WHERE p.id = property_id AND p.owner_id = auth.uid())
  );

CREATE POLICY "payments_owner_update" ON public.payments
  FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.properties p WHERE p.id = property_id AND p.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.properties p WHERE p.id = property_id AND p.owner_id = auth.uid()));

CREATE POLICY "payments_owner_delete" ON public.payments
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.properties p WHERE p.id = property_id AND p.owner_id = auth.uid())
  );

-- payments_tenant_read is SELECT only — no change needed

-- ---- NOTIFICATIONS ----
DROP POLICY IF EXISTS "notifications_self" ON public.notifications;

CREATE POLICY "notifications_select" ON public.notifications
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "notifications_insert" ON public.notifications
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "notifications_update" ON public.notifications
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "notifications_delete" ON public.notifications
  FOR DELETE USING (auth.uid() = user_id);

-- ---- BOT_CONVERSATIONS ----
DROP POLICY IF EXISTS "bot_conversations_self" ON public.bot_conversations;

CREATE POLICY "bot_conversations_select" ON public.bot_conversations
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "bot_conversations_insert" ON public.bot_conversations
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "bot_conversations_update" ON public.bot_conversations
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "bot_conversations_delete" ON public.bot_conversations
  FOR DELETE USING (auth.uid() = user_id);

-- ---- EXPENSES ----
DROP POLICY IF EXISTS "owner_all" ON public.expenses;

CREATE POLICY "expenses_select" ON public.expenses
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "expenses_insert" ON public.expenses
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "expenses_update" ON public.expenses
  FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "expenses_delete" ON public.expenses
  FOR DELETE USING (user_id = auth.uid());
```

### DATA-03: Payment state machine trigger

```sql
-- Migration 017_payment_state_machine.sql

CREATE OR REPLACE FUNCTION public.validate_payment_transition()
RETURNS TRIGGER AS $$
BEGIN
  -- Same-status update is always allowed (e.g. updating amount_paid without changing status)
  IF OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

  -- Valid transitions (per CONTEXT.md locked decisions)
  IF (OLD.status = 'pending'   AND NEW.status IN ('partial', 'paid', 'overdue')) OR
     (OLD.status = 'partial'   AND NEW.status IN ('paid', 'overdue')) OR
     (OLD.status = 'overdue'   AND NEW.status IN ('partial', 'paid')) OR
     (OLD.status = 'paid'      AND NEW.status = 'confirmed') OR
     (OLD.status = 'confirmed' AND NEW.status = 'paid')
  THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Invalid payment transition: % → %', OLD.status, NEW.status;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS validate_payment_transition ON public.payments;

CREATE TRIGGER validate_payment_transition
  BEFORE UPDATE ON public.payments
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION public.validate_payment_transition();
```

### SEC-01/SEC-02 Verification: lib/bot.ts current state (already correct)

```typescript
// lib/bot.ts — already implemented correctly as of Phase 1
import * as Crypto from 'expo-crypto';

// UUID generation (line 51): SEC-01 COMPLETE
const token = Crypto.randomUUID();

// Verification code generation (secureRandomDigits, line 40-47): SEC-02 COMPLETE
function secureRandomDigits(length: number): string {
  const bytes = Crypto.getRandomBytes(length);
  let result = '';
  for (let i = 0; i < length; i++) {
    result += (bytes[i] % 10).toString();
  }
  return result;
}
```

### DATA-01 Soft-Delete Audit Checklist

Current status based on code inspection:

**Hooks — PASS (all filter is_archived):**
- `useProperties`: `.eq('is_archived', false)` on both properties and tenants queries
- `useTenants`: `.eq('is_archived', false)` on tenants query
- `useDashboard`: `.eq('is_archived', false)` on properties query; has post-fetch `if (tenant.is_archived) continue;` guard; recent transactions query does not filter is_archived on tenants (relies on RLS + property scope — acceptable)
- `usePayments`: queries payments by tenant_id only — payments have no is_archived field (N/A)
- `useNotifications`: notifications have no is_archived field (N/A)
- `useBotConversations`: no is_archived field (N/A)
- `useExpenses`/`useAllExpenses`: expenses have no is_archived field (N/A)
- `useAiNudge`: calls ai-insights Edge Function — covered there

**Screens — PASS:**
- `app/(tabs)/properties/index.tsx`: `.eq('is_archived', false)` on properties
- `app/payments/index.tsx`: `.eq('is_archived', false)` on tenants
- `app/log-payment.tsx`: `.eq('is_archived', false)` on properties, client-side filter on tenants
- `app/reminders/index.tsx`: client-side `if (t.is_archived) return false`
- `app/_layout.tsx`: `.eq('is_archived', false)` on onboarding check

**Edge Functions — PASS:**
- `send-reminders`: `.eq('is_archived', false)` on tenants query
- `process-bot-message`: multiple `.eq('is_archived', false)` calls in buildContext and action handlers
- `ai-insights`: `.eq('is_archived', false)` on properties query
- `ai-search`: `.eq('is_archived', false)` on properties, tenants, and properties queries
- `ai-draft-reminders`: `.eq('is_archived', false)` on properties query
- `auto-confirm-payments`: queries payments only — no is_archived on payments (N/A)
- `mark-overdue`: queries payments only — no is_archived on payments (N/A)
- `whatsapp-webhook`, `telegram-webhook`: no properties/tenants queries (N/A)
- `invite-redirect`, `send-push`, `whatsapp-send-code`: no properties/tenants queries (N/A)

**GAP identified:** `lib/invite.ts` `getInviteDetails()` does not filter `.eq('is_archived', false)` — an archived tenant's pending invite token remains usable. This is the DATA-04 edge case.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | None — no test infrastructure exists (see CONCERNS.md item #24) |
| Config file | None — Wave 0 must create if tests are added |
| Quick run command | `npx tsc --noEmit` (type check only) |
| Full suite command | `npx tsc --noEmit` (type check only) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SEC-01 | No Math.random() in lib/bot.ts UUID path | manual-only (grep) | `grep -r "Math.random" lib/ supabase/` | N/A |
| SEC-02 | No Math.random() in verification code path | manual-only (grep) | `grep -r "Math.random" lib/ supabase/` | N/A |
| SEC-03 | RLS policies have USING + WITH CHECK on UPDATE | manual-only (DB inspection) | Supabase Security Advisor dashboard | N/A |
| SEC-04 | Telegram webhook returns 401 on missing/wrong secret | manual-only (curl test) | `curl -X POST .../telegram-webhook` without header | N/A |
| SEC-05 | WhatsApp webhook returns 401 on bad HMAC | manual-only (curl test) | `curl -X POST .../whatsapp-webhook` with bad signature | N/A |
| SEC-06 | User strings XML-escaped in bot context | manual-only (log inspection) | Inspect Edge Function log output | N/A |
| DATA-01 | Archived records never appear in user-facing queries | manual-only (audit checklist) | Code review checklist above | N/A |
| DATA-02 | No invalid state transitions in app code | manual-only (code review) | Code review + trigger will catch at runtime | N/A |
| DATA-03 | DB trigger rejects invalid payment transitions | manual-only (Supabase SQL editor) | Run test SQL against migrations | N/A |
| DATA-04 | Archived tenant invite tokens rejected | manual-only (code review) | Verify getInviteDetails adds is_archived filter | N/A |

**Note on testing:** This project has no unit test infrastructure. All validation is manual — code inspection, grep verification, curl tests against deployed Edge Functions, and Supabase SQL editor queries. The planner should include specific verification steps (grep commands, curl examples, SQL test queries) as explicit task checklist items.

### Sampling Rate
- **Per task commit:** `npx tsc --noEmit`
- **Per wave merge:** `npx tsc --noEmit` + manual verification checklist items
- **Phase gate:** All 10 requirements manually verified before `/gsd:verify-work`

### Wave 0 Gaps
None — no test framework setup is in scope for this phase. Validation is entirely manual per the existing project pattern.

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `FOR ALL USING (...)` RLS policies | Explicit per-operation policies with `WITH CHECK` | Supabase Security Advisor era | Eliminates advisory warnings, explicit intent |
| App-level state validation only | DB-level BEFORE UPDATE trigger | PostgreSQL 9.0+ | Cannot be bypassed by any code path |
| `Math.random()` UUID | `expo-crypto.randomUUID()` | Already done in lib/bot.ts | Cryptographically secure |
| Raw string interpolation in LLM context | XML-tagged user data | LLM security best practice | Prevents prompt injection |

**Deprecated/outdated:**
- `Math.random()` for any security-sensitive value: replaced with `expo-crypto` in lib/bot.ts. Verify no regression elsewhere.
- `FOR ALL` RLS policies without WITH CHECK: will be replaced in migration 016.

---

## Open Questions

1. **Does `TELEGRAM_WEBHOOK_SECRET` need to be set retroactively on existing Telegram webhook registration?**
   - What we know: The existing Telegram webhook was registered without a secret. Adding validation in the Edge Function will reject all existing Telegram messages until the webhook is re-registered with the secret.
   - What's unclear: Whether the re-registration step is documented or automated anywhere in the project.
   - Recommendation: The planner should include a step to re-register the Telegram webhook with `secret_token` set, using the new `TELEGRAM_WEBHOOK_SECRET` env var, as part of the implementation task.

2. **`WHATSAPP_APP_SECRET` env var — is it already configured in Supabase?**
   - What we know: The current Edge Function env vars include `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_VERIFY_TOKEN` but not `WHATSAPP_APP_SECRET`.
   - What's unclear: Whether this secret is available or needs to be retrieved from the Meta Developer Portal.
   - Recommendation: The implementation task should document where to obtain it (Meta Developer Portal > App > Basic Settings > App Secret) and how to add it (`supabase secrets set WHATSAPP_APP_SECRET=...`).

3. **RLS migration: will dropping FOR ALL policies cause a temporary access window?**
   - What we know: `DROP POLICY` then `CREATE POLICY` is not atomic in a transaction in terms of ongoing connections.
   - What's unclear: Supabase handles migrations in transactions — if the DROP succeeds but CREATE fails (syntax error), the table would have no policy, allowing all authenticated users access temporarily.
   - Recommendation: Wrap each DROP + CREATE pair in an explicit transaction, or use `CREATE POLICY ... IF NOT EXISTS` + keep old policy until new is verified. The safest approach is to run the migration in a single transaction with both old and new policies briefly coexisting, then drop the old one.

---

## Sources

### Primary (HIGH confidence)
- Direct code inspection: `lib/bot.ts`, `supabase/functions/telegram-webhook/index.ts`, `supabase/functions/whatsapp-webhook/index.ts`, `supabase/functions/process-bot-message/index.ts`, `supabase/migrations/001_initial_schema.sql`, all hooks, relevant screens
- Postgres trigger documentation: `FOR EACH ROW WHEN (...)` syntax, `RAISE EXCEPTION`
- Supabase RLS documentation: `WITH CHECK` behavior for UPDATE policies

### Secondary (MEDIUM confidence)
- Telegram Bot API documentation: `X-Telegram-Bot-Api-Secret-Token` header, `setWebhook` with `secret_token` parameter
- Meta Webhooks documentation: `X-Hub-Signature-256` HMAC-SHA256 pattern, App Secret location

### Tertiary (LOW confidence)
- Supabase Security Advisor behavior: based on known patterns of what the advisor flags; exact wording of warnings not directly verified (would require live Supabase dashboard access)

---

## Metadata

**Confidence breakdown:**
- SEC-01/02 (crypto): HIGH — code directly inspected, already complete
- SEC-03 (RLS): HIGH — schema directly inspected, gap confirmed
- SEC-04 (Telegram): HIGH — code directly inspected, gap confirmed; fix pattern is documented API
- SEC-05 (WhatsApp): HIGH — code directly inspected, gap confirmed; HMAC pattern is documented Meta API
- SEC-06 (prompt injection): HIGH — code directly inspected, gap confirmed; XML escaping is standard
- DATA-01 (soft-delete): HIGH — all files directly inspected, one gap confirmed in lib/invite.ts
- DATA-02/03 (payment trigger): HIGH — schema inspected, trigger SQL is standard plpgsql
- DATA-04 (invite flow): HIGH — lib/invite.ts directly inspected, gap confirmed

**Research date:** 2026-03-18
**Valid until:** 2026-04-18 (stable libraries; Telegram/Meta APIs rarely change webhook auth patterns)
