import { useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import * as Linking from 'expo-linking';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/lib/theme-context';

/**
 * Handles dwella://auth/callback deep links (cold-launch fallback).
 *
 * In the normal foreground flow, openAuthSessionAsync intercepts the
 * dwella:// redirect before the app routes here. This screen handles
 * the edge case where the app was backgrounded/killed and iOS cold-launches
 * it via the deep link.
 */
export default function AuthCallbackScreen() {
  const { colors } = useTheme();
  const router = useRouter();

  useEffect(() => {
    async function handleCallback() {
      const url = await Linking.getInitialURL();
      if (!url) {
        router.replace('/(auth)/login');
        return;
      }

      // Implicit flow: tokens are in the hash fragment
      const hash = url.split('#')[1] ?? '';
      const params: Record<string, string> = {};
      for (const pair of hash.split('&')) {
        const [key, val] = pair.split('=');
        if (key && val) params[decodeURIComponent(key)] = decodeURIComponent(val);
      }

      const { access_token, refresh_token } = params;
      if (access_token && refresh_token) {
        await supabase.auth.setSession({ access_token, refresh_token });
        // AuthGuard in _layout.tsx should redirect, but as a safety net:
        router.replace('/(tabs)/dashboard');
      } else {
        router.replace('/(auth)/login');
      }
    }

    handleCallback();
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' }}>
      <ActivityIndicator size="large" color={colors.primary} />
    </View>
  );
}
