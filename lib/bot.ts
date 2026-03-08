import { supabase } from './supabase';

const FUNCTION_URL = `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/process-bot-message`;

export interface PendingAction {
  action: string;
  entities: Record<string, unknown>;
  description: string;
}

export interface BotResponse {
  reply: string;
  intent?: string;
  action_taken?: string;
  pending_action?: PendingAction | null;
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

function randomUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/** Generate a one-time telegram link token for the current user */
export async function generateTelegramLinkToken(userId: string): Promise<string> {
  const token = randomUUID();

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
