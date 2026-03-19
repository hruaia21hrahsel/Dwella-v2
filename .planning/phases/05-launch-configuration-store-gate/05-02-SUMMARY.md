---
phase: 05-launch-configuration-store-gate
plan: 02
subsystem: infra
tags: [expo-updates, ota, fingerprint, runtime-version, eas, expo]

# Dependency graph
requires:
  - phase: 05-launch-configuration-store-gate
    provides: UI-SPEC and research for UpdateGate design and fingerprint policy
provides:
  - Fingerprint runtimeVersion policy in app.json replacing appVersion
  - UpdateGate component for OTA lifecycle management and forced-update screen
  - app/_layout.tsx wired with UpdateGate wrapping InnerLayout
affects:
  - EAS build pipeline (first production build generates new fingerprint hash)
  - Future OTA update delivery (incompatible updates trigger store redirect screen)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Two-component pattern for conditional React hook calls (UpdateGate/UpdateGateInner split avoids conditional hook violation while preserving isEnabled guard)
    - UpdateGate wraps app root inside ThemeProvider for theme access but outside InnerLayout for blocking capability

key-files:
  created:
    - components/UpdateGate.tsx
  modified:
    - app.json
    - app/_layout.tsx

key-decisions:
  - "Two-component UpdateGate/UpdateGateInner pattern: outer component guards with Updates.isEnabled, inner component calls useUpdates() unconditionally — avoids React conditional hook violation while satisfying dev no-op requirement"
  - "UpdateGate placed inside ThemeProvider but wrapping InnerLayout: requires useTheme() access for styling the forced-update screen; must wrap InnerLayout to be blocking"
  - "iOS App Store URL uses [APP_ID] placeholder: real App Store ID not yet assigned; pre-launch checklist item"
  - "EAS production profile validated via npx eas config — confirms fingerprint policy resolves correctly"

patterns-established:
  - "Pattern: Two-component hook guard — outer component returns early when feature flag is false/disabled, inner component calls hook unconditionally"

requirements-completed: [LAUNCH-03, LAUNCH-04]

# Metrics
duration: 15min
completed: 2026-03-19
---

# Phase 05 Plan 02: OTA Fingerprint Policy and Forced-Update Gate Summary

**Fingerprint runtimeVersion policy replacing appVersion in app.json, UpdateGate component with silent OTA apply and store-redirect forced-update screen wired into app root**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-03-19T17:00:00Z
- **Completed:** 2026-03-19T17:15:00Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Switched `app.json` runtimeVersion from `appVersion` to `fingerprint` policy — content-addressed native dependency hash prevents OTA crashes on native dep changes
- Created `components/UpdateGate.tsx`: no-ops in dev/Expo Go (via `Updates.isEnabled` guard), silently applies compatible OTA updates, shows blocking forced-update screen with App Store/Play Store redirect on fingerprint mismatch
- Wired UpdateGate into `app/_layout.tsx` wrapping InnerLayout; removed legacy `checkForUpdateAsync` useEffect from AuthGuard and cleaned up unused expo-updates import
- Validated EAS production profile with `npx eas config` — fingerprint policy resolves correctly

## Task Commits

Each task was committed atomically:

1. **Task 1: Fingerprint policy in app.json + UpdateGate component** - `a4e1956` (feat)
2. **Task 2: Wire UpdateGate into app root + remove old OTA logic + validate EAS config** - `7530232` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified
- `app.json` - runtimeVersion policy changed from appVersion to fingerprint
- `components/UpdateGate.tsx` - OTA update gate: dev no-op guard, silent apply, forced-update screen with store redirect
- `app/_layout.tsx` - Added UpdateGate import, wrapped InnerLayout, removed legacy OTA useEffect and expo-updates import

## Decisions Made
- **Two-component UpdateGate pattern:** The plan warned that placing `useUpdates()` after an `if (!Updates.isEnabled) return` guard violates React's Rules of Hooks. Used the two-component pattern (outer `UpdateGate` guards, inner `UpdateGateInner` calls hook unconditionally) — compiles cleanly with `npx tsc --noEmit`.
- **iOS URL placeholder:** App Store ID not yet assigned; used `[APP_ID]` placeholder matching the pre-launch checklist item already in MEMORY.md. Android URL uses the real package name `com.dwella.app`.
- **EAS validation method:** Per RESEARCH.md Pitfall 1, `eas build --dry-run` does not exist. Used `npx eas config --platform ios/android --profile production` to validate config — confirmed fingerprint policy resolves correctly in both platform configs.

## Deviations from Plan

None - plan executed exactly as written. The two-component hook pattern was pre-planned in the task action section as the preferred approach.

## Issues Encountered
None.

## User Setup Required
**Pre-launch action required:** iOS App Store URL in `components/UpdateGate.tsx` contains `[APP_ID]` placeholder. Replace with real App Store ID once the App Store listing is created in App Store Connect:
```typescript
ios: 'https://apps.apple.com/app/dwella/id[APP_ID]',  // Replace [APP_ID] with real numeric ID
```
Then re-deploy (this is a JS change, an OTA update is sufficient after the initial fingerprint build).

## Next Phase Readiness
- OTA fingerprint policy and UpdateGate are complete — ready for first EAS production build submission
- Phase 5 Plan 02 complete; all requirements (LAUNCH-03, LAUNCH-04) satisfied
- Remaining phase work: LAUNCH-01 (privacy checklist) and LAUNCH-02 (AI disclosure modal) are in separate plans

---
*Phase: 05-launch-configuration-store-gate*
*Completed: 2026-03-19*
