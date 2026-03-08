import { Platform } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import * as AppleAuthentication from 'expo-apple-authentication';
import { supabase } from './supabase';

// Hardcoded — must match app.json scheme and Supabase allowed redirect URLs.
// makeRedirectUri() is avoided because it can return exp:// in Expo Go or
// triple-slash variants that break ASWebAuthenticationSession matching.
const REDIRECT_URI = 'dwella://auth/callback';

/**
 * Sign in with Google via Supabase OAuth (PKCE flow).
 * Opens an in-app browser session; Supabase redirects back with ?code=...
 * which is exchanged for a session via exchangeCodeForSession().
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

  const result = await WebBrowser.openAuthSessionAsync(data.url, REDIRECT_URI);

  if (result.type === 'success' && result.url) {
    const { error: sessionError } = await supabase.auth.exchangeCodeForSession(result.url);
    if (sessionError) throw sessionError;
    return { success: true };
  }

  return { success: false };
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

/**
 * Native Apple Sign-In (iOS only).
 * Passes the identity token directly to Supabase — no browser needed.
 */
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

  // Apple only returns the name on first sign-in — update profile if present
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

/**
 * Apple Sign-In via web OAuth (Android fallback).
 */
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

  const result = await WebBrowser.openAuthSessionAsync(data.url, REDIRECT_URI);

  if (result.type === 'success' && result.url) {
    const { error: sessionError } = await supabase.auth.exchangeCodeForSession(result.url);
    if (sessionError) throw sessionError;
    return { success: true };
  }

  return { success: false };
}

/**
 * Check if native Apple Sign-In is available (iOS 13+).
 */
export async function isAppleSignInAvailable(): Promise<boolean> {
  if (Platform.OS !== 'ios') return true;
  return AppleAuthentication.isAvailableAsync();
}
