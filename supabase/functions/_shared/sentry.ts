// Sentry observability for Supabase Edge Functions (SEC-04)
// CRITICAL: Every edge function must call flushSentry() before returning
// ANY response — otherwise the Deno isolate terminates and errors are lost.

import * as Sentry from 'https://deno.land/x/sentry/index.mjs';

let initialized = false;

export function initSentry(): void {
  if (initialized) return;
  const dsn = Deno.env.get('SENTRY_DSN');
  if (!dsn) return;
  Sentry.init({
    dsn,
    defaultIntegrations: false,
    tracesSampleRate: 1.0,
  });
  initialized = true;
}

export async function flushSentry(): Promise<void> {
  if (!initialized) return;
  try {
    await Sentry.flush(2000);
  } catch {
    // Swallow flush errors — don't let observability break the function
  }
}

export function captureException(error: unknown): void {
  if (!initialized) return;
  Sentry.captureException(error);
}

export function captureMessage(message: string, level: 'info' | 'warning' | 'error' = 'info'): void {
  if (!initialized) return;
  Sentry.captureMessage(message, level);
}

export { Sentry };
