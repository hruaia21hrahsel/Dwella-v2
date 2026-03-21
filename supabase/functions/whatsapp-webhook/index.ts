import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const WHATSAPP_VERIFY_TOKEN = Deno.env.get('WHATSAPP_VERIFY_TOKEN')!;
const WHATSAPP_APP_SECRET = Deno.env.get('WHATSAPP_APP_SECRET');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const PROCESS_BOT_URL = `${SUPABASE_URL}/functions/v1/process-bot-message`;
const WHATSAPP_SEND_URL = `${SUPABASE_URL}/functions/v1/whatsapp-send`;
const WHATSAPP_MEDIA_URL = `${SUPABASE_URL}/functions/v1/whatsapp-media`;

/** Normalize a phone number to E.164 format with + prefix */
function normalizePhone(phone: string): string {
  const digits = phone.replace(/[^\d]/g, '');
  return digits.startsWith('+') ? digits : `+${digits}`;
}

/** Send a text message via whatsapp-send Edge Function */
async function sendWhatsApp(to: string, text: string) {
  const res = await fetch(WHATSAPP_SEND_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
    },
    body: JSON.stringify({ to, type: 'text', text }),
  });
  if (!res.ok) {
    const err = await res.text();
    console.error('whatsapp-send error:', err);
  }
}

/** Send an interactive button message via whatsapp-send Edge Function */
async function sendWhatsAppInteractive(
  to: string,
  body: string,
  buttons: Array<{ id: string; title: string }>,
) {
  const res = await fetch(WHATSAPP_SEND_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
    },
    body: JSON.stringify({
      to,
      type: 'interactive',
      interactive: { body, buttons },
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    console.error('whatsapp-send interactive error:', err);
  }
}

/** Send a document via whatsapp-send Edge Function */
async function sendWhatsAppDocument(
  to: string,
  link: string,
  filename: string,
  caption: string,
) {
  const res = await fetch(WHATSAPP_SEND_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
    },
    body: JSON.stringify({
      to,
      type: 'document',
      document: { link, filename, caption },
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    console.error('whatsapp-send document error:', err);
  }
}

/** Send a process-bot-message response that may contain buttons, documents, and additional_messages */
async function sendBotResponse(phone: string, botData: Record<string, unknown>) {
  const reply = (botData['reply'] as string) ?? 'Sorry, I encountered an error.';
  const buttons = botData['buttons'] as Array<Array<{ id: string; title: string }>> | undefined;
  const additionalMessages = botData['additional_messages'] as Array<{
    reply: string;
    buttons?: Array<Array<{ id: string; title: string }>>;
  }> | undefined;

  // Send primary message
  if (buttons && buttons.length > 0) {
    // Flatten button rows to flat array (WhatsApp buttons are flat, max 3)
    const flatButtons = buttons.map(row => row[0]).filter(Boolean);
    await sendWhatsAppInteractive(phone, reply, flatButtons.slice(0, 3));
  } else {
    await sendWhatsApp(phone, reply);
  }

  // Handle document delivery (PDF reports)
  const doc = botData['document'] as { url: string; filename: string; caption: string } | undefined;
  if (doc) {
    await sendWhatsAppDocument(phone, doc.url, doc.filename, doc.caption);
  }

  // Send additional messages (multi-message menus)
  if (additionalMessages) {
    for (const msg of additionalMessages) {
      if (msg.buttons && msg.buttons.length > 0) {
        const flatBtns = msg.buttons.map(row => row[0]).filter(Boolean);
        await sendWhatsAppInteractive(phone, msg.reply, flatBtns.slice(0, 3));
      } else {
        await sendWhatsApp(phone, msg.reply);
      }
    }
  }
}

/** Send welcome message with main menu buttons (D-01, D-02, D-03) */
async function sendWelcomeMessage(phone: string) {
  await sendWhatsApp(
    phone,
    'Welcome to Dwella! I can help you manage properties, payments, and maintenance. Use the menu below or type anything.',
  );
  // Send main menu buttons (D-02) — 2 messages per D-11
  await sendWhatsAppInteractive(phone, 'What would you like to do? (1/2)', [
    { id: 'menu_properties', title: 'Properties' },
    { id: 'menu_payments', title: 'Payments' },
    { id: 'menu_history', title: 'History' },
  ]);
  await sendWhatsAppInteractive(phone, 'More options (2/2)', [
    { id: 'menu_maintenance', title: 'Maintenance' },
    { id: 'menu_others', title: 'Others' },
  ]);
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
  const msgType = (msg['type'] as string) ?? '';
  const text = (msg['text']?.['body'] as string) ?? '';

  // ---- Media messages: delegate to whatsapp-media ----
  if (msgType === 'image' || msgType === 'document') {
    // Need linked user for media processing
    const supabaseForMedia = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const { data: mediaUser } = await supabaseForMedia
      .from('users')
      .select('id')
      .eq('whatsapp_phone', senderPhone)
      .single();

    if (!mediaUser) {
      await sendWhatsApp(
        senderPhone,
        "I don't recognize this WhatsApp number. Please link it from the Dwella app \u2192 Profile \u2192 Link WhatsApp.",
      );
      return new Response('OK', { status: 200 });
    }

    try {
      await fetch(WHATSAPP_MEDIA_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
        },
        body: JSON.stringify({
          user_id: mediaUser.id,
          phone: senderPhone,
          msg_type: msgType,
          media: msg[msgType],
        }),
      });
    } catch (err) {
      console.error('whatsapp-media delegation error:', err);
      await sendWhatsApp(
        senderPhone,
        'Something went wrong processing your media. Please try again or use the Dwella app directly.',
      );
    }
    return new Response('OK', { status: 200 });
  }

  // ---- Unsupported media types: inform user ----
  if (['video', 'audio', 'sticker', 'location', 'contacts'].includes(msgType)) {
    // Check if user is linked before replying (avoid replying to unknown numbers)
    const supabaseForCheck = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const { data: checkUser } = await supabaseForCheck
      .from('users')
      .select('id')
      .eq('whatsapp_phone', senderPhone)
      .single();

    if (checkUser) {
      await sendWhatsApp(
        senderPhone,
        'I can only accept photos (payment proofs) and documents (PDFs, Word files). For other requests, just type your message.',
      );
    }
    return new Response('OK', { status: 200 });
  }

  // ---- Interactive button replies: route to process-bot-message ----
  if (msgType === 'interactive') {
    const interactiveData = msg['interactive'] as Record<string, unknown> | undefined;
    const interactiveType = interactiveData?.['type'] as string | undefined;

    if (interactiveType === 'button_reply') {
      const buttonReply = interactiveData?.['button_reply'] as { id: string; title: string } | undefined;
      const buttonId = buttonReply?.id;

      if (buttonId) {
        // Find linked user
        const supabaseForBtn = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
        const { data: btnUser } = await supabaseForBtn
          .from('users')
          .select('id')
          .eq('whatsapp_phone', senderPhone)
          .single();

        if (!btnUser) {
          await sendWhatsApp(senderPhone, "I don't recognize this WhatsApp number. Please link it from the Dwella app.");
          return new Response('OK', { status: 200 });
        }

        // Update last_bot_message_at
        await supabaseForBtn
          .from('users')
          .update({ last_bot_message_at: new Date().toISOString() })
          .eq('id', btnUser.id);

        // Forward to process-bot-message with button_id
        try {
          const botRes = await fetch(PROCESS_BOT_URL, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
            },
            body: JSON.stringify({
              user_id: btnUser.id,
              message: buttonReply.title,  // button title as message for logging
              source: 'whatsapp',
              button_id: buttonId,
            }),
          });

          const botData = await botRes.json();
          await sendBotResponse(senderPhone, botData);
        } catch (err) {
          console.error('WhatsApp button_reply error:', err);
          await sendWhatsApp(senderPhone, 'Sorry, something went wrong. Please try again.');
        }
      }
      return new Response('OK', { status: 200 });
    }
  }

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

      await sendWelcomeMessage(senderPhone);
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

  // ---- Session detection: show menu if > 1 hour gap (D-05, D-06) ----
  const { data: sessionUser } = await supabase
    .from('users')
    .select('id, last_bot_message_at')
    .eq('whatsapp_phone', senderPhone)
    .single();

  const isNewSession = !sessionUser?.last_bot_message_at ||
    (Date.now() - new Date(sessionUser.last_bot_message_at as string).getTime()) > 60 * 60 * 1000;

  // Update last_bot_message_at
  await supabase
    .from('users')
    .update({ last_bot_message_at: new Date().toISOString() })
    .eq('id', linkedUser.id);

  // Show menu on new session or explicit "menu"/"help" request (D-05, D-08)
  if (isNewSession || /^(menu|help)$/i.test(text.trim())) {
    await sendWhatsAppInteractive(senderPhone, 'What would you like to do? (1/2)', [
      { id: 'menu_properties', title: 'Properties' },
      { id: 'menu_payments', title: 'Payments' },
      { id: 'menu_history', title: 'History' },
    ]);
    await sendWhatsAppInteractive(senderPhone, 'More options (2/2)', [
      { id: 'menu_maintenance', title: 'Maintenance' },
      { id: 'menu_others', title: 'Others' },
    ]);

    // If user only typed "menu" or "help", don't forward to Claude
    if (/^(menu|help)$/i.test(text.trim())) {
      return new Response('OK', { status: 200 });
    }
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

    const botData = await botRes.json();
    await sendBotResponse(senderPhone, botData);
  } catch (err) {
    console.error('WhatsApp webhook forwarding error:', err);
    await sendWhatsApp(senderPhone, 'Sorry, something went wrong. Please try again later.');
  }

  return new Response('OK', { status: 200 });
});
