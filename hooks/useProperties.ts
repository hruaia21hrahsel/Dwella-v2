import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/lib/store';
import { Property, Tenant } from '@/lib/types';

interface UsePropertiesResult {
  ownedProperties: Property[];
  tenantProperties: (Tenant & { properties: Property })[];
  isLoading: boolean;
  error: string | null;
  refresh: () => void;
}

export function useProperties(): UsePropertiesResult {
  const { user, propertyRefreshAt } = useAuthStore();
  const [ownedProperties, setOwnedProperties] = useState<Property[]>([]);
  const [tenantProperties, setTenantProperties] = useState<(Tenant & { properties: Property })[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // propertyRefreshAt is included so that bumping it from the create screen
  // always produces a new fetch reference and triggers the useEffect below.
  const fetch = useCallback(async () => {
    if (!user) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);

    try {
      const [ownedRes, tenantRes] = await Promise.all([
        supabase
          .from('properties')
          .select('*')
          .eq('owner_id', user.id)
          .eq('is_archived', false)
          .order('created_at', { ascending: false }),
        supabase
          .from('tenants')
          .select('*, properties(*)')
          .eq('user_id', user.id)
          .eq('is_archived', false)
          .order('created_at', { ascending: false }),
      ]);

      if (ownedRes.error) throw ownedRes.error;
      if (tenantRes.error) throw tenantRes.error;

      setOwnedProperties((ownedRes.data as Property[]) ?? []);
      setTenantProperties((tenantRes.data as (Tenant & { properties: Property })[]) ?? []);
    } catch (err: any) {
      setError(err.message ?? 'Failed to load properties');
    } finally {
      setIsLoading(false);
    }
  }, [user, propertyRefreshAt]);

  // Runs on mount and whenever fetch changes (i.e. when propertyRefreshAt bumps)
  useEffect(() => {
    fetch();
  }, [fetch]);

  // Realtime fallback for changes made outside the app
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('properties-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'properties' },
        () => { fetch(); }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user, fetch]);

  return { ownedProperties, tenantProperties, isLoading, error, refresh: fetch };
}
