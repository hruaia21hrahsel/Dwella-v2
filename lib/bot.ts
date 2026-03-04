import { supabase } from './supabase';

const FUNCTION_URL = `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/process-bot-message`;

export interface BotResponse {
  reply: string;
  intent?: string;
  action_taken?: string;
}

export async function sendBotMessage(userId: string, message: string): Promise<BotResponse> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Not authenticated');

  const res = await fetch(FUNCTION_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ user_id: userId, message, source: 'app' }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Bot error: ${res.status} ${err}`);
  }

  return res.json() as Promise<BotResponse>;
}

/** Generate a one-time telegram link token for the current user */
export async function generateTelegramLinkToken(userId: string): Promise<string> {
  // Generate a random token
  const token = crypto.randomUUID();

  const { error } = await supabase
    .from('users')
    .update({ telegram_link_token: token })
    .eq('id', userId);

  if (error) throw error;
  return token;
}

/** Unlink Telegram from the current user */
export async function unlinkTelegram(userId: string): Promise<void> {
  const { error } = await supabase
    .from('users')
    .update({ telegram_chat_id: null, telegram_link_token: null })
    .eq('id', userId);

  if (error) throw error;
}
