---
phase: 8
slug: maintenance-requests
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-21
---

# Phase 8 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | jest 29.x |
| **Config file** | jest.config.js |
| **Quick run command** | `npx jest --testPathPattern=maintenance --bail` |
| **Full suite command** | `npx jest` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx jest --testPathPattern=maintenance --bail`
- **After every plan wave:** Run `npx jest`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 08-01-01 | 01 | 1 | MAINT-01 | integration | `supabase db reset && npx jest --testPathPattern=migration` | ❌ W0 | ⬜ pending |
| 08-01-02 | 01 | 1 | MAINT-03 | unit | `npx jest --testPathPattern=maintenance` | ❌ W0 | ⬜ pending |
| 08-02-01 | 02 | 1 | MAINT-01 | manual | Device camera/gallery test | N/A | ⬜ pending |
| 08-02-02 | 02 | 1 | MAINT-02 | manual | Push notification delivery test | N/A | ⬜ pending |
| 08-03-01 | 03 | 2 | MAINT-03 | manual | Status flow walkthrough | N/A | ⬜ pending |
| 08-03-02 | 03 | 2 | MAINT-04 | manual | Push on status change | N/A | ⬜ pending |
| 08-04-01 | 04 | 2 | MAINT-05 | manual | Cost logging + expense link | N/A | ⬜ pending |
| 08-04-02 | 04 | 2 | MAINT-06 | manual | Filter/sort verification | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `__tests__/maintenance.test.ts` — stubs for MAINT-01 (schema validation) and MAINT-03 (valid/invalid status transitions, helper function tests)

*Existing jest infrastructure covers framework needs.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Camera + gallery photo capture | MAINT-01 | Device-only API (expo-image-picker) | Open submit form → tap camera → capture photo → verify preview. Tap gallery → select photo → verify preview. |
| Push notification on new request | MAINT-02 | Requires two physical devices | Tenant submits request → landlord device receives push within 5s |
| Status flow UI walkthrough | MAINT-03 | UI interaction + state transitions | Landlord taps Acknowledge → Start Work → Mark Resolved → Close on detail screen |
| Push notification on status change | MAINT-04 | Requires two physical devices | Landlord changes status → tenant device receives push within 5s |
| Cost logging creates expense | MAINT-05 | Multi-screen flow | Landlord marks resolved → enters cost → verify expense appears in property expenses list |
| Filter and sort requests | MAINT-06 | UI interaction | Apply status filter → verify list updates. Apply priority filter → verify. Toggle sort → verify order. |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
