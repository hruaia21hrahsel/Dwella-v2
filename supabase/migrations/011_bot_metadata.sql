-- Add metadata JSONB column to bot_conversations for storing pending action data
ALTER TABLE public.bot_conversations ADD COLUMN metadata JSONB;
