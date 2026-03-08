import { useEffect, useRef } from 'react';
import { View } from 'react-native';
import { Stack, router, useRouter, useSegments } from 'expo-router';
import { PaperProvider, MD3LightTheme, MD3DarkTheme } from 'react-native-paper';
import { StatusBar } from 'expo-status-bar';
import * as Notifications from 'expo-notifications';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/lib/store';
import { isBiometricEnabled } from '@/lib/biometric-auth';
import { registerPushToken } from '@/lib/notifications';
import { ProfileHeaderButton } from '@/components/ProfileHeaderButton';
import { DwellaHeaderTitle } from '@/components/DwellaHeaderTitle';
import { TourGuideCard } from '@/components/TourGuideCard';
import { ToastProvider } from '@/components/ToastProvider';
import { ThemeProvider, useTheme } from '@/lib/theme-context';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

function usePaperTheme() {
  const { colors, isDark } = useTheme();
  const base = isDark ? MD3DarkTheme : MD3LightTheme;
  return {
    ...base,
    colors: {
      ...base.colors,
      primary: colors.primary,
      secondary: colors.primaryLight,
      background: colors.background,
      surface: colors.surface,
      surfaceVariant: colors.surfaceElevated,
      error: colors.error,
      onPrimary: colors.textOnPrimary,
      onBackground: colors.textPrimary,
      onSurface: colors.textPrimary,
      outline: colors.border,
    },
  };
}

function AuthGuard() {
  const { session, isLoading, isLocked, setSession, setUser, setLoading, onboardingCompleted } = useAuthStore();
  const segments = useSegments();
  const router = useRouter();
  const initialRedirectDone = useRef(false);

  // ── Supabase auth listener ─────────────────────────────────────────
  useEffect(() => {
    // Safety net: if onAuthStateChange never fires (bad config, network), unblock after 8s
    const fallback = setTimeout(() => setLoading(false), 8000);

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
      clearTimeout(fallback);
      try {
        setSession(newSession);

        if (newSession?.user) {
          await supabase.from('users').upsert(
            {
              id: newSession.user.id,
              email: newSession.user.email!,
              full_name: newSession.user.user_metadata?.full_name ?? null,
              phone: newSession.user.user_metadata?.phone ?? null,
            },
            { onConflict: 'id', ignoreDuplicates: true }
          );
          const { data } = await supabase
            .from('users')
            .select('*')
            .eq('id', newSession.user.id)
            .single();
          setUser(data);
          registerPushToken(newSession.user.id);
        } else {
          setUser(null);
        }
      } finally {
        setLoading(false);
      }
    });

    return () => { subscription.unsubscribe(); clearTimeout(fallback); };
  }, []);

  // ── Routing logic ──────────────────────────────────────────────────
  //
  // Correct model:
  //   if (!session)              → /login          (must authenticate)
  //   else if (pinEnabled && isLocked) → /lock     (session exists, UI locked)
  //   else                       → /dashboard      (session + unlocked)
  //
  // isLocked is a pure in-memory flag. It has nothing to do with the backend.
  // PIN only sets isLocked = false. It never touches Supabase.
  useEffect(() => {
    if (isLoading) return;

    const inAuthGroup = segments[0] === '(auth)' || segments[0] === 'auth';
    const inOnboarding = segments[0] === 'onboarding';

    if (!session) {
      // No Supabase session — user must log in with email/password.
      if (!inAuthGroup) router.replace('/(auth)/login');
      return;
    }

    // Session exists. Check if the UI is locally locked.
    isBiometricEnabled().then((pinEnabled) => {
      if (pinEnabled && isLocked) {
        // App is locked — show PIN screen. PIN will call setLocked(false).
        // Only navigate if not already on the lock screen.
        const alreadyOnLock = inAuthGroup && segments[1] === 'lock';
        if (!alreadyOnLock) router.replace('/(auth)/lock');
        return;
      }

      // Unlocked — go to the app. Only redirect if coming from auth screens
      // or on the very first load.
      if (inAuthGroup || inOnboarding || !initialRedirectDone.current) {
        initialRedirectDone.current = true;
        router.replace(onboardingCompleted ? '/(tabs)/dashboard' : '/onboarding');
      }
    });
  }, [session, isLoading, segments, isLocked]);

  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const screen = (response.notification.request.content.data as any)?.screen;
      if (screen) router.push(screen);
    });
    return () => sub.remove();
  }, []);

  return null;
}

function InnerLayout() {
  const { colors, isDark } = useTheme();
  const paperTheme = usePaperTheme();

  return (
    <PaperProvider theme={paperTheme}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <AuthGuard />
      <TourGuideCard />
      <ToastProvider />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="onboarding/index" options={{ headerShown: false }} />
        <Stack.Screen name="property/create" options={{ headerShown: true, presentation: 'modal', headerStyle: { backgroundColor: colors.surface, height: 64 } as any, headerTitleAlign: 'center', headerTitle: () => <DwellaHeaderTitle dark={!isDark} />, headerLeft: () => <ProfileHeaderButton dark={!isDark} />, headerRight: () => <View style={{ width: 50 }} /> }} />
        <Stack.Screen name="log-payment" options={{ headerShown: true, presentation: 'modal', headerStyle: { backgroundColor: colors.surface, height: 64 } as any, headerTitleAlign: 'center', headerTitle: () => <DwellaHeaderTitle dark={!isDark} />, headerLeft: () => <ProfileHeaderButton dark={!isDark} />, headerRight: () => <View style={{ width: 50 }} /> }} />
        <Stack.Screen name="payments/index" options={{ headerShown: true, headerStyle: { backgroundColor: colors.surface, height: 64 } as any, headerTitleAlign: 'center', headerTitle: () => <DwellaHeaderTitle dark={!isDark} />, headerLeft: () => <ProfileHeaderButton dark={!isDark} />, headerRight: () => <View style={{ width: 50 }} /> }} />
        <Stack.Screen name="expenses/index" options={{ headerShown: true, headerStyle: { backgroundColor: colors.surface, height: 64 } as any, headerTitleAlign: 'center', headerTitle: () => <DwellaHeaderTitle dark={!isDark} />, headerLeft: () => <ProfileHeaderButton dark={!isDark} />, headerRight: () => <View style={{ width: 50 }} /> }} />
        <Stack.Screen name="auth/callback" options={{ headerShown: false }} />
        <Stack.Screen name="invite/[token]" />
        <Stack.Screen
          name="pin-setup"
          options={{
            headerShown: true,
            headerStyle: { backgroundColor: colors.surface, height: 64 } as any,
            headerTitleAlign: 'center',
            headerTitle: () => <DwellaHeaderTitle />,
            headerLeft: () => <ProfileHeaderButton />,
            headerRight: () => <View style={{ width: 50 }} />,
          }}
        />
        <Stack.Screen
          name="reminders/index"
          options={{
            headerShown: true,
            presentation: 'modal',
            headerStyle: { backgroundColor: colors.surface, height: 64 } as any,
            headerTitleAlign: 'center',
            headerTitle: () => <DwellaHeaderTitle />,
            headerLeft: () => <ProfileHeaderButton />,
            headerRight: () => <View style={{ width: 50 }} />,
          }}
        />
        <Stack.Screen
          name="notifications/index"
          options={{ headerShown: false, presentation: 'modal' }}
        />
        <Stack.Screen name="+not-found" />
      </Stack>
    </PaperProvider>
  );
}

export default function RootLayout() {
  return (
    <ThemeProvider>
      <InnerLayout />
    </ThemeProvider>
  );
}
