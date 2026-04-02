---
phase: 18-apple-app-store-beta-testing-prep
plan: "01"
subsystem: config
tags: [eas, app-store, testflight, ios, provisioning]
dependency_graph:
  requires: []
  provides: [eas-submit-profile, ios-capabilities, posthog-env, privacy-manifests]
  affects: [eas-build, testflight-submission, app-store-connect]
tech_stack:
  added: []
  patterns: [eas-submit-non-interactive, apple-sign-in-entitlement, privacy-manifest-api]
key_files:
  created: []
  modified:
    - app.json
    - eas.json
    - components/UpdateGate.tsx
decisions:
  - "ascAppId hardcoded in eas.json submit.production.ios — enables non-interactive eas submit"
  - "appleTeamId 35G5HXD9K9 added to app.json ios — prevents interactive EAS Build prompts"
  - "privacyManifests added with NSPrivacyAccessedAPICategoryUserDefaults/CA92.1 — required by App Store review"
metrics:
  duration: "3 minutes"
  completed_date: "2026-04-02T14:08:16Z"
  tasks_completed: 2
  tasks_total: 2
  files_changed: 3
---

# Phase 18 Plan 01: EAS Build Config and TestFlight Submission Readiness Summary

All seven EAS configuration gaps closed — app.json and eas.json now fully configured for a clean EAS production build and non-interactive TestFlight submission.

## What Was Built

Config-only changes across three files to satisfy EAS-01 through EAS-07:

- **EAS-01:** Added `submit.production.ios.ascAppId: "6760478576"` to eas.json so `eas submit` runs without prompts
- **EAS-02:** Added `EXPO_PUBLIC_POSTHOG_API_KEY` and `EXPO_PUBLIC_POSTHOG_HOST` to `build.production.env` in eas.json so PostHog analytics works in TestFlight builds
- **EAS-03:** Added `usesAppleSignIn: true` to app.json ios section so EAS Build syncs the Apple Sign In entitlement
- **EAS-04:** Added `appleTeamId: "35G5HXD9K9"` to app.json ios section so EAS Build does not prompt interactively for the team
- **EAS-05:** Changed `splash.backgroundColor` from teal `#009688` to brand indigo `#4F46E5`
- **EAS-06:** Replaced `[APP_ID]` placeholder in `components/UpdateGate.tsx` line 8 with real numeric ID `6760478576`
- **EAS-07:** Added `privacyManifests` with `NSPrivacyAccessedAPICategoryUserDefaults` reason code `CA92.1` to app.json ios section — required for App Store review when any SDK accesses UserDefaults

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Update app.json and eas.json with all required config | f7ab2e9 | app.json, eas.json |
| 2 | Replace [APP_ID] placeholder in UpdateGate.tsx | 939ad95 | components/UpdateGate.tsx |

## Verification

All automated checks passed:

```
All config checks passed   (node assertion script — EAS-01 through EAS-05, EAS-07)
0                          (grep [APP_ID] — EAS-06)
```

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — all config values are real, hardcoded production values.

## Self-Check: PASSED

- app.json modified — FOUND (verified via node require)
- eas.json modified — FOUND (verified via node require)
- components/UpdateGate.tsx modified — FOUND (grep confirms id6760478576 present, [APP_ID] absent)
- Commit f7ab2e9 — FOUND
- Commit 939ad95 — FOUND
