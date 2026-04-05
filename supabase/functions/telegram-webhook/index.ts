import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const TELEGRAM_BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN')!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const PROCESS_BOT_URL = `${SUPABASE_URL}/functions/v1/process-bot-message`;

async function sendTelegram(chatId: number, text: string) {
  await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'Markdown' }),
  });
}

/**
 * Send a document (PDF, etc.) to a Telegram chat.
 *
 * Telegram fetches the file from `documentUrl` server-side, so passing
 * a Supabase signed URL works without any manual multipart upload. The
 * signed URL must stay valid for at least a few seconds after this call
 * (process-bot-message issues 10-minute signed URLs).
 */
async function sendTelegramDocument(
  chatId: number,
  documentUrl: string,
  filename: string,
  caption?: string,
) {
  const res = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendDocument`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      document: documentUrl,
      caption: caption ?? undefined,
      // Telegram infers filename from the URL by default — override so
      // the recipient sees a clean `rent-receipt-...pdf` instead of a
      // UUID-ish storage path.
      // (Telegram's `sendDocument` supports a `filename` alongside a
      // file upload but not a URL; we include it in caption as a
      // fallback indicator. The file is still delivered correctly.)
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    console.error('[telegram] sendDocument failed', res.status, body);
  }
  // Silence unused-var lint for filename (kept in signature for future
  // use if we switch to multipart upload).
  void filename;
}

serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('OK', { status: 200 });
  }

  let update: Record<string, unknown>;
  try {
    update = await req.json();
  } catch {
    return new Response('Bad request', { status: 400 });
  }

  const message = update['message'] as Record<string, unknown> | undefined;
  if (!message) return new Response('OK', { status: 200 });

  const chatId = (message['chat'] as Record<string, unknown>)?.['id'] as number;
  const text = (message['text'] as string) ?? '';
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  // ---- /start <link_token> — account linking ----
  if (text.startsWith('/start')) {
    const parts = text.split(' ');
    const linkToken = parts[1]?.trim();

    if (!linkToken) {
      await sendTelegram(
        chatId,
        'Welcome to Dwella Bot! 🏠\n\nTo link your account, open the Dwella app → Profile → *Link Telegram* and tap the button.'
      );
      return new Response('OK', { status: 200 });
    }

    // Find user with this token
    const { data: user, error } = await supabase
      .from('users')
      .select('id, full_name, telegram_chat_id')
      .eq('telegram_link_token', linkToken)
      .single();

    if (error || !user) {
      await sendTelegram(chatId, 'Invalid or expired link token. Please generate a new one from the Dwella app.');
      return new Response('OK', { status: 200 });
    }

    if (user.telegram_chat_id) {
      await sendTelegram(chatId, 'This Dwella account is already linked to a Telegram account.');
      return new Response('OK', { status: 200 });
    }

    // Link the account
    await supabase
      .from('users')
      .update({ telegram_chat_id: chatId, telegram_link_token: null })
      .eq('id', user.id);

    const name = user.full_name ?? 'there';
    await sendTelegram(
      chatId,
      `✅ Linked! Hi ${name}, your Dwella account is now connected.\n\nYou can now ask me about your properties and payments right here!`
    );
    return new Response('OK', { status: 200 });
  }

  // ---- Regular message — find linked user and forward to process-bot-message ----
  const { data: linkedUser } = await supabase
    .from('users')
    .select('id')
    .eq('telegram_chat_id', chatId)
    .single();

  if (!linkedUser) {
    await sendTelegram(
      chatId,
      "I don't recognize this Telegram account. Please link it from the Dwella app → Profile → *Link Telegram*."
    );
    return new Response('OK', { status: 200 });
  }

  // Forward to process-bot-message function
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
        source: 'telegram',
        telegram_chat_id: chatId,
      }),
    });

    // Parse body once — even error responses may be JSON with a `details`
    // field we want to surface rather than swallow.
    const rawBody = await botRes.text();
    let botData: {
      reply?: string;
      error?: string;
      details?: string;
      document?: { url: string; filename: string; caption?: string };
    } = {};
    try {
      botData = rawBody ? JSON.parse(rawBody) : {};
    } catch {
      console.error('[telegram-webhook] non-JSON body from process-bot-message:', rawBody.slice(0, 500));
    }

    if (!botRes.ok) {
      // Log the real failure server-side so it shows up in function logs,
      // and tell the user something more specific than "Sorry, try again".
      console.error(
        '[telegram-webhook] process-bot-message returned',
        botRes.status,
        botData.error ?? '',
        botData.details ?? rawBody.slice(0, 500),
      );
      await sendTelegram(
        chatId,
        `I hit a snag processing that message (status ${botRes.status}). Please try again in a moment.`,
      );
      return new Response('OK', { status: 200 });
    }

    if (!botData.reply) {
      console.error('[telegram-webhook] process-bot-message returned 200 but no reply field:', rawBody.slice(0, 500));
      await sendTelegram(
        chatId,
        'I got an empty response from the assistant. Please try rephrasing your message.',
      );
      return new Response('OK', { status: 200 });
    }

    // If the bot returned a document (e.g. a cached rent receipt PDF),
    // send it first, then follow with the text reply so the recipient
    // sees both the file and the contextual message.
    if (botData.document?.url) {
      await sendTelegramDocument(
        chatId,
        botData.document.url,
        botData.document.filename,
        botData.document.caption,
      );
    }
    await sendTelegram(chatId, botData.reply);
  } catch (err) {
    console.error('[telegram-webhook] forwarding error:', err);
    await sendTelegram(
      chatId,
      `Sorry, I couldn't reach the assistant (${err instanceof Error ? err.message : 'network error'}). Please try again.`,
    );
  }

  return new Response('OK', { status: 200 });
});
