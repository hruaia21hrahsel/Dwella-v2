import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const WHATSAPP_SEND_URL = `${SUPABASE_URL}/functions/v1/whatsapp-send`;
const TELEGRAM_BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN')!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function sendTelegramDirect(chatId: number, text: string): Promise<void> {
  try {
    await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text }),
    });
  } catch (err) {
    console.error(`Telegram send failed for chat ${chatId}:`, err);
  }
}

async function sendWhatsAppTemplate(
  phone: string,
  templateName: string,
  params: Array<{ type: string; text: string }>,
): Promise<boolean> {
  try {
    const res = await fetch(WHATSAPP_SEND_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
      },
      body: JSON.stringify({
        to: phone,
        type: 'template',
        template: {
          name: templateName,
          language: 'en',
          components: [{ type: 'body', parameters: params }],
        },
      }),
    });
    const data = await res.json();
    if (!data.success) {
      console.error(`WhatsApp template ${templateName} failed for ${phone}:`, JSON.stringify(data));
      return false;
    }
    return true;
  } catch (err) {
    console.error(`WhatsApp send error for ${phone}:`, err);
    return false;
  }
}

async function sendPushFallback(userId: string, title: string, body: string): Promise<void> {
  try {
    // Look up push token for this user
    const { data: user } = await supabase
      .from('users')
      .select('push_token')
      .eq('id', userId)
      .single();

    if (!user?.push_token) return;

    await supabase.functions.invoke('send-push', {
      body: {
        messages: [{
          token: user.push_token,
          title,
          body,
          data: { screen: '/maintenance' },
        }],
      },
    });
  } catch (err) {
    console.error(`Push fallback failed for user ${userId}:`, err);
  }
}

serve(async (req) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      },
    });
  }

  try {
    const { request_id, tenant_id, property_id, old_status, new_status, title } =
      await req.json();

    console.log(`notify-whatsapp: maintenance ${request_id} ${old_status} -> ${new_status}`);

    // Look up tenant user
    const { data: tenant } = await supabase
      .from('tenants')
      .select('user_id, tenant_name')
      .eq('id', tenant_id)
      .single();

    // Look up property owner
    const { data: property } = await supabase
      .from('properties')
      .select('owner_id, name')
      .eq('id', property_id)
      .single();

    if (!tenant || !property) {
      console.error('notify-whatsapp: tenant or property not found', { tenant_id, property_id });
      return new Response(JSON.stringify({ error: 'tenant or property not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Collect target user IDs (D-06: both tenant AND landlord)
    const targetUserIds: string[] = [];
    if (tenant.user_id) targetUserIds.push(tenant.user_id);
    if (property.owner_id) targetUserIds.push(property.owner_id);
    const uniqueUserIds = [...new Set(targetUserIds)];

    if (uniqueUserIds.length === 0) {
      return new Response(JSON.stringify({ sent: 0, reason: 'no target users' }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Fetch user contact details
    const { data: users } = await supabase
      .from('users')
      .select('id, whatsapp_phone, telegram_chat_id, push_token')
      .in('id', uniqueUserIds);

    const notificationTitle = 'Maintenance Update';
    const notificationBody = `${title}: status changed to ${new_status}`;
    let sent = 0;

    for (const user of users ?? []) {
      // D-08: Always create notification row regardless of delivery channel
      await supabase.from('notifications').insert({
        user_id: user.id,
        type: 'maintenance_update',
        title: notificationTitle,
        body: notificationBody,
        maintenance_request_id: request_id,
      });

      let waSuccess = false;

      // WhatsApp template (dwella_maintenance_update: {{name}}, {{description}}, {{status}})
      if (user.whatsapp_phone) {
        const userName = user.id === tenant.user_id ? tenant.tenant_name : 'Landlord';
        waSuccess = await sendWhatsAppTemplate(user.whatsapp_phone, 'dwella_maintenance_update', [
          { type: 'text', text: userName },
          { type: 'text', text: title },
          { type: 'text', text: new_status },
        ]);
        if (waSuccess) sent++;
      }

      // D-09: Telegram parity
      if (user.telegram_chat_id) {
        await sendTelegramDirect(
          Number(user.telegram_chat_id),
          `${notificationTitle}\n\n${title}\nStatus: ${old_status} → ${new_status}`,
        );
        sent++;
      }

      // D-08: Push fallback if WhatsApp failed or not linked
      if (!waSuccess && !user.telegram_chat_id) {
        await sendPushFallback(user.id, notificationTitle, notificationBody);
      }
    }

    return new Response(JSON.stringify({ sent }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('notify-whatsapp error:', err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
