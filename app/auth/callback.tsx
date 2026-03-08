import { useEffect, useRef } from 'react';
import { View, ActivityIndicator } from 'react-native';
import * as Linking from 'expo-linking';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/lib/store';
import { useTheme } from '@/lib/theme-context';
import { useRouter } from 'expo-router';

/**
 * OAuth callback screen — handles dwella://auth/callback deep links.
 *
 * Two scenarios reach this screen:
 *   A) openAuthSessionAsync already captured the redirect, set the session
 *      via social-auth.ts, and AuthGuard is about to navigate away.
 *      → We just show a spinner; AuthGuard does the rest.
 *
 *   B) The OS opened this deep link directly (cold launch, or Android edge
 *      case where the Custom Tab redirect isn't captured by openAuthSessionAsync).
 *      → We need to extract the tokens ourselves and set the session.
 */
export default function AuthCallbackScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const handled = useRef(false);

  useEffect(() => {
    // If session is already set (scenario A), AuthGuard will navigate away.
    // Give it a moment, then check.
    const { session } = useAuthStore.getState();
    if (session) return; // AuthGuard will redirect

    async function tryExtractSession(url: string | null) {
      if (handled.current || !url) return false;

      const hash = url.split('#')[1];
      if (!hash) return false;

      const params: Record<string, string> = {};
      for (const pair of hash.split('&')) {
        const idx = pair.indexOf('=');
        if (idx > 0) {
          params[decodeURIComponent(pair.slice(0, idx))] = decodeURIComponent(pair.slice(idx + 1));
        }
      }

      if (params.access_token && params.refresh_token) {
        handled.current = true;
        await supabase.auth.setSession({
          access_token: params.access_token,
          refresh_token: params.refresh_token,
        });
        // AuthGuard will redirect via onAuthStateChange
        return true;
      }
      return false;
    }

    // Method 1: cold-launch URL
    Linking.getInitialURL().then(async (url) => {
      if (await tryExtractSession(url)) return;
    });

    // Method 2: foreground URL event (warm launch)
    const sub = Linking.addEventListener('url', async ({ url }) => {
      await tryExtractSession(url);
    });

    // Method 3: safety timeout — if nothing worked after 3s, bail out
    const timeout = setTimeout(() => {
      if (handled.current) return;
      const currentSession = useAuthStore.getState().session;
      if (currentSession) {
        // Session was set elsewhere (social-auth.ts), AuthGuard will redirect
        return;
      }
      // No session, no tokens — go to login
      router.replace('/(auth)/login');
    }, 3000);

    return () => {
      sub.remove();
      clearTimeout(timeout);
    };
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' }}>
      <ActivityIndicator size="large" color={colors.primary} />
    </View>
  );
}
