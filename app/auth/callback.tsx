import { useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/lib/theme-context';

/**
 * Handles dwella://auth/callback deep links from Supabase OAuth.
 *
 * Two scenarios:
 * 1. App is in foreground — openAuthSessionAsync catches the redirect
 *    before it reaches this screen. This screen is a safety fallback.
 * 2. App was cold-launched via the deep link — this screen receives
 *    the full URL and exchanges the code for a session.
 */
export default function AuthCallbackScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  // Expo Router passes the full URL params here
  const params = useLocalSearchParams<{ code?: string; error?: string }>();

  useEffect(() => {
    async function handleCallback() {
      if (params.error) {
        router.replace('/(auth)/login');
        return;
      }

      if (params.code) {
        // Build the full callback URL so Supabase can verify the PKCE code
        const url = `dwella://auth/callback?code=${params.code}`;
        const { error } = await supabase.auth.exchangeCodeForSession(url);
        if (error) {
          console.warn('OAuth callback error:', error.message);
          router.replace('/(auth)/login');
        }
        // onAuthStateChange in _layout.tsx handles routing after session is set
        return;
      }

      // No code — back to login
      router.replace('/(auth)/login');
    }

    handleCallback();
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' }}>
      <ActivityIndicator size="large" color={colors.primary} />
    </View>
  );
}
