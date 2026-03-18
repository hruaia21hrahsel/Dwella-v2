import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const WHATSAPP_ACCESS_TOKEN = Deno.env.get('WHATSAPP_ACCESS_TOKEN')!;
const WHATSAPP_PHONE_NUMBER_ID = Deno.env.get('WHATSAPP_PHONE_NUMBER_ID')!;
const WHATSAPP_VERIFY_TOKEN = Deno.env.get('WHATSAPP_VERIFY_TOKEN')!;
const WHATSAPP_APP_SECRET = Deno.env.get('WHATSAPP_APP_SECRET');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const PROCESS_BOT_URL = `${SUPABASE_URL}/functions/v1/process-bot-message`;

/** Normalize a phone number to E.164 format with + prefix */
function normalizePhone(phone: string): string {
  const digits = phone.replace(/[^\d]/g, '');
  return digits.startsWith('+') ? digits : `+${digits}`;
}

/** Send a text message via WhatsApp Cloud API */
async function sendWhatsApp(to: string, text: string) {
  const res = await fetch(
    `https://graph.facebook.com/v21.0/${WHATSAPP_PHONE_NUMBER_ID}/messages`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to,
        type: 'text',
        text: { body: text },
      }),
    },
  );

  if (!res.ok) {
    const err = await res.text();
    console.error('WhatsApp send error:', err);
  }
}

/** Validate Meta X-Hub-Signature-256 HMAC-SHA256 (SEC-05) */
async function validateMetaSignature(req: Request, rawBody: string): Promise<boolean> {
  if (!WHATSAPP_APP_SECRET) return true; // Skip validation in dev when secret not configured

  const signature = req.headers.get('X-Hub-Signature-256');
  if (!signature || !signature.startsWith('sha256=')) return false;

  const expectedHex = signature.slice('sha256='.length);
  const keyData = new TextEncoder().encode(WHATSAPP_APP_SECRET);
  const key = await crypto.subtle.importKey(
    'raw', keyData, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const bodyBytes = new TextEncoder().encode(rawBody);
  const sigBytes = await crypto.subtle.sign('HMAC', key, bodyBytes);
  const computedHex = Array.from(new Uint8Array(sigBytes))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');

  return computedHex === expectedHex;
}

serve(async (req) => {
  const url = new URL(req.url);

  // ---- GET: Meta webhook verification challenge ----
  if (req.method === 'GET') {
    const mode = url.searchParams.get('hub.mode');
    const token = url.searchParams.get('hub.verify_token');
    const challenge = url.searchParams.get('hub.challenge');

    if (mode === 'subscribe' && token === WHATSAPP_VERIFY_TOKEN) {
      console.log('WhatsApp webhook verified.');
      return new Response(challenge, { status: 200, headers: { 'Content-Type': 'text/plain' } });
    }

    return new Response('Forbidden', { status: 403 });
  }

  // ---- POST: Incoming messages ----
  if (req.method !== 'POST') {
    return new Response('OK', { status: 200 });
  }

  // Read raw body for HMAC validation before parsing (SEC-05)
  let rawBody: string;
  try {
    rawBody = await req.text();
  } catch {
    return new Response('Bad request', { status: 400 });
  }

  // Validate HMAC signature
  if (!(await validateMetaSignature(req, rawBody))) {
    console.warn('WhatsApp webhook: HMAC validation failed');
    return new Response('Unauthorized', { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return new Response('Bad request', { status: 400 });
  }

  // Extract message from WhatsApp webhook payload
  const entry = (body['entry'] as any[])?.[0];
  const change = entry?.['changes']?.[0];
  const value = change?.['value'];

  // Ignore status updates (delivery receipts, read receipts, etc.)
  if (!value?.['messages'] || value['messages'].length === 0) {
    return new Response('OK', { status: 200 });
  }

  const msg = value['messages'][0];
  const senderPhone = normalizePhone(msg['from'] as string);
  const text = (msg['text']?.['body'] as string) ?? '';

  if (!text.trim()) {
    return new Response('OK', { status: 200 });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  // ---- Account linking: 6-digit verification code ----
  const isVerifyCode = /^\d{6}$/.test(text.trim());

  if (isVerifyCode) {
    // Check if this phone is already linked
    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .eq('whatsapp_phone', senderPhone)
      .single();

    if (!existingUser) {
      // Try to match the verification code
      const { data: codeUser, error } = await supabase
        .from('users')
        .select('id, full_name')
        .eq('whatsapp_verify_code', text.trim())
        .single();

      if (error || !codeUser) {
        await sendWhatsApp(
          senderPhone,
          'Invalid or expired verification code. Please generate a new one from the Dwella app.',
        );
        return new Response('OK', { status: 200 });
      }

      // Link the account
      await supabase
        .from('users')
        .update({ whatsapp_phone: senderPhone, whatsapp_verify_code: null })
        .eq('id', codeUser.id);

      const name = codeUser.full_name ?? 'there';
      await sendWhatsApp(
        senderPhone,
        `Linked! Hi ${name}, your Dwella account is now connected to WhatsApp.\n\nYou can now ask me about your properties and payments right here!`,
      );
      return new Response('OK', { status: 200 });
    }
  }

  // ---- Regular message: find linked user ----
  const { data: linkedUser } = await supabase
    .from('users')
    .select('id')
    .eq('whatsapp_phone', senderPhone)
    .single();

  if (!linkedUser) {
    await sendWhatsApp(
      senderPhone,
      "I don't recognize this WhatsApp number. Please link it from the Dwella app \u2192 Profile \u2192 Link WhatsApp.",
    );
    return new Response('OK', { status: 200 });
  }

  // Forward to process-bot-message
  try {
    const botRes = await fetch(PROCESS_BOT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
      },
      body: JSON.stringify({
        user_id: linkedUser.id,
        message: text,
        source: 'whatsapp',
      }),
    });

    const botData = (await botRes.json()) as { reply?: string; error?: string };
    const reply = botData.reply ?? 'Sorry, I encountered an error. Please try again.';
    await sendWhatsApp(senderPhone, reply);
  } catch (err) {
    console.error('WhatsApp webhook forwarding error:', err);
    await sendWhatsApp(senderPhone, 'Sorry, something went wrong. Please try again later.');
  }

  return new Response('OK', { status: 200 });
});
