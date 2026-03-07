import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

Deno.serve(async (_req) => {
  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();
  const todayDay = now.getDate();

  // Fetch all active tenants with their current month payment status
  const { data: tenants, error } = await supabase
    .from('tenants')
    .select('id, tenant_name, due_day, user_id, property_id, properties(name)')
    .eq('is_archived', false)
    .not('user_id', 'is', null);

  if (error) {
    console.error('send-reminders error:', error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }

  const notifications: {
    user_id: string;
    tenant_id: string;
    type: string;
    title: string;
    body: string;
  }[] = [];

  for (const tenant of tenants ?? []) {
    const daysUntilDue = (tenant as any).due_day - todayDay;

    // Fetch this month's payment
    const { data: payment } = await supabase
      .from('payments')
      .select('status')
      .eq('tenant_id', tenant.id)
      .eq('month', currentMonth)
      .eq('year', currentYear)
      .single();

    const status = payment?.status ?? 'pending';
    const propertyName = (tenant as any).properties?.name ?? 'your property';

    // 3 days before due
    if (daysUntilDue === 3 && ['pending', 'partial'].includes(status)) {
      notifications.push({
        user_id: tenant.user_id!,
        tenant_id: tenant.id,
        type: 'reminder',
        title: 'Rent Due Soon',
        body: `Your rent for ${propertyName} is due in 3 days.`,
      });
    }

    // On due day
    if (daysUntilDue === 0 && ['pending', 'partial'].includes(status)) {
      notifications.push({
        user_id: tenant.user_id!,
        tenant_id: tenant.id,
        type: 'reminder',
        title: 'Rent Due Today',
        body: `Your rent for ${propertyName} is due today.`,
      });
    }

    // 3 days overdue
    if (daysUntilDue === -3 && ['pending', 'partial', 'overdue'].includes(status)) {
      notifications.push({
        user_id: tenant.user_id!,
        tenant_id: tenant.id,
        type: 'overdue',
        title: 'Rent Overdue',
        body: `Your rent for ${propertyName} is 3 days overdue. Please pay as soon as possible.`,
      });
    }
  }

  if (notifications.length > 0) {
    await supabase.from('notifications').insert(notifications);

    // Send push notifications
    const userIds = [...new Set(notifications.map((n) => n.user_id))];
    const { data: users } = await supabase
      .from('users')
      .select('id, push_token')
      .in('id', userIds);
    const tokenMap: Record<string, string | null> = Object.fromEntries(
      (users ?? []).map((u: any) => [u.id, u.push_token]),
    );

    const pushMessages = notifications
      .filter((n) => tokenMap[n.user_id])
      .map((n) => ({
        token: tokenMap[n.user_id],
        title: n.title,
        body: n.body,
        data: { screen: '/(tabs)/payments' },
      }));

    if (pushMessages.length > 0) {
      await supabase.functions.invoke('send-push', {
        body: { messages: pushMessages },
      });
    }
  }

  console.log(`Sent ${notifications.length} reminder(s).`);

  return new Response(JSON.stringify({ sent: notifications.length }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
