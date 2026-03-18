import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { useFocusEffect } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/lib/store';
import { Payment, PaymentStatus } from '@/lib/types';

interface DashboardPayment {
  tenant_id: string;
  status: string;
  amount_paid: number;
  amount_due: number;
  month: number;
  [key: string]: unknown;
}

interface DashboardTenant {
  id: string;
  is_archived: boolean;
  tenant_name: string;
  due_day: number;
  flat_no: string;
  monthly_rent: number;
}

interface RecentPaymentRow {
  id: string;
  tenant_id: string;
  amount_paid: number;
  month: number;
  year: number;
  status: string;
  paid_at: string;
  tenants?: {
    tenant_name?: string;
    flat_no?: string;
    properties?: {
      name?: string;
      id?: string;
    };
  };
}


export interface TenantRow {
  tenantId: string;
  tenantName: string;
  flatNo: string;
  propertyName: string;
  propertyId: string;
  monthlyRent: number;
  paymentsByMonth: Record<number, Payment | undefined>;
}

export interface DashboardStats {
  totalReceivable: number;
  totalReceived: number;
  totalPending: number;
  totalOverdue: number;
}

export interface RecentTx {
  paymentId: string;
  tenantName: string;
  flatNo: string;
  propertyName: string;
  propertyId: string;
  tenantId: string;
  amountPaid: number;
  month: number;
  year: number;
  status: PaymentStatus;
  paidAt: string;
}

export interface DashboardData {
  tenantRows: TenantRow[];
  stats: DashboardStats;
  recentTransactions: RecentTx[];
  isLoading: boolean;
  error: string | null;
  refresh: () => void;
}

export function useDashboard(year: number, month: number): DashboardData {
  const { user } = useAuthStore();
  const [tenantRows, setTenantRows] = useState<TenantRow[]>([]);
  const [recentTransactions, setRecentTransactions] = useState<RecentTx[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const hasLoadedOnce = useRef(false);

  const load = useCallback(async () => {
    if (!user?.id) {
      setIsLoading(false);
      return;
    }
    // Only show skeleton on the very first load — subsequent refreshes keep stale data visible
    if (!hasLoadedOnce.current) setIsLoading(true);
    setError(null);

    try {
    // Query 1: properties + tenants (lightweight — no payments)
    // Query 2: payments for selected year only (filtered server-side)
    // Query 3: recent transactions
    // All three run in parallel to minimize round-trips.

    const propertiesPromise = supabase
      .from('properties')
      .select('id, name, tenants(id, tenant_name, flat_no, monthly_rent, is_archived)')
      .eq('owner_id', user.id)
      .eq('is_archived', false);

    const paymentsPromise = supabase
      .from('payments')
      .select('*, tenants!inner(id, property_id, is_archived)')
      .eq('year', year)
      .eq('tenants.is_archived', false);

    const recentPromise = supabase
      .from('payments')
      .select('*, tenants(tenant_name, flat_no, properties(name, id))')
      .in('status', ['paid', 'confirmed'])
      .not('paid_at', 'is', null)
      .order('paid_at', { ascending: false })
      .limit(5);

    const [propResult, payResult, recentResult] = await Promise.all([
      propertiesPromise,
      paymentsPromise,
      recentPromise,
    ]);

    if (propResult.error) throw propResult.error;
    if (payResult.error) throw payResult.error;

    // Index payments by tenant_id + month for O(1) lookup
    const paymentIndex = new Map<string, Record<number, Payment>>();
    for (const p of (payResult.data ?? []) as DashboardPayment[]) {
      const key = p.tenant_id;
      if (!paymentIndex.has(key)) paymentIndex.set(key, {});
      paymentIndex.get(key)![p.month] = p as unknown as Payment;
    }

    const rows: TenantRow[] = [];
    for (const property of propResult.data ?? []) {
      const tenants = (property.tenants as DashboardTenant[]) ?? [];
      for (const tenant of tenants) {
        if (tenant.is_archived) continue;
        rows.push({
          tenantId: tenant.id,
          tenantName: tenant.tenant_name,
          flatNo: tenant.flat_no,
          propertyName: property.name,
          propertyId: property.id,
          monthlyRent: tenant.monthly_rent,
          paymentsByMonth: paymentIndex.get(tenant.id) ?? {},
        });
      }
    }

    // Filter recent transactions to only the user's properties
    const ownedPropertyIds = new Set((propResult.data ?? []).map((p) => p.id));
    const txs: RecentTx[] = (recentResult.data ?? [])
      .filter((p: RecentPaymentRow) => ownedPropertyIds.has(p.tenants?.properties?.id))
      .map((p: RecentPaymentRow) => ({
        paymentId: p.id,
        tenantName: p.tenants?.tenant_name ?? '',
        flatNo: p.tenants?.flat_no ?? '',
        propertyName: p.tenants?.properties?.name ?? '',
        propertyId: p.tenants?.properties?.id ?? '',
        tenantId: p.tenant_id,
        amountPaid: p.amount_paid,
        month: p.month,
        year: p.year,
        status: p.status as PaymentStatus,
        paidAt: p.paid_at,
      }));

    setTenantRows(rows);
    setRecentTransactions(txs);

    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load dashboard');
    } finally {
      hasLoadedOnce.current = true;
      setIsLoading(false);
    }
  }, [user?.id, year]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  // Realtime subscription on payments table
  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel('dashboard-payments')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'payments' }, () => {
        load();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, load]);

  // Derive stats from already-loaded tenantRows — no re-fetch needed on month change
  const stats = useMemo<DashboardStats>(() => {
    let totalReceivable = 0;
    let totalReceived = 0;
    let totalOverdue = 0;

    for (const row of tenantRows) {
      const p = row.paymentsByMonth[month];
      // Always count every tenant's rent as receivable, whether a payment row exists or not
      totalReceivable += p?.amount_due ?? row.monthlyRent;
      if (p) {
        totalReceived += p.amount_paid;
        if (p.status === 'overdue') totalOverdue += p.amount_due - p.amount_paid;
      }
    }

    return {
      totalReceivable,
      totalReceived,
      totalPending: totalReceivable - totalReceived,
      totalOverdue,
    };
  }, [tenantRows, month]);

  return { tenantRows, stats, recentTransactions, isLoading, error, refresh: load };
}
