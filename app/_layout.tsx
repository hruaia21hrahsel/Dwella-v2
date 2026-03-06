import { useEffect, useRef } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { PaperProvider, MD3LightTheme } from 'react-native-paper';
import { Colors } from '@/constants/colors';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/lib/store';
import { isBiometricEnabled } from '@/lib/biometric-auth';
import { ProfileHeaderButton } from '@/components/ProfileHeaderButton';
import { DwellaHeaderTitle } from '@/components/DwellaHeaderTitle';

const theme = {
  ...MD3LightTheme,
  colors: {
    ...MD3LightTheme.colors,
    primary: Colors.primary,
    secondary: Colors.primaryLight,
  },
};

function AuthGuard() {
  const { session, isLoading, setSession, setUser, setLoading } = useAuthStore();
  const segments = useSegments();
  const router = useRouter();
  const initialRedirectDone = useRef(false);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
      setSession(newSession);

      if (newSession?.user) {
        // Upsert ensures a profile row exists even if the DB trigger missed it
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
      } else {
        setUser(null);
      }

      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (isLoading) return;

    const inAuthGroup = segments[0] === '(auth)';

    if (!session && !inAuthGroup) {
      // Check if biometric is set up — if so, show lock screen instead of login
      isBiometricEnabled().then((enabled) => {
        router.replace(enabled ? '/(auth)/lock' : '/(auth)/login');
      });
    } else if (session && inAuthGroup) {
      router.replace('/(tabs)/dashboard');
    } else if (session && !inAuthGroup && !initialRedirectDone.current) {
      initialRedirectDone.current = true;
      router.replace('/(tabs)/dashboard');
    }
  }, [session, isLoading, segments]);

  return null;
}

export default function RootLayout() {
  return (
    <PaperProvider theme={theme}>
      <AuthGuard />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="property/create" options={{ headerShown: true, presentation: 'modal', headerStyle: { backgroundColor: Colors.surface }, headerTitleAlign: 'center', headerTitle: () => <DwellaHeaderTitle />, headerLeft: () => <ProfileHeaderButton /> }} />
        <Stack.Screen name="log-payment" options={{ headerShown: true, presentation: 'modal', headerStyle: { backgroundColor: Colors.surface }, headerTitleAlign: 'center', headerTitle: () => <DwellaHeaderTitle />, headerLeft: () => <ProfileHeaderButton /> }} />
        <Stack.Screen name="invite/[token]" />
        <Stack.Screen
          name="pin-setup"
          options={{
            headerShown: true,
            headerStyle: { backgroundColor: Colors.surface },
            headerTitleAlign: 'center',
            headerTitle: () => <DwellaHeaderTitle />,
            headerLeft: () => <ProfileHeaderButton />,
          }}
        />
        <Stack.Screen
          name="reminders/index"
          options={{
            headerShown: true,
            presentation: 'modal',
            headerStyle: { backgroundColor: Colors.surface },
            headerTitleAlign: 'center',
            headerTitle: () => <DwellaHeaderTitle />,
            headerLeft: () => <ProfileHeaderButton />,
          }}
        />
        <Stack.Screen name="+not-found" />
      </Stack>
    </PaperProvider>
  );
}
