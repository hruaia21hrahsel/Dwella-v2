# Phase 4: Client Code & UX - Research

**Researched:** 2026-03-19
**Domain:** React Native / Expo client hardening — auth error surfacing, env validation, Realtime subscription cleanup, push notification audit
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Auth error visibility (CLIENT-01)**
- Show auth/profile sync failures via existing ToastProvider (Snackbar at bottom of screen)
- Non-blocking — user sees the error but can still interact with the app
- Auth errors also sent to Sentry for monitoring failure rates in production
- Claude's discretion: include Retry button on toast for retryable errors, inform-only for non-retryable

**Env validation behavior (CLIENT-02)**
- Critical vars (SUPABASE_URL, SUPABASE_ANON_KEY): throw error at startup — fail fast with clear message in dev console
- Optional vars (SENTRY_DSN, TELEGRAM_BOT_USERNAME, WHATSAPP_BOT_PHONE): log console warning, app continues without them
- Validation runs in `constants/config.ts` at import time — checked as soon as the app loads
- Replace existing `?? ''` fallback pattern for critical vars with throw on empty/missing

**Subscription cleanup (CLIENT-03)**
- Audit all 10 hooks with Realtime subscriptions (complete coverage, not spot-check)
- Every hook must call `unsubscribe()` + `removeChannel()` in its useEffect cleanup return
- Silent fix only — no debug logging in production code
- Hooks to audit: useProperties, useTenants, usePayments, useNotifications, useDashboard, useBotConversations, useAllExpenses, useExpenses, and 2 in app/ screens (profile, _layout)

**Push notification verification (CLIENT-04)**
- Code audit only — verify registration -> DB storage -> send-push -> Expo Push API path is correct
- Physical device test is a separate manual step post-deploy (not automated in this phase)
- Audit error paths too: expired tokens, permission denied, Expo API errors — fix gaps if found
- `lib/notifications.ts` + `send-push` Edge Function (already hardened in Phase 3) are the audit targets

### Claude's Discretion
- Whether to add Retry action on auth error toast vs inform-only (based on error retryability)
- Exact error message wording for env validation throws
- Order of hook audit (by criticality or alphabetical)
- How to handle expired push tokens (remove from DB? retry? log and skip?)

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| CLIENT-01 | Auth sync failure shows user-facing error/toast instead of silent fallback | Background enrichment catch block in `_layout.tsx` line 158 is empty — add `useToastStore().showToast()` + `Sentry.captureException()` there |
| CLIENT-02 | Missing critical env vars throw on app startup (fail fast) | `constants/config.ts` uses `?? ''` for SUPABASE_URL and SUPABASE_ANON_KEY — replace with throw pattern |
| CLIENT-03 | Realtime subscription cleanup verified (no memory leaks) | Code audit complete — 8 of 10 targets already correct; `_layout.tsx` auth listener uses `subscription.unsubscribe()` correctly; full audit table in Architecture Patterns section |
| CLIENT-04 | Push notification flow verified end-to-end | `lib/notifications.ts` missing `projectId` in `getExpoPushTokenAsync()` call and missing DB write error handling — two fixes required |
</phase_requirements>

---

## Summary

Phase 4 is a hardening-only phase with no new features. All four requirements involve small, targeted fixes to existing code paths. The research consisted of a direct code audit of all 10 subscription targets and both critical files (`constants/config.ts`, `lib/notifications.ts`), producing definitive findings — no speculation required.

The subscription cleanup situation is mostly already correct: 8 of 10 audit targets already call `supabase.removeChannel()` in their useEffect cleanup. The two exceptions identified are worth double-checking: `_layout.tsx` handles auth subscription cleanup correctly via `subscription.unsubscribe()` (not `removeChannel` — this is correct for the auth listener type, which is not a Realtime channel). The `app/(tabs)/profile/index.tsx` WhatsApp realtime subscription also correctly calls `supabase.removeChannel(channel)`. `useAiNudge.ts` has no Realtime subscription at all (AsyncStorage + HTTP fetch only). The audit will confirm conformance — no rewrites expected.

The two real bugs found are in `lib/notifications.ts` (missing `projectId` for `getExpoPushTokenAsync`) and in the auth enrichment catch block in `_layout.tsx` (silent catch swallows all profile-load errors). Both are simple targeted fixes.

**Primary recommendation:** All four requirements are single-file or two-file fixes. Plan as four focused tasks, one per requirement. No new libraries needed. All infrastructure (toast, Sentry, Supabase channels) already exists.

---

## Standard Stack

### Core (already in project — no new installs)
| Library | Version | Purpose | Notes |
|---------|---------|---------|-------|
| `expo-notifications` | SDK 51 | Push token registration, notification handling | Already installed; `getExpoPushTokenAsync` requires `projectId` in SDK 51+ |
| `expo-device` | SDK 51 | Physical device check before push registration | Already installed |
| `@supabase/supabase-js` | 2.x | Realtime channel creation and cleanup | `supabase.removeChannel()` is the correct cleanup API |
| `@sentry/react-native` | Configured in Phase 1 | `Sentry.captureException()` for auth errors | Already initialized in `lib/sentry.ts` |
| `zustand` | 4.x | Toast store (`useToastStore`) | `lib/toast.ts` — already wired |

### No new packages required
This phase makes no new dependencies. All needed libraries are already installed.

---

## Architecture Patterns

### Supabase Realtime Subscription Cleanup — Confirmed Pattern

The project uses `supabase.channel()` with `.subscribe()` in `useEffect`, and `supabase.removeChannel(channel)` in the cleanup return. This is the correct and complete teardown — `removeChannel` unsubscribes and removes the channel from the client's internal registry, preventing accumulation.

**Correct pattern (already used in all 8 hooks):**
```typescript
useEffect(() => {
  if (!userId) return;

  const channel = supabase
    .channel(`notifs-${userId}`)
    .on('postgres_changes', { ... }, handler)
    .subscribe();

  return () => { supabase.removeChannel(channel); };
}, [userId, fetch]);
```

**Auth listener pattern (different — not a Realtime channel):**
The auth listener in `_layout.tsx` uses `supabase.auth.onAuthStateChange()`, which returns a subscription object — not a Realtime channel. Cleanup is `subscription.unsubscribe()`, not `removeChannel`. This is already correct at line 170.

### Subscription Audit Results

| Target | File | Has Channel? | Uses removeChannel? | Status |
|--------|------|--------------|---------------------|--------|
| useProperties | `hooks/useProperties.ts:77` | Yes | Yes | CLEAN |
| useTenants | `hooks/useTenants.ts:63-65` | Yes | Yes | CLEAN |
| usePayments | `hooks/usePayments.ts:64` | Yes | Yes | CLEAN |
| useNotifications | `hooks/useNotifications.ts:52` | Yes | Yes | CLEAN |
| useDashboard | `hooks/useDashboard.ts:208-210` | Yes | Yes | CLEAN |
| useBotConversations | `hooks/useBotConversations.ts:51` | Yes | Yes | CLEAN |
| useAllExpenses | `hooks/useAllExpenses.ts:61` | Yes | Yes | CLEAN |
| useExpenses | `hooks/useExpenses.ts:62` | Yes | Yes | CLEAN |
| profile screen | `app/(tabs)/profile/index.tsx:334-337` | Yes | Yes | CLEAN |
| _layout.tsx | `app/_layout.tsx:170` | Auth listener (not channel) | `subscription.unsubscribe()` | CLEAN |
| useAiNudge | `hooks/useAiNudge.ts` | No — HTTP fetch only | N/A | N/A |

**Finding:** All 10 targets are already correct. CLIENT-03 verification will confirm this via audit documentation rather than code changes. No rewrites needed.

### Auth Error Surfacing Pattern

The auth enrichment block in `app/_layout.tsx` lines 126-162 runs in a background IIFE. The `catch` block at line 158 is currently empty:

```typescript
// CURRENT (lines 126-162 in _layout.tsx) — BUG
(async () => {
  try {
    // ... upsert, select user, identify posthog ...
  } catch {
    // Enrichment failed — app still works with fallback user
  }
  registerPushToken(uid);
})();
```

Fix: catch the error, show toast, capture to Sentry. The toast store is accessible from any module via `useToastStore.getState().showToast(...)` (not the hook, since this runs outside a React component render).

```typescript
// FIXED
} catch (err: unknown) {
  const msg = err instanceof Error ? err.message : 'Failed to load profile';
  useToastStore.getState().showToast('Profile sync failed. Some data may be outdated.', 'error');
  Sentry.captureException(err);
}
```

**Retry button decision (Claude's discretion):** Profile enrichment failure is a network/DB issue that auto-retries on next `onAuthStateChange` event or app resume. A Retry button adds complexity with limited value — recommend inform-only toast with no Retry action.

### Env Validation Pattern

`constants/config.ts` is imported by `lib/supabase.ts` at module load time. Throwing at import time in `config.ts` means the throw propagates before Supabase client is created, which is the correct fail-fast moment.

```typescript
// CURRENT (lines 1-2 in constants/config.ts) — BUG
export const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
export const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

// FIXED
function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(
      `[Dwella] Missing required environment variable: ${key}\n` +
      `Add it to your .env file and restart the dev server.`
    );
  }
  return value;
}

export const SUPABASE_URL = requireEnv('EXPO_PUBLIC_SUPABASE_URL');
export const SUPABASE_ANON_KEY = requireEnv('EXPO_PUBLIC_SUPABASE_ANON_KEY');

// Optional vars keep the ?? '' pattern with a warning
export const SENTRY_DSN = process.env.EXPO_PUBLIC_SENTRY_DSN ?? '';
if (!process.env.EXPO_PUBLIC_SENTRY_DSN) {
  console.warn('[Dwella] EXPO_PUBLIC_SENTRY_DSN not set — crash reporting disabled');
}
```

**Important:** The `requireEnv` throw must happen at module evaluation time (top-level), not inside a function body called later. The current export assignment at module level satisfies this.

### Push Token Registration — Missing projectId

In Expo SDK 51+, `Notifications.getExpoPushTokenAsync()` requires an explicit `projectId` parameter when called outside of Expo Go. The `projectId` is available in `app.json` under `extra.eas.projectId` (`3bc7de51-47e7-4c4e-92e3-e6e1a40ae71b`).

```typescript
// CURRENT (lib/notifications.ts line 21) — INCOMPLETE
const token = (await Notifications.getExpoPushTokenAsync()).data;

// FIXED — pass projectId from Constants
import Constants from 'expo-constants';

const projectId =
  Constants.expoConfig?.extra?.eas?.projectId ??
  Constants.easConfig?.projectId;

if (!projectId) throw new Error('Expo projectId not found in app config');
const token = (await Notifications.getExpoPushTokenAsync({ experienceId: undefined, projectId })).data;
```

Also the current DB write at line 22 doesn't check the error:

```typescript
// CURRENT (line 22) — missing error check
await supabase.from('users').update({ push_token: token }).eq('id', userId);

// FIXED — log error; don't throw (registration is best-effort)
const { error: updateError } = await supabase.from('users').update({ push_token: token }).eq('id', userId);
if (updateError) {
  console.warn('[Dwella] Failed to store push token:', updateError.message);
}
```

**Expired token handling (Claude's discretion):** The Expo Push API returns a `DeviceNotRegistered` error for expired tokens. The `send-push` Edge Function currently returns the raw Expo API response. Recommendation: log expired tokens as a warning at the Edge Function level but do not attempt automatic DB cleanup — token refresh happens on next app launch via `registerPushToken`. This is the standard Expo pattern and avoids DB write races.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Toast system | Custom Snackbar component | Existing `ToastProvider` + `useToastStore` | Already built, themed, positioned |
| Error reporting | Custom error logger | `Sentry.captureException()` from `lib/sentry.ts` | Already initialized in Phase 1 |
| Env validation | Env-parsing library | Inline `requireEnv()` helper in `config.ts` | Zero dependencies, 5 lines, exactly right for this scale |
| Push project ID lookup | Hard-coding UUID string | `Constants.expoConfig?.extra?.eas?.projectId` | Reads from `app.json` at runtime, survives project ID changes |

---

## Common Pitfalls

### Pitfall 1: Calling useToastStore hook outside React tree
**What goes wrong:** `useToastStore()` (hook form) can only be called inside a React component. The auth enrichment IIFE in `_layout.tsx` runs in a callback, not a component render.
**How to avoid:** Use `useToastStore.getState().showToast(...)` (store API, not hook) for imperative calls outside components. This is already done elsewhere in the codebase (e.g., `app/(tabs)/profile/index.tsx` line 127).
**Warning signs:** "Invalid hook call" error at runtime.

### Pitfall 2: Throwing in config.ts breaks the import chain in tests / storybook
**What goes wrong:** If `constants/config.ts` throws at import time when env vars are absent, any test file that imports it (directly or transitively) will fail unless `.env.test` is present.
**How to avoid:** This project has no test suite (v2 requirements deferred), so this is not a concern. Document in the throw message that the dev server must be restarted after adding `.env`.
**Warning signs:** Build-time errors in CI pipelines.

### Pitfall 3: getExpoPushTokenAsync() without projectId returns undefined token in production builds
**What goes wrong:** In Expo Go, the projectId is inferred from the manifest. In a standalone/EAS build, it must be explicit. Without it, `token` is either empty or throws at runtime, silently breaking push on all physical device builds.
**How to avoid:** Always pass `projectId` from `Constants.expoConfig?.extra?.eas?.projectId`. The value is already in `app.json`.
**Warning signs:** Push notifications work in Expo Go but not on TestFlight/Play Store builds.

### Pitfall 4: Confusing auth subscription cleanup with Realtime channel cleanup
**What goes wrong:** `supabase.auth.onAuthStateChange()` returns `{ data: { subscription } }`. The cleanup is `subscription.unsubscribe()`. This is not a Realtime channel — calling `supabase.removeChannel()` on it would fail silently.
**How to avoid:** Use the right cleanup API for the right subscription type. Both are already correct in the codebase.

---

## Code Examples

### Accessing toast store imperatively (outside React component)
```typescript
// Source: existing usage in app/(tabs)/profile/index.tsx line 127
import { useToastStore } from '@/lib/toast';

// In a callback, not a component:
useToastStore.getState().showToast('Profile sync failed. Some data may be outdated.', 'error');
```

### Sentry error capture
```typescript
// Source: lib/sentry.ts — already initialized in Phase 1
import * as Sentry from '@sentry/react-native';

Sentry.captureException(err); // err can be unknown; Sentry handles it
```

### Reading projectId from app config
```typescript
// Source: Expo documentation pattern for SDK 51+
import Constants from 'expo-constants';

const projectId =
  Constants.expoConfig?.extra?.eas?.projectId ??
  Constants.easConfig?.projectId;
```

### requireEnv helper (to be added to constants/config.ts)
```typescript
function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(
      `[Dwella] Missing required environment variable: ${key}\n` +
      `Add it to your .env file and restart the dev server.`
    );
  }
  return value;
}
```

---

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|------------------|--------|
| `getExpoPushTokenAsync()` (no args) | `getExpoPushTokenAsync({ projectId })` required in SDK 51+ standalone builds | Silent push failure in production builds if projectId omitted |
| `supabase.channel().subscribe()` + manual `unsubscribe()` | `supabase.removeChannel(channel)` handles both unsubscribe + registry removal | Channel accumulation prevented correctly |

---

## Open Questions

1. **Expired push token cleanup strategy**
   - What we know: Expo Push API returns `DeviceNotRegistered` for stale tokens in the batch response from `send-push`
   - What's unclear: Current `send-push` returns the raw Expo API response without inspecting per-message errors
   - Recommendation: For Phase 4 scope (audit only), log expired token errors as a console warning inside `send-push` if the response body contains `DeviceNotRegistered` ticket status. Full automatic DB cleanup is a v2 enhancement.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | None — `QUAL-01` (unit test suite) is deferred to v2 |
| Config file | none |
| Quick run command | `npx tsc --noEmit` (type check as proxy for correctness) |
| Full suite command | `npx tsc --noEmit` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CLIENT-01 | Auth error toast visible on profile sync failure | manual-only | n/a — no test suite; verify visually in Expo Go | N/A |
| CLIENT-02 | Missing env var throws at startup with clear message | manual-only | Temporarily remove `EXPO_PUBLIC_SUPABASE_URL` from `.env`, restart dev server, verify throw message in console | N/A |
| CLIENT-03 | All subscription cleanups present | static analysis | `npx tsc --noEmit` + code review of audit table | N/A |
| CLIENT-04 | Push token registered and stored; DB write error handled | manual-only | Physical device test post-deploy | N/A |

**Manual-only justification:** No test framework exists (deferred to v2). All four requirements are small targeted code changes verifiable by inspection and manual testing.

### Sampling Rate
- **Per task commit:** `npx tsc --noEmit`
- **Per wave merge:** `npx tsc --noEmit`
- **Phase gate:** TypeScript clean + manual verification checklist in VERIFY.md

### Wave 0 Gaps
None — no test infrastructure to create. Verification is manual + TypeScript type check.

---

## Sources

### Primary (HIGH confidence)
- Direct code audit of `app/_layout.tsx`, `constants/config.ts`, `lib/notifications.ts`, `hooks/useProperties.ts`, `hooks/useTenants.ts`, `hooks/usePayments.ts`, `hooks/useNotifications.ts`, `hooks/useDashboard.ts`, `hooks/useBotConversations.ts`, `hooks/useAllExpenses.ts`, `hooks/useExpenses.ts`, `hooks/useAiNudge.ts`, `app/(tabs)/profile/index.tsx`, `supabase/functions/send-push/index.ts`
- `app.json` — confirmed `extra.eas.projectId = "3bc7de51-47e7-4c4e-92e3-e6e1a40ae71b"`
- `lib/toast.ts` + `components/ToastProvider.tsx` — confirmed `useToastStore.getState().showToast()` imperative API

### Secondary (MEDIUM confidence)
- Expo SDK 51 `getExpoPushTokenAsync` projectId requirement — confirmed by Expo documentation pattern; the SDK change requiring explicit projectId in standalone builds is well-established

### Tertiary (LOW confidence)
- None

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — direct code audit, no guesswork
- Architecture: HIGH — all patterns confirmed from existing codebase + direct file inspection
- Pitfalls: HIGH — all identified from actual code defects found in audit

**Research date:** 2026-03-19
**Valid until:** 2026-04-18 (stable domain, 30 day window)
