---
phase: 9
slug: reporting-dashboards
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-21
---

# Phase 9 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Manual verification + TypeScript type checking |
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
| 09-01-01 | 01 | 1 | RPT-01 | type-check | `npx tsc --noEmit` | N/A | ⬜ pending |
| 09-01-02 | 01 | 1 | RPT-02 | type-check | `npx tsc --noEmit` | N/A | ⬜ pending |
| 09-02-01 | 02 | 1 | RPT-03 | type-check | `npx tsc --noEmit` | N/A | ⬜ pending |
| 09-02-02 | 02 | 1 | RPT-04 | type-check | `npx tsc --noEmit` | N/A | ⬜ pending |
| 09-03-01 | 03 | 2 | RPT-05 | type-check | `npx tsc --noEmit` | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `npx expo install victory-native@36` — charting library (must pin to v36)
- [ ] Verify composite index exists or create migration 023

*Existing hooks and components cover all other infrastructure needs.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| P&L chart renders grouped bars | RPT-01 | Visual rendering | Open reports > select property > verify green/red bars per month |
| Donut chart shows expense categories | RPT-02 | Visual rendering | Open reports > verify donut with category colors and center total |
| Payment reliability table shows scores | RPT-03 | Visual + data accuracy | Open reports > verify tenant list with on-time % and avg days late |
| Occupancy chart tracks units | RPT-04 | Visual rendering | Open reports > verify filled vs vacant visualization |
| Portfolio summary rolls up KPIs | RPT-05 | Visual + aggregation | Open portfolio > verify total income/expenses/P&L/occupancy |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
