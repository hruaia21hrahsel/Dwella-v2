-- Add WhatsApp linking columns to users table
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS whatsapp_phone TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS whatsapp_verify_code TEXT;

CREATE INDEX IF NOT EXISTS idx_users_whatsapp_phone ON public.users(whatsapp_phone);
