import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';

const WHATSAPP_ACCESS_TOKEN = Deno.env.get('WHATSAPP_ACCESS_TOKEN')!;
const WHATSAPP_PHONE_NUMBER_ID = Deno.env.get('WHATSAPP_PHONE_NUMBER_ID')!;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      },
    });
  }

  try {
    const { phone, code } = await req.json();

    if (!phone || !code) {
      return new Response(JSON.stringify({ error: 'phone and code required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Send template message via WhatsApp Cloud API
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
          to: phone,
          type: 'template',
          template: {
            name: 'dwella_verification',
            language: { code: 'en' },
            components: [
              {
                type: 'body',
                parameters: [{ type: 'text', text: code }],
              },
            ],
          },
        }),
      },
    );

    if (!res.ok) {
      const err = await res.text();
      console.error('WhatsApp template send error:', err);
      return new Response(JSON.stringify({ error: 'Failed to send WhatsApp message' }), {
        status: 502,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  } catch (err) {
    console.error('whatsapp-send-code error:', err);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }
});
