import { useEffect, useRef, useState, useCallback } from 'react';
import { Stack, useRouter, useSegments, type Href } from 'expo-router';
import { PaperProvider, MD3LightTheme, MD3DarkTheme } from 'react-native-paper';
import { StatusBar } from 'expo-status-bar';
import { InteractionManager } from 'react-native';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/lib/store';
import { User } from '@/lib/types';
import { usePostHog, getPostHogProvider, POSTHOG_API_KEY, POSTHOG_HOST } from '@/lib/posthog';
import { TourGuideCard } from '@/components/TourGuideCard';
import { ToastProvider } from '@/components/ToastProvider';
import { ThemeProvider, useTheme } from '@/lib/theme-context';
import { useToastStore } from '@/lib/toast';
import { enableStorage } from '@/lib/deferred-storage';

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

  // Dismiss splash screen once loading finishes (or after a safety timeout).
  // No preventAutoHideAsync needed — Expo SDK 54 keeps the native splash
  // visible by default until hideAsync() is called explicitly.
  useEffect(() => {
    if (!isLoading) {
      // Delay the native TurboModule call until all interactions are done
      // to avoid the performVoidMethodInvocation crash during startup.
      InteractionManager.runAfterInteractions(() => {
        const SplashScreen = require('expo-splash-screen') as typeof import('expo-splash-screen');
        SplashScreen.hideAsync();
      });
    }
  }, [isLoading]);

  // ── Supabase auth listener ─────────────────────────────────────────
  useEffect(() => {
    // Safety net: if onAuthStateChange never fires (bad config, network), unblock after 3s
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
            posthog?.identify(uid, {
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
          // Lazy-load expo-notifications transitively via lib/notifications
          const { registerPushToken } = require('@/lib/notifications') as typeof import('@/lib/notifications');
          registerPushToken(uid);
        })();
      } else {
        setUser(null);
        posthog?.reset();
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
    // Lazy-load biometric-auth to defer expo-secure-store native init.
    const { isBiometricEnabled } = require('@/lib/biometric-auth') as typeof import('@/lib/biometric-auth');
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

  // Defer notification listener setup until after all startup interactions
  // complete — prevents TurboModule void method crash during launch.
  useEffect(() => {
    const handle = InteractionManager.runAfterInteractions(() => {
      const Notifications = require('expo-notifications') as typeof import('expo-notifications');
      const sub = Notifications.addNotificationResponseReceivedListener((response) => {
        interface NotificationData { screen?: string; }
        const notifData = response.notification.request.content.data as NotificationData;
        const screen = notifData?.screen;
        if (screen) router.push(screen as Href);
      });
      // Store cleanup for when effect unmounts
      cleanupRef.current = () => sub.remove();
    });
    return () => { handle.cancel(); cleanupRef.current?.(); };
  }, []);

  const cleanupRef = useRef<(() => void) | null>(null);

  return null;
}

function InnerLayout() {
  const { colors, isDark } = useTheme();
  const paperTheme = usePaperTheme();

  // Defer notification handler setup until after startup interactions.
  useEffect(() => {
    const handle = InteractionManager.runAfterInteractions(() => {
      const Notifications = require('expo-notifications') as typeof import('expo-notifications');
      Notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowAlert: true,
          shouldPlaySound: true,
          shouldSetBadge: false,
          shouldShowBanner: true,
          shouldShowList: true,
        }),
      });
    });
    return () => handle.cancel();
  }, []);

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

/**
 * Lazy-loaded UpdateGate — prevents expo-updates native module from
 * auto-initializing at bundle evaluation time.
 */
function LazyUpdateGate({ children }: { children: React.ReactNode }) {
  const [UpdateGate, setUpdateGate] = useState<React.ComponentType<{ children: React.ReactNode }> | null>(null);

  useEffect(() => {
    InteractionManager.runAfterInteractions(() => {
      const mod = require('@/components/UpdateGate') as typeof import('@/components/UpdateGate');
      setUpdateGate(() => mod.UpdateGate);
    });
  }, []);

  if (!UpdateGate) return <>{children}</>;
  return <UpdateGate>{children}</UpdateGate>;
}

export default function RootLayout() {
  const [postHogReady, setPostHogReady] = useState(false);
  // Lazy-loaded PostHogProvider — posthog-react-native depends on
  // @react-native-async-storage/async-storage whose TurboModule crashes
  // Hermes when it auto-registers on iOS 26.3 (builds 23-32).
  const [PHProvider, setPHProvider] = useState<React.ComponentType<{
    apiKey: string;
    options: { host: string };
    autocapture: { captureTouches: boolean; captureScreens: boolean };
    children: React.ReactNode;
  }> | null>(null);

  useEffect(() => {
    enableStorage();
    // Defer PostHog native module loading until after interactions
    InteractionManager.runAfterInteractions(() => {
      const Provider = getPostHogProvider();
      setPHProvider(() => Provider);
      setPostHogReady(true);
    });
  }, []);

  const inner = (
    <ThemeProvider>
      <LazyUpdateGate>
        <InnerLayout />
      </LazyUpdateGate>
    </ThemeProvider>
  );

  if (!POSTHOG_API_KEY || !postHogReady || !PHProvider) {
    return inner;
  }

  return (
    <PHProvider
      apiKey={POSTHOG_API_KEY}
      options={{ host: POSTHOG_HOST }}
      autocapture={{ captureTouches: false, captureScreens: false }}
    >
      {inner}
    </PHProvider>
  );
}
