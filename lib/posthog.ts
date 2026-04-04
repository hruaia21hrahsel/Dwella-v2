/**
 * PostHog lazy-loading wrapper.
 *
 * posthog-react-native's OptionalAsyncStorage.js calls
 * require('@react-native-async-storage/async-storage') at module evaluation
 * time. On iOS 26.3 / RN 0.81 the AsyncStorage TurboModule auto-registers
 * on a background dispatch thread, throws an NSException, and the
 * RCTTurboModule.mm error handler corrupts Hermes by accessing the JS runtime
 * from that background thread → SIGSEGV.
 *
 * Root cause of build 33 crash:
 *   AuthGuard (renders immediately on startup) calls usePostHog() →
 *   lib/posthog.ts usePostHog() calls require('posthog-react-native') during
 *   render → OptionalAsyncStorage.js auto-loads AsyncStorage TurboModule →
 *   crash within 0.2s.
 *
 * Fix: posthog-react-native must NEVER be required during React render.
 * usePostHog() now returns a stable React ref value that is null until
 * RootLayout's useEffect+InteractionManager loads posthog-rn and sets the
 * client. No require() happens in the render path.
 */

import { createContext, useContext } from 'react';

export const POSTHOG_API_KEY = process.env.EXPO_PUBLIC_POSTHOG_API_KEY ?? '';
export const POSTHOG_HOST = process.env.EXPO_PUBLIC_POSTHOG_HOST ?? 'https://us.i.posthog.com';

// ── Internal module cache ─────────────────────────────────────────────────
// Set once from inside useEffect in RootLayout. Never read during render
// to decide whether to require() — only used by getPostHogProvider().
let _posthogModule: typeof import('posthog-react-native') | null = null;

// ── PostHog client context ────────────────────────────────────────────────
// RootLayout sets this after loading posthog-rn and mounting the Provider.
// All consumers read this context — no require() ever happens in render.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PostHogClient = any; // PostHog | undefined; real type from posthog-react-native
const PostHogClientContext = createContext<PostHogClient>(undefined);

export { PostHogClientContext };

/**
 * Safe usePostHog hook — reads from PostHogClientContext.
 *
 * Returns the PostHog client once it is available, or undefined if PostHog
 * has not been loaded yet (or has no API key). All call sites already use
 * optional chaining (posthog?.capture, posthog?.reset) so undefined is safe.
 *
 * IMPORTANT: This hook never calls require('posthog-react-native').
 * The module is loaded exclusively from useEffect in RootLayout.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function usePostHog(): any {
  return useContext(PostHogClientContext);
}

/**
 * Load and return the PostHogProvider component.
 * MUST only be called from inside a useEffect (never during render).
 */
export function getPostHogProvider(): typeof import('posthog-react-native').PostHogProvider {
  if (!_posthogModule) {
    _posthogModule = require('posthog-react-native') as typeof import('posthog-react-native');
  }
  return _posthogModule.PostHogProvider;
}

/**
 * Get the usePostHog hook from posthog-react-native.
 * MUST only be called from inside a useEffect (never during render).
 */
export function getUsePostHog(): () => unknown {
  if (!_posthogModule) {
    _posthogModule = require('posthog-react-native') as typeof import('posthog-react-native');
  }
  return _posthogModule.usePostHog as () => unknown;
}
