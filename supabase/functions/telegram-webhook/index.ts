import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const TELEGRAM_BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN')!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const PROCESS_BOT_URL = `${SUPABASE_URL}/functions/v1/process-bot-message`;

// Shared secret for the internal call to process-bot-message.
// Not in the SUPABASE_* namespace so the platform can't silently
// replace it with a new-format API key. verify_jwt is disabled on
// process-bot-message and this header is enforced inside that
// function instead.
const BOT_INTERNAL_SECRET = Deno.env.get('BOT_INTERNAL_SECRET') ?? '';

interface TelegramInlineButton {
  text: string;
  callback_data: string;
}
type TelegramReplyMarkup = { inline_keyboard: TelegramInlineButton[][] };

async function sendTelegram(chatId: number, text: string, replyMarkup?: TelegramReplyMarkup) {
  const body: Record<string, unknown> = {
    chat_id: chatId,
    text,
    parse_mode: 'Markdown',
  };
  if (replyMarkup) body.reply_markup = replyMarkup;
  await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

/**
 * Acknowledge a callback_query so Telegram stops showing a loading spinner
 * on the button the user tapped. Must be called within 10 seconds of the
 * update. Optional text appears as a toast on the user's screen.
 */
async function answerCallbackQuery(callbackQueryId: string, text?: string) {
  await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/answerCallbackQuery`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      callback_query_id: callbackQueryId,
      text: text ?? undefined,
    }),
  });
}

/**
 * Main menu inline keyboard shown on `/menu`. Each button's callback_data
 * maps to a canonical natural-language prompt that we re-send through the
 * normal NLP pipeline — so the bot's existing intent classifier handles
 * the routing instead of us maintaining a parallel menu state machine.
 */
const MAIN_MENU: TelegramReplyMarkup = {
  inline_keyboard: [
    [
      { text: '📊 Status', callback_data: 'menu:status' },
      { text: '⚠ Overdue', callback_data: 'menu:overdue' },
    ],
    [
      { text: '📄 My Receipt', callback_data: 'menu:receipt' },
      { text: '🔔 Remind All', callback_data: 'menu:remind_all' },
    ],
    [
      { text: '🏠 Properties', callback_data: 'menu:properties' },
      { text: '👥 Tenants', callback_data: 'menu:tenants' },
    ],
  ],
};

const MENU_PROMPTS: Record<string, string> = {
  'menu:status': 'What is the current rent payment status across all my tenants?',
  'menu:overdue': 'Which tenants are overdue this month?',
  'menu:receipt': 'Send me my rent receipt for the current month.',
  'menu:remind_all': 'Send a rent reminder to all my unpaid tenants.',
  'menu:properties': 'Give me a summary of my properties.',
  'menu:tenants': 'List all my active tenants with their rent and due day.',
};

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

/**
 * Forward a text prompt to process-bot-message for a linked user and
 * dispatch the resulting reply (text + optional document + optional
 * inline keyboard) back to the Telegram chat.
 *
 * Used by both the regular-message path and the inline-button path,
 * so callback taps and typed messages go through exactly one code path.
 */
async function forwardToBot(chatId: number, userId: string, prompt: string) {
  try {
    const botRes = await fetch(PROCESS_BOT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // verify_jwt is disabled on process-bot-message; this shared
        // secret is the internal auth gate instead.
        'x-bot-internal-secret': BOT_INTERNAL_SECRET,
        // Still include a bearer for compatibility with any future
        // re-enablement of JWT verification. SUPABASE_SERVICE_KEY may
        // be empty in some runtimes — harmless when verify_jwt is off.
        Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
      },
      body: JSON.stringify({
        user_id: userId,
        message: prompt,
        source: 'telegram',
        telegram_chat_id: chatId,
      }),
    });

    const rawBody = await botRes.text();
    let botData: {
      reply?: string;
      error?: string;
      details?: string;
      document?: { url: string; filename: string; caption?: string };
      reply_markup?: TelegramReplyMarkup;
    } = {};
    try {
      botData = rawBody ? JSON.parse(rawBody) : {};
    } catch {
      console.error('[telegram-webhook] non-JSON body from process-bot-message:', rawBody.slice(0, 500));
    }

    if (!botRes.ok) {
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
      return;
    }

    if (!botData.reply) {
      console.error('[telegram-webhook] process-bot-message returned 200 but no reply field:', rawBody.slice(0, 500));
      await sendTelegram(
        chatId,
        'I got an empty response from the assistant. Please try rephrasing your message.',
      );
      return;
    }

    if (botData.document?.url) {
      await sendTelegramDocument(
        chatId,
        botData.document.url,
        botData.document.filename,
        botData.document.caption,
      );
    }
    await sendTelegram(chatId, botData.reply, botData.reply_markup);
  } catch (err) {
    console.error('[telegram-webhook] forwarding error:', err);
    await sendTelegram(
      chatId,
      `Sorry, I couldn't reach the assistant (${err instanceof Error ? err.message : 'network error'}). Please try again.`,
    );
  }
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

  const supabaseClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  // ----------------------------------------------------------------
  // Inline-button taps arrive as callback_query updates, NOT messages.
  // We acknowledge the query first (kills the spinner) and then map
  // the callback_data back into a text prompt we forward through the
  // normal pipeline. This keeps menu/button state out of this file
  // and reuses the existing intent classifier.
  // ----------------------------------------------------------------
  const callbackQuery = update['callback_query'] as Record<string, unknown> | undefined;
  if (callbackQuery) {
    const queryId = callbackQuery['id'] as string;
    const data = (callbackQuery['data'] as string | undefined) ?? '';
    const cbMessage = callbackQuery['message'] as Record<string, unknown> | undefined;
    const cbChatId = (cbMessage?.['chat'] as Record<string, unknown> | undefined)?.['id'] as number | undefined;

    // Always acknowledge within 10s so the Telegram client stops the spinner.
    await answerCallbackQuery(queryId);

    if (!cbChatId) return new Response('OK', { status: 200 });

    // Map the callback to canonical text to forward through NLP.
    let forwardText: string | null = null;
    if (data === 'confirm') forwardText = 'yes';
    else if (data === 'cancel') forwardText = 'no';
    else if (data in MENU_PROMPTS) forwardText = MENU_PROMPTS[data];

    if (!forwardText) return new Response('OK', { status: 200 });

    // Look up linked user and forward (same path as regular text below).
    const { data: linked } = await supabaseClient
      .from('users')
      .select('id')
      .eq('telegram_chat_id', cbChatId)
      .single();

    if (!linked) {
      await sendTelegram(
        cbChatId,
        "I don't recognize this Telegram account. Please link it from the Dwella app → Profile → *Link Telegram*.",
      );
      return new Response('OK', { status: 200 });
    }

    await forwardToBot(cbChatId, linked.id as string, forwardText);
    return new Response('OK', { status: 200 });
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
      `✅ Linked! Hi ${name}, your Dwella account is now connected.\n\nYou can now ask me about your properties and payments right here, or tap /menu for quick actions!`,
    );
    return new Response('OK', { status: 200 });
  }

  // ---- /menu — show quick-action inline keyboard ----
  if (text === '/menu' || text.startsWith('/menu ')) {
    const { data: linkedForMenu } = await supabase
      .from('users')
      .select('id')
      .eq('telegram_chat_id', chatId)
      .single();

    if (!linkedForMenu) {
      await sendTelegram(
        chatId,
        "I don't recognize this Telegram account. Please link it from the Dwella app → Profile → *Link Telegram*.",
      );
      return new Response('OK', { status: 200 });
    }

    await sendTelegram(
      chatId,
      '*Dwella Quick Menu*\n\nTap an option below, or just type what you want in plain English.',
      MAIN_MENU,
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
      "I don't recognize this Telegram account. Please link it from the Dwella app → Profile → *Link Telegram*.",
    );
    return new Response('OK', { status: 200 });
  }

  await forwardToBot(chatId, linkedUser.id as string, text);
  return new Response('OK', { status: 200 });
});
