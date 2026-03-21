---
phase: 09-reporting-dashboards
plan: 01
subsystem: reporting
tags: [reports, aggregation, tdd, charting, victory-native]
dependency_graph:
  requires: []
  provides: [lib/reports.ts, report-aggregation-types, report-aggregation-functions]
  affects: [09-02, 09-03, 09-04]
tech_stack:
  added: [victory-native@36]
  patterns: [pure-functions, tdd-red-green-refactor, timezone-safe-date-comparison]
key_files:
  created:
    - lib/reports.ts
    - __tests__/reports.test.ts
    - supabase/migrations/023_report_indexes.sql
  modified:
    - package.json
decisions:
  - victory-native pinned to @36 (SVG-based, avoids @shopify/react-native-skia which is not installed in Expo managed workflow)
  - Composite index created in migration 023 (STATE.md incorrectly attributed it to migration 019 which is the documents migration)
  - filterByPeriod uses duck-typing to handle both Payment (month/year fields) and Expense (expense_date field) objects
  - calcReliability uses .toISOString().slice(0, 10) for timezone-safe calendar day comparison per D-17/pitfall-4
  - aggregatePortfolio sparkline always generates 12 monthly buckets regardless of granularity for consistent sparkline rendering
  - avgDaysLate is mean of late-payment days only; returns 0 when all payments are on-time (D-18)
metrics:
  duration_minutes: 15
  completed_date: "2026-03-21"
  tasks_completed: 2
  files_created: 3
  files_modified: 1
---

# Phase 09 Plan 01: Report Aggregation Layer Summary

**One-liner:** Pure aggregation helpers (P&L, expense breakdown, reliability, occupancy, portfolio KPIs) with timezone-safe date logic and 46 passing unit tests.

## What Was Built

### victory-native@36 installed

The SVG-based charting library pinned to v36. v41+ requires `@shopify/react-native-skia` which is unavailable in Expo managed workflow. `react-native-svg` (already installed at 15.12.1) satisfies the peer dependency.

### Migration 023: Composite index

`supabase/migrations/023_report_indexes.sql` creates `idx_payments_tenant_year_month` on `public.payments(tenant_id, year, month)`. This covers the primary report query pattern: fetch payments by `tenant_id IN (...) AND year = ?`. STATE.md had incorrectly claimed this index existed in migration 019 (which is actually the Documents migration).

### lib/reports.ts — All types and aggregation functions

**Exported types:**
- `Granularity` — `'yearly' | 'quarterly' | 'monthly'`
- `TimePeriod` — year, granularity, optional quarter/month
- `PeriodBucket` — label, months array, startDate, endDate ISO strings
- `MonthlyPL` — label, income, expense
- `CategoryBreakdown` — category, label, amount, color
- `TenantReliability` — tenantId, tenantName, flatNo, onTimePct, avgDaysLate, totalPayments
- `OccupancyPoint` — label, filled, vacant
- `PortfolioKPIs` — totalIncome, totalExpenses, netPL, filledUnits, totalUnits
- `PropertySummary` — propertyId, propertyName, netPL, filledUnits, totalUnits, monthlyPL

**Exported functions:**
- `getPeriodBuckets(period)` — returns time buckets with ISO date bounds
- `filterByPeriod(items, period)` — duck-typed filter for Payment and Expense items
- `aggregateByPeriod(payments, expenses, period)` — P&L per bucket (paid/confirmed only)
- `aggregateByCategory(expenses, period)` — donut chart data with getCategoryColor
- `calcReliability(payments, tenants, period)` — on-time %, avg days late, sorted best-first
- `calcOccupancy(tenants, totalUnits, period)` — filled/vacant per bucket
- `aggregatePortfolio(properties, allPayments, allExpenses, period)` — cross-property KPIs + sparklines

### __tests__/reports.test.ts — 46 unit tests

Full TDD coverage across all 5 RPT requirements:
- `getPeriodBuckets`: 7 tests (yearly 4 quarters, quarterly 3 months, monthly 1 bucket, ISO date bounds)
- `filterByPeriod`: 4 tests (Payment year/quarter filtering, Expense date filtering)
- `aggregateByPeriod`: 8 tests (income status rules, empty period, multi-payment summing, expense bucketing)
- `aggregateByCategory`: 5 tests (grouping, getCategoryColor, empty, filtered-out categories, labels)
- `calcReliability`: 7 tests (on-time, late, avgDaysLate math, sort order, timezone edge case, no-payments tenant)
- `calcOccupancy`: 5 tests (active tenant, archived exclusion, lease start/end boundary)
- `aggregatePortfolio`: 10 tests (KPI sums, netPL, units, summaries, sparkline length, empty case)

## Deviations from Plan

### Auto-fixed Issues

None — plan executed exactly as written. The migration 019 discrepancy was pre-documented in the plan itself and handled as specified.

## Known Stubs

None — all functions are fully implemented with correct business logic. No placeholder returns.

## Self-Check: PASSED

- `lib/reports.ts`: FOUND
- `__tests__/reports.test.ts`: FOUND
- `supabase/migrations/023_report_indexes.sql`: FOUND
- Commit cd432cc (chore: install + migration): FOUND
- Commit 3bb5d51 (test: failing tests): FOUND
- Commit dfe164e (feat: implementation): FOUND
- All 46 tests: PASSING
- `npx tsc --noEmit`: CLEAN (0 errors)
