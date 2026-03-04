import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { BotConversation } from '@/lib/types';

export function useBotConversations(userId: string | undefined) {
  const [messages, setMessages] = useState<BotConversation[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    const { data } = await supabase
      .from('bot_conversations')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: true })
      .limit(100);
    setMessages(data ?? []);
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    fetch();
  }, [fetch]);

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

  return { messages, loading, refetch: fetch, clearHistory };
}
