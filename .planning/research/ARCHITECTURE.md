# Architecture Research

**Domain:** Multi-layer React Native + Supabase audit (property management app)
**Researched:** 2026-03-18
**Confidence:** HIGH

## Standard Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                     CLIENT LAYER (React Native)                  │
├────────────────────┬────────────────────┬────────────────────────┤
│  Expo Router       │  Zustand Store     │  PostHog / Analytics   │
│  (screens/tabs)    │  (auth + cache)    │  (event tracking)      │
├────────────────────┴────────────────────┴────────────────────────┤
│                     HOOK LAYER (React hooks)                      │
│  useProperties  usePayments  useTenants  useDashboard  useNotif  │
├─────────────────────────────────────────────────────────────────┤
│                      LIB LAYER (utility modules)                  │
│  supabase.ts  payments.ts  bot.ts  invite.ts  notifications.ts   │
│  pdf.ts  expenses.ts  analytics.ts  biometric-auth.ts            │
├─────────────────────────────────────────────────────────────────┤
│                   SUPABASE EDGE (serverless functions)            │
│  telegram-webhook  whatsapp-webhook  process-bot-message          │
│  auto-confirm-payments  mark-overdue  send-reminders              │
│  send-push  ai-insights  ai-search  ai-draft-reminders            │
│  invite-redirect  generate-pdf                                    │
├─────────────────────────────────────────────────────────────────┤
│                   DATA LAYER (Supabase Postgres)                  │
│  users → properties → tenants → payments                          │
│  notifications  bot_conversations  expenses  push_tokens          │
├─────────────────────────────────────────────────────────────────┤
│                   EXTERNAL SERVICES                               │
│  Telegram Bot API  WhatsApp (Edge)  Claude API  Expo Push         │
│  Apple/Google OAuth  Supabase Storage  Apple/Google Store         │
└─────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Layer | Component | Responsibility | Audit Boundary |
|-------|-----------|----------------|----------------|
| Client | Expo Router screens | UI rendering, user input, navigation | Type safety, error display, UX correctness |
| Client | Zustand store | Auth state, cached properties/tenants | Persistence correctness, stale state risk |
| Client | `lib/` modules | Business logic wrappers, external SDK calls | Crypto security, error propagation, type fidelity |
| Hook | Custom hooks | Data fetching, Realtime subscriptions, derived state | RLS alignment, subscription cleanup, N+1 risk |
| Edge | Webhook functions | Ingest from Telegram/WhatsApp, validate, dispatch | Auth checks, input validation, error codes |
| Edge | Scheduled functions | Time-based state transitions (auto-confirm, overdue, reminders) | Soft-delete filtering, idempotency, error codes |
| Edge | AI functions | Claude API call, JSON parse, DB mutation | Structured output validation, fallback handling |
| Data | Postgres tables | Source of truth for all entities | RLS policies, constraint enforcement, migration integrity |
| Data | Storage | Payment proof images, PDF receipts, avatars | Bucket policies, signed URL expiry |

## Recommended Audit Layer Order

### Dependency Order: Database First

Audit in this sequence because each layer's correctness depends on the layer below it:

```
1. DATA LAYER (Postgres + Storage)
       ↓ correctness here propagates upward
2. EDGE FUNCTIONS
       ↓ their behavior depends on DB contracts
3. HOOK LAYER (client-side data fetching)
       ↓ hooks mirror DB queries, inherit RLS assumptions
4. LIB MODULES (business logic)
       ↓ libs call hooks or supabase directly
5. CLIENT LAYER (screens + Zustand)
       ↓ screens consume lib + hooks
6. CROSS-CUTTING (config, auth, logging, launch config)
       acts on all layers, audited last as a sweep
```

**Rationale:**

- An RLS policy gap found in layer 1 invalidates any security assumption made in layers 3-5. Auditing top-down means re-auditing after each DB fix.
- A soft-delete filtering miss in a hook (layer 3) means every screen that consumes it silently shows archived records. Finding it at the DB level first prevents auditing 10+ screens for a symptom.
- Edge Functions touch the DB directly (bypassing client RLS in some cases). They must be validated against the confirmed DB contracts, not audited before them.

## Audit Layer Boundaries

### Layer 1: Data Layer

**Audit surface:**
- All 15 migrations (`001` through `015`) — schema correctness, constraint definitions
- RLS policies on every table: `users`, `properties`, `tenants`, `payments`, `notifications`, `bot_conversations`, `expenses`, `push_tokens`
- Storage bucket policies: `payment-proofs`, `avatars`
- Triggers and functions (if any): state transition enforcement

**Key questions:**
- Does RLS on `payments` prevent a tenant from reading another tenant's payments?
- Does RLS on `properties` prevent tenants from querying other users' properties?
- Is `is_archived = FALSE` enforced at the view or view-equivalent level, or only in app code?
- Do all tables with `user_id`/`owner_id` foreign keys have corresponding RLS `auth.uid() = ...` policies?
- Does `ON DELETE RESTRICT` on `tenant_id` in `payments` propagate correctly when archiving?

**Findings feed:**
- Every hook and Edge Function that queries these tables
- Any screen that presents data without going through a hook (direct Supabase calls in screens)

---

### Layer 2: Edge Functions

**Audit surface:**
13 deployed functions, grouped by concern:

| Group | Functions | Primary Risk |
|-------|-----------|--------------|
| Bot ingestion | `telegram-webhook`, `whatsapp-webhook` | Input validation, token verification, no auth bypass |
| Bot processing | `process-bot-message` | Claude output validation, structured JSON parse, DB mutation safety |
| Scheduled state | `auto-confirm-payments`, `mark-overdue`, `send-reminders` | Soft-delete filtering, idempotency, correct HTTP status codes |
| AI tools | `ai-insights`, `ai-search`, `ai-draft-reminders` | Auth header verification, rate limiting, error fallback |
| Notifications | `send-push` | Push token validity, error handling per-token failure |
| Utility | `invite-redirect`, `generate-pdf` | Placeholder URLs (#18), token exposure, PDF auth |

**Key questions:**
- Do all Edge Functions that mutate data verify `Authorization` header against a known service key or user JWT?
- Does `process-bot-message` validate Claude's structured JSON output before executing DB actions, or does it trust the model blindly?
- Do scheduled functions (`auto-confirm-payments`, `mark-overdue`) include `is_archived = FALSE` in their tenant/payment queries?
- Do all catch blocks return meaningful HTTP status codes (400/404/500/503) rather than generic 500?
- Does `send-reminders` avoid double-sending if called twice in one day (idempotency)?

**Findings feed:**
- Client-side bot flow (screens calling these functions)
- Scheduled job reliability (Supabase cron config)

---

### Layer 3: Hook Layer

**Audit surface:**
9 custom hooks: `useProperties`, `usePayments`, `useTenants`, `useDashboard`, `useNotifications`, `useBotConversations`, `useAiNudge`, `useExpenses`, `useAllExpenses`

**Key questions:**
- Does every `select()` call include `.eq('is_archived', false)` where applicable?
- Are Realtime subscription channels properly unsubscribed on unmount (not just removed)?
- Does `useDashboard` execute N+1 queries (property → tenants → payments in sequence), and if so, how many extra round-trips does this generate?
- Do hooks propagate errors to callers (via returned `error` state), or swallow them silently?
- Do hooks cache invalidate on Realtime events, or do stale fetches race with live updates?

**Findings feed:**
- All screens consuming these hooks (upstream symptom source)
- Zustand store invalidation behavior

---

### Layer 4: Lib Modules

**Audit surface:**
`lib/bot.ts`, `lib/payments.ts`, `lib/invite.ts`, `lib/notifications.ts`, `lib/supabase.ts`, `lib/store.ts`, `lib/analytics.ts`, `lib/biometric-auth.ts`, `lib/pdf.ts`, `lib/expenses.ts`

**Key questions:**
- Does `lib/bot.ts` use `Math.random()` for UUID/code generation (known issue #2, #3)?
- Does `lib/supabase.ts` fail fast on missing env vars (known issue #21)?
- Does `lib/store.ts` properly clear all cached state on logout (tenant data, property cache)?
- Does `lib/invite.ts` verify token expiry before accepting?
- Does `lib/payments.ts` enforce valid status transitions, or is that left to calling code?

**Findings feed:**
- Screens that call lib functions directly
- Security audit (crypto concerns)

---

### Layer 5: Client Layer (Screens + Zustand)

**Audit surface:**
All `app/` screens, `components/`, Zustand `store.ts` state shape

**Key questions:**
- Do screens show user-facing error messages when hooks return errors (or silently show empty states)?
- Does the auth flow handle profile sync failure visibly (known issue #13)?
- Does the invite acceptance screen (`app/invite/[token].tsx`) handle expired or already-used tokens gracefully?
- Is biometric auth enforced on re-open, or only on first launch?
- Are TypeScript `as any` casts localized or proliferated across components?

**Findings feed:**
- UX audit pass
- Type safety sweep

---

### Layer 6: Cross-Cutting Concerns

Audited last because they span all layers and require the full picture:

| Concern | Spans | What to Check |
|---------|-------|---------------|
| TypeScript compilation | All layers | `npx tsc --noEmit` — known error in `_layout.tsx` (issue #1) |
| Auth & session security | Client + Edge | JWT passed correctly, no anon key misuse in Edge |
| Env/config validation | Client + Edge | All required vars present, fail-fast on missing |
| Logging & observability | Edge + Client | No secrets in logs, no verification codes exposed |
| Launch config | App metadata | `app.json` version, bundle ID, EAS build config, store URLs |
| PostHog | Client | Autocapture scope, performance impact, correct event names |

## Cross-Cutting Concerns That Span Layers

### 1. Soft-Delete Pattern (affects layers 1, 2, 3, 5)

**The chain:**
```
Migration adds is_archived column (layer 1)
  → RLS does NOT filter archived rows (layer 1 gap)
    → Hook queries archived data (layer 3 symptom)
      → Edge Functions schedule actions on archived tenants (layer 2 symptom)
        → Screen shows archived tenant in list (layer 5 symptom)
```

**Audit approach:** Verify at layer 1 first (DB views or RLS). Every downstream finding about archived data is a symptom of the same root cause.

---

### 2. Auth Identity Propagation (affects layers 1, 2, 3, 4, 5)

**The chain:**
```
Supabase auth.uid() — source of identity (layer 1)
  → RLS policies use auth.uid() for row ownership (layer 1)
    → Edge Functions receive JWT and must verify it (layer 2)
      → Hooks inherit user context from Zustand (layers 3-4)
        → Screens render data filtered by user (layer 5)
```

**Audit approach:** Trace one user identity from login through to a payment query. Verify JWT is passed at each boundary, not just assumed.

---

### 3. Payment State Machine (affects layers 1, 2, 3, 4)

**The chain:**
```
Status CHECK constraint in schema (layer 1 — partial enforcement)
  → auto-confirm-payments changes paid → confirmed (layer 2)
    → mark-overdue changes pending → overdue (layer 2)
      → usePayments reads status and derives UI state (layer 3)
        → PaymentStatusBadge renders color (layer 5)
```

**Audit approach:** Map all transition-writing code paths. Verify invalid transitions (e.g., confirmed → pending) cannot occur through any code path or direct DB call.

---

### 4. Bot Message Flow (affects layers 2, 4, 5)

**The chain:**
```
Telegram/WhatsApp sends message → webhook Edge Function
  → process-bot-message calls Claude API
    → Claude returns structured JSON {intent, entities, action}
      → Edge Function executes DB mutation
        → Response sent back to user
```

**Audit approach:** Validate that Claude's response is schema-checked before any DB write. A malformed or unexpected response must fail safely, not mutate data.

---

### 5. Invite Flow (affects layers 1, 2, 4, 5)

**The chain:**
```
Landlord creates tenant → UUID token stored on tenants row (layer 1)
  → Token embedded in deep link (layer 4 / invite.ts)
    → invite-redirect Edge Function resolves token to store URL (layer 2)
      → app/invite/[token].tsx accepts and links user_id (layer 5)
        → tenants.invite_status = 'accepted' (layer 1)
```

**Audit approach:** Token must be single-use. Verify no second acceptance is possible once `invite_status = 'accepted'`. Verify token is not logged by Edge Function or rendered in shareable UI beyond the deep link itself.

## Data Flow

### Primary Request Flow (Client → DB)

```
User Action (screen)
    ↓
Custom Hook (usePayments, useProperties, etc.)
    ↓
lib/supabase.ts (Supabase JS client)
    ↓
Supabase Postgres (RLS enforced)
    ↓ (Realtime event if subscribed)
Hook state update → React re-render
```

### Bot Message Flow (Telegram/WhatsApp → DB)

```
External message (Telegram API / WhatsApp)
    ↓
telegram-webhook / whatsapp-webhook (Edge Function)
    ↓ (validates, dispatches)
process-bot-message (Edge Function)
    ↓ (calls Claude API with DB context)
Claude API returns structured JSON
    ↓ (Edge Function validates and executes)
Supabase DB mutation (bypasses client RLS — uses service key)
    ↓
Response sent back to user via Telegram/WhatsApp API
```

### Scheduled Flow (Cron → DB)

```
Supabase cron trigger (hourly/daily)
    ↓
auto-confirm-payments / mark-overdue / send-reminders (Edge Function)
    ↓ (queries active tenants + payments)
DB UPDATE (status transition or notification INSERT)
    ↓ (send-reminders also calls Expo Push API)
Expo push notification delivered to device
```

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| 0-1k users | Current monolith is fine. Focus on correctness, not scale. |
| 1k-10k users | Optimize N+1 in `useDashboard`. Add DB connection pooling (PgBouncer, already in Supabase). |
| 10k+ users | Move heavy AI context building out of per-message Edge Function. Cache property context per user in Redis/Upstash. |

### Scaling Priorities

1. **First bottleneck:** `useDashboard` N+1 query pattern — sequential loads of properties → tenants → payments will hit noticeable latency around 20+ properties. Fix: single join query.
2. **Second bottleneck:** Claude API context building — each bot message rebuilds full property/tenant context from DB. At 1k+ active bot users, this becomes expensive and slow. Fix: per-user context cache with 5-min TTL.

## Anti-Patterns

### Anti-Pattern 1: Auditing Top-Down (Screen → DB)

**What people do:** Start reading screens, find a UI bug, trace backward to the hook, then the query.
**Why it's wrong:** A single RLS gap at the DB level causes dozens of symptom appearances in screens. Auditing screens first means finding the same root cause multiple times under different names.
**Do this instead:** Audit DB layer first. Mark every finding. Then check if hooks/screens expose the same issue as a UI symptom — and consolidate into one fix rather than patching 12 screens.

---

### Anti-Pattern 2: Treating Edge Functions as Trusted

**What people do:** Assume Edge Functions run in a safe environment and skip input validation.
**Why it's wrong:** Telegram and WhatsApp webhooks are publicly reachable HTTP endpoints. Anyone can POST to them. Webhook secret verification is the only gate.
**Do this instead:** Verify every Edge Function that handles external input has signature/secret validation as the first check. Fail fast before any DB operation.

---

### Anti-Pattern 3: Fixing Symptoms Without the Root Cause

**What people do:** Find archived tenants appearing in payment lists. Add `.eq('is_archived', false)` to that specific hook. Move on.
**Why it's wrong:** The same missing filter exists in 5 other queries. The actual fix is a DB view or consistent query convention enforced at layer 1/3.
**Do this instead:** When a soft-delete filter is missing, search all hooks and Edge Functions for the pattern before concluding scope of the fix.

---

### Anti-Pattern 4: Auditing Security Issues in Isolation

**What people do:** Note "Math.random() is weak" and fix only `lib/bot.ts`.
**Why it's wrong:** The same weak pattern may exist in `lib/invite.ts` (token generation) or in Edge Functions. Fixing one without a global search misses others.
**Do this instead:** For each security class (weak crypto, log exposure, missing auth checks), search the entire codebase before marking the concern resolved.

## Integration Points

### External Services

| Service | Integration Layer | Auth Mechanism | Audit Focus |
|---------|------------------|----------------|-------------|
| Telegram Bot API | Edge Function (`telegram-webhook`) | Webhook secret in `X-Telegram-Bot-Api-Secret-Token` header | Secret presence, constant-time comparison |
| WhatsApp (via `whatsapp-webhook`) | Edge Function | Custom HMAC or shared secret | Same as Telegram |
| Claude API | Edge Function (`process-bot-message`, AI tools) | `ANTHROPIC_API_KEY` in env | Key in logs, structured output validation |
| Expo Push API | Edge Function (`send-push`) | Bearer token | Token validity per-device, partial failure handling |
| Apple OAuth | Client (`lib/social-auth.ts`) | Expo AuthSession | Nonce validation, token expiry |
| Google OAuth | Client (`lib/social-auth.ts`) | Expo AuthSession | Same as Apple |
| Supabase Storage | Client + Edge | Signed URLs (client), service key (Edge) | Signed URL expiry, bucket policy coverage |
| PostHog | Client (`lib/posthog.ts`) | Public API key (EXPO_PUBLIC) | Autocapture scope, no PII in events |

### Internal Layer Boundaries

| Boundary | Communication | Audit Concern |
|----------|---------------|---------------|
| Screen → Hook | React hook call | Error surfaced to UI or silently swallowed? |
| Hook → Supabase client | Supabase JS query | RLS alignment, soft-delete filter, subscription cleanup |
| Screen → Lib module | Direct function call | Error propagation, type safety |
| Client → Edge Function | `fetch()` with JWT | JWT passed in Authorization header? |
| Edge Function → DB | Supabase service key | Bypasses RLS — must enforce own auth checks |
| Edge Function → Claude API | REST call | Structured response validated before DB write? |
| Edge Function → External (Telegram/WhatsApp) | REST call | Secrets not in logs, timeouts handled |

## Sources

- Project `CLAUDE.md` — architecture decisions, data flow, scheduled functions list
- `.planning/PROJECT.md` — audit scope and known concerns
- `.planning/codebase/CONCERNS.md` — 28 pre-identified issues with layer attribution
- Supabase Edge Functions documentation (service key bypasses RLS — verified behavior)
- React Native Expo Router architecture (file-based routing, managed workflow constraints)

---
*Architecture research for: Dwella v2 launch audit*
*Researched: 2026-03-18*
