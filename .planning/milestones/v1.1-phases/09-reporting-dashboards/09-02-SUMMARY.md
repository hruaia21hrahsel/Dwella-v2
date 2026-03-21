---
phase: 09-reporting-dashboards
plan: 02
subsystem: ui
tags: [reporting, charts, victory-native, react-native, theme-system]

dependency_graph:
  requires:
    - phase: 09-01
      provides: lib/reports.ts with MonthlyPL, CategoryBreakdown, OccupancyPoint types
  provides:
    - ChartTooltip: absolute-positioned floating tooltip for chart tap interactions
    - ChartSectionCard: GlassCard wrapper with MaterialCommunityIcons section heading
    - PLBarChart: VictoryGroup grouped bar chart for income vs expense
    - DonutChart: VictoryPie donut chart with center label overlay and legend
    - OccupancyChart: VictoryStack stacked bar chart for filled vs vacant units
    - SparklineChart: minimal 40px VictoryLine sparkline for property cards
  affects: [09-03, 09-04]

tech-stack:
  added: []
  patterns:
    - "Victory @36 style-as-function pattern: cast style prop to any for per-datum fill/opacity callbacks (victory-core CallbackArgs has datum?: optional)"
    - "Absolute-positioned tooltip inside relative-positioned chart container"
    - "VictoryGroup with two VictoryBar children (not per-datum mapped arrays) for correct grouping behavior"
    - "VictoryStack with two VictoryBar children for correct stacking behavior"

key-files:
  created:
    - components/ChartTooltip.tsx
    - components/ChartSectionCard.tsx
    - components/PLBarChart.tsx
    - components/DonutChart.tsx
    - components/OccupancyChart.tsx
    - components/SparklineChart.tsx
  modified: []

key-decisions:
  - "Victory @36 style callbacks require casting style prop to `any` — VictoryStringOrNumberCallback signature uses CallbackArgs with `datum?: Datum` (optional) which is incompatible with custom DatumShape types; eslint-disable-next-line comment added per usage"
  - "Per-datum dim effect achieved via fill function returning color with 66 hex suffix for 0.4 opacity approximation rather than using opacity property (avoids stacking opacity issues)"
  - "DonutChart fallback: when hasData=false, renders a single grey segment with amount=1 so the pie ring remains visible as an empty-state frame"
  - "PLBarChart and OccupancyChart use two VictoryBar children in VictoryGroup/VictoryStack (not per-element mapping) — Victory expects complete series as children, not individual bars"

requirements-completed:
  - RPT-01
  - RPT-02
  - RPT-04

duration: 5min
completed: "2026-03-21"
---

# Phase 09 Plan 02: Chart Components Summary

**Six Victory Native @36 chart components with per-datum tap-to-highlight, floating tooltip overlay, empty-state frames, and theme-aware colors throughout.**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-21T10:18:08Z
- **Completed:** 2026-03-21T10:23:00Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments

- ChartTooltip and ChartSectionCard foundation components using GlassCard and useTheme
- PLBarChart with VictoryGroup (income=statusConfirmed, expense=error), tap-to-highlight via fill function, empty state overlay preserving 200px height
- DonutChart with VictoryPie innerRadius=60, center label absoluteFill overlay, per-datum opacity, category legend
- OccupancyChart with VictoryStack (filled=statusConfirmed, vacant=statusPendingSoft), tap tooltip showing unit counts
- SparklineChart with no axes/labels, 40px height, returns empty View when all data is zero

## Task Commits

Each task was committed atomically:

1. **Task 1: ChartTooltip and ChartSectionCard foundation components** - `5c1b1f6` (feat)
2. **Task 2: PLBarChart, DonutChart, OccupancyChart, SparklineChart** - `f81b1f1` (feat)

## Files Created/Modified

- `components/ChartTooltip.tsx` - Floating tooltip bubble, absolute-positioned, auto-flips when in right half of chart
- `components/ChartSectionCard.tsx` - GlassCard wrapper with MaterialCommunityIcons icon + title heading row
- `components/PLBarChart.tsx` - VictoryGroup grouped bar chart with two VictoryBar series, 200px container, tap interaction, empty overlay
- `components/DonutChart.tsx` - VictoryPie donut chart with innerRadius=60, center label overlay, category legend, 220px container
- `components/OccupancyChart.tsx` - VictoryStack stacked bar chart, 180px container, tap tooltip with unit counts, filled/vacant legend
- `components/SparklineChart.tsx` - VictoryLine sparkline, 40px default height, no axes or labels

## Decisions Made

- Victory @36 style callbacks cast to `any` — the library's `VictoryStringOrNumberCallback` type uses `CallbackArgs` with `datum?: Datum` (optional field), which conflicts with custom datum types. Using `// eslint-disable-next-line @typescript-eslint/no-explicit-any` on each style object allows per-datum fill/opacity functions while keeping all other TypeScript checks clean.
- Per-datum dim: achieved via `color + '66'` (appending hex for ~40% opacity) rather than an `opacity` property on individual bars to avoid stacking opacity artifacts in VictoryStack.
- DonutChart empty state: renders a single `colors.border` segment with y=1 so the VictoryPie ring remains visible as an empty frame (per D-20/D-21 — container height and chart frame must persist when hasData=false).
- VictoryGroup/VictoryStack children: two complete VictoryBar series as direct children, not per-element mapped arrays. This is the correct Victory API pattern for grouped and stacked charts.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Rewrote PLBarChart from per-element mapping to full-series VictoryBar children**
- **Found during:** Task 2 (PLBarChart implementation)
- **Issue:** Initial implementation mapped `incomeData.map(...)` inside VictoryGroup, creating N individual VictoryBar children per series. Victory @36 expects exactly two VictoryBar children inside VictoryGroup — one per series with all data points. Per-element mapping produces incorrect grouping behavior.
- **Fix:** Replaced per-element mapping with two `VictoryBar data={incomeData}` and `VictoryBar data={expenseData}` children using per-datum fill functions.
- **Files modified:** components/PLBarChart.tsx
- **Verification:** npx tsc --noEmit clean
- **Committed in:** f81b1f1

**2. [Rule 1 - Bug] Rewrote OccupancyChart from per-element mapping to full-series VictoryBar children inside VictoryStack**
- **Found during:** Task 2 (OccupancyChart implementation)
- **Issue:** Same issue as PLBarChart — per-element mapping inside VictoryStack produces N*2 bar children instead of 2 series children.
- **Fix:** Two `VictoryBar data={filledData}` and `VictoryBar data={vacantData}` as direct VictoryStack children with per-datum fill functions.
- **Files modified:** components/OccupancyChart.tsx
- **Verification:** npx tsc --noEmit clean
- **Committed in:** f81b1f1

**3. [Rule 1 - Bug] Cast Victory style props to `any` to resolve VictoryStringOrNumberCallback type mismatch**
- **Found during:** Task 2 (TypeScript check)
- **Issue:** Custom per-datum fill functions `({ datum }: { datum: DatumShape }) => string` are incompatible with `VictoryStringOrNumberCallback` which expects `(args: CallbackArgs) => string | number` where `CallbackArgs.datum` is optional.
- **Fix:** Added `// eslint-disable-next-line @typescript-eslint/no-explicit-any` and cast each style object to `any`.
- **Files modified:** components/PLBarChart.tsx, components/DonutChart.tsx, components/OccupancyChart.tsx
- **Verification:** npx tsc --noEmit clean (0 errors)
- **Committed in:** f81b1f1

---

**Total deviations:** 3 auto-fixed (3 Rule 1 bugs)
**Impact on plan:** All auto-fixes necessary for correct Victory API usage and TypeScript compilation. No scope creep.

## Issues Encountered

- victory-native@36 `VictoryStyleInterface` types are loose — per-datum fill callbacks require bypassing the type system. This is a known limitation of victory@36 types (pre-strict-types era). The `as any` cast is the standard workaround for this library version.

## Known Stubs

None — all 6 components are fully implemented with correct rendering logic, theme-aware colors, tap interactions, and empty states.

## Next Phase Readiness

- All 6 chart components ready for assembly in Plan 03 (report screens)
- ChartSectionCard provides the section heading + GlassCard wrapper needed by PLBarChart, DonutChart, OccupancyChart sections
- SparklineChart ready for use on PropertyReportCard (Plan 03)
- All components type-check clean with zero TypeScript errors

## Self-Check: PASSED

- `components/ChartTooltip.tsx`: FOUND
- `components/ChartSectionCard.tsx`: FOUND
- `components/PLBarChart.tsx`: FOUND
- `components/DonutChart.tsx`: FOUND
- `components/OccupancyChart.tsx`: FOUND
- `components/SparklineChart.tsx`: FOUND
- Commit 5c1b1f6 (Task 1 — ChartTooltip + ChartSectionCard): FOUND
- Commit f81b1f1 (Task 2 — 4 chart components): FOUND
- npx tsc --noEmit: CLEAN (0 errors)
- Zero hardcoded hex values in any chart component: VERIFIED

---
*Phase: 09-reporting-dashboards*
*Completed: 2026-03-21*
