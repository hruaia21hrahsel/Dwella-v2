import { useState, useCallback, useEffect } from 'react';
import { useFocusEffect } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/lib/store';
import { Payment, PaymentStatus } from '@/lib/types';
import { getCurrentMonthYear } from '@/lib/utils';

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
  refresh: () => void;
}

export function useDashboard(year: number): DashboardData {
  const { user } = useAuthStore();
  const [tenantRows, setTenantRows] = useState<TenantRow[]>([]);
  const [stats, setStats] = useState<DashboardStats>({
    totalReceivable: 0,
    totalReceived: 0,
    totalPending: 0,
    totalOverdue: 0,
  });
  const [recentTransactions, setRecentTransactions] = useState<RecentTx[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const { month: currentMonth } = getCurrentMonthYear();

  const load = useCallback(async () => {
    if (!user?.id) return;
    setIsLoading(true);

    // Query 1: properties + tenants + payments for current year
    const { data: propertiesData } = await supabase
      .from('properties')
      .select('id, name, tenants(id, tenant_name, flat_no, monthly_rent, is_archived, payments(*))')
      .eq('owner_id', user.id)
      .eq('is_archived', false);

    const rows: TenantRow[] = [];
    const allTenantIds: string[] = [];

    for (const property of propertiesData ?? []) {
      const tenants = (property.tenants as any[]) ?? [];
      for (const tenant of tenants) {
        if (tenant.is_archived) continue;
        allTenantIds.push(tenant.id);

        const payments: Payment[] = (tenant.payments ?? []).filter(
          (p: Payment) => p.year === year,
        );

        const paymentsByMonth: Record<number, Payment | undefined> = {};
        for (const p of payments) {
          paymentsByMonth[p.month] = p;
        }

        rows.push({
          tenantId: tenant.id,
          tenantName: tenant.tenant_name,
          flatNo: tenant.flat_no,
          propertyName: property.name,
          propertyId: property.id,
          monthlyRent: tenant.monthly_rent,
          paymentsByMonth,
        });
      }
    }

    setTenantRows(rows);

    // Compute stats from current month payments
    let totalReceivable = 0;
    let totalReceived = 0;
    let totalOverdue = 0;

    for (const row of rows) {
      const p = row.paymentsByMonth[currentMonth];
      if (p) {
        totalReceivable += p.amount_due;
        totalReceived += p.amount_paid;
        if (p.status === 'overdue') totalOverdue += p.amount_due - p.amount_paid;
      }
    }

    setStats({
      totalReceivable,
      totalReceived,
      totalPending: totalReceivable - totalReceived,
      totalOverdue,
    });

    // Query 2: last 5 paid/confirmed payments across all owned tenants
    if (allTenantIds.length > 0) {
      const { data: recentData } = await supabase
        .from('payments')
        .select('*, tenants(tenant_name, flat_no, properties(name, id))')
        .in('tenant_id', allTenantIds)
        .in('status', ['paid', 'confirmed'])
        .not('paid_at', 'is', null)
        .order('paid_at', { ascending: false })
        .limit(5);

      const txs: RecentTx[] = (recentData ?? []).map((p: any) => ({
        paymentId: p.id,
        tenantName: p.tenants?.tenant_name ?? '',
        flatNo: p.tenants?.flat_no ?? '',
        propertyName: p.tenants?.properties?.name ?? '',
        propertyId: p.tenants?.properties?.id ?? '',
        tenantId: p.tenant_id,
        amountPaid: p.amount_paid,
        month: p.month,
        year: p.year,
        status: p.status,
        paidAt: p.paid_at,
      }));

      setRecentTransactions(txs);
    } else {
      setRecentTransactions([]);
    }

    setIsLoading(false);
  }, [user?.id, year, currentMonth]);

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

  return { tenantRows, stats, recentTransactions, isLoading, refresh: load };
}
