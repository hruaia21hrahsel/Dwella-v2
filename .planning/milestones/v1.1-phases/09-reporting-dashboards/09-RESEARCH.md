# Phase 9: Reporting Dashboards - Research

**Researched:** 2026-03-21
**Domain:** React Native charting, aggregate data queries, Expo Router screen composition
**Confidence:** HIGH

## Summary

Phase 9 builds a two-screen analytics feature (portfolio summary + per-property reports) on top of existing data already living in `payments`, `expenses`, `tenants`, and `properties`. All user decisions are locked in CONTEXT.md and a full UI design contract exists in 09-UI-SPEC.md. No new migrations, no Edge Functions, no schema work is needed.

The dominant technical risk is charting library version selection. The UI-SPEC recommends `victory-native` but the simple `npx expo install victory-native` command would install v41+, which has mandatory peer dependencies on `@shopify/react-native-skia`, `react-native-reanimated`, and `react-native-gesture-handler` — none of which are installed in this project. The correct install is `victory-native@36.x`, the legacy SVG-based version that only requires `react-native-svg` (already at v15.12.1). This is a verified incompatibility that the planner must pin in the install step.

All aggregate data computation happens client-side from full payment/expense arrays already fetched by existing hooks. No new Supabase queries beyond what's needed to scope by property_id. The composite index in migration 019 supports query performance.

**Primary recommendation:** Install `npx expo install victory-native@36` (legacy SVG variant), build 11 new components and 2 new screens as specified in the UI-SPEC, wire all aggregation logic in plain TypeScript from existing hook data.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Chart Types & Interactions**
- D-01: P&L chart is a grouped bar chart — two bars side-by-side per period (green=income, red=expenses)
- D-02: Expense breakdown is a donut chart with total amount displayed in the center; each category uses its existing color from `lib/expenses.ts`
- D-03: Payment reliability is a table/list view: tenant name, on-time %, average days late — sorted by performance
- D-04: All charts are interactive — tap a bar/segment to highlight it and show a tooltip with the exact value
- D-05: Occupancy chart style is Claude's discretion (bar or area chart showing filled vs vacant units over time)

**Time Controls**
- D-06: Year picker dropdown at top of reports page
- D-07: Granularity toggle next to year picker: Yearly (shows 4 quarter bars) | Quarterly (shows 3 month bars for selected quarter) | Monthly (shows single-month summary)
- D-08: When granularity is Quarterly, a quarter selector appears (Q1/Q2/Q3/Q4); when Monthly, a month selector appears
- D-09: All charts re-render based on selected year + granularity + period

**Report Navigation & Layout**
- D-10: Single scrollable page per property — all report sections stacked vertically
- D-11: Portfolio-first navigation: Tools menu "Analytics" card opens portfolio summary; tap property to drill in
- D-12: Single entry point via tools menu only (no second entry on property detail screen)
- D-13: Back button from property reports returns to portfolio summary

**Portfolio Summary**
- D-14: Portfolio landing page shows 4 aggregate KPIs: Total Income, Total Expenses, Net P&L, Overall Occupancy Rate
- D-15: Below KPIs, each property is a summary card showing: property name, net P&L for selected period, occupancy fraction, profit/loss color indicator, mini P&L sparkline
- D-16: Property cards are tappable — drill into that property's full report page

**Payment Reliability Scoring**
- D-17: On-time = payment reached `paid` or `confirmed` status on or before `due_date` (strict, no grace period)
- D-18: Average days late = mean of (paid_at - due_date) for late payments only; 0 if all on-time
- D-19: Reliability scores scoped to the selected time period (year/quarter/month)

**Empty States**
- D-20: When a selected period has no data, show the chart frame/axes with no data rendered plus a subtle message ("No data for Q3 2026")
- D-21: Layout stays stable — chart containers don't collapse when empty

**No new Edge Functions.** All aggregate queries are direct Supabase client calls protected by RLS.
**Composite index** added in migration 019 for report aggregate queries.

### Claude's Discretion
- Charting library choice (victory-native, react-native-chart-kit, custom SVG, etc.)
- Occupancy chart type (stacked bar, area chart, or simple filled/vacant bars) — decided: stacked bar (VictoryStack + VictoryBar) per UI-SPEC
- Sparkline implementation on portfolio property cards
- Loading skeleton design
- Exact card styling, spacing, and animations
- Chart color palette beyond existing status/category colors
- Error state handling for failed queries
- Empty state message wording
- Quarter/month selector UI (chips, dropdown, or segment)

### Deferred Ideas (OUT OF SCOPE)
- PDF/CSV export of reports — RPT-F01, deferred to v2
- Custom date range filters (arbitrary start/end) — RPT-F02, deferred to v2
- Year-over-year comparison charts — RPT-F03, deferred to v2
- Maintenance cost trends chart — possible future enhancement
- Tenant turnover rate metric — possible future enhancement
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| RPT-01 | Landlord can view property P&L (income vs expenses per month) with bar/line charts | P&L aggregation from `payments` table; VictoryBar grouped chart; time control filtering |
| RPT-02 | Landlord can view expense breakdown by category as pie/donut chart | Expense aggregation by `category` field; VictoryPie donut; colors from `getCategoryColor()` |
| RPT-03 | Landlord can view tenant payment reliability scores (on-time %, average days late) | `paid_at` vs `due_date` comparison; per-tenant aggregation; FlatList table |
| RPT-04 | Landlord can view occupancy tracking (filled vs vacant units over time) | `tenants` count + `properties.total_units`; stacked VictoryBar; time period filtering |
| RPT-05 | Landlord can view portfolio-level summary across all properties | Cross-property aggregation via `useAllExpenses` + per-property payment queries; 4 KPI cards |
</phase_requirements>

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| victory-native | 36.9.2 (legacy) | SVG-based charts (VictoryBar, VictoryPie, VictoryLine, VictoryStack, VictoryAxis) | Only version compatible with this project — uses react-native-svg peer dep (already installed); v40+ requires Skia/Reanimated which are NOT in package.json |
| react-native-svg | 15.12.1 (installed) | SVG rendering layer for charts | Already installed; peer dep for victory-native@36 |
| react-native-paper | 5.x (installed) | Chip, surface, text components for TimeControlBar | Already in use project-wide |
| expo-linear-gradient | ~15.0.8 (installed) | Portfolio header gradient (gradients.hero) | Already installed |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @expo/vector-icons | ^15.0.3 (installed) | MaterialCommunityIcons for section icons | Section headings, KPI card icons |
| zustand | ^4.5.0 (installed) | Auth state via `useAuthStore` | Every hook that needs user.id |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| victory-native@36 | Custom SVG with react-native-svg | Custom SVG = more code, same renderer; victory-native@36 gives VictoryBar/Pie/Line/Stack with built-in animation; stick with victory-native |
| victory-native@36 | react-native-chart-kit | chart-kit is less flexible for grouped bars and donut customization; victory-native@36 is better fit |
| victory-native@41+ | NOT viable — Skia + Reanimated not installed; would require native rebuild | N/A |

**Installation:**
```bash
npx expo install victory-native@36
```

**CRITICAL: Do NOT run `npx expo install victory-native` without pinning `@36`.** As of March 2026, `npx expo install victory-native` resolves to v41.20.2 which requires `@shopify/react-native-skia >=1.2.3`, `react-native-reanimated >=3.0.0`, and `react-native-gesture-handler >=2.0.0`. None of these are installed. This will cause a runtime crash.

**Version verification (confirmed):**
- `victory-native@36.9.2` — peerDeps: `{ react: '>=16.6.0' }` only. Verified via `npm view victory-native@36.9.2 peerDependencies`.
- `react-native-svg@15.12.1` — already in package.json.

---

## Architecture Patterns

### Recommended Project Structure
```
app/reports/
├── index.tsx              # Portfolio summary screen (RPT-05)
└── [propertyId].tsx       # Per-property report screen (RPT-01 to RPT-04)

components/
├── KpiCard.tsx            # Single KPI tile (value + label)
├── PLBarChart.tsx         # Grouped bar chart, tap = tooltip
├── DonutChart.tsx         # VictoryPie donut with center label
├── OccupancyChart.tsx     # VictoryStack stacked bars
├── SparklineChart.tsx     # Minimal VictoryLine, 40px tall, no axes
├── ReliabilityTable.tsx   # FlatList reliability rows
├── PropertyReportCard.tsx # Portfolio property summary card
├── TimeControlBar.tsx     # Year + granularity + period selectors
├── ChartTooltip.tsx       # Floating tooltip bubble
├── ChartSectionCard.tsx   # Wrapper card (GlassCard + heading)
└── ReportSkeleton.tsx     # Loading state skeleton

hooks/
└── useReportData.ts       # New hook: aggregate all report data for one property
```

### Pattern 1: Client-Side Aggregation
**What:** Fetch raw payments/expenses/tenants for a property once, aggregate in JS by selected period.
**When to use:** All report screens. No server-side aggregation needed.
**Example:**
```typescript
// Aggregate payments into monthly P&L buckets
function aggregateByMonth(payments: Payment[], expenses: Expense[], year: number): MonthlyPL[] {
  return MONTHS.map((month) => {
    const income = payments
      .filter(p => p.year === year && p.month === month && (p.status === 'paid' || p.status === 'confirmed'))
      .reduce((sum, p) => sum + p.amount_paid, 0);
    const expenseTotal = expenses
      .filter(e => {
        const d = new Date(e.expense_date);
        return d.getFullYear() === year && d.getMonth() + 1 === month;
      })
      .reduce((sum, e) => sum + e.amount, 0);
    return { month, income, expense: expenseTotal };
  });
}
```

### Pattern 2: Time Period Filtering
**What:** Single time control state object passed to all aggregation functions.
**When to use:** TimeControlBar drives the period; all charts receive derived filtered arrays.
```typescript
type Granularity = 'yearly' | 'quarterly' | 'monthly';
interface TimePeriod {
  year: number;
  granularity: Granularity;
  quarter?: 1 | 2 | 3 | 4;   // only when granularity === 'quarterly'
  month?: number;              // only when granularity === 'monthly'
}

// Derive bar periods from time control state
function getPeriodBuckets(period: TimePeriod): { label: string; months: number[] }[] {
  if (period.granularity === 'yearly') {
    return [
      { label: 'Q1', months: [1, 2, 3] },
      { label: 'Q2', months: [4, 5, 6] },
      { label: 'Q3', months: [7, 8, 9] },
      { label: 'Q4', months: [10, 11, 12] },
    ];
  }
  if (period.granularity === 'quarterly') {
    const q = period.quarter ?? 1;
    const base = (q - 1) * 3 + 1;
    return [base, base + 1, base + 2].map(m => ({
      label: MONTH_SHORT[m - 1],
      months: [m],
    }));
  }
  // monthly: single period
  return [{ label: getMonthName(period.month ?? 1), months: [period.month ?? 1] }];
}
```

### Pattern 3: VictoryBar Grouped Chart (victory-native@36)
**What:** Two bars per period — income (green) and expense (red). Tap highlights + tooltip.
**When to use:** P&L chart component.
```typescript
// victory-native@36 uses same API as victory (web)
import { VictoryChart, VictoryBar, VictoryAxis, VictoryGroup } from 'victory-native';

// Grouped bar example:
<VictoryChart domainPadding={20}>
  <VictoryAxis />
  <VictoryAxis dependentAxis />
  <VictoryGroup offset={12}>
    <VictoryBar
      data={incomeData}
      style={{ data: { fill: colors.statusConfirmed } }}
      events={[{ target: 'data', eventHandlers: { onPress: handlePress } }]}
    />
    <VictoryBar
      data={expenseData}
      style={{ data: { fill: colors.error } }}
      events={[{ target: 'data', eventHandlers: { onPress: handlePress } }]}
    />
  </VictoryGroup>
</VictoryChart>
```

### Pattern 4: VictoryPie Donut (victory-native@36)
**What:** Donut chart with center label overlay. Tap segment = highlight.
```typescript
import { VictoryPie } from 'victory-native';

// Donut via innerRadius. Center label is an absolute-positioned View overlay.
<View style={{ width: 220, height: 220 }}>
  <VictoryPie
    data={categoryData}
    innerRadius={60}
    colorScale={categoryData.map(d => d.color)}
    events={[{ target: 'data', eventHandlers: { onPress: handleSegmentPress } }]}
    style={{ data: { stroke: colors.background, strokeWidth: 2 } }}
  />
  <View style={StyleSheet.absoluteFill} pointerEvents="none">
    {/* Center total label */}
  </View>
</View>
```

### Pattern 5: Payment Reliability Calculation
**What:** On-time % and avg days late, scoped to selected period.
**Rules (D-17, D-18, D-19):**
```typescript
function calcReliability(payments: Payment[], period: TimePeriod): TenantReliability[] {
  // Filter payments to period
  const filtered = filterByPeriod(payments, period);
  // Group by tenant
  return tenants.map(tenant => {
    const tenantPayments = filtered.filter(p => p.tenant_id === tenant.id)
      .filter(p => p.status === 'paid' || p.status === 'confirmed');
    const onTime = tenantPayments.filter(p =>
      p.paid_at && new Date(p.paid_at) <= new Date(p.due_date)
    );
    const late = tenantPayments.filter(p =>
      p.paid_at && new Date(p.paid_at) > new Date(p.due_date)
    );
    const avgDaysLate = late.length === 0 ? 0 :
      late.reduce((sum, p) => {
        const days = Math.floor(
          (new Date(p.paid_at!).getTime() - new Date(p.due_date).getTime())
          / (1000 * 60 * 60 * 24)
        );
        return sum + days;
      }, 0) / late.length;
    const pct = tenantPayments.length === 0 ? 100 :
      Math.round((onTime.length / tenantPayments.length) * 100);
    return { tenantName: tenant.tenant_name, onTimePct: pct, avgDaysLate };
  }).sort((a, b) => b.onTimePct - a.onTimePct);
}
```

### Pattern 6: Occupancy Calculation
**What:** Filled vs vacant units per period bucket. Occupancy = active (non-archived) tenant count.
```typescript
// Occupancy uses tenant presence at lease_start/lease_end, not payments.
// For simplicity: count active tenants at end of each period.
// Active = NOT is_archived AND (lease_end is null OR lease_end > period end date)
function calcOccupancy(tenants: Tenant[], totalUnits: number, buckets: PeriodBucket[]): OccupancyPoint[] {
  return buckets.map(bucket => {
    const periodEnd = new Date(bucket.endDate);
    const filled = tenants.filter(t =>
      !t.is_archived &&
      new Date(t.lease_start) <= periodEnd &&
      (t.lease_end === null || new Date(t.lease_end) > periodEnd)
    ).length;
    return { label: bucket.label, filled, vacant: totalUnits - filled };
  });
}
```

### Pattern 7: Tools Menu Activation
**What:** Flip Analytics card from `comingSoon: true` to `route: '/reports'` in `app/(tabs)/tools/index.tsx`.
```typescript
// Change this in TOOLS array:
{
  label: 'Analytics',
  description: 'Financial reports and insights',
  icon: 'chart-bar',
  color: '#F97316',
  route: '/reports',  // was: comingSoon: true
},
```

### Anti-Patterns to Avoid
- **Installing victory-native without version pin:** `npx expo install victory-native` gives v41+ which crashes without Skia. Always pin `@36`.
- **Realtime subscriptions on report screens:** Reports are historical aggregate data. No Realtime subscriptions needed — pull-to-refresh is sufficient (confirmed in UI-SPEC implementation notes).
- **`flex: 1` on chart containers:** Chart containers must use fixed pixel heights (200px P&L, 220px donut, 180px occupancy, 40px sparkline) for predictable empty-state overlay positioning.
- **Hardcoded hex colors:** All components must use `useTheme()` tokens. Dark mode is in production.
- **Computing aggregates in render:** Memoize with `useMemo` — aggregation over large payment arrays on every render causes jank.
- **Re-fetching on time control change:** Time controls change only the view of already-fetched data. Aggregate client-side; only refetch on `propertyId` change or pull-to-refresh.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| SVG charts | Custom SVG bar/pie primitives | victory-native@36 (VictoryBar, VictoryPie, VictoryStack, VictoryLine) | Grouped bars, donut innerRadius, tap events, axis formatting are non-trivial with raw SVG |
| Currency formatting | `₹{amount}` string interpolation | `formatCurrency()` from `lib/utils.ts` | Already handles INR Intl formatting correctly |
| Loading skeletons | Blinking box components | Adapt `ListSkeleton` / create `ReportSkeleton` from existing pattern | Pattern already established in project |
| Error banner | Inline error Text | `ErrorBanner` component | Already exists, matches design system |
| Empty state | Custom empty view | `EmptyState` component (with `titleStyle={{ fontSize: 16 }}`) | Already exists, use as-is except per-chart inline message |
| Animated card entrance | Opacity/translateY animation | `AnimatedCard` | Already built, handles stagger via `index` prop |
| Glass card surface | Custom card styling | `GlassCard` (variant="default") | Already built, theme-aware |

**Key insight:** The aggregation logic (income sums, expense grouping, reliability calc) is the true value-add; everything else is wiring into established project components.

---

## Common Pitfalls

### Pitfall 1: victory-native Version Mismatch
**What goes wrong:** Installing v41+ without Skia/Reanimated causes `Cannot find module '@shopify/react-native-skia'` at runtime — blank screen or crash.
**Why it happens:** npm latest and `expo install` (without version pin) both resolve to v41+.
**How to avoid:** `npx expo install victory-native@36` — pin to the 36.x series.
**Warning signs:** Import error mentioning `@shopify/react-native-skia` in Metro bundler output.

### Pitfall 2: VictoryChart Overflow on Fixed-Height Containers
**What goes wrong:** VictoryChart with default padding overflows or clips at the declared container height.
**Why it happens:** Victory adds internal padding (top/bottom) that eats into the container height.
**How to avoid:** Set explicit `padding={{ top: 10, bottom: 30, left: 50, right: 10 }}` on VictoryChart. Adjust to fit within the fixed container height.

### Pitfall 3: Empty Period — Zero vs No Data
**What goes wrong:** A period with zero income and zero expenses looks identical to "no payments recorded." Aggregation returns zeros; chart renders flat bars at zero.
**Why it happens:** Aggregation function produces `{ income: 0, expense: 0 }` for every bucket.
**How to avoid:** Distinguish between "query returned no rows" and "rows exist but sum to zero." Track `hasData` flag. Show the in-chart "No data for {period}" overlay only when no payment/expense rows exist for the period at all.

### Pitfall 4: due_date vs paid_at Timezone Drift in Reliability
**What goes wrong:** `paid_at` is a timestamptz (UTC); `due_date` is a date (no time). Comparing them directly shifts by timezone offset, causing correct-day payments to appear late.
**Why it happens:** `new Date(due_date)` in JS produces midnight UTC; `new Date(paid_at)` is an exact UTC timestamp.
**How to avoid:** Compare dates only (strip time from both): `new Date(p.paid_at!).toISOString().slice(0,10) <= p.due_date`.

### Pitfall 5: Occupancy Count Including Archived Tenants
**What goes wrong:** Archived tenants inflate the "filled" count.
**Why it happens:** Forgetting to filter `is_archived = false` when counting active tenants.
**How to avoid:** Always filter: `tenants.filter(t => !t.is_archived && ...)` in occupancy calculation.

### Pitfall 6: Portfolio Payments Query Scope
**What goes wrong:** The portfolio screen fetches payments across all properties but RLS filters to the user's owned properties. Accidentally including tenant-role payments inflates income figures.
**Why it happens:** `useAllExpenses()` already scopes by `user_id` but a cross-property payments query needs to join through `properties.owner_id`.
**How to avoid:** Follow `useDashboard.ts` pattern — query properties first, then filter payments by those property IDs. Or query payments with an inner join to `tenants` scoped to owner's properties.

---

## Code Examples

Verified patterns from existing codebase:

### Year Picker Pattern (from dashboard/index.tsx)
```typescript
// Existing pattern: horizontal scrollable chips
const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: CURRENT_YEAR - 1999 }, (_, i) => 2000 + i).reverse();

// In TimeControlBar: left/right chevron + active chip pattern
// Active chip style: primarySoft background + primary border
```

### Supabase Property+Payments Fetch Pattern (from useDashboard.ts)
```typescript
// Fetch owned properties first, then scope payments by year
const { data: properties } = await supabase
  .from('properties')
  .select('id, name, total_units, tenants(id, tenant_name, flat_no, lease_start, lease_end, is_archived, due_day)')
  .eq('owner_id', user.id)
  .eq('is_archived', false);

// Fetch payments for all tenants under this property for selected year
const tenantIds = tenants.map(t => t.id);
const { data: payments } = await supabase
  .from('payments')
  .select('*')
  .in('tenant_id', tenantIds)
  .eq('year', selectedYear);
```

### Analytics Tracking Pattern
```typescript
// useTrack() events for this phase:
useTrack('report_portfolio_viewed');
useTrack('report_property_viewed', { propertyId });
useTrack('report_granularity_changed', { granularity });
useTrack('report_chart_tapped', { chartType, period });
```

### Theme Token Usage (from theme.ts)
```typescript
const { colors, shadows, gradients } = useTheme();
// Chart fills: colors.statusConfirmed (income green), colors.error (expense red)
// Vacant fill: colors.statusPendingSoft
// Sparkline stroke: colors.primary
// Tooltip bg: colors.surface + shadows.sm
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| victory-native@36 (SVG-based) | victory-native@40+ (Skia-based, higher performance) | ~2023 (v40 release) | v40+ not compatible without Skia; use v36 for this project |
| Manual SVG chart primitives | victory-native@36 declarative API | Prior to this project | Lower complexity, use victory-native |

**Deprecated/outdated:**
- `react-native-chart-kit`: Less flexible for grouped bars and custom donut centers; still works but victory-native@36 is a better fit for this feature set.

---

## Open Questions

1. **Composite index location**
   - What we know: CONTEXT.md and STATE.md both say "Composite index added in migration 019 for report aggregate queries"
   - What's unclear: Migration 019 (`019_documents.sql`) is the documents migration — no composite index for payments/expenses was found when checking the file header. The index may have been planned but not yet created.
   - Recommendation: The planner should include a Wave 0 task to create migration 023 with the composite index (`CREATE INDEX idx_payments_tenant_year_month ON payments(tenant_id, year, month)`) or verify it exists elsewhere.

2. **`useTrack` hook — import path**
   - What we know: Mentioned in CONTEXT.md as `useTrack()` with `useTrack` named events
   - What's unclear: Source file not confirmed during research
   - Recommendation: Locate import path before writing analytics calls in implementation; likely in `lib/analytics.ts` or similar.

---

## Validation Architecture

`nyquist_validation` is `true` in `.planning/config.json` — this section is required.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | jest + jest-expo v55.0.9 |
| Config file | `jest.config.js` (root) |
| Quick run command | `npx jest __tests__/reports.test.ts -x` |
| Full suite command | `npx jest` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| RPT-01 | `aggregateByPeriod()` returns correct income/expense sums per bucket | unit | `npx jest __tests__/reports.test.ts::aggregateByPeriod -x` | Wave 0 |
| RPT-02 | `aggregateByCategory()` groups expenses by category correctly | unit | `npx jest __tests__/reports.test.ts::aggregateByCategory -x` | Wave 0 |
| RPT-03 | `calcReliability()` on-time % and avg days late calc is correct (incl. timezone edge) | unit | `npx jest __tests__/reports.test.ts::calcReliability -x` | Wave 0 |
| RPT-04 | `calcOccupancy()` counts filled/vacant correctly, excludes archived tenants | unit | `npx jest __tests__/reports.test.ts::calcOccupancy -x` | Wave 0 |
| RPT-05 | Portfolio aggregation sums cross-property KPIs correctly | unit | `npx jest __tests__/reports.test.ts::portfolioAggregation -x` | Wave 0 |

### Sampling Rate
- **Per task commit:** `npx jest __tests__/reports.test.ts -x`
- **Per wave merge:** `npx jest`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `__tests__/reports.test.ts` — covers all 5 RPT requirements (pure function tests for aggregation helpers)
- [ ] `lib/reports.ts` — aggregation helpers to be extracted here, making them independently testable without React hooks

*(Existing test infrastructure covers the framework setup; only the new test file and helper module are needed.)*

---

## Sources

### Primary (HIGH confidence)
- `package.json` (project root) — verified all installed dependencies: react-native-svg@15.12.1, no Skia/Reanimated/GestureHandler
- `npm view victory-native@36.9.2 peerDependencies` — verified: `{ react: '>=16.6.0' }` only
- `npm view victory-native version` — confirmed latest is 41.20.2 with Skia peer deps
- `npm view victory-native peerDependencies` — confirmed v41 requires Skia >=1.2.3
- `09-CONTEXT.md` — all locked decisions
- `09-UI-SPEC.md` — component inventory, spacing, typography, interaction contracts
- `hooks/useDashboard.ts` — payment fetch + property scope pattern
- `hooks/useAllExpenses.ts` — cross-property expense fetch pattern
- `lib/expenses.ts` — EXPENSE_CATEGORIES with colors
- `lib/types.ts` — Payment, Tenant, Property, Expense interfaces (including `due_date`, `paid_at` field types)
- `__tests__/setup.ts`, `jest.config.js` — test infrastructure confirmed

### Secondary (MEDIUM confidence)
- `.planning/STATE.md` — decision log confirming no Edge Functions, composite index planned for migration 019
- `supabase/migrations/022_maintenance_requests.sql` — confirmed latest migration number is 022; no composite index for payments found in 019

### Tertiary (LOW confidence)
- STATE.md claim "Composite index added in migration 019" — LOW confidence that the index was actually created; migration 019 file header shows documents table only. Needs verification.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — verified via npm registry; version incompatibility confirmed
- Architecture: HIGH — drawn directly from existing hooks, types, and UI-SPEC contracts
- Pitfalls: HIGH — timezone and archived-tenant pitfalls drawn from code inspection; version pitfall confirmed empirically
- Composite index: LOW — STATE.md claims it exists in migration 019 but file content does not confirm it

**Research date:** 2026-03-21
**Valid until:** 2026-04-21 (stable dependencies; victory-native@36 is no longer actively developed)
