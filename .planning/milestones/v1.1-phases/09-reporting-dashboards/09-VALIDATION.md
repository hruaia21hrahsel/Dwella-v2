---
phase: 9
slug: reporting-dashboards
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-03-21
updated: 2026-03-21
---

# Phase 9 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | jest + jest-expo v55.0.9 (unit tests) + TypeScript type checking |
| **Config file** | `jest.config.js` (root), `tsconfig.json` |
| **Quick run command** | `npx jest __tests__/reports.test.ts -x` |
| **Full suite command** | `npx jest && npx tsc --noEmit` |
| **Estimated runtime** | ~20 seconds |

---

## Sampling Rate

- **After every task commit:** Run task-specific `<verify>` command
- **After every plan wave:** Run `npx jest __tests__/reports.test.ts --no-coverage && npx tsc --noEmit`
- **Before `/gsd:verify-work`:** Full suite must be green (`npx jest && npx tsc --noEmit`)
- **Max feedback latency:** 20 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 09-01-T0 | 01 | 1 | (infra) | version-check + file-exists | `node -e "..."` (inline verify) | N/A | pending |
| 09-01-T1 | 01 | 1 | RPT-01, RPT-02, RPT-03, RPT-04, RPT-05 | unit (TDD) | `npx jest __tests__/reports.test.ts --no-coverage` | Wave 0 (created in this task) | pending |
| 09-02-T1 | 02 | 2 | RPT-01, RPT-02, RPT-04 | type-check | `npx tsc --noEmit` | N/A | pending |
| 09-02-T2 | 02 | 2 | RPT-01, RPT-02, RPT-04 | type-check | `npx tsc --noEmit` | N/A | pending |
| 09-03-T1 | 03 | 3 | RPT-03, RPT-05 | type-check | `npx tsc --noEmit` | N/A | pending |
| 09-03-T2 | 03 | 3 | RPT-03, RPT-05 | type-check | `npx tsc --noEmit` | N/A | pending |
| 09-04-T1 | 04 | 4 | RPT-01 to RPT-05 | type-check | `npx tsc --noEmit` | N/A | pending |
| 09-04-T2 | 04 | 4 | RPT-01 to RPT-05 | type-check + regression | `npx tsc --noEmit && npx jest __tests__/reports.test.ts --no-coverage` | N/A | pending |

*Status: pending / green / red / flaky*

---

## Wave 0 Requirements

- [ ] `npx expo install victory-native@36` — charting library (must pin to v36)
- [ ] Verify composite index does NOT exist in migration 019 (confirmed: 019 is documents)
- [ ] Create `supabase/migrations/023_report_indexes.sql` with `CREATE INDEX idx_payments_tenant_year_month ON payments(tenant_id, year, month)`
- [ ] `__tests__/reports.test.ts` — covers all 5 RPT requirements (pure function tests for aggregation helpers)

*Existing hooks, test infrastructure, and components cover all other infrastructure needs.*

---

## Wave Summary

| Wave | Plans | Tasks | Key Outputs |
|------|-------|-------|-------------|
| 1 | 09-01 | T0 (install + migration), T1 (TDD aggregation) | victory-native@36, migration 023, lib/reports.ts, tests |
| 2 | 09-02 | T1 (tooltip + section card), T2 (4 chart components) | 6 chart/support components |
| 3 | 09-03 | T1 (time control + KPI + skeleton), T2 (reliability + property card) | 5 control/display components |
| 4 | 09-04 | T1 (hook + portfolio screen), T2 (property screen + tools wiring) | 2 screens, 1 hook, tools menu update |

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| P&L chart renders grouped bars | RPT-01 | Visual rendering | Open reports > select property > verify green/red bars per month |
| Donut chart shows expense categories | RPT-02 | Visual rendering | Open reports > verify donut with category colors and center total |
| Payment reliability table shows scores | RPT-03 | Visual + data accuracy | Open reports > verify tenant list with on-time % and avg days late |
| Occupancy chart tracks units | RPT-04 | Visual rendering | Open reports > verify filled vs vacant visualization |
| Portfolio summary rolls up KPIs | RPT-05 | Visual + aggregation | Open portfolio > verify total income/expenses/P&L/occupancy |
| Tap-to-tooltip on charts | D-04 | Interaction | Tap a bar/segment > tooltip appears with exact value |
| Time control changes re-render charts | D-09 | Interaction | Change granularity/period > all charts update |
| Empty states preserve layout | D-20, D-21 | Visual | Select period with no data > charts show "No data" message, layout stable |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify commands
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references (migration 023 + test file created in Plan 01)
- [x] No watch-mode flags
- [x] Feedback latency < 20s
- [x] `nyquist_compliant: true` set in frontmatter
- [x] Task map matches all 8 tasks across 4 plans with correct wave assignments

**Approval:** signed-off (revision pass)
