/**
 * Throws at import time if a required env var is missing or empty.
 * Since config.ts is imported by lib/supabase.ts at module load,
 * this fires before the Supabase client is created — fail fast.
 */
function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(
      `[Dwella] Missing required environment variable: ${key}\n` +
      `Add it to your .env file and restart the dev server.`
    );
  }
  return value;
}

// ── Critical (throw if missing) ─────────────────────────────────────
export const SUPABASE_URL = requireEnv('EXPO_PUBLIC_SUPABASE_URL');
export const SUPABASE_ANON_KEY = requireEnv('EXPO_PUBLIC_SUPABASE_ANON_KEY');

// ── Optional (warn + continue) ──────────────────────────────────────
export const SENTRY_DSN = process.env.EXPO_PUBLIC_SENTRY_DSN ?? '';
if (!process.env.EXPO_PUBLIC_SENTRY_DSN) {
  console.warn('[Dwella] EXPO_PUBLIC_SENTRY_DSN not set — crash reporting disabled');
}

export const TELEGRAM_BOT_USERNAME = process.env.EXPO_PUBLIC_TELEGRAM_BOT_USERNAME ?? '';
if (!process.env.EXPO_PUBLIC_TELEGRAM_BOT_USERNAME) {
  console.warn('[Dwella] EXPO_PUBLIC_TELEGRAM_BOT_USERNAME not set — Telegram bot link disabled');
}

export const WHATSAPP_BOT_PHONE = process.env.EXPO_PUBLIC_WHATSAPP_BOT_PHONE ?? '';
if (!process.env.EXPO_PUBLIC_WHATSAPP_BOT_PHONE) {
  console.warn('[Dwella] EXPO_PUBLIC_WHATSAPP_BOT_PHONE not set — WhatsApp bot link disabled');
}

// ── Non-env constants ───────────────────────────────────────────────
export const STORAGE_BUCKET = 'payment-proofs';
export const BOT_MODEL = 'claude-sonnet-4-20250514';
export const AUTO_CONFIRM_HOURS = 48;
export const REMINDER_DAYS_BEFORE = 3;
export const REMINDER_DAYS_AFTER = 3;
