/**
 * Report aggregation helpers for Dwella reporting dashboards.
 *
 * All functions are pure (no side effects, no DB calls) and operate
 * on arrays of Payment, Expense, Tenant, and Property objects that
 * callers fetch from Supabase.
 *
 * Coverage:
 *   RPT-01 — P&L aggregation (aggregateByPeriod, aggregatePortfolio)
 *   RPT-02 — Expense category breakdown (aggregateByCategory)
 *   RPT-03 — Payment reliability per tenant (calcReliability)
 *   RPT-04 — Occupancy over time (calcOccupancy)
 *   RPT-05 — Portfolio-wide KPIs (aggregatePortfolio)
 */

import { Payment, Expense, Tenant, Property, ExpenseCategory } from './types';
import { getCategoryColor, getCategoryLabel } from './expenses';
import { getMonthName } from './utils';

// ─── Type Definitions ────────────────────────────────────────────────────────

/** Report time granularity. */
export type Granularity = 'yearly' | 'quarterly' | 'monthly';

/**
 * Describes the time window for a report.
 * - yearly:    full year, broken into 4 quarter buckets
 * - quarterly: a single quarter, broken into 3 month buckets
 * - monthly:   a single month, returned as 1 bucket
 */
export interface TimePeriod {
  year: number;
  granularity: Granularity;
  /** Required when granularity = 'quarterly'. */
  quarter?: 1 | 2 | 3 | 4;
  /** Required when granularity = 'monthly'. */
  month?: number;
}

/**
 * A time bucket used internally for grouping data.
 * `months` lists the calendar months (1–12) that fall in this bucket.
 * `startDate` and `endDate` are ISO date strings (YYYY-MM-DD) for
 * boundary comparisons (e.g. occupancy lease-date logic).
 */
export interface PeriodBucket {
  label: string;
  months: number[];
  startDate: string;
  endDate: string;
}

/** A single bar/data-point in a P&L chart. */
export interface MonthlyPL {
  label: string;
  income: number;
  expense: number;
}

/** A single slice in an expense donut chart. */
export interface CategoryBreakdown {
  category: ExpenseCategory;
  label: string;
  amount: number;
  color: string;
}

/** Reliability score for one tenant. */
export interface TenantReliability {
  tenantId: string;
  tenantName: string;
  flatNo: string;
  /** Percentage of payments made on or before due_date (0–100). */
  onTimePct: number;
  /** Mean days late across LATE payments only; 0 if all on-time. */
  avgDaysLate: number;
  /** Number of paid/confirmed payments counted in this period. */
  totalPayments: number;
}

/** A single bar in the occupancy chart. */
export interface OccupancyPoint {
  label: string;
  filled: number;
  vacant: number;
}

/** Top-level KPIs shown on the portfolio screen. */
export interface PortfolioKPIs {
  totalIncome: number;
  totalExpenses: number;
  netPL: number;
  filledUnits: number;
  totalUnits: number;
}

/** Per-property summary row shown in the portfolio list. */
export interface PropertySummary {
  propertyId: string;
  propertyName: string;
  netPL: number;
  filledUnits: number;
  totalUnits: number;
  /** Always 12 monthly data-points (Jan–Dec) for sparkline rendering. */
  monthlyPL: MonthlyPL[];
}

// ─── Internal helpers ────────────────────────────────────────────────────────

/** Zero-pad a number to 2 digits. */
function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/** Last day of a given month (1-indexed). */
function lastDay(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

/** ISO date string for the first day of a month. */
function monthStart(year: number, month: number): string {
  return `${year}-${pad2(month)}-01`;
}

/** ISO date string for the last day of a month. */
function monthEnd(year: number, month: number): string {
  return `${year}-${pad2(month)}-${pad2(lastDay(year, month))}`;
}

/** Short month label, e.g. "Apr". */
function shortMonth(month: number): string {
  return getMonthName(month).slice(0, 3);
}

// ─── getPeriodBuckets ────────────────────────────────────────────────────────

/**
 * Returns the time buckets that correspond to a given TimePeriod.
 *
 * - yearly    → 4 quarter buckets (Q1–Q4)
 * - quarterly → 3 monthly buckets for that quarter
 * - monthly   → 1 bucket for that month
 */
export function getPeriodBuckets(period: TimePeriod): PeriodBucket[] {
  const { year, granularity, quarter, month } = period;

  if (granularity === 'monthly') {
    const m = month ?? 1;
    return [
      {
        label: shortMonth(m),
        months: [m],
        startDate: monthStart(year, m),
        endDate: monthEnd(year, m),
      },
    ];
  }

  if (granularity === 'quarterly') {
    const q = quarter ?? 1;
    const startMonth = (q - 1) * 3 + 1; // Q1→1, Q2→4, Q3→7, Q4→10
    return [0, 1, 2].map((offset) => {
      const m = startMonth + offset;
      return {
        label: shortMonth(m),
        months: [m],
        startDate: monthStart(year, m),
        endDate: monthEnd(year, m),
      };
    });
  }

  // yearly → 4 quarter buckets
  return [1, 2, 3, 4].map((q) => {
    const startMonth = (q - 1) * 3 + 1;
    const endMonth = startMonth + 2;
    return {
      label: `Q${q}`,
      months: [startMonth, startMonth + 1, endMonth],
      startDate: monthStart(year, startMonth),
      endDate: monthEnd(year, endMonth),
    };
  });
}

// ─── filterByPeriod ──────────────────────────────────────────────────────────

type PeriodFilterable =
  | { month: number; year: number; expense_date?: undefined }
  | { expense_date: string; month?: undefined; year?: undefined }
  | { month?: number; year?: number; expense_date?: string };

/**
 * Filters an array of Payment-like or Expense-like objects to only those
 * that fall within the given TimePeriod.
 *
 * For items with `month` + `year` fields (Payments): matches by year,
 * and by the months that belong to the period buckets.
 * For items with `expense_date` (Expenses): parses the date and matches
 * the same way.
 */
export function filterByPeriod<T extends PeriodFilterable>(items: T[], period: TimePeriod): T[] {
  const buckets = getPeriodBuckets(period);
  const allowedMonths = new Set(buckets.flatMap((b) => b.months));

  return items.filter((item) => {
    if ('expense_date' in item && item.expense_date) {
      const d = new Date(item.expense_date);
      const y = d.getFullYear();
      const m = d.getMonth() + 1;
      return y === period.year && allowedMonths.has(m);
    }
    // Payment-style: month + year fields
    const itemYear = (item as { year: number }).year;
    const itemMonth = (item as { month: number }).month;
    return itemYear === period.year && allowedMonths.has(itemMonth);
  });
}

// ─── aggregateByPeriod ───────────────────────────────────────────────────────

/**
 * Aggregates income and expenses into period buckets for a P&L bar chart.
 *
 * Income rule: only `paid` and `confirmed` payments count (using `amount_paid`).
 * Pending, partial, and overdue payments are excluded from income.
 */
export function aggregateByPeriod(
  payments: Payment[],
  expenses: Expense[],
  period: TimePeriod,
): MonthlyPL[] {
  const buckets = getPeriodBuckets(period);

  return buckets.map((bucket) => {
    // Income: paid/confirmed payments whose month is in this bucket
    const income = payments
      .filter(
        (p) =>
          p.year === period.year &&
          bucket.months.includes(p.month) &&
          (p.status === 'paid' || p.status === 'confirmed'),
      )
      .reduce((sum, p) => sum + p.amount_paid, 0);

    // Expenses: by expense_date
    const expense = expenses
      .filter((e) => {
        const d = new Date(e.expense_date);
        return d.getFullYear() === period.year && bucket.months.includes(d.getMonth() + 1);
      })
      .reduce((sum, e) => sum + e.amount, 0);

    return { label: bucket.label, income, expense };
  });
}

// ─── aggregateByCategory ─────────────────────────────────────────────────────

/**
 * Groups expenses by category and returns breakdown data for a donut chart.
 * Expenses are first filtered to those within the given period.
 * Categories with zero total are omitted from the result.
 */
export function aggregateByCategory(expenses: Expense[], period: TimePeriod): CategoryBreakdown[] {
  const inPeriod = filterByPeriod(expenses, period);

  const totals = new Map<ExpenseCategory, number>();
  for (const e of inPeriod) {
    totals.set(e.category, (totals.get(e.category) ?? 0) + e.amount);
  }

  const result: CategoryBreakdown[] = [];
  for (const [category, amount] of totals.entries()) {
    if (amount > 0) {
      result.push({
        category,
        label: getCategoryLabel(category),
        amount,
        color: getCategoryColor(category),
      });
    }
  }

  return result;
}

// ─── calcReliability ─────────────────────────────────────────────────────────

/**
 * Computes payment reliability per tenant for the given period.
 *
 * On-time rule (D-17 + pitfall 4): compare `.toISOString().slice(0, 10)`
 * against `due_date` (a plain date string). This strips timezone offset and
 * compares calendar days only — a payment made at 23:59 UTC on the due date
 * is considered on-time.
 *
 * avgDaysLate (D-18): mean of (paidDate - dueDate) in days for LATE payments
 * only; 0 if all payments were on-time.
 *
 * Results are sorted by onTimePct descending (D-03, best performers first).
 */
export function calcReliability(
  payments: Payment[],
  tenants: Tenant[],
  period: TimePeriod,
): TenantReliability[] {
  const inPeriod = filterByPeriod(payments, period) as Payment[];

  const results: TenantReliability[] = tenants.map((tenant) => {
    const tenantPayments = inPeriod.filter(
      (p) =>
        p.tenant_id === tenant.id &&
        (p.status === 'paid' || p.status === 'confirmed') &&
        p.paid_at !== null,
    );

    if (tenantPayments.length === 0) {
      return {
        tenantId: tenant.id,
        tenantName: tenant.tenant_name,
        flatNo: tenant.flat_no,
        onTimePct: 100,
        avgDaysLate: 0,
        totalPayments: 0,
      };
    }

    let onTimeCount = 0;
    const lateDays: number[] = [];

    for (const p of tenantPayments) {
      // Timezone-safe: compare ISO date strings (YYYY-MM-DD only)
      const paidDate = new Date(p.paid_at!).toISOString().slice(0, 10);
      const isOnTime = paidDate <= p.due_date;

      if (isOnTime) {
        onTimeCount++;
      } else {
        const paidMs = new Date(paidDate).getTime();
        const dueMs = new Date(p.due_date).getTime();
        const days = Math.round((paidMs - dueMs) / (1000 * 60 * 60 * 24));
        lateDays.push(days);
      }
    }

    const onTimePct = Math.round((onTimeCount / tenantPayments.length) * 100);
    const avgDaysLate =
      lateDays.length > 0
        ? Math.round(lateDays.reduce((a, b) => a + b, 0) / lateDays.length)
        : 0;

    return {
      tenantId: tenant.id,
      tenantName: tenant.tenant_name,
      flatNo: tenant.flat_no,
      onTimePct,
      avgDaysLate,
      totalPayments: tenantPayments.length,
    };
  });

  // Sort by onTimePct descending (best first), then by name for tie-breaking
  return results.sort(
    (a, b) => b.onTimePct - a.onTimePct || a.tenantName.localeCompare(b.tenantName),
  );
}

// ─── calcOccupancy ───────────────────────────────────────────────────────────

/**
 * Computes occupancy (filled vs vacant units) for each period bucket.
 *
 * A tenant is counted as filling a unit in a bucket when ALL of:
 *   1. `!t.is_archived`
 *   2. `lease_start` is on or before the bucket's `endDate`
 *   3. `lease_end` is null (no end), or after the bucket's `endDate`
 *
 * (pitfall 5 from research notes)
 */
export function calcOccupancy(
  tenants: Tenant[],
  totalUnits: number,
  period: TimePeriod,
): OccupancyPoint[] {
  const buckets = getPeriodBuckets(period);

  return buckets.map((bucket) => {
    const bucketEnd = new Date(bucket.endDate);

    const filled = tenants.filter((t) => {
      if (t.is_archived) return false;
      const leaseStart = new Date(t.lease_start);
      if (leaseStart > bucketEnd) return false;
      if (t.lease_end !== null && new Date(t.lease_end) <= bucketEnd) return false;
      return true;
    }).length;

    return {
      label: bucket.label,
      filled,
      vacant: totalUnits - filled,
    };
  });
}

// ─── aggregatePortfolio ──────────────────────────────────────────────────────

type PropertyWithTenants = Property & { tenants: Tenant[] };

/**
 * Rolls up income, expenses, P&L, and occupancy across multiple properties.
 *
 * Returns:
 *   - `kpis`: portfolio-wide totals
 *   - `summaries`: per-property breakdown including a 12-month sparkline
 *
 * The sparkline (`monthlyPL`) always has 12 monthly data-points for the
 * selected year, regardless of the granularity chosen for the report.
 * This ensures the sparkline shows the full annual trend.
 */
export function aggregatePortfolio(
  properties: PropertyWithTenants[],
  allPayments: Payment[],
  allExpenses: Expense[],
  period: TimePeriod,
): { kpis: PortfolioKPIs; summaries: PropertySummary[] } {
  if (properties.length === 0) {
    return {
      kpis: { totalIncome: 0, totalExpenses: 0, netPL: 0, filledUnits: 0, totalUnits: 0 },
      summaries: [],
    };
  }

  // 12-month period for sparklines — always full year
  const sparklinePeriod: TimePeriod = { year: period.year, granularity: 'monthly', month: 1 };

  let totalIncome = 0;
  let totalExpenses = 0;
  let filledUnits = 0;
  let totalUnits = 0;

  const summaries: PropertySummary[] = properties.map((property) => {
    const propPayments = allPayments.filter((p) => p.property_id === property.id);
    const propExpenses = allExpenses.filter((e) => e.property_id === property.id);

    // P&L for selected period
    const pl = aggregateByPeriod(propPayments, propExpenses, period);
    const propIncome = pl.reduce((s, b) => s + b.income, 0);
    const propExpense = pl.reduce((s, b) => s + b.expense, 0);

    // 12-month sparkline (Jan–Dec)
    const monthlyPL: MonthlyPL[] = Array.from({ length: 12 }, (_, i) => {
      const m = i + 1;
      const bucket: PeriodBucket = {
        label: shortMonth(m),
        months: [m],
        startDate: monthStart(period.year, m),
        endDate: monthEnd(period.year, m),
      };
      const income = propPayments
        .filter(
          (p) =>
            p.year === period.year &&
            p.month === m &&
            (p.status === 'paid' || p.status === 'confirmed'),
        )
        .reduce((s, p) => s + p.amount_paid, 0);
      const expense = propExpenses
        .filter((e) => {
          const d = new Date(e.expense_date);
          return d.getFullYear() === period.year && d.getMonth() + 1 === m;
        })
        .reduce((s, e) => s + e.amount, 0);
      return { label: bucket.label, income, expense };
    });

    // Occupancy for selected period (first bucket for KPI)
    const occupancy = calcOccupancy(property.tenants, property.total_units, period);
    const propFilled = occupancy.length > 0 ? occupancy[0].filled : 0;

    totalIncome += propIncome;
    totalExpenses += propExpense;
    filledUnits += propFilled;
    totalUnits += property.total_units;

    return {
      propertyId: property.id,
      propertyName: property.name,
      netPL: propIncome - propExpense,
      filledUnits: propFilled,
      totalUnits: property.total_units,
      monthlyPL,
    };
  });

  return {
    kpis: {
      totalIncome,
      totalExpenses,
      netPL: totalIncome - totalExpenses,
      filledUnits,
      totalUnits,
    },
    summaries,
  };
}
