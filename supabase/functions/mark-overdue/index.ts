import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

Deno.serve(async (_req) => {
  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();
  const currentDay = now.getDate();

  // Fetch pending payments for the current month where today > due_day
  const { data: payments, error: fetchError } = await supabase
    .from('payments')
    .select('id, tenant_id, tenants(due_day, user_id, tenant_name, properties(owner_id))')
    .eq('status', 'pending')
    .eq('month', currentMonth)
    .eq('year', currentYear);

  if (fetchError) {
    console.error('mark-overdue fetch error:', fetchError);
    return new Response(JSON.stringify({ error: fetchError.message }), { status: 500 });
  }

  const overduePayments = (payments ?? []).filter(
    (p: any) => p.tenants?.due_day < currentDay,
  );
  const overdueIds = overduePayments.map((p: any) => p.id);

  if (overdueIds.length === 0) {
    return new Response(JSON.stringify({ marked: 0 }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { error: updateError } = await supabase
    .from('payments')
    .update({ status: 'overdue' })
    .in('id', overdueIds);

  if (updateError) {
    console.error('mark-overdue update error:', updateError);
    return new Response(JSON.stringify({ error: updateError.message }), { status: 500 });
  }

  // Send push notifications to tenants and landlords
  const tenantUserIds = overduePayments
    .map((p: any) => p.tenants?.user_id)
    .filter(Boolean) as string[];
  const ownerIds = overduePayments
    .map((p: any) => p.tenants?.properties?.owner_id)
    .filter(Boolean) as string[];
  const allUserIds = [...new Set([...tenantUserIds, ...ownerIds])];

  if (allUserIds.length > 0) {
    const { data: users } = await supabase
      .from('users')
      .select('id, push_token')
      .in('id', allUserIds);
    const tokenMap: Record<string, string | null> = Object.fromEntries(
      (users ?? []).map((u: any) => [u.id, u.push_token]),
    );

    const pushMessages: any[] = [];
    for (const p of overduePayments) {
      const tenantUserId = (p as any).tenants?.user_id;
      const ownerId = (p as any).tenants?.properties?.owner_id;
      const tenantName = (p as any).tenants?.tenant_name ?? 'Tenant';
      if (tenantUserId && tokenMap[tenantUserId]) {
        pushMessages.push({
          token: tokenMap[tenantUserId],
          title: 'Rent Overdue',
          body: 'Your rent payment is now overdue.',
          data: { screen: '/payments' },
        });
      }
      if (ownerId && tokenMap[ownerId]) {
        pushMessages.push({
          token: tokenMap[ownerId],
          title: 'Rent Overdue',
          body: `${tenantName}'s rent is now overdue.`,
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

  console.log(`Marked ${overdueIds.length} payment(s) as overdue.`);

  return new Response(JSON.stringify({ marked: overdueIds.length }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
