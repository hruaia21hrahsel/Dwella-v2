import { useEffect, useRef } from 'react';
import { Stack, router, useRouter, useSegments, type Href } from 'expo-router';
import { PaperProvider, MD3LightTheme, MD3DarkTheme } from 'react-native-paper';
import { StatusBar } from 'expo-status-bar';
import * as Notifications from 'expo-notifications';
import * as SplashScreen from 'expo-splash-screen';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/lib/store';
import { User } from '@/lib/types';
import { usePostHog } from '@/lib/posthog';
import { isBiometricEnabled } from '@/lib/biometric-auth';
import { registerPushToken } from '@/lib/notifications';
import { TourGuideCard } from '@/components/TourGuideCard';
import { ToastProvider } from '@/components/ToastProvider';
import { ThemeProvider, useTheme } from '@/lib/theme-context';
import { UpdateGate } from '@/components/UpdateGate';
import { PostHogProvider, POSTHOG_API_KEY, POSTHOG_HOST } from '@/lib/posthog';
import { useToastStore } from '@/lib/toast';
SplashScreen.preventAutoHideAsync();

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
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
  const posthog = usePostHog();
  const initialRedirectDone = useRef(false);
  /** Incremented each time the routing effect fires; stale async callbacks bail out. */
  const routingGeneration = useRef(0);

  // Dismiss splash screen once loading finishes (or after a safety timeout)
  useEffect(() => {
    if (!isLoading) {
      SplashScreen.hideAsync();
    }
  }, [isLoading]);

  // ── Supabase auth listener ─────────────────────────────────────────
  useEffect(() => {
    // Safety net: if onAuthStateChange never fires (bad config, network), unblock after 8s
    const fallback = setTimeout(() => setLoading(false), 3000);

    // Clear stale sessions on startup — if the refresh token is expired/revoked,
    // Supabase throws AuthApiError before onAuthStateChange fires.
    supabase.auth.getSession().then(({ error }) => {
      if (error) {
        console.warn('[Dwella] Stale session cleared:', error.message);
        supabase.auth.signOut().catch(() => {});
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, newSession) => {
      clearTimeout(fallback);

      setSession(newSession);

      // When the user actively signs in (email/password, Google, Apple),
      // unlock the app so AuthGuard skips the PIN screen.
      if (event === 'SIGNED_IN') {
        setLocked(false);
      }

      if (newSession?.user) {
        const uid = newSession.user.id;
        const fallbackUser: User = {
          id: uid,
          email: newSession.user.email ?? '',
          full_name: newSession.user.user_metadata?.full_name ?? null,
          phone: newSession.user.user_metadata?.phone ?? null,
          avatar_url: newSession.user.user_metadata?.avatar_url ?? null,
          telegram_chat_id: null,
          telegram_link_token: null,
          whatsapp_phone: null,
          whatsapp_verify_code: null,
          push_token: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        // Set a minimal user immediately so the app can render
        setUser(fallbackUser);
        setLoading(false);

        // Enrich user data and PostHog in the background (non-blocking)
        (async () => {
          try {
            await supabase.from('users').upsert(
              {
                id: uid,
                email: newSession.user.email ?? '',
                full_name: newSession.user.user_metadata?.full_name ?? null,
                phone: newSession.user.user_metadata?.phone ?? null,
              },
              { onConflict: 'id', ignoreDuplicates: true }
            );
            const { data } = await supabase
              .from('users')
              .select('*')
              .eq('id', uid)
              .single();
            if (data) setUser(data);

            const [{ count: propCount }, { count: tenantCount }] = await Promise.all([
              supabase.from('properties').select('id', { count: 'exact', head: true }).eq('owner_id', uid).eq('is_archived', false),
              supabase.from('tenants').select('id', { count: 'exact', head: true }).eq('user_id', uid),
            ]);
            posthog.identify(uid, {
              email: newSession.user.email ?? '',
              name: newSession.user.user_metadata?.full_name ?? '',
              property_count: propCount ?? 0,
              tenant_count: tenantCount ?? 0,
              is_landlord: (propCount ?? 0) > 0,
              is_tenant: (tenantCount ?? 0) > 0,
              has_telegram: !!(data ?? fallbackUser).telegram_chat_id,
              theme: useAuthStore.getState().themeMode,
            });
          } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : 'Failed to load profile';
            useToastStore.getState().showToast('Profile sync failed. Some data may be outdated.', 'error');
          }
          registerPushToken(uid);
        })();
      } else {
        setUser(null);
        posthog.reset();
        setLoading(false);
      }
    });

    return () => { subscription.unsubscribe(); clearTimeout(fallback); };
  }, []);

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
          router.replace(pendingRoute as Href);
        } else {
          router.replace(onboardingCompleted ? '/(tabs)/dashboard' : '/onboarding');
        }
      }
    });
  }, [session, isLoading, segments, isLocked, pendingRoute]);

  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      interface NotificationData { screen?: string; }
      const notifData = response.notification.request.content.data as NotificationData;
      const screen = notifData?.screen;
      if (screen) router.push(screen as Href);
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
  const inner = (
    <ThemeProvider>
      <UpdateGate>
        <InnerLayout />
      </UpdateGate>
    </ThemeProvider>
  );

  if (!POSTHOG_API_KEY) {
    return inner;
  }

  return (
    <PostHogProvider
      apiKey={POSTHOG_API_KEY}
      options={{ host: POSTHOG_HOST }}
      autocapture={{ captureTouches: true, captureScreens: true }}
    >
      {inner}
    </PostHogProvider>
  );
}
