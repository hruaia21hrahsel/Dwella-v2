import { Platform } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import * as AppleAuthentication from 'expo-apple-authentication';
import { makeRedirectUri } from 'expo-auth-session';
import { supabase } from './supabase';

const redirectUri = makeRedirectUri({
  scheme: 'dwella',
  path: 'auth/callback',
});

/**
 * Sign in with Google via Supabase OAuth.
 * Opens a web browser session, Supabase handles the OAuth flow,
 * then redirects back to the app with the session.
 */
export async function signInWithGoogle() {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: redirectUri,
      skipBrowserRedirect: true,
    },
  });

  if (error) throw error;
  if (!data.url) throw new Error('No OAuth URL returned');

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectUri);

  if (result.type === 'success') {
    const url = result.url;
    // Extract tokens from the URL fragment
    const params = extractHashParams(url);

    if (params.access_token && params.refresh_token) {
      const { error: sessionError } = await supabase.auth.setSession({
        access_token: params.access_token,
        refresh_token: params.refresh_token,
      });
      if (sessionError) throw sessionError;
      return { success: true };
    }
  }

  return { success: false };
}

/**
 * Sign in with Apple using native Apple Authentication on iOS,
 * or falls back to OAuth web flow on Android.
 */
export async function signInWithApple() {
  if (Platform.OS === 'ios') {
    return signInWithAppleNative();
  }
  return signInWithAppleWeb();
}

/**
 * Native Apple Sign-In (iOS only).
 * Uses expo-apple-authentication for the native credential,
 * then passes the identity token to Supabase.
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

  // Apple only returns the name on the first sign-in, so update profile if available
  if (credential.fullName?.givenName || credential.fullName?.familyName) {
    const fullName = [credential.fullName.givenName, credential.fullName.familyName]
      .filter(Boolean)
      .join(' ');

    if (fullName) {
      await supabase.auth.updateUser({
        data: { full_name: fullName },
      });
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
      redirectTo: redirectUri,
      skipBrowserRedirect: true,
    },
  });

  if (error) throw error;
  if (!data.url) throw new Error('No OAuth URL returned');

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectUri);

  if (result.type === 'success') {
    const params = extractHashParams(result.url);

    if (params.access_token && params.refresh_token) {
      const { error: sessionError } = await supabase.auth.setSession({
        access_token: params.access_token,
        refresh_token: params.refresh_token,
      });
      if (sessionError) throw sessionError;
      return { success: true };
    }
  }

  return { success: false };
}

/**
 * Check if native Apple Sign-In is available (iOS 13+).
 */
export async function isAppleSignInAvailable(): Promise<boolean> {
  if (Platform.OS !== 'ios') return true; // Android uses web fallback, always "available"
  return AppleAuthentication.isAvailableAsync();
}

/**
 * Parse hash fragment parameters from a redirect URL.
 * Supabase returns tokens in the URL fragment: #access_token=...&refresh_token=...
 */
function extractHashParams(url: string): Record<string, string> {
  const hash = url.split('#')[1];
  if (!hash) return {};

  const params: Record<string, string> = {};
  for (const pair of hash.split('&')) {
    const [key, value] = pair.split('=');
    if (key && value) params[decodeURIComponent(key)] = decodeURIComponent(value);
  }
  return params;
}
