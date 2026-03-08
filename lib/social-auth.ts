import { Platform } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import * as AppleAuthentication from 'expo-apple-authentication';
import { supabase } from './supabase';

// Must match app.json scheme + Supabase allowed redirect URLs.
const REDIRECT_URI = 'dwella://auth/callback';

/**
 * Sign in with Google via Supabase OAuth (implicit flow).
 * Supabase redirects back to dwella://auth/callback#access_token=...
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
    return handleOAuthRedirect(result.url);
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
    return handleOAuthRedirect(result.url);
  }

  return { success: false };
}

/**
 * Parses tokens from the OAuth redirect URL (implicit flow returns them
 * in the hash fragment: dwella://auth/callback#access_token=...&refresh_token=...)
 * then sets the Supabase session.
 */
async function handleOAuthRedirect(url: string) {
  // Hash fragment: #access_token=...&refresh_token=...&token_type=bearer&...
  const hash = url.split('#')[1] ?? '';
  const params: Record<string, string> = {};
  for (const pair of hash.split('&')) {
    const [key, val] = pair.split('=');
    if (key && val) params[decodeURIComponent(key)] = decodeURIComponent(val);
  }

  const { access_token, refresh_token } = params;
  if (!access_token || !refresh_token) {
    throw new Error('OAuth redirect did not return tokens. Check Supabase provider config.');
  }

  const { error } = await supabase.auth.setSession({ access_token, refresh_token });
  if (error) throw error;

  return { success: true };
}

/**
 * Check if native Apple Sign-In is available (iOS 13+).
 */
export async function isAppleSignInAvailable(): Promise<boolean> {
  if (Platform.OS !== 'ios') return true;
  return AppleAuthentication.isAvailableAsync();
}
