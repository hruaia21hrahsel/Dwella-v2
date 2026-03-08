import { Platform } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import * as AppleAuthentication from 'expo-apple-authentication';
import { makeRedirectUri } from 'expo-auth-session';
import { supabase } from './supabase';

// Complete any dangling auth sessions when the app resumes.
WebBrowser.maybeCompleteAuthSession();

// makeRedirectUri generates the correct callback URL for the current
// environment: custom scheme for standalone builds, proxy URL for Expo Go.
const REDIRECT_URI = makeRedirectUri({ scheme: 'dwella', path: 'auth/callback' });

/**
 * Sign in with Google via Supabase OAuth (implicit flow).
 */
export async function signInWithGoogle() {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: REDIRECT_URI,
      skipBrowserRedirect: true,
    },
  });

  if (error) throw error;
  if (!data.url) throw new Error('No OAuth URL returned');

  if (Platform.OS === 'android') await WebBrowser.warmUpAsync().catch(() => {});

  try {
    const result = await WebBrowser.openAuthSessionAsync(data.url, REDIRECT_URI);

    if (result.type === 'success' && result.url) {
      await setSessionFromRedirect(result.url);
      return { success: true };
    }
    return { success: false };
  } finally {
    if (Platform.OS === 'android') await WebBrowser.coolDownAsync().catch(() => {});
  }
}

/**
 * Sign in with Apple — native on iOS, web OAuth fallback on Android.
 */
export async function signInWithApple() {
  if (Platform.OS === 'ios') {
    return signInWithAppleNative();
  }
  return signInWithAppleWeb();
}

async function signInWithAppleNative() {
  const credential = await AppleAuthentication.signInAsync({
    requestedScopes: [
      AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
      AppleAuthentication.AppleAuthenticationScope.EMAIL,
    ],
  });

  if (!credential.identityToken) {
    throw new Error('No identity token returned from Apple');
  }

  const { error } = await supabase.auth.signInWithIdToken({
    provider: 'apple',
    token: credential.identityToken,
  });
  if (error) throw error;

  if (credential.fullName?.givenName || credential.fullName?.familyName) {
    const fullName = [credential.fullName.givenName, credential.fullName.familyName]
      .filter(Boolean)
      .join(' ');
    if (fullName) {
      await supabase.auth.updateUser({ data: { full_name: fullName } });
    }
  }

  return { success: true };
}

async function signInWithAppleWeb() {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'apple',
    options: {
      redirectTo: REDIRECT_URI,
      skipBrowserRedirect: true,
    },
  });

  if (error) throw error;
  if (!data.url) throw new Error('No OAuth URL returned');

  if (Platform.OS === 'android') await WebBrowser.warmUpAsync().catch(() => {});

  try {
    const result = await WebBrowser.openAuthSessionAsync(data.url, REDIRECT_URI);

    if (result.type === 'success' && result.url) {
      await setSessionFromRedirect(result.url);
      return { success: true };
    }
    return { success: false };
  } finally {
    if (Platform.OS === 'android') await WebBrowser.coolDownAsync().catch(() => {});
  }
}

/**
 * Extract tokens from the redirect URL hash fragment and set the Supabase session.
 */
async function setSessionFromRedirect(url: string) {
  const hash = url.split('#')[1] ?? '';
  const params: Record<string, string> = {};
  for (const pair of hash.split('&')) {
    const idx = pair.indexOf('=');
    if (idx > 0) {
      params[decodeURIComponent(pair.slice(0, idx))] = decodeURIComponent(pair.slice(idx + 1));
    }
  }

  const { access_token, refresh_token } = params;
  if (!access_token || !refresh_token) {
    throw new Error('OAuth redirect did not return tokens. Check Supabase provider config.');
  }

  const { error } = await supabase.auth.setSession({ access_token, refresh_token });
  if (error) throw error;
}

export async function isAppleSignInAvailable(): Promise<boolean> {
  if (Platform.OS !== 'ios') return true;
  return AppleAuthentication.isAvailableAsync();
}
