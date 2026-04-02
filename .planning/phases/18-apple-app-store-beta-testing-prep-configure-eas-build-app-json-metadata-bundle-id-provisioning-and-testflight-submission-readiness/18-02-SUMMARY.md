---
phase: 18-apple-app-store-beta-testing-prep
plan: "02"
subsystem: eas-build
tags: [eas, app-store, testflight, ios, build, submit]
dependency_graph:
  requires: [eas-submit-profile, ios-capabilities, posthog-env, privacy-manifests]
  provides: [testflight-build-23, ipa-artifact]
  affects: [testflight, app-store-connect]
tech_stack:
  added: []
  patterns: [eas-build-non-interactive, eas-auto-submit, testflight-distribution]
key_files:
  created: []
  modified: []
decisions:
  - "EAS free tier queue used — build waited ~30 minutes in queue before starting"
  - "auto-submit via ascAppId 6760478576 worked without interactive prompts — Plan 01 config confirmed correct"
metrics:
  duration: "79 minutes (including ~30 min free tier queue wait + ~15 min build + Apple processing)"
  completed_date: "2026-04-02T15:29:26Z"
  tasks_completed: 1
  tasks_total: 2
  files_changed: 0
---

# Phase 18 Plan 02: EAS Production Build and TestFlight Submission Summary

EAS production iOS build (build number 23) triggered, completed, and auto-submitted to App Store Connect — awaiting human verification on physical TestFlight device.

## What Was Built

Cloud build only — no local file changes. All EAS config fixed in Plan 01 was validated by this build:

- **EAS-08:** `eas build --platform ios --profile production --auto-submit --non-interactive` ran without any interactive prompts
- Build ID: `31bbdc6b-f343-4699-b3a7-3180efe7f92a`
- Build number: 23 (auto-incremented via `autoIncrement: true` in eas.json)
- App version: 1.0.0
- Distribution: store
- `.ipa` artifact: `https://expo.dev/artifacts/eas/79cue76UUEP8St5YzVX9Dy.ipa`
- Submission ID: `4abf5eaf-a974-4def-8f49-6dc4f422ce41`
- Submission URL: `https://appstoreconnect.apple.com/apps/6760478576/testflight/ios`
- Build logs: `https://expo.dev/accounts/hruaia21hrahsel/projects/dwella-v2/builds/31bbdc6b-f343-4699-b3a7-3180efe7f92a`

All credentials resolved automatically (distribution cert expiry 2027-03-12, provisioning profile active). The EAS Expo submit key (`TF8ZF6NDZQ`) was already set up from a prior run.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Trigger EAS production build with auto-submit to TestFlight | (cloud build — no local commit needed) | none |
| 2 | Verify TestFlight build launches to login screen | CHECKPOINT — awaiting human verification | — |

## Verification

EAS-08 acceptance criteria:

- `eas build:list --platform ios --limit 1` shows status `finished`, profile `production` — PASSED
- Build was submitted to App Store Connect — PASSED (`Submitted your app to Apple App Store Connect!`)
- No `ITMS-91053` or other rejection errors — PASSED (clean submission output)

EAS-09: Human verification on physical TestFlight device — PENDING CHECKPOINT

## Deviations from Plan

### Notes

**1. [Free tier queue] Build queued for ~30 minutes before starting**
- Found during: Task 1 monitoring
- Issue: EAS free tier has significant queue wait times
- Impact: Total wall time was ~79 min vs the expected 10-15 min plan estimate
- No fix needed — this is expected free tier behavior

## Known Stubs

None.

## Self-Check: PASSED

- Build ID 31bbdc6b confirmed `finished` via `eas build:list`
- Submission confirmed via `Submitted your app to Apple App Store Connect!` in CLI output
- No local file changes were made (config was all done in Plan 01)
- Task 2 is a checkpoint — not yet complete, awaiting human verification
