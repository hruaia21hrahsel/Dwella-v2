import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { Expense } from '@/lib/types';

interface UseExpensesResult {
  expenses: Expense[];
  isLoading: boolean;
  error: string | null;
  refresh: () => void;
}

export function useExpenses(propertyId: string | null): UseExpensesResult {
  const [expenses, setExpenses] = useState<Expense[]>([]);
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
        .from('expenses')
        .select('*')
        .eq('property_id', propertyId)
        .order('expense_date', { ascending: false });

      if (fetchError) throw fetchError;
      setExpenses((data as Expense[]) ?? []);
    } catch (err: any) {
      setError(err.message ?? 'Failed to load expenses');
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
      .channel(`expenses-${propertyId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'expenses',
          filter: `property_id=eq.${propertyId}`,
        },
        () => { fetch(); }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [propertyId, fetch]);

  return { expenses, isLoading, error, refresh: fetch };
}
