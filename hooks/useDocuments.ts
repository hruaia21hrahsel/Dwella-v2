import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type { Document } from '@/lib/types';

interface UseDocumentsResult {
  documents: Document[];
  isLoading: boolean;
  error: string | null;
  refresh: () => void;
}

export function useDocuments(
  propertyId: string | null,
  tenantId?: string | null
): UseDocumentsResult {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    if (!propertyId) {
      setDocuments([]);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      let query = supabase
        .from('documents')
        .select('*')
        .eq('property_id', propertyId)
        .eq('is_archived', false)
        .order('created_at', { ascending: false });

      if (tenantId !== undefined) {
        // null = property-wide only; string = tenant-specific only
        query = tenantId === null
          ? query.is('tenant_id', null)
          : query.eq('tenant_id', tenantId);
      }
      // When tenantId is undefined, no tenant filter is applied = all docs for property

      const { data, error: fetchError } = await query;
      if (fetchError) throw fetchError;
      setDocuments((data as Document[]) ?? []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load documents');
    } finally {
      setIsLoading(false);
    }
  }, [propertyId, tenantId]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  // Realtime subscription
  useEffect(() => {
    if (!propertyId) return;

    const channel = supabase
      .channel(`documents-${propertyId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'documents',
          filter: `property_id=eq.${propertyId}`,
        },
        () => {
          fetch();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [propertyId, fetch]);

  return { documents, isLoading, error, refresh: fetch };
}
