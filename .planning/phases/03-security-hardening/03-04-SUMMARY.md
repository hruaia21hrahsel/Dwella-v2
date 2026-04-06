---
phase: 03-security-hardening
plan: 04
status: checkpoint-pending
subsystem: observability
tags: [sentry, error-tracking, edge-functions, mobile-app]
dependency_graph:
  requires: [03-03]
  provides: [sentry-mobile, sentry-edge-functions]
  affects: [app/_layout.tsx, constants/config.ts, supabase/functions/_shared/sentry.ts]
tech_stack:
  added: ["@sentry/react-native (JS-only)", "Sentry Deno SDK (deno.land/x/sentry)"]
  patterns: [try-catch-finally-flush, enableNative-false, env-var-dsn]
key_files:
  created:
    - supabase/functions/_shared/sentry.ts
  modified:
    - app/_layout.tsx
    - constants/config.ts
    - package.json
    - supabase/functions/telegram-webhook/index.ts
    - supabase/functions/invite-redirect/index.ts
    - supabase/functions/process-bot-message/index.ts
decisions:
  - "Used enableNative: false for Sentry React Native SDK to avoid PAC/Hermes crash"
  - "Wrapped edge function handlers with try/catch/finally pattern for Sentry flush"
  - "Removed auto-added @sentry/react-native/expo plugin from app.json"
metrics:
  tasks_completed: 2
  tasks_total: 3
  completed_date: null
---

# Phase 3 Plan 4: Sentry Observability Restoration Summary

**Status: CHECKPOINT PENDING (Task 3: human-verify)**

Sentry JS-only SDK integrated into mobile app and shared Sentry Deno utility created for all 3 edge functions. Awaiting user verification of Sentry project setup, DSN configuration, and error capture confirmation.

## Completed Tasks

### Task 1: Install Sentry SDK and configure mobile app integration
**Commit:** d52090f

- Installed `@sentry/react-native` via `npx expo install` (SDK 54 compatible version)
- Added `SENTRY_DSN` export to `constants/config.ts` sourced from `EXPO_PUBLIC_SENTRY_DSN` env var
- Added `Sentry.init()` to `app/_layout.tsx` with `enableNative: false` to avoid native iOS plugin crash
- Wrapped `RootLayout` with `Sentry.wrap()` for error boundary
- Guarded init with `if (SENTRY_DSN)` so app works without DSN configured
- Removed auto-added `@sentry/react-native/expo` plugin from `app.json` (critical - native plugin causes crash)

### Task 2: Create shared Sentry utility and integrate into all edge functions
**Commit:** f2db767

- Created `supabase/functions/_shared/sentry.ts` with `initSentry`, `flushSentry`, `captureException`, `captureMessage` exports
- Uses Deno Sentry SDK from `https://deno.land/x/sentry/index.mjs`
- Configured with `defaultIntegrations: false` to prevent data sharing between requests
- Integrated into all 3 edge functions using try/catch/finally wrapper pattern
- `telegram-webhook`: initSentry at handler top, flushSentry on early returns (401, 429) + finally block
- `invite-redirect`: initSentry at handler top, try/catch/finally wrapper
- `process-bot-message`: initSentry at handler top, captureException in existing catch, flushSentry on early returns (OPTIONS, 403, 429) + finally block

### Task 3: Verify Sentry integration (CHECKPOINT - PENDING)
User must:
1. Verify app launches without crashing
2. Create Sentry project and configure DSN
3. Verify test error appears in Sentry dashboard
4. Configure email alerts
5. Register Telegram webhook secret

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Removed auto-added Sentry Expo plugin from app.json**
- **Found during:** Task 1
- **Issue:** `npx expo install @sentry/react-native` automatically added `@sentry/react-native` to the plugins array in app.json, which would load the native Sentry module and cause the PAC/Hermes crash
- **Fix:** Removed the plugin entry from app.json
- **Files modified:** app.json

**2. [Rule 3 - Blocking] Prior wave files on disk differed from base commit**
- **Found during:** Task 1
- **Issue:** Initial git reset --soft left prior wave deletions staged alongside Task 1 changes
- **Fix:** Unstaged prior wave files and recommitted with only Task 1 changes
- **Files modified:** (git staging only)

## Known Stubs

None - no stubs introduced by this plan.

## Self-Check: PENDING

Self-check deferred until plan completion (checkpoint pending).
