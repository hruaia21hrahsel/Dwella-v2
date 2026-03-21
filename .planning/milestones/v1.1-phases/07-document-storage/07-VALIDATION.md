---
phase: 7
slug: document-storage
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-20
---

# Phase 7 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | jest 29.x (via expo) |
| **Config file** | jest.config.js or package.json jest section |
| **Quick run command** | `npx jest --testPathPattern=documents --bail` |
| **Full suite command** | `npx jest` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx jest --testPathPattern=documents --bail`
- **After every plan wave:** Run `npx jest`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 07-01-01 | 01 | 1 | DOC-01 | migration | `supabase db reset` | ❌ W0 | ⬜ pending |
| 07-01-02 | 01 | 1 | DOC-02 | RLS | `supabase db reset` | ❌ W0 | ⬜ pending |
| 07-02-01 | 02 | 1 | DOC-03 | unit | `npx jest --testPathPattern=documents` | ❌ W0 | ⬜ pending |
| 07-02-02 | 02 | 1 | DOC-04 | unit | `npx jest --testPathPattern=documents` | ❌ W0 | ⬜ pending |
| 07-03-01 | 03 | 2 | DOC-05 | integration | `npx jest --testPathPattern=documents` | ❌ W0 | ⬜ pending |
| 07-03-02 | 03 | 2 | DOC-06 | integration | `npx jest --testPathPattern=documents` | ❌ W0 | ⬜ pending |
| 07-04-01 | 04 | 2 | DOC-07 | manual | N/A (UI render) | N/A | ⬜ pending |
| 07-04-02 | 04 | 2 | DOC-08 | manual | N/A (delete flow) | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Install test dependencies if missing (jest, @testing-library/react-native)
- [ ] Stub test files for document upload/download/delete flows
- [ ] Shared fixtures for mock Supabase storage responses

*If none: "Existing infrastructure covers all phase requirements."*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| PDF renders in WebView | DOC-07 | Requires device/emulator with WebView | Upload PDF, tap to view, confirm renders |
| Image renders inline | DOC-07 | Requires visual confirmation | Upload image, confirm inline preview |
| Share/download works | DOC-07 | Platform-specific sharing sheet | Tap share icon, confirm OS share sheet appears |
| Atomic delete (storage + DB) | DOC-08 | Requires Supabase storage integration | Delete doc, verify both storage object and DB row removed |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
