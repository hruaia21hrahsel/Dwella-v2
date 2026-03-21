# Phase 9: Reporting Dashboards - Context

**Gathered:** 2026-03-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Landlords can see financial and operational health for each property and across their portfolio without leaving the app. Covers P&L charts, expense breakdown by category, tenant payment reliability scores, occupancy tracking, and a portfolio-level summary. No new Edge Functions — all aggregate queries are direct Supabase client calls protected by RLS. Requirements: RPT-01 through RPT-05.

</domain>

<decisions>
## Implementation Decisions

### Chart Types & Interactions
- **D-01:** P&L chart is a grouped bar chart — two bars side-by-side per period (green=income, red=expenses), clear comparison at a glance
- **D-02:** Expense breakdown is a donut chart with total amount displayed in the center; each category uses its existing color from `lib/expenses.ts`
- **D-03:** Payment reliability is a table/list view: tenant name, on-time %, average days late — sorted by performance
- **D-04:** All charts are interactive — tap a bar/segment to highlight it and show a tooltip with the exact value
- **D-05:** Occupancy chart style is Claude's discretion (bar or area chart showing filled vs vacant units over time)

### Time Controls
- **D-06:** Year picker dropdown at top of reports page
- **D-07:** Granularity toggle next to year picker: Yearly (shows 4 quarter bars) | Quarterly (shows 3 month bars for selected quarter) | Monthly (shows single-month summary)
- **D-08:** When granularity is Quarterly, a quarter selector appears (Q1/Q2/Q3/Q4); when Monthly, a month selector appears
- **D-09:** All charts re-render based on selected year + granularity + period

### Report Navigation & Layout
- **D-10:** Single scrollable page per property — all report sections stacked vertically: P&L chart, expense breakdown donut, tenant reliability table, occupancy chart
- **D-11:** Portfolio-first navigation: Tools menu "Analytics" card opens the portfolio summary page; tap a property card to drill into that property's full reports
- **D-12:** Single entry point via tools menu only (no second entry on property detail screen)
- **D-13:** Back button from property reports returns to portfolio summary

### Portfolio Summary
- **D-14:** Portfolio landing page shows 4 aggregate KPIs: Total Income, Total Expenses, Net P&L, Overall Occupancy Rate (filled/total across all properties)
- **D-15:** Below KPIs, each property is a summary card showing: property name, net P&L for selected period, occupancy fraction (e.g., 19/20), profit/loss color indicator (green/red), and a mini P&L sparkline
- **D-16:** Property cards are tappable — drill into that property's full report page

### Payment Reliability Scoring
- **D-17:** On-time = payment reached `paid` or `confirmed` status on or before `due_date` (strict, no grace period)
- **D-18:** Average days late = mean of (paid_at - due_date) for late payments only; 0 if all on-time
- **D-19:** Reliability scores scoped to the selected time period (year/quarter/month)

### Empty States
- **D-20:** When a selected period has no data, show the chart frame/axes with no data rendered plus a subtle message ("No data for Q3 2026")
- **D-21:** Layout stays stable — chart containers don't collapse when empty

### Claude's Discretion
- Charting library choice (victory-native, react-native-chart-kit, custom SVG, etc. — `react-native-svg` already installed)
- Occupancy chart type (stacked bar, area chart, or simple filled/vacant bars)
- Sparkline implementation on portfolio property cards
- Loading skeleton design
- Exact card styling, spacing, and animations
- Chart color palette beyond existing status/category colors
- Error state handling for failed queries
- Empty state message wording
- Quarter/month selector UI (chips, dropdown, or segment)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & Roadmap
- `.planning/REQUIREMENTS.md` — RPT-01 through RPT-05 define all reporting requirements
- `.planning/ROADMAP.md` — Phase 9 success criteria (5 acceptance tests)

### Prior Decisions (STATE.md)
- `.planning/STATE.md` — "Accumulated Context > Decisions" section contains locked decisions:
  - No new Edge Functions — aggregate queries are direct Supabase client calls protected by RLS
  - Composite index added in migration 019 for report aggregate queries
  - Research flag: run `EXPLAIN ANALYZE` on report aggregate queries against production data

### Existing Data Sources
- `hooks/useExpenses.ts` — Per-property expenses with Realtime subscription
- `hooks/useAllExpenses.ts` — All user expenses across properties (for portfolio aggregation)
- `hooks/usePayments.ts` — Per-tenant payments with Realtime subscription
- `hooks/useDashboard.ts` — Dashboard aggregation patterns (monthly income/expenses, stats, recent transactions)
- `hooks/useProperties.ts` — Owned properties + tenant properties (dual-role)
- `hooks/useTenants.ts` — Per-property tenants with lease dates

### Existing Patterns to Follow
- `lib/expenses.ts` — EXPENSE_CATEGORIES with colors, icons, labels (donut chart color source)
- `lib/payments.ts` — `getStatusColor()`, `getStatusLabel()`, payment state helpers
- `lib/utils.ts` — `formatCurrency()` (INR), `getMonthName()`, `getCurrentMonthYear()`
- `app/(tabs)/dashboard/index.tsx` — Year picker pattern, monthly P&L card, StatCard pattern
- `components/AnimatedCard.tsx` — Staggered fade-in card animation
- `components/GlassCard.tsx` — Glass morphism card styling
- `app/(tabs)/tools/index.tsx` — Analytics card with `comingSoon: true` (flip to route)

### Theme System
- `constants/theme.ts` — Light/dark color tokens, status colors, gradient pairs
- `lib/theme-context.tsx` — `useTheme()` hook for theme-aware components

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `useAllExpenses()` hook: Cross-property expense aggregation for portfolio view
- `useDashboard()` hook: Monthly income calculation pattern (query payments, sum confirmed amounts)
- `EXPENSE_CATEGORIES` array: Pre-defined colors for donut chart segments
- `formatCurrency()`: INR formatting for all monetary values
- `AnimatedCard` / `GlassCard`: Card components for property summary cards
- `DwellaHeader`: Standard screen header
- `EmptyState` component: Reusable empty state pattern
- `ListSkeleton` component: Loading state placeholder

### Established Patterns
- Year picker: Already exists in dashboard (horizontal scrollable chips, 2000-present)
- P&L calculation: `monthlyIncome - monthlyExpenses` pattern in `app/expenses/index.tsx`
- Realtime hooks: `supabase.channel()` subscription for live data updates
- Theme-aware: `useTheme()` for light/dark mode support
- Toast: `useToastStore.getState().showToast()` for feedback
- Analytics: `useTrack()` hook with named events
- Navigation: `useLocalSearchParams()` + `useRouter()` in Expo Router

### Integration Points
- `app/(tabs)/tools/index.tsx` — Flip Analytics `comingSoon` to `route: '/reports'`
- `app/reports/` — New route directory for portfolio and property report screens
- `react-native-svg` (v15.12.1) — Already installed, chart library dependency
- New charting library — needs `npx expo install` (Claude's discretion on which)
- No new migrations needed — all data already exists in payments, expenses, tenants tables
- Composite index in migration 019 covers report query performance

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches within the decisions captured above.

</specifics>

<deferred>
## Deferred Ideas

- PDF/CSV export of reports — RPT-F01, deferred to v2
- Custom date range filters (arbitrary start/end) — RPT-F02, deferred to v2
- Year-over-year comparison charts — RPT-F03, deferred to v2
- Maintenance cost trends chart — possible future enhancement
- Tenant turnover rate metric — possible future enhancement

</deferred>

---

*Phase: 09-reporting-dashboards*
*Context gathered: 2026-03-21*
