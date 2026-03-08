import { useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { useTheme } from '@/lib/theme-context';

/**
 * This screen handles the OAuth deep-link redirect: dwella://auth/callback
 *
 * After Google/Apple sign-in, Supabase redirects to dwella://auth/callback#access_token=...
 * Expo Router routes that deep link here. Calling maybeCompleteAuthSession() signals
 * expo-web-browser to close the in-app browser and hand the tokens back to
 * the openAuthSessionAsync() caller in lib/social-auth.ts.
 */
export default function AuthCallbackScreen() {
  const { colors } = useTheme();

  useEffect(() => {
    WebBrowser.maybeCompleteAuthSession();
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' }}>
      <ActivityIndicator size="large" color={colors.primary} />
    </View>
  );
}
