---
phase: 04-client-code-ux
verified: 2026-03-19T15:30:00Z
status: human_needed
score: 5/5 must-haves verified
human_verification:
  - test: "Kill app with EXPO_PUBLIC_SUPABASE_URL unset and observe startup behavior"
    expected: "App crashes at startup with '[Dwella] Missing required environment variable: EXPO_PUBLIC_SUPABASE_URL' before any UI renders"
    why_human: "requireEnv throws at module evaluation time — verifiable by grep, but actual crash-at-boot behavior on a physical device cannot be confirmed programmatically"
  - test: "Trigger an auth enrichment failure (e.g., cut network after sign-in) and observe UI"
    expected: "Red error toast appears reading 'Profile sync failed. Some data may be outdated.' — no retry button"
    why_human: "Toast rendering requires a physical device/simulator with ToastProvider mounted in the React tree; cannot be confirmed with grep alone"
  - test: "Install a production (EAS) build on a physical iOS or Android device and sign in"
    expected: "Push notification is delivered to the device (token registered from EAS projectId, not Expo Go fallback)"
    why_human: "Push token delivery to a physical device from a standalone EAS build requires device-level testing; cannot be verified statically"
---

# Phase 04: Client Code + UX Verification Report

**Phase Goal:** The client layer is observable and resilient — hooks clean up Realtime subscriptions, auth failures are visible to the user, the app refuses to start without required environment variables, and push notifications deliver to a physical device
**Verified:** 2026-03-19T15:30:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| #  | Truth                                                                                                           | Status     | Evidence                                                                                      |
|----|-----------------------------------------------------------------------------------------------------------------|------------|-----------------------------------------------------------------------------------------------|
| 1  | Auth sync failure shows a user-visible error toast instead of silently swallowing the exception                 | VERIFIED   | `app/_layout.tsx` line 162: `showToast('Profile sync failed. Some data may be outdated.', 'error')` + `Sentry.captureException(err)` at line 163 |
| 2  | Starting the app without EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY throws at import time        | VERIFIED   | `constants/config.ts` lines 6-15: `requireEnv` throws `[Dwella] Missing required environment variable:` before Supabase client init |
| 3  | Missing optional env vars log console warnings but do not crash                                                 | VERIFIED   | `constants/config.ts` lines 22-35: `?? ''` fallback + `console.warn` for SENTRY_DSN, TELEGRAM_BOT_USERNAME, WHATSAPP_BOT_PHONE |
| 4  | All 10 Realtime subscription targets call the correct cleanup API in useEffect return                           | VERIFIED   | All 8 hooks: `supabase.removeChannel(channel)` confirmed; `app/(tabs)/profile/index.tsx` line 335: `removeChannel`; `app/_layout.tsx` line 174: `subscription.unsubscribe()` |
| 5  | Push token registration passes projectId to getExpoPushTokenAsync for standalone builds + DB errors are caught  | VERIFIED   | `lib/notifications.ts` lines 28-30: dual-path `Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId`; line 38: `getExpoPushTokenAsync({ projectId })`; lines 41-48: `{ error: updateError }` + `console.warn` |

**Score:** 5/5 truths verified (automated)

### Required Artifacts

| Artifact                            | Expected                                          | Status     | Details                                                                 |
|-------------------------------------|---------------------------------------------------|------------|-------------------------------------------------------------------------|
| `constants/config.ts`               | requireEnv helper + fail-fast + optional warnings | VERIFIED   | `function requireEnv(key: string): string` present; 2 requireEnv calls; 3 console.warn for optional vars |
| `app/_layout.tsx`                   | Auth error toast + Sentry capture                 | VERIFIED   | Lines 19-21: imports present; lines 160-164: `catch (err: unknown)` with toast + Sentry |
| `lib/notifications.ts`              | projectId + DB error handling                     | VERIFIED   | 49 lines; all required patterns present; no old `getExpoPushTokenAsync()` without projectId |
| `hooks/useProperties.ts`            | removeChannel cleanup                             | VERIFIED   | Line 77: `return () => { supabase.removeChannel(channel); }` |
| `hooks/useTenants.ts`               | removeChannel cleanup                             | VERIFIED   | Lines 63-65: `return () => { supabase.removeChannel(channel); }` |
| `hooks/usePayments.ts`              | removeChannel cleanup                             | VERIFIED   | Line 64: `return () => { supabase.removeChannel(channel); }` |
| `hooks/useNotifications.ts`         | removeChannel cleanup                             | VERIFIED   | Line 52: `return () => { supabase.removeChannel(sub); }` |
| `hooks/useDashboard.ts`             | removeChannel cleanup                             | VERIFIED   | Lines 208-210: `return () => { supabase.removeChannel(channel); }` |
| `hooks/useBotConversations.ts`      | removeChannel cleanup                             | VERIFIED   | Line 51: `return () => { supabase.removeChannel(sub); }` |
| `hooks/useAllExpenses.ts`           | removeChannel cleanup                             | VERIFIED   | Line 60: `return () => { supabase.removeChannel(channel); }` |
| `hooks/useExpenses.ts`              | removeChannel cleanup                             | VERIFIED   | Line 63: `return () => { supabase.removeChannel(channel); }` |

### Key Link Verification

| From                    | To                    | Via                                          | Status     | Details                                                                          |
|-------------------------|-----------------------|----------------------------------------------|------------|----------------------------------------------------------------------------------|
| `app/_layout.tsx`       | `lib/toast.ts`        | `useToastStore.getState().showToast()`        | WIRED      | Import at line 21; imperative call at line 162 with correct signature `(string, type)` |
| `app/_layout.tsx`       | `lib/sentry.ts`       | `Sentry.captureException()`                  | WIRED      | `import * as Sentry` at line 20; call at line 163 inside catch block            |
| `constants/config.ts`   | `lib/supabase.ts`     | requireEnv throws before Supabase client init | WIRED      | `lib/supabase.ts` line 4 imports `SUPABASE_URL`/`SUPABASE_ANON_KEY` from config; requireEnv fires at module evaluation before `createClient` on line 24 |
| `lib/notifications.ts`  | `expo-constants`      | `Constants.expoConfig?.extra?.eas?.projectId` | WIRED      | `import Constants from 'expo-constants'` line 3; dual-path lookup lines 29-30; `app.json` confirms `extra.eas.projectId: "3bc7de51-47e7-4c4e-92e3-e6e1a40ae71b"` |
| `lib/notifications.ts`  | `supabase`            | push_token update with error check           | WIRED      | Lines 41-48: `{ error: updateError }` destructured; `console.warn` on failure   |

### Requirements Coverage

| Requirement | Source Plan | Description                                                          | Status    | Evidence                                                        |
|-------------|-------------|----------------------------------------------------------------------|-----------|-----------------------------------------------------------------|
| CLIENT-01   | 04-01-PLAN  | Auth sync failure shows user-facing error/toast instead of silent fallback | SATISFIED | `app/_layout.tsx` line 162: exact UI-SPEC toast copy present    |
| CLIENT-02   | 04-01-PLAN  | Missing critical environment variables throw error on app startup    | SATISFIED | `constants/config.ts`: `requireEnv` throws before Supabase init |
| CLIENT-03   | 04-02-PLAN  | Realtime subscription cleanup verified (no memory leaks)             | SATISFIED | All 9 channel targets use `removeChannel`; auth listener uses `unsubscribe()` |
| CLIENT-04   | 04-02-PLAN  | Push notification flow verified end-to-end (token registration)      | PARTIALLY SATISFIED | Code path is correct (projectId passed, errors caught); device delivery requires human test |

### Anti-Patterns Found

| File               | Line | Pattern                                                            | Severity | Impact                                                                                          |
|--------------------|------|---------------------------------------------------------------------|----------|-------------------------------------------------------------------------------------------------|
| `lib/supabase.ts`  | 6-11 | `console.error` guard + `|| 'placeholder'` fallback on line 24     | Info     | Dead code — `requireEnv` in config.ts will throw before this code could ever be reached with missing vars. The guard and fallback strings are harmless but misleading about the actual behavior. |

**Note on `lib/supabase.ts` dead code:** The `if (!SUPABASE_URL || !SUPABASE_ANON_KEY)` check and `|| 'https://placeholder.supabase.co'` / `|| 'placeholder'` fallbacks on line 24 were written before `requireEnv` was added. Since `config.ts` now throws at module evaluation when either var is absent, `SUPABASE_URL` and `SUPABASE_ANON_KEY` can never be falsy by the time `supabase.ts` runs. This is not a functional gap — the fail-fast behavior is correct — but the dead fallback code is confusing.

### Human Verification Required

#### 1. Startup Crash on Missing Env Var

**Test:** Remove `EXPO_PUBLIC_SUPABASE_URL` from `.env`, start the dev server with `npx expo start`, and launch the app.
**Expected:** App crashes immediately on startup (before any screen renders) with a clear error: `[Dwella] Missing required environment variable: EXPO_PUBLIC_SUPABASE_URL — Add it to your .env file and restart the dev server.`
**Why human:** The `requireEnv` throw happens at module evaluation time — this is statically verifiable by grep, but the actual crash-at-startup behavior (before React tree mounts) needs a live device or simulator to confirm it surfaces correctly rather than being caught by Expo's error boundary.

#### 2. Auth Enrichment Error Toast

**Test:** Sign in on a device/simulator, then simulate a network interruption or manually throw in the enrichment IIFE, and observe the UI.
**Expected:** A red error toast appears with the text "Profile sync failed. Some data may be outdated." — no retry button, dismissible by tap. App continues to function normally.
**Why human:** Toast rendering requires `ToastProvider` to be mounted in the React tree at the time the error fires. While both the toast call and ToastProvider presence are verified by grep, the visual appearance and timing of the toast cannot be confirmed statically.

#### 3. Push Notification Delivery on Physical Device (EAS Build)

**Test:** Build a standalone EAS development build (`eas build --profile development`) and install it on a physical iOS or Android device. Sign in and observe device logs.
**Expected:** No `[Dwella] Expo projectId not found` warning in logs; push token is successfully written to the `users` table; a test notification sent via Expo Push API is received on the device.
**Why human:** Push token delivery to a physical device from a standalone build is the core of CLIENT-04. The code path is correct but the end-to-end flow (EAS projectId resolution, APNS/FCM delivery) can only be confirmed on hardware. Expo Go does not use the EAS projectId path.

### Gaps Summary

No blocking gaps found. All five observable truths are satisfied by actual code. The three human verification items are runtime/device behaviors that cannot be confirmed statically:

- CLIENT-01 (toast) and CLIENT-02 (fail-fast) are fully implemented and wired — human tests confirm rendering/runtime behavior only.
- CLIENT-03 (subscription cleanup) is 100% verified — all 10 targets confirmed with correct APIs in useEffect return positions.
- CLIENT-04 (push notifications) is fully implemented for standalone builds — the human test confirms actual device delivery.

One non-blocking observation: `lib/supabase.ts` retains dead fallback code (`|| 'placeholder'`) that is now unreachable after the `requireEnv` addition. Not a gap — does not affect behavior — but worth cleaning up in a future pass.

---

_Verified: 2026-03-19T15:30:00Z_
_Verifier: Claude (gsd-verifier)_
