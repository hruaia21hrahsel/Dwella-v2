# Phase 4: Client Code & UX - Context

**Gathered:** 2026-03-19
**Status:** Ready for planning

<domain>
## Phase Boundary

Make the client layer observable and resilient before launch. Hooks clean up Realtime subscriptions correctly, auth failures surface to users via toast, the app refuses to start without critical env vars, and push notification code paths are verified end-to-end including error handling. No new features — hardening only.

Requirements: CLIENT-01, CLIENT-02, CLIENT-03, CLIENT-04

</domain>

<decisions>
## Implementation Decisions

### Auth error visibility (CLIENT-01)
- Show auth/profile sync failures via existing ToastProvider (Snackbar at bottom of screen)
- Non-blocking — user sees the error but can still interact with the app
- Auth errors also sent to Sentry for monitoring failure rates in production
- Claude's discretion: include Retry button on toast for retryable errors, inform-only for non-retryable

### Env validation behavior (CLIENT-02)
- Critical vars (SUPABASE_URL, SUPABASE_ANON_KEY): throw error at startup — fail fast with clear message in dev console
- Optional vars (SENTRY_DSN, TELEGRAM_BOT_USERNAME, WHATSAPP_BOT_PHONE): log console warning, app continues without them
- Validation runs in `constants/config.ts` at import time — checked as soon as the app loads
- Replace existing `?? ''` fallback pattern for critical vars with throw on empty/missing

### Subscription cleanup (CLIENT-03)
- Audit all 10 hooks with Realtime subscriptions (complete coverage, not spot-check)
- Every hook must call `unsubscribe()` + `removeChannel()` in its useEffect cleanup return
- Silent fix only — no debug logging in production code
- Hooks to audit: useProperties, useTenants, usePayments, useNotifications, useDashboard, useBotConversations, useAllExpenses, useExpenses, and 2 in app/ screens (profile, _layout)

### Push notification verification (CLIENT-04)
- Code audit only — verify registration -> DB storage -> send-push -> Expo Push API path is correct
- Physical device test is a separate manual step post-deploy (not automated in this phase)
- Audit error paths too: expired tokens, permission denied, Expo API errors — fix gaps if found
- `lib/notifications.ts` + `send-push` Edge Function (already hardened in Phase 3) are the audit targets

### Claude's Discretion
- Whether to add Retry action on auth error toast vs inform-only (based on error retryability)
- Exact error message wording for env validation throws
- Order of hook audit (by criticality or alphabetical)
- How to handle expired push tokens (remove from DB? retry? log and skip?)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Client hooks (subscription audit targets)
- `hooks/useProperties.ts` — Property list + Realtime subscription
- `hooks/useTenants.ts` — Tenant list + Realtime subscription
- `hooks/usePayments.ts` — Payment list + auto-generation + Realtime subscription
- `hooks/useNotifications.ts` — Notification feed + Realtime subscription
- `hooks/useDashboard.ts` — Dashboard aggregation + Realtime subscription
- `hooks/useBotConversations.ts` — Bot chat messages + Realtime subscription
- `hooks/useAllExpenses.ts` — All expenses across properties + Realtime subscription
- `hooks/useExpenses.ts` — Per-property expenses + Realtime subscription
- `app/(tabs)/profile/index.tsx` — Profile screen with Realtime subscription
- `app/_layout.tsx` — Root layout with auth state + Realtime subscription

### Auth & config
- `lib/store.ts` — Zustand auth store (syncProfile logic lives here or in _layout)
- `constants/config.ts` — Central env var config (validation target for CLIENT-02)
- `components/ToastProvider.tsx` — Existing toast system (reuse for CLIENT-01)
- `lib/toast.ts` — Toast store (success/error/info types)

### Push notifications
- `lib/notifications.ts` — `registerPushToken()` function (registration + DB write)
- `supabase/functions/send-push/index.ts` — Push dispatch Edge Function (hardened in Phase 3)
- `supabase/migrations/010_push_tokens.sql` — push_token column on users table

### Prior phase context
- `.planning/phases/01-compilation-tooling-baseline/01-CONTEXT.md` — Sentry integration decisions
- `.planning/phases/03-edge-functions-backend/03-CONTEXT.md` — send-push hardening decisions

### Requirements
- `.planning/REQUIREMENTS.md` — CLIENT-01, CLIENT-02, CLIENT-03, CLIENT-04 acceptance criteria

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `components/ToastProvider.tsx` + `lib/toast.ts`: Snackbar toast system with success/error/info types — reuse for auth error visibility
- `lib/sentry.ts`: Sentry already initialized (Phase 1) — use `Sentry.captureException()` for auth errors
- `lib/notifications.ts`: Push token registration function exists — audit and fix, don't rewrite

### Established Patterns
- Env vars use `EXPO_PUBLIC_` prefix, exported from `constants/config.ts`
- Realtime subscriptions created via `supabase.channel()` in useEffect hooks
- Auth state managed in Zustand store (`lib/store.ts`) with persist middleware
- Toast shown via `useToastStore().showToast('message', 'error')`

### Integration Points
- Auth sync happens in `app/_layout.tsx` after `onAuthStateChange` — error toast triggers here
- `constants/config.ts` imported by `lib/supabase.ts` and many screens — validation must not break import chain
- All 10 hooks with subscriptions follow similar pattern: create channel in useEffect, return cleanup

</code_context>

<specifics>
## Specific Ideas

No specific requirements — standard hardening patterns apply.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 04-client-code-ux*
*Context gathered: 2026-03-19*
