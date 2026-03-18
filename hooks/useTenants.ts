import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { Tenant } from '@/lib/types';

interface UseTenantResult {
  tenants: Tenant[];
  isLoading: boolean;
  error: string | null;
  refresh: () => void;
}

export function useTenants(propertyId: string | undefined): UseTenantResult {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    if (!propertyId) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);

    try {
      const { data, error: fetchError } = await supabase
        .from('tenants')
        .select('*')
        .eq('property_id', propertyId)
        .eq('is_archived', false)
        .order('flat_no', { ascending: true });

      if (fetchError) throw fetchError;
      setTenants((data as Tenant[]) ?? []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load tenants');
    } finally {
      setIsLoading(false);
    }
  }, [propertyId]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  useEffect(() => {
    if (!propertyId) return;

    const channel = supabase
      .channel(`tenants-${propertyId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tenants',
          filter: `property_id=eq.${propertyId}`,
        },
        () => { fetch(); }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [propertyId, fetch]);

  return { tenants, isLoading, error, refresh: fetch };
}
