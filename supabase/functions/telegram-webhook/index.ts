import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { checkRateLimit, getClientIp } from '../_shared/rate-limit.ts';

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
const TELEGRAM_WEBHOOK_SECRET = Deno.env.get('TELEGRAM_WEBHOOK_SECRET') ?? '';

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
 * Edit an existing message's text + keyboard in place. Used to transform
 * picker messages as the user drills down through steps (tenant → month
 * → receipt) so the old button grid doesn't linger in the chat.
 */
async function editMessageText(
  chatId: number,
  messageId: number,
  text: string,
  replyMarkup?: TelegramReplyMarkup,
) {
  const body: Record<string, unknown> = {
    chat_id: chatId,
    message_id: messageId,
    text,
    parse_mode: 'Markdown',
  };
  if (replyMarkup) body.reply_markup = replyMarkup;
  try {
    await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/editMessageText`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch (err) {
    console.warn('[telegram] editMessageText failed:', err);
  }
}

// Inline month helpers so the picker doesn't need lib/ imports (Deno
// Edge Functions can't reach the app's TypeScript lib tree).
const MONTH_NAMES_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];
const MONTH_NAMES_FULL = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const STATUS_EMOJI: Record<string, string> = {
  confirmed: '✓',
  paid: '●',
  partial: '◐',
  pending: '○',
  overdue: '⚠',
};

/**
 * Show "Bot is typing…" in the Telegram chat header. The indicator
 * auto-expires after ~5 seconds, so we repeat it every 4 seconds for
 * the duration of a slow Claude call so the user never sees dead air.
 */
async function sendTypingAction(chatId: number) {
  try {
    await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendChatAction`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, action: 'typing' }),
    });
  } catch (err) {
    // Typing indicator is best-effort — never let it break the main flow.
    console.warn('[telegram] sendChatAction failed:', err);
  }
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
      { text: '📄 Receipts', callback_data: 'menu:receipt' },
      { text: '🔔 Remind All', callback_data: 'menu:remind_all' },
    ],
    [
      { text: '🏠 Properties', callback_data: 'menu:properties' },
      { text: '👥 Tenants', callback_data: 'menu:tenants' },
    ],
  ],
};

// menu:receipt is handled specially (opens an interactive picker flow),
// so it intentionally has no canonical prompt here — the callback_query
// branch intercepts it before the prompt lookup.
const MENU_PROMPTS: Record<string, string> = {
  'menu:status': 'What is the current rent payment status across all my tenants?',
  'menu:overdue': 'Which tenants are overdue this month?',
  'menu:remind_all': 'Send a rent reminder to all my unpaid tenants.',
  'menu:properties': 'Give me a summary of my properties.',
  'menu:tenants': 'List all my active tenants with their rent and due day.',
};

// ----------------------------------------------------------------
// Interactive receipt picker
// ----------------------------------------------------------------
// Three-step flow driven entirely by inline buttons:
//   1. menu:receipt       → show tenant list (this file, DB lookup)
//   2. rcpt_t:{tenant_id} → show last 12 months for that tenant
//   3. rcpt_p:{payment_id} → construct NLP prompt, forward to bot
//
// Only step 3 talks to process-bot-message. Steps 1-2 are pure DB
// queries inside the webhook, so there's no Claude latency until
// the user actually commits to a specific month.
// ----------------------------------------------------------------

type SupabaseClientType = ReturnType<typeof createClient>;

async function showReceiptTenantPicker(
  supabaseClient: SupabaseClientType,
  chatId: number,
  messageId: number,
  userId: string,
) {
  // Landlord's owned tenants + the user's own tenancies, in parallel.
  const [ownedRes, mineRes] = await Promise.all([
    supabaseClient
      .from('properties')
      .select('name, tenants(id, tenant_name, flat_no, is_archived)')
      .eq('owner_id', userId)
      .eq('is_archived', false),
    supabaseClient
      .from('tenants')
      .select('id, tenant_name, flat_no, properties(name)')
      .eq('user_id', userId)
      .eq('is_archived', false),
  ]);

  interface PickerEntry {
    id: string;
    label: string;
  }
  const entries: PickerEntry[] = [];
  const seen = new Set<string>();

  for (const p of ((ownedRes.data ?? []) as any[])) {
    for (const t of ((p.tenants ?? []) as any[])) {
      if (t.is_archived) continue;
      if (seen.has(t.id)) continue;
      seen.add(t.id);
      entries.push({
        id: t.id,
        label: `${t.tenant_name} (${t.flat_no})`,
      });
    }
  }
  for (const t of ((mineRes.data ?? []) as any[])) {
    if (seen.has(t.id)) continue;
    seen.add(t.id);
    const propName = (t.properties as any)?.name ?? '—';
    entries.push({
      id: t.id,
      label: `${t.tenant_name} · ${propName}`,
    });
  }

  if (entries.length === 0) {
    await editMessageText(
      chatId,
      messageId,
      "*Rent Receipt*\n\nYou don't have any tenants linked to your account yet.",
    );
    return;
  }

  // Two buttons per row, truncate long labels so they fit on mobile.
  const buttons: TelegramInlineButton[][] = [];
  for (let i = 0; i < entries.length; i += 2) {
    const row: TelegramInlineButton[] = [];
    for (let j = 0; j < 2 && i + j < entries.length; j++) {
      const e = entries[i + j];
      const label = e.label.length > 24 ? e.label.slice(0, 23) + '…' : e.label;
      row.push({ text: label, callback_data: `rcpt_t:${e.id}` });
    }
    buttons.push(row);
  }

  await editMessageText(
    chatId,
    messageId,
    '*Rent Receipt*\n\nWho is the receipt for?',
    { inline_keyboard: buttons },
  );
}

async function showReceiptMonthPicker(
  supabaseClient: SupabaseClientType,
  chatId: number,
  messageId: number,
  userId: string,
  tenantId: string,
) {
  // Verify access — user must be the landlord of this tenant's property
  // OR be the tenant themselves. Without this check, a user could
  // manipulate callback_data to peek at other landlords' tenants.
  const { data: tenantRow } = await supabaseClient
    .from('tenants')
    .select('id, tenant_name, user_id, properties(owner_id)')
    .eq('id', tenantId)
    .eq('is_archived', false)
    .single();

  if (!tenantRow) {
    await editMessageText(chatId, messageId, 'That tenant no longer exists.');
    return;
  }
  const ownerId = ((tenantRow as any).properties)?.owner_id;
  const tenantUserId = (tenantRow as any).user_id;
  if (ownerId !== userId && tenantUserId !== userId) {
    await editMessageText(chatId, messageId, 'You do not have access to that tenant.');
    return;
  }

  const { data: payments } = await supabaseClient
    .from('payments')
    .select('id, month, year, status')
    .eq('tenant_id', tenantId)
    .order('year', { ascending: false })
    .order('month', { ascending: false })
    .limit(12);

  if (!payments || payments.length === 0) {
    await editMessageText(
      chatId,
      messageId,
      `*${(tenantRow as any).tenant_name}*\n\nNo payment records yet.`,
    );
    return;
  }

  const buttons: TelegramInlineButton[][] = [];
  for (let i = 0; i < payments.length; i += 2) {
    const row: TelegramInlineButton[] = [];
    for (let j = 0; j < 2 && i + j < payments.length; j++) {
      const p = payments[i + j] as any;
      const emoji = STATUS_EMOJI[p.status] ?? '•';
      row.push({
        text: `${MONTH_NAMES_SHORT[p.month - 1]} ${p.year} ${emoji}`,
        callback_data: `rcpt_p:${p.id}`,
      });
    }
    buttons.push(row);
  }
  // Back button so the user can bounce to the tenant list
  buttons.push([{ text: '« Back to tenants', callback_data: 'menu:receipt' }]);

  await editMessageText(
    chatId,
    messageId,
    `*${(tenantRow as any).tenant_name}*\n\nPick a month:`,
    { inline_keyboard: buttons },
  );
}

async function deliverReceiptByPaymentId(
  supabaseClient: SupabaseClientType,
  chatId: number,
  userId: string,
  paymentId: string,
) {
  // Look up the payment + tenant + property to build a precise NLP prompt
  // and verify the caller has access.
  const { data: payment } = await supabaseClient
    .from('payments')
    .select('month, year, tenants(tenant_name, user_id, properties(owner_id))')
    .eq('id', paymentId)
    .single();

  if (!payment) {
    await sendTelegram(chatId, 'That payment record no longer exists.');
    return;
  }

  const row = payment as any;
  const tenantName = row.tenants?.tenant_name;
  const ownerId = row.tenants?.properties?.owner_id;
  const tenantUserId = row.tenants?.user_id;

  if (userId !== ownerId && userId !== tenantUserId) {
    await sendTelegram(chatId, 'You do not have access to that receipt.');
    return;
  }

  const fullMonth = MONTH_NAMES_FULL[row.month - 1] ?? String(row.month);
  const prompt = `Get the rent receipt for ${tenantName} for ${fullMonth} ${row.year}`;
  await forwardToBot(chatId, userId, prompt);
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

/**
 * Forward a text prompt to process-bot-message for a linked user and
 * dispatch the resulting reply (text + optional document + optional
 * inline keyboard) back to the Telegram chat.
 *
 * Used by both the regular-message path and the inline-button path,
 * so callback taps and typed messages go through exactly one code path.
 */
async function forwardToBot(chatId: number, userId: string, prompt: string) {
  // Kick off the typing indicator immediately and keep it alive every 4s.
  // Telegram auto-expires it after ~5s, so re-sending covers long Claude
  // calls (typically 2-8s). The interval is cleared in `finally` below
  // so the indicator dies the instant we send a real reply.
  sendTypingAction(chatId);
  const typingInterval = setInterval(() => {
    sendTypingAction(chatId);
  }, 4000);

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
  } finally {
    clearInterval(typingInterval);
  }
}

serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('OK', { status: 200 });
  }

  // SEC-01: Telegram secret-token verification — reject before parsing body
  const secretHeader = req.headers.get('x-telegram-bot-api-secret-token') ?? '';
  if (!TELEGRAM_WEBHOOK_SECRET || secretHeader !== TELEGRAM_WEBHOOK_SECRET) {
    return new Response('', { status: 401 });
  }

  // SEC-05: Rate limiting — 60 requests/min per IP
  const clientIp = getClientIp(req);
  const allowed = await checkRateLimit(clientIp, 'telegram-webhook', 60);
  if (!allowed) {
    return new Response('', { status: 429 });
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
    const cbMessageId = cbMessage?.['message_id'] as number | undefined;

    // Always acknowledge within 10s so the Telegram client stops the
    // spinner on the tapped button. The toast text gives instant visible
    // feedback before the "typing…" header indicator kicks in.
    await answerCallbackQuery(queryId, 'Got it…');

    if (!cbChatId) return new Response('OK', { status: 200 });

    // Look up linked user once — every branch needs it.
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
    const linkedUserId = linked.id as string;

    // ── Interactive receipt picker (3-step flow, handled locally) ──
    if (data === 'menu:receipt') {
      if (cbMessageId) {
        await showReceiptTenantPicker(supabaseClient, cbChatId, cbMessageId, linkedUserId);
      }
      return new Response('OK', { status: 200 });
    }
    if (data.startsWith('rcpt_t:')) {
      const tenantId = data.slice('rcpt_t:'.length);
      if (cbMessageId) {
        await showReceiptMonthPicker(supabaseClient, cbChatId, cbMessageId, linkedUserId, tenantId);
      }
      return new Response('OK', { status: 200 });
    }
    if (data.startsWith('rcpt_p:')) {
      const paymentId = data.slice('rcpt_p:'.length);
      await deliverReceiptByPaymentId(supabaseClient, cbChatId, linkedUserId, paymentId);
      return new Response('OK', { status: 200 });
    }

    // ── Generic flows: confirmation + other menu buttons ──
    let forwardText: string | null = null;
    if (data === 'confirm') forwardText = 'yes';
    else if (data === 'cancel') forwardText = 'no';
    else if (data in MENU_PROMPTS) forwardText = MENU_PROMPTS[data];

    if (!forwardText) return new Response('OK', { status: 200 });

    await forwardToBot(cbChatId, linkedUserId, forwardText);
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
