/**
 * Unit tests for report aggregation helpers in lib/reports.ts
 * Coverage: RPT-01 (P&L), RPT-02 (expenses), RPT-03 (reliability),
 *           RPT-04 (occupancy), RPT-05 (portfolio)
 */

import {
  getPeriodBuckets,
  filterByPeriod,
  aggregateByPeriod,
  aggregateByCategory,
  calcReliability,
  calcOccupancy,
  aggregatePortfolio,
  TimePeriod,
  Granularity,
  MonthlyPL,
  CategoryBreakdown,
  TenantReliability,
  OccupancyPoint,
  PortfolioKPIs,
  PropertySummary,
  PeriodBucket,
} from '@/lib/reports';
import { Payment, Expense, Tenant, Property, ExpenseCategory } from '@/lib/types';

// ─── Mock helpers ───────────────────────────────────────────────────────────

function makePayment(overrides: Partial<Payment> = {}): Payment {
  return {
    id: 'pay-1',
    tenant_id: 'tenant-1',
    property_id: 'prop-1',
    amount_due: 10000,
    amount_paid: 10000,
    status: 'confirmed',
    month: 4,
    year: 2025,
    due_date: '2025-04-05',
    paid_at: '2025-04-04T12:00:00Z',
    confirmed_at: null,
    auto_confirmed: false,
    proof_url: null,
    notes: null,
    created_at: '2025-04-01T00:00:00Z',
    updated_at: '2025-04-01T00:00:00Z',
    ...overrides,
  };
}

function makeExpense(overrides: Partial<Expense> = {}): Expense {
  return {
    id: 'exp-1',
    property_id: 'prop-1',
    user_id: 'user-1',
    amount: 5000,
    category: 'repairs' as ExpenseCategory,
    description: null,
    expense_date: '2025-04-15',
    maintenance_request_id: null,
    created_at: '2025-04-15T00:00:00Z',
    updated_at: '2025-04-15T00:00:00Z',
    ...overrides,
  };
}

function makeTenant(overrides: Partial<Tenant> = {}): Tenant {
  return {
    id: 'tenant-1',
    property_id: 'prop-1',
    user_id: 'user-1',
    flat_no: '101',
    tenant_name: 'Alice',
    monthly_rent: 10000,
    security_deposit: 20000,
    due_day: 5,
    lease_start: '2024-01-01',
    lease_end: null,
    invite_token: 'token-1',
    invite_status: 'accepted',
    photo_url: null,
    notes: null,
    is_archived: false,
    archived_at: null,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    ...overrides,
  };
}

function makeProperty(overrides: Partial<Property> = {}): Property {
  return {
    id: 'prop-1',
    owner_id: 'user-1',
    name: 'Sunrise Apartments',
    address: '123 Main St',
    city: 'Mumbai',
    total_units: 4,
    color: '#4F46E5',
    notes: null,
    is_archived: false,
    archived_at: null,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    ...overrides,
  };
}

// FY 2025 = Apr 2025 – Mar 2026
// Q1=Apr-Jun, Q2=Jul-Sep, Q3=Oct-Dec, Q4=Jan-Mar(2026)
const yearlyPeriod: TimePeriod = { year: 2025, granularity: 'yearly' };
const q2Period: TimePeriod = { year: 2025, granularity: 'quarterly', quarter: 2 };
const monthlyPeriod: TimePeriod = { year: 2025, granularity: 'monthly', month: 7 };

// ─── getPeriodBuckets ────────────────────────────────────────────────────────

describe('getPeriodBuckets', () => {
  test('yearly: returns 4 quarter buckets', () => {
    const buckets = getPeriodBuckets(yearlyPeriod);
    expect(buckets).toHaveLength(4);
    expect(buckets[0].label).toMatch(/Q1/i);
    expect(buckets[1].label).toMatch(/Q2/i);
    expect(buckets[2].label).toMatch(/Q3/i);
    expect(buckets[3].label).toMatch(/Q4/i);
  });

  test('yearly: Q1 covers months 4-6 (Apr-Jun)', () => {
    const buckets = getPeriodBuckets(yearlyPeriod);
    expect(buckets[0].months).toEqual([4, 5, 6]);
  });

  test('yearly: Q4 covers months 1-3 (Jan-Mar of next calendar year)', () => {
    const buckets = getPeriodBuckets(yearlyPeriod);
    expect(buckets[3].months).toEqual([1, 2, 3]);
    // Q4 of FY 2025 is Jan-Mar 2026
    expect(buckets[3].startDate).toBe('2026-01-01');
    expect(buckets[3].endDate).toBe('2026-03-31');
  });

  test('quarterly Q2: returns 3 month buckets for Jul-Sep', () => {
    const buckets = getPeriodBuckets(q2Period);
    expect(buckets).toHaveLength(3);
    expect(buckets[0].label).toMatch(/Jul/i);
    expect(buckets[1].label).toMatch(/Aug/i);
    expect(buckets[2].label).toMatch(/Sep/i);
  });

  test('quarterly Q2: each bucket has 1 month', () => {
    const buckets = getPeriodBuckets(q2Period);
    expect(buckets[0].months).toEqual([7]);
    expect(buckets[1].months).toEqual([8]);
    expect(buckets[2].months).toEqual([9]);
  });

  test('monthly month=7: returns 1 bucket for July', () => {
    const buckets = getPeriodBuckets(monthlyPeriod);
    expect(buckets).toHaveLength(1);
    expect(buckets[0].label).toMatch(/Jul/i);
    expect(buckets[0].months).toEqual([7]);
  });

  test('buckets include startDate and endDate as ISO date strings', () => {
    const buckets = getPeriodBuckets(yearlyPeriod);
    // Q1 = Apr-Jun 2025
    expect(buckets[0].startDate).toBe('2025-04-01');
    expect(buckets[0].endDate).toBe('2025-06-30');
    // Q3 = Oct-Dec 2025
    expect(buckets[2].startDate).toBe('2025-10-01');
    expect(buckets[2].endDate).toBe('2025-12-31');
  });
});

// ─── filterByPeriod ──────────────────────────────────────────────────────────

describe('filterByPeriod', () => {
  test('filters payments within FY year (Apr-Dec of year, Jan-Mar of year+1)', () => {
    const payments = [
      makePayment({ year: 2025, month: 5 }),           // May 2025 — in FY 2025 Q1
      makePayment({ id: 'pay-2', year: 2026, month: 2 }), // Feb 2026 — in FY 2025 Q4
      makePayment({ id: 'pay-3', year: 2024, month: 3 }), // Mar 2024 — NOT in FY 2025
    ];
    const filtered = filterByPeriod(payments, yearlyPeriod);
    expect(filtered).toHaveLength(2);
  });

  test('filters payments by FY quarter months for quarterly period', () => {
    // Q2 of FY 2025 = Jul, Aug, Sep 2025
    const payments = [
      makePayment({ id: 'pay-jul', month: 7, year: 2025 }),
      makePayment({ id: 'pay-aug', month: 8, year: 2025 }),
      makePayment({ id: 'pay-sep', month: 9, year: 2025 }),
      makePayment({ id: 'pay-apr', month: 4, year: 2025 }), // Q1, not Q2
    ];
    const filtered = filterByPeriod(payments, q2Period);
    expect(filtered).toHaveLength(3);
  });

  test('filters expenses by expense_date for yearly FY period', () => {
    const expenses = [
      makeExpense({ expense_date: '2025-06-15' }),     // Jun 2025 — in FY 2025
      makeExpense({ id: 'exp-2', expense_date: '2025-03-15' }), // Mar 2025 — NOT in FY 2025 (it's FY 2024 Q4)
    ];
    const filtered = filterByPeriod(expenses, yearlyPeriod);
    expect(filtered).toHaveLength(1);
  });

  test('filters expenses by expense_date month for monthly period', () => {
    const expenses = [
      makeExpense({ expense_date: '2025-07-10' }),
      makeExpense({ id: 'exp-2', expense_date: '2025-08-10' }),
    ];
    const filtered = filterByPeriod(expenses, monthlyPeriod);
    expect(filtered).toHaveLength(1);
  });
});

// ─── aggregateByPeriod ───────────────────────────────────────────────────────

describe('aggregateByPeriod', () => {
  test('groups confirmed and paid payments as income in FY Q1 (Apr-Jun)', () => {
    const payments = [
      makePayment({ month: 4, year: 2025, amount_paid: 10000, status: 'confirmed' }),
      makePayment({ id: 'pay-2', month: 4, year: 2025, amount_paid: 8000, status: 'paid' }),
    ];
    const result = aggregateByPeriod(payments, [], yearlyPeriod);
    const q1 = result.find((r) => r.label === 'Q1');
    expect(q1).toBeDefined();
    expect(q1!.income).toBe(18000);
  });

  test('pending and overdue payments are NOT counted as income', () => {
    const payments = [
      makePayment({ month: 4, year: 2025, amount_paid: 10000, status: 'pending' }),
      makePayment({ id: 'pay-2', month: 5, year: 2025, amount_paid: 10000, status: 'overdue' }),
    ];
    const result = aggregateByPeriod(payments, [], yearlyPeriod);
    result.forEach((bucket) => {
      expect(bucket.income).toBe(0);
    });
  });

  test('partial payments are not counted as income (only paid/confirmed)', () => {
    const payments = [
      makePayment({ month: 4, year: 2025, amount_paid: 5000, status: 'partial' }),
    ];
    const result = aggregateByPeriod(payments, [], yearlyPeriod);
    const q1 = result.find((r) => r.label === 'Q1');
    expect(q1!.income).toBe(0);
  });

  test('empty period returns MonthlyPL with income=0 and expense=0', () => {
    const result = aggregateByPeriod([], [], yearlyPeriod);
    expect(result).toHaveLength(4); // 4 FY quarters
    result.forEach((bucket) => {
      expect(bucket.income).toBe(0);
      expect(bucket.expense).toBe(0);
    });
  });

  test('multiple payments in same FY quarter sum correctly', () => {
    const payments = [
      makePayment({ month: 4, year: 2025, amount_paid: 10000, status: 'confirmed' }),
      makePayment({ id: 'pay-2', month: 5, year: 2025, amount_paid: 10000, status: 'confirmed' }),
      makePayment({ id: 'pay-3', month: 6, year: 2025, amount_paid: 10000, status: 'confirmed' }),
    ];
    const result = aggregateByPeriod(payments, [], yearlyPeriod);
    const q1 = result.find((r) => r.label === 'Q1');
    expect(q1!.income).toBe(30000);
  });

  test('expenses are summed into correct FY quarter bucket (Q2=Jul-Sep)', () => {
    const expenses = [
      makeExpense({ expense_date: '2025-07-15', amount: 3000 }),
      makeExpense({ id: 'exp-2', expense_date: '2025-08-20', amount: 2000 }),
    ];
    const result = aggregateByPeriod([], expenses, yearlyPeriod);
    const q2 = result.find((r) => r.label === 'Q2');
    expect(q2!.expense).toBe(5000);
  });

  test('monthly granularity returns single bucket with correct label', () => {
    const payments = [
      makePayment({ month: 7, year: 2025, amount_paid: 10000, status: 'confirmed' }),
    ];
    const result = aggregateByPeriod(payments, [], monthlyPeriod);
    expect(result).toHaveLength(1);
    expect(result[0].label).toMatch(/Jul/i);
    expect(result[0].income).toBe(10000);
  });
});

// ─── aggregateByCategory ─────────────────────────────────────────────────────

describe('aggregateByCategory', () => {
  test('groups expenses by category with correct sums', () => {
    const expenses = [
      makeExpense({ category: 'repairs', amount: 3000 }),
      makeExpense({ id: 'exp-2', category: 'repairs', amount: 2000 }),
      makeExpense({ id: 'exp-3', category: 'insurance', amount: 5000 }),
    ];
    const result = aggregateByCategory(expenses, yearlyPeriod);
    const repairs = result.find((r) => r.category === 'repairs');
    const insurance = result.find((r) => r.category === 'insurance');
    expect(repairs!.amount).toBe(5000);
    expect(insurance!.amount).toBe(5000);
  });

  test('uses getCategoryColor() for each category color', () => {
    const expenses = [makeExpense({ category: 'repairs', amount: 1000 })];
    const result = aggregateByCategory(expenses, yearlyPeriod);
    // repairs color is '#EF4444' from lib/expenses.ts
    expect(result[0].color).toBe('#EF4444');
  });

  test('returns empty array when no expenses in period', () => {
    const result = aggregateByCategory([], yearlyPeriod);
    expect(result).toEqual([]);
  });

  test('omits categories with zero amount (no expenses in period filter)', () => {
    // expenses outside FY 2025 (Apr 2025 – Mar 2026) should be filtered out
    const expenses = [
      makeExpense({ expense_date: '2025-03-15', amount: 5000 }), // Mar 2025 = FY 2024 Q4
    ];
    const result = aggregateByCategory(expenses, yearlyPeriod);
    expect(result).toHaveLength(0);
  });

  test('returns correct label for each category', () => {
    const expenses = [makeExpense({ category: 'insurance', amount: 1000 })];
    const result = aggregateByCategory(expenses, yearlyPeriod);
    expect(result[0].label).toBe('Insurance');
  });
});

// ─── calcReliability ─────────────────────────────────────────────────────────

describe('calcReliability', () => {
  test('on-time payment (paid_at date <= due_date) yields onTimePct=100', () => {
    const tenants = [makeTenant()];
    const payments = [
      makePayment({ month: 4, year: 2025, paid_at: '2025-04-04T12:00:00Z', due_date: '2025-04-05', status: 'confirmed' }),
    ];
    const result = calcReliability(payments, tenants, yearlyPeriod);
    expect(result[0].onTimePct).toBe(100);
  });

  test('late payment (paid_at date > due_date) lowers onTimePct', () => {
    const tenants = [makeTenant()];
    const payments = [
      makePayment({ month: 4, year: 2025, paid_at: '2025-04-10T12:00:00Z', due_date: '2025-04-05', status: 'confirmed' }),
    ];
    const result = calcReliability(payments, tenants, yearlyPeriod);
    expect(result[0].onTimePct).toBe(0);
  });

  test('avgDaysLate is mean of late days only (0 if all on-time)', () => {
    const tenants = [makeTenant()];
    const payments = [
      makePayment({ month: 4, year: 2025, paid_at: '2025-04-04T12:00:00Z', due_date: '2025-04-05', status: 'confirmed' }),
    ];
    const result = calcReliability(payments, tenants, yearlyPeriod);
    expect(result[0].avgDaysLate).toBe(0);
  });

  test('avgDaysLate calculates correctly for late payments', () => {
    const tenants = [makeTenant()];
    const payments = [
      // 5 days late
      makePayment({ id: 'pay-1', month: 4, year: 2025, paid_at: '2025-04-10T00:00:00Z', due_date: '2025-04-05', status: 'confirmed' }),
      // 3 days late
      makePayment({ id: 'pay-2', month: 5, year: 2025, paid_at: '2025-05-08T00:00:00Z', due_date: '2025-05-05', status: 'confirmed' }),
    ];
    const result = calcReliability(payments, tenants, yearlyPeriod);
    // avg of 5 and 3 = 4
    expect(result[0].avgDaysLate).toBe(4);
    expect(result[0].onTimePct).toBe(0);
  });

  test('results sorted by onTimePct descending (best first)', () => {
    const tenants = [
      makeTenant({ id: 'tenant-1', tenant_name: 'Alice' }),
      makeTenant({ id: 'tenant-2', tenant_name: 'Bob' }),
    ];
    const payments = [
      // Alice: on-time
      makePayment({ id: 'pay-alice', tenant_id: 'tenant-1', month: 4, year: 2025, paid_at: '2025-04-04T00:00:00Z', due_date: '2025-04-05', status: 'confirmed' }),
      // Bob: late
      makePayment({ id: 'pay-bob', tenant_id: 'tenant-2', month: 4, year: 2025, paid_at: '2025-04-10T00:00:00Z', due_date: '2025-04-05', status: 'confirmed' }),
    ];
    const result = calcReliability(payments, tenants, yearlyPeriod);
    expect(result[0].tenantName).toBe('Alice');
    expect(result[1].tenantName).toBe('Bob');
  });

  test('timezone edge case: paid_at same calendar day as due_date is on-time', () => {
    const tenants = [makeTenant()];
    const payments = [
      makePayment({ month: 4, year: 2025, paid_at: '2025-04-05T23:59:59Z', due_date: '2025-04-05', status: 'confirmed' }),
    ];
    const result = calcReliability(payments, tenants, yearlyPeriod);
    expect(result[0].onTimePct).toBe(100);
  });

  test('tenant with no payments in period gets onTimePct=100, avgDaysLate=0, totalPayments=0', () => {
    const tenants = [makeTenant({ id: 'tenant-no-pay' })];
    const payments: Payment[] = [];
    const result = calcReliability(payments, tenants, yearlyPeriod);
    expect(result[0].onTimePct).toBe(100);
    expect(result[0].avgDaysLate).toBe(0);
    expect(result[0].totalPayments).toBe(0);
  });

  test('totalPayments counts paid and confirmed payments in period', () => {
    const tenants = [makeTenant()];
    const payments = [
      makePayment({ id: 'p1', month: 4, year: 2025, paid_at: '2025-04-04T00:00:00Z', status: 'confirmed' }),
      makePayment({ id: 'p2', month: 5, year: 2025, paid_at: '2025-05-04T00:00:00Z', status: 'paid' }),
    ];
    const result = calcReliability(payments, tenants, yearlyPeriod);
    expect(result[0].totalPayments).toBe(2);
  });
});

// ─── calcOccupancy ───────────────────────────────────────────────────────────

describe('calcOccupancy', () => {
  const totalUnits = 4;

  test('active tenant contributes to filled count', () => {
    const tenants = [makeTenant({ lease_start: '2024-01-01', lease_end: null, is_archived: false })];
    const result = calcOccupancy(tenants, totalUnits, yearlyPeriod);
    // For yearly period, returns quarter buckets
    expect(result[0].filled).toBe(1);
    expect(result[0].vacant).toBe(totalUnits - 1);
  });

  test('archived tenant is excluded from filled count', () => {
    const tenants = [makeTenant({ is_archived: true })];
    const result = calcOccupancy(tenants, totalUnits, yearlyPeriod);
    result.forEach((point) => {
      expect(point.filled).toBe(0);
      expect(point.vacant).toBe(totalUnits);
    });
  });

  test('tenant whose lease started after bucket end is not counted', () => {
    // Tenant started in Oct 2025 (Q3), so Q1 (Apr-Jun) should not count them
    const tenants = [makeTenant({ lease_start: '2025-10-01', lease_end: null, is_archived: false })];
    const result = calcOccupancy(tenants, totalUnits, yearlyPeriod);
    const q1 = result.find((r) => r.label === 'Q1');
    expect(q1!.filled).toBe(0);
  });

  test('tenant whose lease ended before bucket end is not counted', () => {
    // Tenant's lease ended in Jun 2025 (Q1 end), so Q2 (Jul-Sep) should not count them
    const tenants = [makeTenant({ lease_start: '2024-01-01', lease_end: '2025-06-15', is_archived: false })];
    const result = calcOccupancy(tenants, totalUnits, yearlyPeriod);
    const q2 = result.find((r) => r.label === 'Q2');
    expect(q2!.filled).toBe(0);
  });

  test('vacant = totalUnits - filled', () => {
    const tenants = [makeTenant()];
    const result = calcOccupancy(tenants, totalUnits, yearlyPeriod);
    result.forEach((point) => {
      expect(point.filled + point.vacant).toBe(totalUnits);
    });
  });
});

// ─── aggregatePortfolio ──────────────────────────────────────────────────────

describe('aggregatePortfolio', () => {
  const property1 = makeProperty({ id: 'prop-1', name: 'Sunrise', total_units: 4 });
  const property2 = makeProperty({ id: 'prop-2', name: 'Sunset', total_units: 2 });

  const tenant1 = makeTenant({ id: 'tenant-1', property_id: 'prop-1' });
  const tenant2 = makeTenant({ id: 'tenant-2', property_id: 'prop-2' });

  const properties = [
    { ...property1, tenants: [tenant1] },
    { ...property2, tenants: [tenant2] },
  ];

  const payments = [
    makePayment({ id: 'p1', tenant_id: 'tenant-1', property_id: 'prop-1', month: 4, year: 2025, amount_paid: 10000, status: 'confirmed' }),
    makePayment({ id: 'p2', tenant_id: 'tenant-2', property_id: 'prop-2', month: 4, year: 2025, amount_paid: 8000, status: 'confirmed' }),
  ];

  const expenses = [
    makeExpense({ id: 'e1', property_id: 'prop-1', expense_date: '2025-04-15', amount: 3000 }),
    makeExpense({ id: 'e2', property_id: 'prop-2', expense_date: '2025-05-15', amount: 2000 }),
  ];

  test('totalIncome sums income across all properties', () => {
    const { kpis } = aggregatePortfolio(properties, payments, expenses, yearlyPeriod);
    expect(kpis.totalIncome).toBe(18000);
  });

  test('totalExpenses sums expenses across all properties', () => {
    const { kpis } = aggregatePortfolio(properties, payments, expenses, yearlyPeriod);
    expect(kpis.totalExpenses).toBe(5000);
  });

  test('netPL = totalIncome - totalExpenses', () => {
    const { kpis } = aggregatePortfolio(properties, payments, expenses, yearlyPeriod);
    expect(kpis.netPL).toBe(kpis.totalIncome - kpis.totalExpenses);
    expect(kpis.netPL).toBe(13000);
  });

  test('totalUnits aggregated across properties', () => {
    const { kpis } = aggregatePortfolio(properties, payments, expenses, yearlyPeriod);
    expect(kpis.totalUnits).toBe(6); // 4 + 2
  });

  test('filledUnits aggregated across properties', () => {
    const { kpis } = aggregatePortfolio(properties, payments, expenses, yearlyPeriod);
    // Both tenants are active
    expect(kpis.filledUnits).toBeGreaterThan(0);
  });

  test('summaries contain one entry per property', () => {
    const { summaries } = aggregatePortfolio(properties, payments, expenses, yearlyPeriod);
    expect(summaries).toHaveLength(2);
  });

  test('each PropertySummary has correct propertyId and propertyName', () => {
    const { summaries } = aggregatePortfolio(properties, payments, expenses, yearlyPeriod);
    const s1 = summaries.find((s) => s.propertyId === 'prop-1');
    expect(s1!.propertyName).toBe('Sunrise');
  });

  test('each PropertySummary has correct per-property netPL', () => {
    const { summaries } = aggregatePortfolio(properties, payments, expenses, yearlyPeriod);
    const s1 = summaries.find((s) => s.propertyId === 'prop-1');
    // prop-1: income 10000, expense 3000, netPL 7000
    expect(s1!.netPL).toBe(7000);
  });

  test('summaries contain monthlyPL array (12 months for sparkline)', () => {
    const { summaries } = aggregatePortfolio(properties, payments, expenses, yearlyPeriod);
    summaries.forEach((s) => {
      expect(s.monthlyPL).toHaveLength(12);
    });
  });

  test('empty properties array returns zero KPIs', () => {
    const { kpis, summaries } = aggregatePortfolio([], [], [], yearlyPeriod);
    expect(kpis.totalIncome).toBe(0);
    expect(kpis.totalExpenses).toBe(0);
    expect(kpis.netPL).toBe(0);
    expect(kpis.totalUnits).toBe(0);
    expect(summaries).toHaveLength(0);
  });
});
