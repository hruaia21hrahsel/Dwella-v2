---
phase: 01-compilation-tooling-baseline
plan: 02
subsystem: infra
tags: [eslint, typescript-eslint, sentry, crash-monitoring, linting, security]

# Dependency graph
requires:
  - phase: 01-compilation-tooling-baseline
    provides: TypeScript baseline with no as any casts (01-01)
provides:
  - ESLint flat config with TypeScript + security rules enforcing no-explicit-any as error
  - Sentry crash monitoring SDK initialized on app startup with crash-only config
  - npm run lint command wired to ESLint
  - EXPO_PUBLIC_SENTRY_DSN env var pattern established
affects:
  - All future phases writing TypeScript (ESLint will catch regressions)
  - Phase 3+ production builds (Sentry captures unhandled errors)

# Tech tracking
tech-stack:
  added:
    - eslint (v10 flat config format)
    - "@typescript-eslint/eslint-plugin"
    - "@typescript-eslint/parser"
    - eslint-plugin-security
    - "@sentry/react-native"
  patterns:
    - ESLint flat config (eslint.config.js) with per-directory file globs
    - Sentry crash-only init (tracesSampleRate 0, no performance monitoring)
    - initSentry() no-op guard when DSN not set (safe for local dev)

key-files:
  created:
    - eslint.config.js
    - lib/sentry.ts
  modified:
    - package.json (lint script + ESLint/Sentry deps)
    - constants/config.ts (SENTRY_DSN export)
    - app/_layout.tsx (initSentry call before SplashScreen)
    - .env.example (EXPO_PUBLIC_SENTRY_DSN template)

key-decisions:
  - "ESLint no-explicit-any set to error severity — blocks new as any introductions, warns on existing violations"
  - "Sentry configured crash-only (tracesSampleRate: 0) — no performance monitoring overhead"
  - "initSentry() gracefully no-ops when DSN absent — local dev works without Sentry account"

patterns-established:
  - "Sentry pattern: init at module level in _layout.tsx before SplashScreen, guarded by DSN presence check"
  - "ESLint flat config: explicit file globs per directory, TS parser with project reference"

requirements-completed: [TS-03, EDGE-04]

# Metrics
duration: ~45min
completed: 2026-03-18
---

# Phase 01 Plan 02: ESLint + Sentry Integration Summary

**ESLint flat config enforcing no-explicit-any as error plus Sentry crash-only SDK initialized at app startup via EXPO_PUBLIC_SENTRY_DSN env var**

## Performance

- **Duration:** ~45 min
- **Started:** 2026-03-18
- **Completed:** 2026-03-18
- **Tasks:** 3 (2 auto + 1 human-verify)
- **Files modified:** 6

## Accomplishments

- ESLint configured with TypeScript strict rules and security plugin — `npm run lint` now catches `as any` regressions at error severity
- Sentry React Native SDK integrated with crash-only config — no performance monitoring overhead, gracefully no-ops in local dev
- `EXPO_PUBLIC_SENTRY_DSN` env var pattern documented in `.env.example` with setup instructions

## Task Commits

Each task was committed atomically:

1. **Task 1: Install dependencies, configure ESLint, add lint script** - `d7c4c97` (chore)
2. **Task 2: Create Sentry init module and wire into app startup** - `15ed5cc` (feat)
3. **Task 3: Verify ESLint and Sentry integration** - checkpoint:human-verify (approved by user — no code commit)

**Plan metadata:** (docs commit — created with state updates)

## Files Created/Modified

- `eslint.config.js` - ESLint 10 flat config: TypeScript parser, security plugin, no-explicit-any as error, unsafe-* as warn
- `lib/sentry.ts` - Sentry init module: crash-only config, DSN guard, exports initSentry()
- `package.json` - Added `"lint": "eslint ."` script, ESLint devDeps, @sentry/react-native dep
- `constants/config.ts` - Added `SENTRY_DSN` export reading EXPO_PUBLIC_SENTRY_DSN
- `app/_layout.tsx` - Imported and called initSentry() before SplashScreen.preventAutoHideAsync()
- `.env.example` - Added EXPO_PUBLIC_SENTRY_DSN template with Sentry project setup instructions

## Decisions Made

- ESLint `no-explicit-any` at `error` severity — preserves the work from Plan 01 by blocking new regressions. Existing violations (legacy `unsafe-*` patterns) set to `warn` to not block the repo but surface them for review.
- Sentry configured as crash-only (`tracesSampleRate: 0`, `enableAutoPerformanceTracing: false`, `enableAutoSessionTracking: false`) — captures unhandled errors without adding performance monitoring bundle size or overhead.
- `initSentry()` designed to no-op silently when DSN is absent — any developer can run the app locally without configuring Sentry. Only production builds with a real DSN will report events.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None - both tasks proceeded without issues. TypeScript check passed after Sentry integration.

## User Setup Required

**External service requires manual configuration.**

To enable Sentry crash monitoring in production:

1. Create a Sentry project: sentry.io -> Projects -> Create Project -> React Native
2. Copy the DSN from Project Settings -> Client Keys (DSN)
3. Add to your `.env` file: `EXPO_PUBLIC_SENTRY_DSN=https://...@sentry.io/...`
4. Optionally verify by adding `Sentry.captureException(new Error('test'))` temporarily and checking the Sentry dashboard

The app runs normally without a DSN configured (local development).

## Next Phase Readiness

- ESLint is active and will catch TypeScript regressions in all future phases automatically
- Sentry infrastructure is ready — just needs a DSN in production environment
- Phase 01 tooling baseline is complete: TypeScript strict (Plan 01) + ESLint + Sentry (Plan 02)
- Phase 02 (or next planned phase) can proceed with confidence that quality gates are in place

---
*Phase: 01-compilation-tooling-baseline*
*Completed: 2026-03-18*
