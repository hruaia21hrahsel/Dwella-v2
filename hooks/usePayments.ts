import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { Payment, Tenant } from '@/lib/types';
import { ensurePaymentRows } from '@/lib/payments';

interface UsePaymentsResult {
  payments: Payment[];
  isLoading: boolean;
  error: string | null;
  refresh: () => void;
}

export function usePayments(tenant: Tenant | null): UsePaymentsResult {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    if (!tenant) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Ensure payment rows exist for all months since lease start
      await ensurePaymentRows(
        tenant.id,
        tenant.property_id,
        tenant.monthly_rent,
        tenant.due_day,
        tenant.lease_start,
      );

      const { data, error: fetchError } = await supabase
        .from('payments')
        .select('*')
        .eq('tenant_id', tenant.id)
        .order('year', { ascending: false })
        .order('month', { ascending: false });

      if (fetchError) throw fetchError;
      setPayments((data as Payment[]) ?? []);
    } catch (err: any) {
      setError(err.message ?? 'Failed to load payments');
    } finally {
      setIsLoading(false);
    }
  }, [tenant?.id]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  useEffect(() => {
    if (!tenant?.id) return;

    const channel = supabase
      .channel(`payments-${tenant.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'payments',
          filter: `tenant_id=eq.${tenant.id}`,
        },
        () => { fetch(); }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [tenant?.id, fetch]);

  return { payments, isLoading, error, refresh: fetch };
}
