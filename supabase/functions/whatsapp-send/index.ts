import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';

const WHATSAPP_ACCESS_TOKEN = Deno.env.get('WHATSAPP_ACCESS_TOKEN')!;
const WHATSAPP_PHONE_NUMBER_ID = Deno.env.get('WHATSAPP_PHONE_NUMBER_ID')!;

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ── Types ───────────────────────────────────────────────────────────

interface WhatsAppSendRequest {
  to: string; // E.164 phone number
  type: 'text' | 'template' | 'interactive' | 'document';
  text?: string;
  template?: {
    name: string;
    language?: string; // Default 'en'
    components?: Array<{
      type: 'body' | 'header' | 'button';
      parameters: Array<{ type: 'text'; text: string }>;
    }>;
  };
  interactive?: {
    body: string;
    buttons: Array<{ id: string; title: string }>;
  };
  document?: {
    link: string;
    filename?: string;
    caption?: string;
  };
}

const VALID_TYPES = ['text', 'template', 'interactive', 'document'] as const;

// ── Meta API caller with retry (D-08) ───────────────────────────────

async function callMetaAPI(payload: object): Promise<Response> {
  const doFetch = () =>
    fetch(`https://graph.facebook.com/v21.0/${WHATSAPP_PHONE_NUMBER_ID}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
      },
      body: JSON.stringify(payload),
    });

  let res = await doFetch();
  if (res.status === 429 || res.status >= 500) {
    await new Promise((r) => setTimeout(r, 1000));
    res = await doFetch();
  }
  return res;
}

// ── Validation ──────────────────────────────────────────────────────

function validate(req: WhatsAppSendRequest): string | null {
  if (!req.to || typeof req.to !== 'string' || !req.to.trim()) {
    return 'Missing or empty "to" field';
  }
  if (!VALID_TYPES.includes(req.type as typeof VALID_TYPES[number])) {
    return `Invalid "type": must be one of ${VALID_TYPES.join(', ')}`;
  }
  if (req.type === 'text' && (!req.text || typeof req.text !== 'string')) {
    return 'type "text" requires a non-empty "text" field';
  }
  if (req.type === 'template' && (!req.template || !req.template.name)) {
    return 'type "template" requires a "template" object with "name"';
  }
  if (
    req.type === 'interactive' &&
    (!req.interactive || !req.interactive.body || !Array.isArray(req.interactive.buttons) || req.interactive.buttons.length === 0)
  ) {
    return 'type "interactive" requires an "interactive" object with "body" and non-empty "buttons" array';
  }
  if (req.type === 'document' && (!req.document || !req.document.link)) {
    return 'type "document" requires a "document" object with "link"';
  }
  return null;
}

// ── Payload builders ────────────────────────────────────────────────

function buildPayload(req: WhatsAppSendRequest): object {
  const base = { messaging_product: 'whatsapp' as const, to: req.to };

  switch (req.type) {
    case 'text':
      return { ...base, type: 'text', text: { body: req.text } };

    case 'template':
      return {
        ...base,
        type: 'template',
        template: {
          name: req.template!.name,
          language: { code: req.template!.language ?? 'en' },
          components: req.template!.components ?? [],
        },
      };

    case 'interactive':
      return {
        ...base,
        type: 'interactive',
        interactive: {
          type: 'button',
          body: { text: req.interactive!.body },
          action: {
            buttons: req.interactive!.buttons.map((b) => ({
              type: 'reply',
              reply: { id: b.id, title: b.title },
            })),
          },
        },
      };

    case 'document':
      return {
        ...base,
        type: 'document',
        document: {
          link: req.document!.link,
          filename: req.document!.filename,
          caption: req.document!.caption,
        },
      };
  }
}

// ── Handler ─────────────────────────────────────────────────────────

serve(async (req) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: CORS_HEADERS });
  }

  const jsonHeaders = { 'Content-Type': 'application/json', ...CORS_HEADERS };

  try {
    const body: WhatsAppSendRequest = await req.json();

    // Validate input
    const validationError = validate(body);
    if (validationError) {
      return new Response(JSON.stringify({ error: validationError }), {
        status: 200,
        headers: jsonHeaders,
      });
    }

    // Build and send
    const payload = buildPayload(body);
    const metaRes = await callMetaAPI(payload);

    if (!metaRes.ok) {
      const errBody = await metaRes.text();
      console.error('whatsapp-send error:', errBody);
      return new Response(
        JSON.stringify({ error: 'Meta API error', status: metaRes.status }),
        { status: 200, headers: jsonHeaders },
      );
    }

    console.log(`whatsapp-send: sent ${body.type} to ${body.to}`);
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: jsonHeaders,
    });
  } catch (err) {
    console.error('whatsapp-send error:', err);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 200, headers: jsonHeaders },
    );
  }
});
