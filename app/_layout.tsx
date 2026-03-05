import { useEffect, useRef } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { PaperProvider, MD3LightTheme } from 'react-native-paper';
import { Colors } from '@/constants/colors';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/lib/store';

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
      router.replace('/(auth)/login');
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
        <Stack.Screen name="property/create" options={{ headerShown: true, title: 'Property', presentation: 'modal' }} />
        <Stack.Screen name="log-payment" options={{ headerShown: true, presentation: 'modal', title: 'Log Payment', headerStyle: { backgroundColor: Colors.surface }, headerTintColor: Colors.textPrimary }} />
        <Stack.Screen name="invite/[token]" />
        <Stack.Screen
          name="reminders"
          options={{
            headerShown: true,
            title: 'Send Reminders',
            presentation: 'modal',
            headerStyle: { backgroundColor: Colors.surface },
            headerTintColor: Colors.textPrimary,
          }}
        />
        <Stack.Screen name="+not-found" />
      </Stack>
    </PaperProvider>
  );
}
