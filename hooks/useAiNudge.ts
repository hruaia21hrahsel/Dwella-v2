import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/lib/supabase';

const CACHE_KEY = 'ai_nudge_cache';
const CACHE_TTL = 6 * 60 * 60 * 1000; // 6 hours

const FUNCTION_URL = `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/ai-insights`;

interface CachedNudge {
  nudge: string;
  timestamp: number;
}

export function useAiNudge(userId: string | undefined) {
  const [nudge, setNudge] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchNudge = useCallback(async () => {
    if (!userId) return;

    // Check cache first
    try {
      const cached = await AsyncStorage.getItem(CACHE_KEY);
      if (cached) {
        const parsed: CachedNudge = JSON.parse(cached);
        if (Date.now() - parsed.timestamp < CACHE_TTL) {
          setNudge(parsed.nudge);
          return;
        }
      }
    } catch {
      // ignore cache errors
    }

    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const res = await fetch(FUNCTION_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ user_id: userId, mode: 'nudge' }),
      });

      if (!res.ok) return;
      const result = await res.json();
      const nudgeText = result.nudge ?? null;

      if (nudgeText) {
        setNudge(nudgeText);
        await AsyncStorage.setItem(CACHE_KEY, JSON.stringify({
          nudge: nudgeText,
          timestamp: Date.now(),
        }));
      }
    } catch {
      // silently fail — nudge is non-critical
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchNudge();
  }, [fetchNudge]);

  return { nudge, loading, refresh: fetchNudge };
}
