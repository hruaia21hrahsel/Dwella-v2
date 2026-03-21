/**
 * Data-fetching and aggregation hooks for reporting dashboard screens.
 *
 * usePortfolioData — Portfolio-wide KPIs + per-property summaries.
 * usePropertyReportData — All four chart datasets for a single property.
 *
 * Neither hook subscribes to Realtime. Pull-to-refresh only (per UI-SPEC note 5).
 */

import { useState, useCallback, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/lib/store';
import { Payment, Expense, Tenant, Property } from '@/lib/types';
import {
  TimePeriod,
  PortfolioKPIs,
  PropertySummary,
  MonthlyPL,
  CategoryBreakdown,
  TenantReliability,
  OccupancyPoint,
  aggregateByPeriod,
  aggregateByCategory,
  calcReliability,
  calcOccupancy,
  aggregatePortfolio,
} from '@/lib/reports';

// ─── Types ────────────────────────────────────────────────────────────────────

type PropertyWithTenants = Property & { tenants: Tenant[] };

export interface PortfolioDataResult {
  kpis: PortfolioKPIs;
  summaries: PropertySummary[];
  properties: PropertyWithTenants[];
  isLoading: boolean;
  error: string | null;
  refresh: () => void;
}

export interface PropertyReportDataResult {
  propertyName: string;
  plData: MonthlyPL[];
  categoryData: CategoryBreakdown[];
  reliabilityData: TenantReliability[];
  occupancyData: OccupancyPoint[];
  totalExpenses: number;
  plHasData: boolean;
  categoryHasData: boolean;
  reliabilityHasData: boolean;
  occupancyHasData: boolean;
  isLoading: boolean;
  error: string | null;
  refresh: () => void;
}

// ─── usePortfolioData ─────────────────────────────────────────────────────────

/**
 * Fetches all owned properties, all payments for the selected year, and all
 * expenses, then runs aggregatePortfolio client-side.
 *
 * Re-fetches raw data when `year` changes or on manual refresh.
 * Aggregation re-runs via useMemo when raw data or year changes.
 */
export function usePortfolioData(year: number): PortfolioDataResult {
  const { user } = useAuthStore();

  const [properties, setProperties] = useState<PropertyWithTenants[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user?.id) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Query 1: owned properties with their tenants
      const propertiesPromise = supabase
        .from('properties')
        .select(
          'id, name, address, city, total_units, color, notes, is_archived, archived_at, created_at, updated_at, owner_id, tenants(id, tenant_name, flat_no, lease_start, lease_end, is_archived, due_day, monthly_rent, property_id, user_id, security_deposit, invite_token, invite_status, photo_url, notes, archived_at, created_at, updated_at)',
        )
        .eq('owner_id', user.id)
        .eq('is_archived', false);

      const [propResult] = await Promise.all([propertiesPromise]);

      if (propResult.error) throw propResult.error;

      const fetchedProperties = (propResult.data ?? []) as unknown as PropertyWithTenants[];

      // Collect all tenant IDs across all properties
      const allTenantIds = fetchedProperties.flatMap((p) => p.tenants.map((t) => t.id));

      // Query 2: payments for selected year (skip if no tenants)
      let fetchedPayments: Payment[] = [];
      if (allTenantIds.length > 0) {
        const { data: payData, error: payError } = await supabase
          .from('payments')
          .select('*')
          .in('tenant_id', allTenantIds)
          .eq('year', year);
        if (payError) throw payError;
        fetchedPayments = (payData ?? []) as Payment[];
      }

      // Query 3: all expenses for this user (filtered client-side by period)
      const { data: expData, error: expError } = await supabase
        .from('expenses')
        .select('*')
        .eq('user_id', user.id);
      if (expError) throw expError;
      const fetchedExpenses = (expData ?? []) as Expense[];

      setProperties(fetchedProperties);
      setPayments(fetchedPayments);
      setExpenses(fetchedExpenses);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load portfolio data');
    } finally {
      setIsLoading(false);
    }
  }, [user?.id, year]);

  useEffect(() => {
    load();
  }, [load]);

  // Memoize aggregation — only re-runs when raw data or year changes
  const { kpis, summaries } = useMemo(() => {
    const period: TimePeriod = { year, granularity: 'yearly' };
    return aggregatePortfolio(properties, payments, expenses, period);
  }, [properties, payments, expenses, year]);

  return {
    kpis,
    summaries,
    properties,
    isLoading,
    error,
    refresh: load,
  };
}

// ─── usePropertyReportData ───────────────────────────────────────────────────

/**
 * Fetches data for a single property and runs all 4 aggregation functions.
 *
 * Raw data is re-fetched only when `propertyId` changes or on manual refresh.
 * Period changes re-compute aggregations client-side (no new queries).
 */
export function usePropertyReportData(
  propertyId: string,
  period: TimePeriod,
): PropertyReportDataResult {
  const { user } = useAuthStore();

  const [property, setProperty] = useState<PropertyWithTenants | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user?.id || !propertyId) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Query 1: single property with tenants
      const { data: propData, error: propError } = await supabase
        .from('properties')
        .select(
          'id, name, address, city, total_units, color, notes, is_archived, archived_at, created_at, updated_at, owner_id, tenants(id, tenant_name, flat_no, lease_start, lease_end, is_archived, due_day, monthly_rent, property_id, user_id, security_deposit, invite_token, invite_status, photo_url, notes, archived_at, created_at, updated_at)',
        )
        .eq('id', propertyId)
        .single();

      if (propError) throw propError;

      const fetchedProperty = propData as unknown as PropertyWithTenants;
      const tenantIds = fetchedProperty.tenants.map((t) => t.id);

      // Query 2: payments for this property's tenants for selected year
      let fetchedPayments: Payment[] = [];
      if (tenantIds.length > 0) {
        const { data: payData, error: payError } = await supabase
          .from('payments')
          .select('*')
          .in('tenant_id', tenantIds)
          .eq('year', period.year);
        if (payError) throw payError;
        fetchedPayments = (payData ?? []) as Payment[];
      }

      // Query 3: expenses for this property
      const { data: expData, error: expError } = await supabase
        .from('expenses')
        .select('*')
        .eq('property_id', propertyId);
      if (expError) throw expError;
      const fetchedExpenses = (expData ?? []) as Expense[];

      setProperty(fetchedProperty);
      setPayments(fetchedPayments);
      setExpenses(fetchedExpenses);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load property report data');
    } finally {
      setIsLoading(false);
    }
  }, [user?.id, propertyId, period.year]);

  useEffect(() => {
    load();
  }, [load]);

  // Memoize all aggregation — re-runs when data or period changes
  const plData = useMemo(
    () => (property ? aggregateByPeriod(payments, expenses, period) : []),
    [property, payments, expenses, period],
  );

  const categoryData = useMemo(
    () => (property ? aggregateByCategory(expenses, period) : []),
    [property, expenses, period],
  );

  const reliabilityData = useMemo(
    () => (property ? calcReliability(payments, property.tenants, period) : []),
    [property, payments, period],
  );

  const occupancyData = useMemo(
    () =>
      property
        ? calcOccupancy(property.tenants, property.total_units, period)
        : [],
    [property, period],
  );

  const totalExpenses = useMemo(
    () => categoryData.reduce((sum, c) => sum + c.amount, 0),
    [categoryData],
  );

  // hasData flags — check if any data exists in the full year, not just selected period
  const plHasData = payments.length > 0 || expenses.length > 0;
  const categoryHasData = categoryData.length > 0;
  const reliabilityHasData = reliabilityData.some((r) => r.totalPayments > 0);
  const occupancyHasData = occupancyData.some((o) => o.filled > 0);

  return {
    propertyName: property?.name ?? '',
    plData,
    categoryData,
    reliabilityData,
    occupancyData,
    totalExpenses,
    plHasData,
    categoryHasData,
    reliabilityHasData,
    occupancyHasData,
    isLoading,
    error,
    refresh: load,
  };
}
