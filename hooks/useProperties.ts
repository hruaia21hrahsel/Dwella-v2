import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/lib/store';
import { Property, Tenant } from '@/lib/types';

interface UsePropertiesResult {
  ownedProperties: Property[];
  tenantProperties: (Tenant & { properties: Property })[];
  isLoading: boolean;
  refresh: () => void;
}

export function useProperties(): UsePropertiesResult {
  const { user } = useAuthStore();
  const [ownedProperties, setOwnedProperties] = useState<Property[]>([]);
  const [tenantProperties, setTenantProperties] = useState<(Tenant & { properties: Property })[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetch = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);

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

    setOwnedProperties((ownedRes.data as Property[]) ?? []);
    setTenantProperties((tenantRes.data as (Tenant & { properties: Property })[]) ?? []);
    setIsLoading(false);
  }, [user]);

  useEffect(() => {
    fetch();
  }, [fetch]);

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

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, fetch]);

  return { ownedProperties, tenantProperties, isLoading, refresh: fetch };
}
