---
phase: 09-reporting-dashboards
plan: 04
subsystem: screens
tags: [react-native, reporting, dashboard, portfolio, property-report, hooks, supabase]

# Dependency graph
requires:
  - phase: 09-01
    provides: lib/reports.ts (aggregatePortfolio, aggregateByPeriod, aggregateByCategory, calcReliability, calcOccupancy, TimePeriod, all report types)
  - phase: 09-02
    provides: PLBarChart, DonutChart, OccupancyChart, ChartSectionCard components
  - phase: 09-03
    provides: TimeControlBar, KpiCard, ReliabilityTable, PropertyReportCard, ReportSkeleton components
provides:
  - hooks/useReportData.ts — usePortfolioData and usePropertyReportData data hooks
  - app/reports/index.tsx — Portfolio summary screen with KPI grid and property list
  - app/reports/[propertyId].tsx — Per-property report with all 4 chart sections
  - app/(tabs)/tools/index.tsx — Analytics route activated (comingSoon removed)
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - usePortfolioData: parallel property + payment + expense queries; useMemo for aggregation keyed on raw data + year
    - usePropertyReportData: separate data fetch and aggregation; period changes re-compute client-side without new DB queries
    - reports/index.tsx: TimeControlBar in yearly-only mode via period.granularity='yearly'; kpiCardWidth derived from useWindowDimensions
    - reports/[propertyId].tsx: gap: 24 between ChartSectionCard sections via contentContainerStyle gap
    - ErrorBanner: uses error + onRetry props (not message prop as plan spec suggested)
    - EmptyState: used without titleStyle (not in actual component interface)

key-files:
  created:
    - hooks/useReportData.ts
    - app/reports/index.tsx
    - app/reports/[propertyId].tsx
  modified:
    - app/(tabs)/tools/index.tsx

# Decisions
decisions:
  - "ErrorBanner uses {error, onRetry} props not {message} — adapted portfolio/property screens to match actual component interface"
  - "EmptyState has no titleStyle prop — used without it (no functional impact)"
  - "DwellaHeader has no title/showBack API — property report screen uses ScrollView with insets.top padding; back navigation handled by Expo Router stack"
  - "usePropertyReportData re-fetches when period.year changes (not just propertyId) — ensures fresh data when year changes in the time control"

# Metrics
metrics:
  duration: "~15 min"
  completed: "2026-03-21"
  tasks: 2
  files_modified: 4
---

# Phase 09 Plan 04: Integration — hooks, screens, and tools menu wiring

## One-liner

Data hook + two report screens (portfolio + per-property) wired to Tools menu Analytics card, completing all 5 RPT requirements end-to-end.

## What Was Built

### Task 1 — useReportData hook and portfolio screen

**hooks/useReportData.ts** exports two hooks:

`usePortfolioData(year)` — fetches all owned properties with tenants, year-filtered payments (skipped if no tenants), and all user expenses. Runs `aggregatePortfolio` via `useMemo` for portfolio KPIs and per-property summaries with sparklines.

`usePropertyReportData(propertyId, period)` — fetches a single property with tenants, year-filtered payments for those tenants, and property-scoped expenses. Runs all 4 aggregation functions via `useMemo`. Period changes re-compute client-side — no new DB queries.

**app/reports/index.tsx** — Portfolio screen:
- Year selector using `TimeControlBar` locked to yearly granularity
- 2x2 KPI grid with `KpiCard` components (Total Income, Total Expenses, Net P&L, Occupancy)
- Property list with `PropertyReportCard` + stagger index; tapping pushes `/reports/${id}`
- `EmptyState` when no properties; `ErrorBanner` on fetch error; `ReportSkeleton` while loading
- Pull-to-refresh via `RefreshControl`; `track('report_portfolio_viewed')` on mount

### Task 2 — Property report screen and tools menu

**app/reports/[propertyId].tsx** — Per-property report screen:
- `useLocalSearchParams` for `propertyId`
- `TimeControlBar` for full year/quarter/month selection
- 4 `ChartSectionCard` sections (Profit & Loss, Expense Breakdown, Payment Reliability, Occupancy)
- `getEmptyLabel(period)` helper returns period-aware empty message (e.g. "No data for Q2 2026")
- `track('report_property_viewed')` on mount; `track('report_granularity_changed')` on period change
- Pull-to-refresh; `ReportSkeleton variant="property"` while loading; `ErrorBanner` on error

**app/(tabs)/tools/index.tsx** — Analytics card updated:
- Removed `comingSoon: true`
- Added `route: '/reports'`
- Card is now tappable and navigates to portfolio summary

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] ErrorBanner interface mismatch**
- **Found during:** Task 1
- **Issue:** Plan spec referenced `ErrorBanner` with `{ message: string }` prop, but actual component uses `{ error: string | null; onRetry: () => void }`
- **Fix:** Used `error` and `onRetry` props per actual interface in both screens
- **Files modified:** app/reports/index.tsx, app/reports/[propertyId].tsx

**2. [Rule 1 - Bug] EmptyState missing titleStyle prop**
- **Found during:** Task 1
- **Issue:** Plan spec mentioned `titleStyle={{ fontSize: 16 }}` for EmptyState but the component doesn't accept this prop
- **Fix:** Used EmptyState without titleStyle (visual impact: title renders at default 17px instead of 16px — negligible)
- **Files modified:** app/reports/index.tsx

**3. [Rule 1 - Bug] DwellaHeader has no title/showBack API**
- **Found during:** Task 2
- **Issue:** Plan spec referenced `DwellaHeader` with `title` and `showBack` props, but the actual component is a greeting header with no such API
- **Fix:** Portfolio screen uses a plain `Text` title with `insets.top` padding; property report screen uses native Expo Router stack back navigation (the Stack navigator provides back arrow automatically when navigating from a pushed screen)
- **Files modified:** app/reports/index.tsx, app/reports/[propertyId].tsx

## Verification Results

- `npx tsc --noEmit` — 0 errors
- `npx jest __tests__/reports.test.ts --no-coverage` — 46 tests passed, 0 failures
- Analytics card in Tools menu has `route: '/reports'` and no `comingSoon`
- Portfolio screen: KPI grid + property cards + empty/loading/error states
- Property report screen: TimeControlBar + 4 ChartSectionCard sections + empty label helper

## Known Stubs

None — all data is fetched from Supabase and wired to chart components.

## Self-Check: PASSED
