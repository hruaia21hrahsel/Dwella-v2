import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { Expense } from '@/lib/types';

interface UseExpensesResult {
  expenses: Expense[];
  isLoading: boolean;
  refresh: () => void;
}

export function useExpenses(propertyId: string | null): UseExpensesResult {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetch = useCallback(async () => {
    if (!propertyId) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const { data } = await supabase
      .from('expenses')
      .select('*')
      .eq('property_id', propertyId)
      .order('expense_date', { ascending: false });

    setExpenses((data as Expense[]) ?? []);
    setIsLoading(false);
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

  return { expenses, isLoading, refresh: fetch };
}
