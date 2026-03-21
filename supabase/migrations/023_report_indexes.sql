-- ============================================================
-- Migration 023: Report Query Indexes
-- ============================================================
-- Composite index for report aggregate queries.
-- Covers: usePropertyReportData fetching payments by tenant_id + year,
-- and usePortfolioData fetching payments by tenant_id + year.
-- STATE.md incorrectly attributed this to migration 019 (which is documents).

CREATE INDEX IF NOT EXISTS idx_payments_tenant_year_month
  ON public.payments(tenant_id, year, month);
