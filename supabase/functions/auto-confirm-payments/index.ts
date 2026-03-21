import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

const WHATSAPP_SEND_URL = `${Deno.env.get('SUPABASE_URL')!}/functions/v1/whatsapp-send`;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const TELEGRAM_BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN')!;

Deno.serve(async (_req) => {
  const { data, error } = await supabase
    .from('payments')
    .update({
      status: 'confirmed',
      confirmed_at: new Date().toISOString(),
      auto_confirmed: true,
    })
    .eq('status', 'paid')
    .is('confirmed_at', null)
    .lt('paid_at', new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString())
    .select('id, tenant_id, month, year, amount_paid, tenants(tenant_name, user_id, is_archived, properties(owner_id))');

  if (error) {
    console.error('auto-confirm error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const count = data?.length ?? 0;
  const activePayments = (data ?? []).filter((p: any) => !p.tenants?.is_archived);

  // Send push to landlord for each confirmed payment
  if (count > 0) {
    const ownerIds = [...new Set(
      activePayments.map((p: any) => p.tenants?.properties?.owner_id).filter(Boolean),
    )] as string[];

    if (ownerIds.length > 0) {
      const { data: owners } = await supabase
        .from('users')
        .select('id, push_token')
        .in('id', ownerIds);
      const tokenMap: Record<string, string | null> = Object.fromEntries(
        (owners ?? []).map((u: any) => [u.id, u.push_token]),
      );

      const pushMessages: any[] = [];
      for (const p of activePayments) {
        const ownerId = (p as any).tenants?.properties?.owner_id;
        const tenantName = (p as any).tenants?.tenant_name ?? 'Tenant';
        if (ownerId && tokenMap[ownerId]) {
          pushMessages.push({
            token: tokenMap[ownerId],
            title: 'Payment Confirmed',
            body: `Payment confirmed — ${tenantName}`,
            data: { screen: '/payments' },
          });
        }
      }

      if (pushMessages.length > 0) {
        await supabase.functions.invoke('send-push', {
          body: { messages: pushMessages },
        });
      }
    }

    // D-07: Send WhatsApp receipt to tenant on auto-confirm
    // Fetch tenant user contact details
    const tenantUserIds = [...new Set(
      activePayments.map((p: any) => p.tenants?.user_id).filter(Boolean),
    )] as string[];

    if (tenantUserIds.length > 0) {
      const { data: tenantUsers } = await supabase
        .from('users')
        .select('id, whatsapp_phone, telegram_chat_id')
        .in('id', tenantUserIds);

      const contactMap: Record<string, { whatsapp_phone: string | null; telegram_chat_id: number | null }> =
        Object.fromEntries(
          (tenantUsers ?? []).map((u: any) => [u.id, {
            whatsapp_phone: u.whatsapp_phone,
            telegram_chat_id: u.telegram_chat_id ? Number(u.telegram_chat_id) : null,
          }]),
        );

      const monthNames = ['', 'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

      for (const p of activePayments) {
        const tenantUserId = (p as any).tenants?.user_id;
        if (!tenantUserId) continue;

        const contact = contactMap[tenantUserId];
        if (!contact) continue;

        const tenantName = (p as any).tenants?.tenant_name ?? 'Tenant';
        const amountPaid = String((p as any).amount_paid ?? 0);
        const monthLabel = `${monthNames[(p as any).month] ?? ''} ${(p as any).year ?? ''}`;

        // WhatsApp template (dwella_payment_confirmed: {{name}}, {{amount}}, {{month}})
        if (contact.whatsapp_phone) {
          try {
            const res = await fetch(WHATSAPP_SEND_URL, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
              },
              body: JSON.stringify({
                to: contact.whatsapp_phone,
                type: 'template',
                template: {
                  name: 'dwella_payment_confirmed',
                  language: 'en',
                  components: [{
                    type: 'body',
                    parameters: [
                      { type: 'text', text: tenantName },
                      { type: 'text', text: amountPaid },
                      { type: 'text', text: monthLabel },
                    ],
                  }],
                },
              }),
            });
            const resData = await res.json();
            if (!resData.success) {
              console.error(`WhatsApp payment confirmed template failed:`, JSON.stringify(resData));
            }
          } catch (err) {
            console.error(`WhatsApp send failed for tenant ${tenantUserId}:`, err);
          }
        }

        // D-09: Telegram parity
        if (contact.telegram_chat_id) {
          try {
            await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                chat_id: contact.telegram_chat_id,
                text: `Payment Confirmed\n\nHi ${tenantName}, your payment of Rs.${amountPaid} for ${monthLabel} has been confirmed. Thank you!`,
              }),
            });
          } catch (err) {
            console.error(`Telegram payment confirm send failed for chat ${contact.telegram_chat_id}:`, err);
          }
        }
      }
    }
  }

  console.log(`Auto-confirmed ${count} payment(s).`);

  return new Response(JSON.stringify({ confirmed: count }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
