---
phase: 04-client-code-ux
plan: "01"
subsystem: client-error-handling
tags: [error-handling, env-validation, sentry, toast, fail-fast]
dependency_graph:
  requires: []
  provides: [env-fail-fast, auth-error-surfacing]
  affects: [app/_layout.tsx, constants/config.ts]
tech_stack:
  added: []
  patterns: [requireEnv fail-fast, useToastStore.getState() imperative call, catch err unknown]
key_files:
  created: []
  modified:
    - app/_layout.tsx
    - constants/config.ts
decisions:
  - "requireEnv() throws at module evaluation time (top-level export) — fires before Supabase client init"
  - "useToastStore.getState().showToast() used imperatively inside async IIFE (not a React render)"
  - "OTA update catch {} block retained as intentional silent-fail (best-effort check)"
metrics:
  duration: 4
  completed_date: "2026-03-19T14:49:40Z"
  tasks_completed: 2
  files_modified: 2
---

# Phase 04 Plan 01: Auth Error Surfacing + Env Fail-Fast Summary

**One-liner:** Auth enrichment errors now show a user-visible error toast + Sentry capture; missing Supabase env vars throw at import time with a clear developer message.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Add auth error toast and Sentry capture in _layout.tsx | 39e1732 | app/_layout.tsx |
| 2 | Add requireEnv fail-fast and optional var warnings in config.ts | ae6e418 | constants/config.ts |

## What Was Built

### Task 1 — Auth enrichment error surfacing

In `app/_layout.tsx`, the empty `catch {}` block inside the background enrichment IIFE (inside `onAuthStateChange`) was replaced with a typed catch that:
- Shows `'Profile sync failed. Some data may be outdated.'` error toast via `useToastStore.getState().showToast()` (imperative store API — correct for async callback context)
- Captures the exception to Sentry via `Sentry.captureException(err)`
- Uses `catch (err: unknown)` with `instanceof Error` guard per the project's established pattern

Both `import * as Sentry from '@sentry/react-native'` and `import { useToastStore } from '@/lib/toast'` were added to the file's import section.

### Task 2 — requireEnv fail-fast validation

`constants/config.ts` was replaced with a version that:
- Defines `function requireEnv(key: string): string` — throws `[Dwella] Missing required environment variable: {KEY}\nAdd it to your .env file and restart the dev server.` at module evaluation time
- `SUPABASE_URL` and `SUPABASE_ANON_KEY` use `requireEnv()` — crash at startup if absent
- `SENTRY_DSN`, `TELEGRAM_BOT_USERNAME`, `WHATSAPP_BOT_PHONE` retain `?? ''` pattern but each emit a `console.warn` when unset
- All non-env constants (`STORAGE_BUCKET`, `BOT_MODEL`, `AUTO_CONFIRM_HOURS`, `REMINDER_DAYS_BEFORE`, `REMINDER_DAYS_AFTER`) preserved unchanged

## Verification

- `npx tsc --noEmit` exits 0 (verified after each task)
- `grep -n "showToast.*Profile sync failed" app/_layout.tsx` matches line 162
- `grep -n "requireEnv" constants/config.ts` returns 3 matches (function def + 2 calls)
- `grep -n "catch {" app/_layout.tsx` only matches line 84 (OTA update silent-fail — intentional)

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED

- app/_layout.tsx — modified, committed at 39e1732
- constants/config.ts — modified, committed at ae6e418
- Both commits verified in git log
