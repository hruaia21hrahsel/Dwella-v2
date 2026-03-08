import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/lib/store';
import { Expense } from '@/lib/types';

interface UseAllExpensesResult {
  expenses: Expense[];
  isLoading: boolean;
  error: string | null;
  refresh: () => void;
}

export function useAllExpenses(): UseAllExpensesResult {
  const { user } = useAuthStore();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    if (!user) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const { data, error: fetchError } = await supabase
        .from('expenses')
        .select('*')
        .eq('user_id', user.id)
        .order('expense_date', { ascending: false });

      if (fetchError) throw fetchError;
      setExpenses((data as Expense[]) ?? []);
    } catch (err: any) {
      setError(err.message ?? 'Failed to load expenses');
    } finally {
      setIsLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('all-expenses')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'expenses' },
        () => { fetch(); }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user?.id, fetch]);

  return { expenses, isLoading, error, refresh: fetch };
}
