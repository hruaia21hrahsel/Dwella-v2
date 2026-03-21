-- ============================================================
-- Add last_bot_message_at to users for session detection (RICH-02)
-- ============================================================
-- D-06: last_bot_message_at updated on every bot interaction
-- D-05: "New session" = gap > 1 hour, triggers main menu display

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS last_bot_message_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_users_last_bot_message_at
  ON public.users(last_bot_message_at);
