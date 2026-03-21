import * as Sentry from '@sentry/react-native';
import { SENTRY_DSN } from '@/constants/config';

/**
 * Initialize Sentry for production crash monitoring.
 * No-ops gracefully when DSN is not set (local development).
 * Crash-only configuration — no performance monitoring or breadcrumbs.
 */
export function initSentry(): void {
  if (!SENTRY_DSN) {
    if (__DEV__) {
      console.log('[Sentry] No DSN configured — skipping init');
    }
    return;
  }

  Sentry.init({
    dsn: SENTRY_DSN,
    // Crash-only config per project decision — no performance monitoring
    tracesSampleRate: 0,
    enableAutoPerformanceTracing: false,
    enableAutoSessionTracking: false,
    // Native crash reporting disabled: @sentry/react-native 7.2.x native iOS
    // framework is incompatible with Expo SDK 54 / RN 0.81. Re-enable once
    // the Sentry config plugin is re-added and the version is updated.
    enableNative: false,
    debug: __DEV__,
  });
}
