import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const TELEGRAM_BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN')!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const PROCESS_BOT_URL = `${SUPABASE_URL}/functions/v1/process-bot-message`;
const TELEGRAM_WEBHOOK_SECRET = Deno.env.get('TELEGRAM_WEBHOOK_SECRET');

// ----------------------------------------------------------------
// Telegram helpers
// ----------------------------------------------------------------

async function sendTelegram(
  chatId: number,
  text: string,
  replyMarkup?: { inline_keyboard: Array<Array<{ text: string; callback_data: string }>> },
) {
  const body: Record<string, unknown> = { chat_id: chatId, text, parse_mode: 'Markdown' };
  if (replyMarkup) {
    body['reply_markup'] = replyMarkup;
  }
  await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

async function sendTelegramDocument(chatId: number, documentUrl: string, caption: string) {
  await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendDocument`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      document: documentUrl,
      caption,
    }),
  });
}

async function answerCallbackQuery(callbackQueryId: string) {
  await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/answerCallbackQuery`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ callback_query_id: callbackQueryId }),
  });
}

/**
 * Converts BotResponse buttons array to Telegram inline_keyboard format.
 * Maps btn.title to text directly — no dead code fallback needed.
 */
function toTelegramKeyboard(
  buttons?: Array<Array<{ id: string; title: string }>>,
): { inline_keyboard: Array<Array<{ text: string; callback_data: string }>> } | undefined {
  if (!buttons || buttons.length === 0) return undefined;
  return {
    inline_keyboard: buttons.map(row =>
      row.map(btn => ({ text: btn.title, callback_data: btn.id }))
    ),
  };
}

/**
 * Sends multi-message bot responses — handles additional_messages from process-bot-message.
 */
async function sendBotResponse(chatId: number, botData: Record<string, unknown>) {
  const reply = (botData['reply'] as string) ?? 'Sorry, I encountered an error.';
  const buttons = botData['buttons'] as Array<Array<{ id: string; title: string }>> | undefined;
  const additionalMessages = botData['additional_messages'] as Array<{ reply: string; buttons?: Array<Array<{ id: string; title: string }>> }> | undefined;

  // Send primary message
  await sendTelegram(chatId, reply, toTelegramKeyboard(buttons));

  // Send additional messages (multi-message menus)
  if (additionalMessages) {
    for (const msg of additionalMessages) {
      await sendTelegram(chatId, msg.reply, toTelegramKeyboard(msg.buttons));
    }
  }
}

// ----------------------------------------------------------------
// Main handler
// ----------------------------------------------------------------

serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('OK', { status: 200 });
  }

  // Validate webhook secret before processing (SEC-04)
  if (TELEGRAM_WEBHOOK_SECRET) {
    const secretHeader = req.headers.get('X-Telegram-Bot-Api-Secret-Token');
    if (!secretHeader || secretHeader !== TELEGRAM_WEBHOOK_SECRET) {
      console.warn('Telegram webhook: invalid or missing secret token');
      return new Response('Unauthorized', { status: 401 });
    }
  }

  let update: Record<string, unknown>;
  try {
    update = await req.json();
  } catch {
    return new Response('Bad request', { status: 400 });
  }

  // Create Supabase client — must be above callback_query block so both branches can use it
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  // ---- callback_query: inline button tap (MUST be checked before message early-return) ----
  const callbackQuery = update['callback_query'] as Record<string, unknown> | undefined;

  if (callbackQuery) {
    const cbChatId = ((callbackQuery['message'] as any)?.['chat']?.['id']) as number;
    const buttonId = callbackQuery['data'] as string;
    const callbackQueryId = callbackQuery['id'] as string;

    // MUST call answerCallbackQuery immediately to dismiss loading spinner (Pitfall 1)
    await answerCallbackQuery(callbackQueryId);

    // Find linked user
    const { data: cbUser } = await supabase
      .from('users')
      .select('id')
      .eq('telegram_chat_id', cbChatId)
      .single();

    if (!cbUser) {
      await sendTelegram(cbChatId, "I don't recognize this Telegram account. Please link it from the Dwella app.");
      return new Response('OK', { status: 200 });
    }

    // Update last_bot_message_at for session tracking
    await supabase
      .from('users')
      .update({ last_bot_message_at: new Date().toISOString() })
      .eq('id', cbUser.id);

    // Forward button press to process-bot-message with button_id
    try {
      const botRes = await fetch(PROCESS_BOT_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
        },
        body: JSON.stringify({
          user_id: cbUser.id,
          message: buttonId,   // button_id as message for logging
          source: 'telegram',
          telegram_chat_id: cbChatId,
          button_id: buttonId,
        }),
      });

      const botData = await botRes.json();
      await sendBotResponse(cbChatId, botData);
    } catch (err) {
      console.error('Telegram callback_query error:', err);
      await sendTelegram(cbChatId, 'Sorry, something went wrong. Please try again.');
    }

    return new Response('OK', { status: 200 });
  }

  const message = update['message'] as Record<string, unknown> | undefined;
  if (!message) return new Response('OK', { status: 200 });

  const chatId = (message['chat'] as Record<string, unknown>)?.['id'] as number;
  const text = (message['text'] as string) ?? '';

  // ---- /start <link_token> — account linking ----
  if (text.startsWith('/start')) {
    const parts = text.split(' ');
    const linkToken = parts[1]?.trim();

    if (!linkToken) {
      await sendTelegram(
        chatId,
        'Welcome to Dwella Bot!\n\nTo link your account, open the Dwella app -> Profile -> *Link Telegram* and tap the button.'
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

    // Welcome message (D-03) with main menu buttons (D-02, RICH-01)
    await sendTelegram(chatId, 'Welcome to Dwella! I can help you manage properties, payments, and maintenance. Use the menu below or type anything.');
    await sendTelegram(chatId, 'What would you like to do? (1/2)', {
      inline_keyboard: [
        [{ text: 'Properties', callback_data: 'menu_properties' }],
        [{ text: 'Payments', callback_data: 'menu_payments' }],
        [{ text: 'History', callback_data: 'menu_history' }],
      ],
    });
    await sendTelegram(chatId, 'More options (2/2)', {
      inline_keyboard: [
        [{ text: 'Maintenance', callback_data: 'menu_maintenance' }],
        [{ text: 'Others', callback_data: 'menu_others' }],
      ],
    });
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
      "I don't recognize this Telegram account. Please link it from the Dwella app -> Profile -> *Link Telegram*."
    );
    return new Response('OK', { status: 200 });
  }

  // ---- Session detection: show menu if > 1 hour gap (D-05, D-06, RICH-02) ----
  const { data: sessionData } = await supabase
    .from('users')
    .select('last_bot_message_at')
    .eq('id', linkedUser.id)
    .single();

  const isNewSession = !sessionData?.last_bot_message_at ||
    (Date.now() - new Date(sessionData.last_bot_message_at).getTime()) > 60 * 60 * 1000;

  // Update last_bot_message_at on every interaction
  await supabase
    .from('users')
    .update({ last_bot_message_at: new Date().toISOString() })
    .eq('id', linkedUser.id);

  // Show menu on new session before forwarding message (D-05)
  if (isNewSession) {
    await sendTelegram(chatId, 'What would you like to do? (1/2)', {
      inline_keyboard: [
        [{ text: 'Properties', callback_data: 'menu_properties' }],
        [{ text: 'Payments', callback_data: 'menu_payments' }],
        [{ text: 'History', callback_data: 'menu_history' }],
      ],
    });
    await sendTelegram(chatId, 'More options (2/2)', {
      inline_keyboard: [
        [{ text: 'Maintenance', callback_data: 'menu_maintenance' }],
        [{ text: 'Others', callback_data: 'menu_others' }],
      ],
    });
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

    if (!botRes.ok) {
      console.error('process-bot-message failed:', botRes.status);
      await sendTelegram(chatId, 'Sorry, I encountered an error processing your message. Please try again.');
      return new Response('OK', { status: 200 });
    }

    const botData = await botRes.json();
    await sendBotResponse(chatId, botData);
  } catch (err) {
    console.error('Telegram webhook forwarding error:', err);
    await sendTelegram(chatId, 'Sorry, something went wrong. Please try again later.');
  }

  return new Response('OK', { status: 200 });
});
