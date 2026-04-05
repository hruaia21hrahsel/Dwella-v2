import { useEffect } from 'react';
import { View, Text } from 'react-native';
import { Redirect } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useAuthStore } from '@/lib/store';
import { useTheme } from '@/lib/theme-context';
import { DwellaLogo } from '@/components/DwellaLogo';

export default function Index() {
  const { session, isLoading } = useAuthStore();
  const { colors } = useTheme();

  useEffect(() => {
    SplashScreen.hideAsync();
  }, []);

  // Escape hatch: if AuthGuard never flips isLoading to false (bad
  // stored session, thrown handler, etc.), this view would otherwise
  // hang forever on the in-app splash. Force-release after 4s so the
  // user always reaches either login or dashboard. This is a belt-and-
  // suspenders backup to the 3s fallback already inside AuthGuard.
  useEffect(() => {
    if (!isLoading) return;
    const t = setTimeout(() => {
      if (useAuthStore.getState().isLoading) {
        console.warn('[Index] isLoading still true after 4s — forcing release');
        useAuthStore.getState().setLoading(false);
      }
    }, 4000);
    return () => clearTimeout(t);
  }, [isLoading]);

  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', gap: 16 }}>
        <DwellaLogo size={120} color={colors.textOnPrimary} />
        <Text style={{ color: colors.textOnPrimary, fontSize: 16, fontStyle: 'italic', opacity: 0.85 }}>
          The AI that runs your rentals.
        </Text>
      </View>
    );
  }

  if (session) {
    return <Redirect href="/(tabs)/dashboard" />;
  }

  return <Redirect href="/(auth)/login" />;
}
