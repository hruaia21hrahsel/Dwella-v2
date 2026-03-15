import * as Crypto from 'expo-crypto';
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

function secureRandomDigits(length: number): string {
  const bytes = Crypto.getRandomBytes(length);
  let result = '';
  for (let i = 0; i < length; i++) {
    result += (bytes[i] % 10).toString();
  }
  return result;
}

/** Generate a one-time telegram link token for the current user */
export async function generateTelegramLinkToken(userId: string): Promise<string> {
  const token = Crypto.randomUUID();

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

/** Normalize a phone number to E.164 format */
function normalizePhoneE164(phone: string): string {
  const digits = phone.replace(/[^\d+]/g, '');
  return digits.startsWith('+') ? digits : `+${digits}`;
}

/** Initiate WhatsApp account linking — generates a 6-digit code and sends it via template message */
export async function initiateWhatsAppLink(userId: string, phoneNumber: string): Promise<string> {
  const phone = normalizePhoneE164(phoneNumber);
  const code = secureRandomDigits(6);

  // Store the verification code on the user row
  const { error: updateError } = await supabase
    .from('users')
    .update({ whatsapp_verify_code: code })
    .eq('id', userId);

  if (updateError) throw updateError;

  // Call the server-side Edge Function to send the template message
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Not authenticated');

  const res = await fetch(
    `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/whatsapp-send-code`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ phone, code }),
    },
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Failed to send verification code: ${err}`);
  }

  return code;
}

/** Unlink WhatsApp from the current user */
export async function unlinkWhatsApp(userId: string): Promise<void> {
  const { error } = await supabase
    .from('users')
    .update({ whatsapp_phone: null, whatsapp_verify_code: null })
    .eq('id', userId);

  if (error) throw error;
}
