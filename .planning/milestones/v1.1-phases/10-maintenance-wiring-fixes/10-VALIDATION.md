---
phase: 10
slug: maintenance-wiring-fixes
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-21
---

# Phase 10 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | TypeScript compiler (tsc) + Expo build check |
| **Config file** | `tsconfig.json` |
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
| 10-01-01 | 01 | 1 | MAINT-03 | type-check + manual | `npx tsc --noEmit` | ✅ | ⬜ pending |
| 10-01-02 | 01 | 1 | MAINT-03 | type-check + manual | `npx tsc --noEmit` | ✅ | ⬜ pending |
| 10-01-03 | 01 | 1 | MAINT-05 | type-check + manual | `npx tsc --noEmit` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

*Existing infrastructure covers all phase requirements.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Notification tap navigates to maintenance detail | MAINT-03 | Requires push notification + deep link on device | 1. Create maintenance request 2. Receive notification 3. Tap notification 4. Verify navigation to maintenance detail screen |
| Property detail Maintenance shortcut card | MAINT-05 | UI navigation behavior | 1. Open property detail 2. Verify Maintenance card visible 3. Tap card 4. Verify navigation to property-scoped maintenance list |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
