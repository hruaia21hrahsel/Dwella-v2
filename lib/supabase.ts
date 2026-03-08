import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { SUPABASE_ANON_KEY, SUPABASE_URL } from '@/constants/config';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
    // Implicit flow avoids PKCE code-verifier storage issues in React Native.
    // With PKCE the verifier can be lost when the JS thread is suspended during
    // the in-app browser session, causing "code verifier should be non-empty".
    flowType: 'implicit',
  },
});
