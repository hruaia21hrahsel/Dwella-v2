import { useEffect, useRef } from 'react';
import { Stack, router, useRouter, useSegments } from 'expo-router';
import { PaperProvider, MD3LightTheme, MD3DarkTheme } from 'react-native-paper';
import { StatusBar } from 'expo-status-bar';
import * as Notifications from 'expo-notifications';
import * as SplashScreen from 'expo-splash-screen';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/lib/store';
import { isBiometricEnabled } from '@/lib/biometric-auth';
import { registerPushToken } from '@/lib/notifications';
import { DwellaHeader } from '@/components/DwellaHeader';
import { TourGuideCard } from '@/components/TourGuideCard';
import { ToastProvider } from '@/components/ToastProvider';
import { ThemeProvider, useTheme } from '@/lib/theme-context';

SplashScreen.preventAutoHideAsync();

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
  const { session, isLoading, isLocked, setSession, setUser, setLoading, setLocked, onboardingCompletedByUser, pendingRoute, setPendingRoute } = useAuthStore();
  const onboardingCompleted = onboardingCompletedByUser[session?.user?.id ?? ''] ?? false;
  const segments = useSegments();
  const router = useRouter();
  const initialRedirectDone = useRef(false);
  /** Incremented each time the routing effect fires; stale async callbacks bail out. */
  const routingGeneration = useRef(0);

  // Dismiss splash screen once loading finishes (or after a safety timeout)
  useEffect(() => {
    if (!isLoading) {
      SplashScreen.hideAsync();
    }
  }, [isLoading]);

  // ── Supabase auth listener (synchronous only — no DB calls here) ──
  useEffect(() => {
    // Safety net: if onAuthStateChange never fires (bad config, network,
    // or malformed stored session) unblock the UI after 3s so the user
    // never sees the in-app splash forever.
    const fallback = setTimeout(() => {
      console.warn('[AuthGuard] onAuthStateChange fallback fired — forcing setLoading(false)');
      setLoading(false);
    }, 3000);

    let subscription: { unsubscribe: () => void } | null = null;
    try {
      const result = supabase.auth.onAuthStateChange((event, newSession) => {
        // CRITICAL: wrap the whole body in try/finally so ANY throw
        // (store setter, stale session object, etc) cannot leave
        // isLoading stuck at true. setLoading(false) must always run.
        try {
          setSession(newSession);

          if (event === 'SIGNED_IN') {
            setLocked(false);
          }

          if (newSession?.user) {
            // Set user immediately from session metadata — no async DB calls
            // inside this callback (they can deadlock with auth state updates).
            setUser({
              id: newSession.user.id,
              email: newSession.user.email ?? '',
              full_name: newSession.user.user_metadata?.full_name ?? null,
              phone: newSession.user.user_metadata?.phone ?? null,
            } as any);
          } else {
            setUser(null);
          }
        } catch (err) {
          console.error('[AuthGuard] onAuthStateChange handler threw:', err);
        } finally {
          // Only clear the fallback once we have successfully reached
          // this point — otherwise leave the fallback armed so the UI
          // can still recover.
          clearTimeout(fallback);
          setLoading(false);
        }
      });
      subscription = result.data.subscription;
    } catch (err) {
      // Subscription setup itself failed — keep the fallback armed so
      // the UI still unblocks after 3s.
      console.error('[AuthGuard] supabase.auth.onAuthStateChange subscribe failed:', err);
    }

    return () => {
      subscription?.unsubscribe();
      clearTimeout(fallback);
    };
  }, []);

  // ── Async user profile fetch (runs OUTSIDE the auth callback) ─────
  useEffect(() => {
    if (!session?.user) return;
    const uid = session.user.id;

    (async () => {
      try {
        await supabase.from('users').upsert(
          {
            id: uid,
            email: session.user.email ?? '',
            full_name: session.user.user_metadata?.full_name ?? null,
            phone: session.user.user_metadata?.phone ?? null,
          },
          { onConflict: 'id', ignoreDuplicates: true }
        );
        const { data } = await supabase
          .from('users')
          .select('*')
          .eq('id', uid)
          .single();
        if (data) setUser(data);
      } catch {
        // Immediate user from session metadata is already set — safe to ignore
      }
      registerPushToken(uid);
    })();
  }, [session?.user?.id]);

  // ── Routing logic ──────────────────────────────────────────────────
  //
  // Correct model:
  //   if (!session)                    → /login      (must authenticate)
  //   else if (pinEnabled && isLocked) → /lock       (session exists, UI locked)
  //   else                             → /dashboard  (session + unlocked)
  //
  // isLocked is a pure in-memory flag. It has nothing to do with the backend.
  // PIN only sets isLocked = false. It never touches Supabase.
  useEffect(() => {
    if (isLoading) return;
    // Skip routing when segments haven't resolved yet
    if (!segments[0]) return;

    const gen = ++routingGeneration.current;
    const inAuthGroup = segments[0] === '(auth)' || segments[0] === 'auth';
    const inOnboarding = segments[0] === 'onboarding';
    const inPinSetup = segments[0] === 'pin-setup';

    if (!session) {
      if (!inAuthGroup) router.replace('/(auth)/login');
      return;
    }

    // Session exists. Check if the UI is locally locked.
    isBiometricEnabled(session.user.id).then((pinEnabled) => {
      // Bail out if the effect has re-fired since we started the async check.
      if (gen !== routingGeneration.current) return;

      if (pinEnabled && isLocked) {
        const alreadyOnLock = inAuthGroup && segments[1] === 'lock';
        if (!alreadyOnLock) router.replace('/(auth)/lock');
        return;
      }

      // Unlocked — go to the app. Only redirect if coming from auth screens
      // or on the very first load. Leave pin-setup and onboarding alone so
      // the user can finish without being bounced by subsequent state updates.
      if (inPinSetup || inOnboarding) return;
      if (inAuthGroup || !initialRedirectDone.current) {
        initialRedirectDone.current = true;
        if (pendingRoute) {
          setPendingRoute(null);
          router.replace(pendingRoute as any);
        } else {
          router.replace(onboardingCompleted ? '/(tabs)/dashboard' : '/onboarding');
        }
      }
    });
  }, [session, isLoading, segments, isLocked, pendingRoute]);

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
        <Stack.Screen name="property/create" options={{ headerShown: false, presentation: 'modal' }} />
        <Stack.Screen name="log-payment" options={{ headerShown: false, presentation: 'modal' }} />
        <Stack.Screen name="payments/index" options={{ headerShown: false }} />
        <Stack.Screen name="expenses/index" options={{ headerShown: false }} />
        <Stack.Screen name="auth/callback" options={{ headerShown: false }} />
        <Stack.Screen name="invite/[token]" />
        <Stack.Screen name="pin-setup" options={{ headerShown: false }} />
        <Stack.Screen name="reminders/index" options={{ headerShown: false, presentation: 'modal' }} />
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
