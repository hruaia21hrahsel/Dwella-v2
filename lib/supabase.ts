import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';
import { SUPABASE_ANON_KEY, SUPABASE_URL } from '@/constants/config';

// On web browser use localStorage; during SSR (no window) pass undefined so
// Supabase skips persistence and avoids "window is not defined" crashes.
const authStorage =
  Platform.OS === 'web'
    ? typeof window !== 'undefined'
      ? window.localStorage
      : undefined
    : AsyncStorage;

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: authStorage as any,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
    // Implicit flow avoids PKCE code-verifier storage issues in React Native.
    // With PKCE the verifier can be lost when the JS thread is suspended during
    // the in-app browser session, causing "code verifier should be non-empty".
    flowType: 'implicit',
  },
});
