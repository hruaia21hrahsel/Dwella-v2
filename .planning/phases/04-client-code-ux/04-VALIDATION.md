---
phase: 4
slug: client-code-ux
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-19
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | None — no unit test suite (deferred to v2) |
| **Config file** | none |
| **Quick run command** | `npx tsc --noEmit` |
| **Full suite command** | `npx tsc --noEmit` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx tsc --noEmit`
- **After every plan wave:** Run `npx tsc --noEmit`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 04-01-01 | 01 | 1 | CLIENT-01 | manual-only | `npx tsc --noEmit` (type check) | N/A | ⬜ pending |
| 04-01-02 | 01 | 1 | CLIENT-02 | manual-only | `npx tsc --noEmit` (type check) | N/A | ⬜ pending |
| 04-02-01 | 02 | 1 | CLIENT-03 | static analysis | `npx tsc --noEmit` + code review | N/A | ⬜ pending |
| 04-03-01 | 03 | 1 | CLIENT-04 | manual-only | `npx tsc --noEmit` (type check) | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

*Existing infrastructure covers all phase requirements — no test framework to install.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Auth error toast visible on profile sync failure | CLIENT-01 | No test suite; UI behavior | Trigger auth error in Expo Go, verify toast appears with error message |
| Missing env var throws at startup | CLIENT-02 | Requires dev server restart | Remove `EXPO_PUBLIC_SUPABASE_URL` from `.env`, restart dev server, verify throw message in console |
| Subscription cleanups present | CLIENT-03 | Static analysis sufficient | Code review: verify all 10 hooks call `removeChannel()` in cleanup |
| Push token registered and stored | CLIENT-04 | Requires physical device | Run on physical device, verify token stored in DB, send test push |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
