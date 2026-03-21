import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type { MaintenanceRequest } from '@/lib/types';

interface UseMaintenanceRequestsResult {
  requests: MaintenanceRequest[];
  isLoading: boolean;
  error: string | null;
  refresh: () => void;
}

export function useMaintenanceRequests(propertyId: string | null): UseMaintenanceRequestsResult {
  const [requests, setRequests] = useState<MaintenanceRequest[]>([]);
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
        .from('maintenance_requests')
        .select('*')
        .eq('property_id', propertyId)
        .eq('is_archived', false)
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;
      setRequests((data as MaintenanceRequest[]) ?? []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load maintenance requests');
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
      .channel(`maintenance-${propertyId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'maintenance_requests',
          filter: `property_id=eq.${propertyId}`,
        },
        () => { fetch(); }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [propertyId, fetch]);

  return { requests, isLoading, error, refresh: fetch };
}
