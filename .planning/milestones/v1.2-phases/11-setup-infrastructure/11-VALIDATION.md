---
phase: 11
slug: setup-infrastructure
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-21
---

# Phase 11 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Jest via `jest-expo` preset |
| **Config file** | `jest.config.js` (exists at project root) |
| **Quick run command** | `npx jest __tests__/whatsapp-send.test.ts --no-coverage` |
| **Full suite command** | `npx jest --no-coverage` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx jest __tests__/whatsapp-send.test.ts --no-coverage`
- **After every plan wave:** Run `npx jest --no-coverage`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 11-01-01 | 01 | 1 | SETUP-01 | manual | `ls docs/meta-setup.md` | Wave 0 | ⬜ pending |
| 11-01-02 | 01 | 1 | SETUP-02 | unit | `npx jest __tests__/whatsapp-send.test.ts --no-coverage` | Wave 0 | ⬜ pending |
| 11-01-03 | 01 | 1 | SETUP-02 | unit | `npx jest __tests__/whatsapp-send.test.ts --no-coverage` | Wave 0 | ⬜ pending |
| 11-02-01 | 02 | 1 | SETUP-02 | unit | `npx jest __tests__/bot.test.ts --no-coverage` | Partial | ⬜ pending |
| 11-02-02 | 02 | 1 | SETUP-03 | unit | `npx jest __tests__/whatsapp-send.test.ts --no-coverage` | Wave 0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `__tests__/whatsapp-send.test.ts` — covers E.164 normalization, wa.me URL construction, and mock-based tests for whatsapp-send request schema validation

*Existing `__tests__/bot.test.ts` partially covers crypto; linking tests to be added.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| End-to-end WhatsApp code send/receive | SETUP-02 | Requires live Meta account and phone | 1. Enter phone in profile UI 2. Receive code on WhatsApp 3. Send code back 4. Confirm linking status updates |
| Meta template submission | SETUP-01 | External platform action | 1. Log into Meta Business Manager 2. Submit 3 templates 3. Verify pending status |
| "Open WhatsApp" deep link opens correct chat | SETUP-03 | Requires physical device with WhatsApp installed | 1. Link account 2. Tap "Open WhatsApp" button 3. Verify Dwella bot conversation opens |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
