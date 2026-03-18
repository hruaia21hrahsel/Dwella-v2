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
    debug: __DEV__,
  });
}
