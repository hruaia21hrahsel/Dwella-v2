import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { BotConversation } from '@/lib/types';

export function useBotConversations(userId: string | undefined) {
  const [messages, setMessages] = useState<BotConversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async (opts?: { silent?: boolean }) => {
    if (!userId) {
      setLoading(false);
      return;
    }
    if (!opts?.silent) setLoading(true);
    setError(null);
    try {
      const { data, error: fetchError } = await supabase
        .from('bot_conversations')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: true })
        .limit(100);
      if (fetchError) throw fetchError;
      setMessages(data ?? []);
    } catch (err: any) {
      setError(err.message ?? 'Failed to load conversations');
    } finally {
      if (!opts?.silent) setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetch();
  }, [userId]);

  // Realtime subscription
  useEffect(() => {
    if (!userId) return;
    const sub = supabase
      .channel(`bot-${userId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'bot_conversations', filter: `user_id=eq.${userId}` },
        (payload) => {
          setMessages((prev) => [...prev, payload.new as BotConversation]);
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(sub); };
  }, [userId]);

  const clearHistory = useCallback(async () => {
    if (!userId) return;
    await supabase.from('bot_conversations').delete().eq('user_id', userId);
    setMessages([]);
  }, [userId]);

  return { messages, loading, error, refetch: fetch, clearHistory };
}
