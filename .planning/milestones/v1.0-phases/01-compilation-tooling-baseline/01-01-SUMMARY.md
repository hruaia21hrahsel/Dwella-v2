---
phase: 01-compilation-tooling-baseline
plan: "01"
subsystem: type-safety
tags: [typescript, as-any, supabase, expo-router, edge-functions]
dependency_graph:
  requires: []
  provides: [TS-01, TS-02]
  affects: [lib/supabase.ts, app/_layout.tsx, supabase/functions/send-reminders/index.ts]
tech_stack:
  added: []
  patterns: [SupportedStorage-cast, narrowed-interface-cast, local-typed-interface]
key_files:
  created: []
  modified:
    - lib/supabase.ts
    - app/_layout.tsx
    - supabase/functions/send-reminders/index.ts
decisions:
  - "Use as unknown as SupportedStorage narrowed cast (not as any) for AsyncStorage and localStorage — both satisfy the runtime getItem/setItem/removeItem contract"
  - "Define NotificationData interface inline in the effect callback — scoped to the only call site, avoids polluting module scope"
  - "Cast send-reminders query result at query site using local TenantWithProperty interface — removes need for per-field casts in the loop"
metrics:
  duration: ~15 minutes
  completed: "2026-03-18"
  tasks_completed: 3
  files_modified: 3
---

# Phase 1 Plan 01: TypeScript Compilation Baseline + as any Removal Summary

**One-liner:** Zero-error tsc baseline confirmed; replaced 7 `as any` casts across 3 critical files with SupportedStorage, User, Href, NotificationData, and TenantWithProperty typed alternatives.

## What Was Built

Established the TypeScript compilation baseline (TS-01) and removed all `as any` casts from the three critical-path files identified in the plan (TS-02).

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Fix auth storage as any in supabase.ts | b3f45fd | lib/supabase.ts |
| 2 | Fix fallbackUser and remaining as any in _layout.tsx | 5a8fbe3 | app/_layout.tsx |
| 3 | Fix send-reminders Edge Function as any casts | d0b6c5f | supabase/functions/send-reminders/index.ts |

## Verification Results

- `npx tsc --noEmit` exits 0 before and after all changes (TS-01 baseline confirmed)
- `grep -rn "as any" lib/supabase.ts app/_layout.tsx supabase/functions/send-reminders/index.ts` returns zero matches (TS-02 confirmed)

## Decisions Made

1. **SupportedStorage narrowed cast:** `as unknown as SupportedStorage` is used (not `as any`) for both `window.localStorage` and `AsyncStorage`. Both satisfy the SupportedStorage contract at runtime (getItem/setItem/removeItem returning string | null). The two-step cast goes through `unknown` to make the narrowing explicit and auditable.

2. **NotificationData interface:** Defined inline in the notification listener effect. Scoped to the single call site — avoids polluting the module with a one-off type.

3. **TenantWithProperty cast at query site:** The Supabase JS client cannot infer the joined `properties(name)` shape from the `.select()` string in this Deno Edge Function context (no generated types). Casting at the query site rather than per-field access keeps the loop body clean.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing typing] Fixed remaining as any casts in send-reminders waUsers and users map lambdas**
- **Found during:** Task 3
- **Issue:** The plan called out `as any` on lines 35 and 47 (tenant fields), but lines 100 and 138 also contained `(u: any)` in the waUsers and users map callbacks — same file, same function, same pattern
- **Fix:** Added `UserWithPhone` and `UserWithPushToken` interfaces; replaced `(u: any)` lambdas with typed versions
- **Files modified:** supabase/functions/send-reminders/index.ts
- **Commit:** d0b6c5f (included in Task 3 commit)

## Self-Check: PASSED

All files confirmed present on disk. All task commits confirmed in git history.

| Check | Result |
|-------|--------|
| lib/supabase.ts exists | FOUND |
| app/_layout.tsx exists | FOUND |
| supabase/functions/send-reminders/index.ts exists | FOUND |
| Commit b3f45fd (Task 1) | FOUND |
| Commit 5a8fbe3 (Task 2) | FOUND |
| Commit d0b6c5f (Task 3) | FOUND |
