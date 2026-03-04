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
    .select('id, tenant_id, tenants(due_day)')
    .eq('status', 'pending')
    .eq('month', currentMonth)
    .eq('year', currentYear);

  if (fetchError) {
    console.error('mark-overdue fetch error:', fetchError);
    return new Response(JSON.stringify({ error: fetchError.message }), { status: 500 });
  }

  const overdueIds = (payments ?? [])
    .filter((p: any) => p.tenants?.due_day < currentDay)
    .map((p: any) => p.id);

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

  console.log(`Marked ${overdueIds.length} payment(s) as overdue.`);

  return new Response(JSON.stringify({ marked: overdueIds.length }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
