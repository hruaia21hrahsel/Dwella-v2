---
phase: 5
slug: launch-configuration-store-gate
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-19
---

# Phase 5 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | jest-expo |
| **Config file** | `jest.config.js` |
| **Quick run command** | `npx jest --testPathPattern="store\|AiDisclosureModal\|UpdateGate\|config"` |
| **Full suite command** | `npx jest` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx jest --testPathPattern="store|AiDisclosureModal|UpdateGate|config"`
- **After every plan wave:** Run `npx jest`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 05-01-01 | 01 | 1 | LAUNCH-01 | manual | Manual review of docs/privacy-checklist.md | N/A | ⬜ pending |
| 05-02-01 | 02 | 1 | LAUNCH-02 | unit | `npx jest --testPathPattern="store"` | ❌ W0 | ⬜ pending |
| 05-02-02 | 02 | 1 | LAUNCH-02 | unit | `npx jest --testPathPattern="AiDisclosureModal"` | ❌ W0 | ⬜ pending |
| 05-02-03 | 02 | 1 | LAUNCH-02 | unit | `npx jest --testPathPattern="AiDisclosureModal"` | ❌ W0 | ⬜ pending |
| 05-03-01 | 03 | 2 | LAUNCH-03 | unit | `npx jest --testPathPattern="config"` | ❌ W0 | ⬜ pending |
| 05-04-01 | 04 | 2 | LAUNCH-04 | unit | `npx jest --testPathPattern="UpdateGate"` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `__tests__/AiDisclosureModal.test.tsx` — covers LAUNCH-02 modal render/dismiss behavior
- [ ] `__tests__/UpdateGate.test.tsx` — covers LAUNCH-04 development no-op guard
- [ ] `__tests__/config.test.ts` — validates app.json runtimeVersion policy value programmatically
- [ ] `__tests__/store.test.ts` (extend or create) — covers `aiDisclosureAccepted` partialize persistence

*Existing infrastructure covers LAUNCH-01 (manual checklist review) and LAUNCH-03 (EAS config CLI validation).*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Privacy checklist completeness | LAUNCH-01 | Document content accuracy requires human review against Apple categories | Review docs/privacy-checklist.md, verify all 7 services listed with correct data types |
| EAS production profile validation | LAUNCH-03 | Requires EAS CLI + credentials | Run `eas config --platform all --profile production` and verify no errors |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
