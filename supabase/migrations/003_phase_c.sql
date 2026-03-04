-- ============================================================
-- Dwella v2 — Phase C: Bot / Telegram columns
-- ============================================================

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS telegram_chat_id  BIGINT UNIQUE,
  ADD COLUMN IF NOT EXISTS telegram_link_token TEXT UNIQUE;

CREATE INDEX IF NOT EXISTS idx_users_telegram_chat_id    ON public.users(telegram_chat_id);
CREATE INDEX IF NOT EXISTS idx_users_telegram_link_token ON public.users(telegram_link_token);
