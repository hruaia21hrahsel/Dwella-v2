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
    .select('id');

  if (error) {
    console.error('auto-confirm error:', error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }

  const count = data?.length ?? 0;
  console.log(`Auto-confirmed ${count} payment(s).`);

  return new Response(JSON.stringify({ confirmed: count }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
