import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

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
    .select('id, tenant_id, tenants(tenant_name, is_archived, properties(owner_id))');

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
  }

  console.log(`Auto-confirmed ${count} payment(s).`);

  return new Response(JSON.stringify({ confirmed: count }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
