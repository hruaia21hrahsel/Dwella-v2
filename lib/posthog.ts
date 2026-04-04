/**
 * PostHog lazy-loading wrapper.
 *
 * posthog-react-native depends on @react-native-async-storage/async-storage,
 * whose TurboModule auto-registers on startup and throws an NSException on
 * iOS 26.3. The exception handler in RCTTurboModule.mm corrupts Hermes by
 * accessing the JS runtime from a background dispatch thread (SIGSEGV).
 *
 * By lazy-loading via require(), the AsyncStorage TurboModule only initialises
 * when PostHog is actually used (inside a useEffect), not at bundle evaluation.
 */

export const POSTHOG_API_KEY = process.env.EXPO_PUBLIC_POSTHOG_API_KEY ?? '';
export const POSTHOG_HOST = process.env.EXPO_PUBLIC_POSTHOG_HOST ?? 'https://us.i.posthog.com';

// Lazy accessors — only load posthog-react-native when actually called.
// This prevents @react-native-async-storage/async-storage TurboModule
// from auto-registering at import time.

export function getPostHogProvider(): typeof import('posthog-react-native').PostHogProvider {
  return (require('posthog-react-native') as typeof import('posthog-react-native')).PostHogProvider;
}

export function usePostHog(): ReturnType<typeof import('posthog-react-native').usePostHog> {
  const mod = require('posthog-react-native') as typeof import('posthog-react-native');
  return mod.usePostHog();
}
