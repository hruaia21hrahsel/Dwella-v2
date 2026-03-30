---
phase: 15
slug: project-setup-infrastructure
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-30
---

# Phase 15 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | CLI smoke checks (no Jest — phase has no unit-testable logic) |
| **Config file** | none — verification via build/compile commands |
| **Quick run command** | `npx tsc --noEmit` |
| **Full suite command** | `npm --prefix website run build && npx tsc --noEmit` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run relevant smoke command for that task
- **After every plan wave:** Run `npm --prefix website run build && npx tsc --noEmit`
- **Before `/gsd:verify-work`:** All four success criteria commands must pass
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 15-01-01 | 01 | 1 | SETUP-01 | smoke | `ls website/package.json website/tsconfig.json` | ❌ W0 | ⬜ pending |
| 15-01-02 | 01 | 1 | SETUP-01 | smoke | `npm --prefix website run build` | ❌ W0 | ⬜ pending |
| 15-02-01 | 02 | 1 | SETUP-02 | smoke | `npx expo start --non-interactive` (observe) | ❌ W0 | ⬜ pending |
| 15-02-02 | 02 | 1 | SETUP-03 | smoke | `npx tsc --noEmit` | ❌ W0 | ⬜ pending |
| 15-03-01 | 03 | 2 | SETUP-04 | manual | Dashboard verification | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- No Jest test files needed — all verification is via CLI smoke checks
- Existing `__tests__/` suite must continue to pass (tests Expo app logic, unaffected by this phase)

*Existing infrastructure covers all phase requirements via CLI commands.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Vercel project configured correctly | SETUP-04 | Requires Vercel dashboard access | Verify Root Directory = `website`, Ignored Build Step = `git diff HEAD^ HEAD --quiet -- .` |

---

## Validation Sign-Off

- [ ] All tasks have automated verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
