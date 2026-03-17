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

    const botData = await botRes.json() as { reply?: string; error?: string };
    if (!botRes.ok) {
      console.error('process-bot-message failed:', botRes.status, botData.error);
      await sendTelegram(chatId, 'Sorry, I encountered an error processing your message. Please try again.');
      return new Response('OK', { status: 200 });
    }
    const reply = botData.reply ?? 'Sorry, I encountered an error. Please try again.';
    await sendTelegram(chatId, reply);
  } catch (err) {
    console.error('Telegram webhook forwarding error:', err);
    await sendTelegram(chatId, 'Sorry, something went wrong. Please try again later.');
  }

  return new Response('OK', { status: 200 });
});
