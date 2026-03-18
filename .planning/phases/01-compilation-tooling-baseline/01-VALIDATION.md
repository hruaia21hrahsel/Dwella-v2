---
phase: 1
slug: compilation-tooling-baseline
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-18
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Jest 29.7.0 + jest-expo 55.0.9 |
| **Config file** | `jest.config.js` (exists) |
| **Quick run command** | `npx tsc --noEmit` |
| **Full suite command** | `npx tsc --noEmit && npm run lint` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run the specific CLI verification for that requirement
- **After every plan wave:** Run `npx tsc --noEmit && npm run lint`
- **Before `/gsd:verify-work`:** All four CLI verifications green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 01-01 | 01 | 1 | TS-01 | CLI verification | `npx tsc --noEmit && echo OK` | N/A — compiler | ⬜ pending |
| 01-02 | 01 | 1 | TS-02 | Code inspection + CLI | `grep -rn "as any" lib/supabase.ts app/_layout.tsx supabase/functions/send-reminders/` | N/A — grep count | ⬜ pending |
| 01-03 | 01 | 1 | TS-03 | CLI verification | `npm run lint` | ❌ W0 — `eslint.config.js` needed | ⬜ pending |
| 01-04 | 01 | 1 | EDGE-04 | Code inspection | `grep -n "initSentry\|Sentry.init" app/_layout.tsx lib/sentry.ts` | ❌ W0 — `lib/sentry.ts` needed | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `eslint.config.js` — ESLint flat config for TS-03
- [ ] `lib/sentry.ts` — Sentry init module for EDGE-04

*This phase is tooling setup — verification is CLI-based, not test-based.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Sentry receives test error | EDGE-04 | Requires Sentry dashboard access | 1. Add `Sentry.captureException(new Error('test'))` to a screen 2. Check Sentry dashboard for event 3. Remove test code |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
