-- Phase 13: Rich Messaging & Menus
-- Add last_bot_message_at for session detection (D-06)

ALTER TABLE users ADD COLUMN IF NOT EXISTS last_bot_message_at TIMESTAMPTZ;

COMMENT ON COLUMN users.last_bot_message_at IS 'Timestamp of last bot interaction for session detection (1-hour gap = new session)';
