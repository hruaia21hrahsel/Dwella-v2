export const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
export const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

export const STORAGE_BUCKET = 'payment-proofs';

// Set this to your Telegram bot's @username (without the @)
export const TELEGRAM_BOT_USERNAME = process.env.EXPO_PUBLIC_TELEGRAM_BOT_USERNAME ?? '';
export const WHATSAPP_BOT_PHONE = process.env.EXPO_PUBLIC_WHATSAPP_BOT_PHONE ?? '';

export const BOT_MODEL = 'claude-sonnet-4-20250514';

export const AUTO_CONFIRM_HOURS = 48;
export const REMINDER_DAYS_BEFORE = 3;
export const REMINDER_DAYS_AFTER = 3;
