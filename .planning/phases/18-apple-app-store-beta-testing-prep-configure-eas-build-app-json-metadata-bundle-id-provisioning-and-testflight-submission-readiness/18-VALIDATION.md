---
phase: 18
slug: apple-app-store-beta-testing-prep
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-02
---

# Phase 18 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node one-liner config checks + grep |
| **Config file** | none — inline validation commands |
| **Quick run command** | `node -e "const e=require('./eas.json'),a=require('./app.json'); console.assert(e.submit.production.ios.ascAppId==='6760478576'); console.assert(!!e.build.production.env.EXPO_PUBLIC_POSTHOG_API_KEY); console.assert(a.expo.ios.usesAppleSignIn===true); console.assert(a.expo.ios.appleTeamId==='35G5HXD9K9'); console.assert(a.expo.splash.backgroundColor==='#4F46E5'); console.assert(!!a.expo.ios.privacyManifests); console.log('All checks passed')"` |
| **Full suite command** | Quick run + `grep -c '\[APP_ID\]' components/UpdateGate.tsx` (must return 0) |
| **Estimated runtime** | ~1 second |

---

## Sampling Rate

- **After every task commit:** Run quick run command
- **After every plan wave:** Run full suite command
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 2 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 18-01-01 | 01 | 1 | EAS-01 | config check | `node -e "console.assert(require('./eas.json').submit.production.ios.ascAppId==='6760478576')"` | N/A | ⬜ pending |
| 18-01-02 | 01 | 1 | EAS-02 | config check | `node -e "console.assert(!!require('./eas.json').build.production.env.EXPO_PUBLIC_POSTHOG_API_KEY)"` | N/A | ⬜ pending |
| 18-01-03 | 01 | 1 | EAS-03 | config check | `node -e "console.assert(require('./app.json').expo.ios.usesAppleSignIn===true)"` | N/A | ⬜ pending |
| 18-01-04 | 01 | 1 | EAS-04 | config check | `node -e "console.assert(require('./app.json').expo.ios.appleTeamId==='35G5HXD9K9')"` | N/A | ⬜ pending |
| 18-01-05 | 01 | 1 | EAS-05 | config check | `node -e "console.assert(require('./app.json').expo.splash.backgroundColor==='#4F46E5')"` | N/A | ⬜ pending |
| 18-01-06 | 01 | 1 | EAS-06 | grep check | `grep -c '\[APP_ID\]' components/UpdateGate.tsx` (must be 0) | N/A | ⬜ pending |
| 18-01-07 | 01 | 1 | EAS-07 | config check | `node -e "console.assert(!!require('./app.json').expo.ios.privacyManifests)"` | N/A | ⬜ pending |
| 18-02-01 | 02 | 2 | EAS-08 | manual/CI | `eas build --platform ios --profile production` | N/A | ⬜ pending |
| 18-02-02 | 02 | 2 | EAS-09 | manual | Human tester on physical device | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements. No new test files or framework installs needed — all automated checks are config-file one-liners.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| EAS build completes without error | EAS-08 | Cloud build on EAS servers; requires Apple credentials | Run `eas build --platform ios --profile production --auto-submit`, monitor EAS dashboard for success |
| TestFlight build launches to login screen | EAS-09 | Requires physical iOS device with TestFlight installed | Install from TestFlight, open app, verify login screen renders without crash |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 2s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
