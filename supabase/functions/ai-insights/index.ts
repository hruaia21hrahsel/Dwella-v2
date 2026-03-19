import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY')!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

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
    const { user_id, period, mode } = await req.json() as {
      user_id: string;
      period?: string; // e.g. "3/2026" or "yearly"
      mode?: 'full' | 'nudge';
    };

    if (!user_id) {
      return new Response(JSON.stringify({ error: 'user_id required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();

    // Parse period
    let targetMonth = currentMonth;
    let targetYear = currentYear;
    let isYearly = false;

    if (period === 'yearly') {
      isYearly = true;
    } else if (period) {
      const [m, y] = period.split('/').map(Number);
      if (m && y) { targetMonth = m; targetYear = y; }
    }

    // Fetch user's properties + tenants + payments
    const { data: properties } = await supabase
      .from('properties')
      .select('*, tenants!inner(*, payments(*))')
      .eq('owner_id', user_id)
      .eq('is_archived', false);

    // Fetch expenses
    let expensesQuery = supabase.from('expenses').select('*').eq('user_id', user_id);
    if (isYearly) {
      expensesQuery = expensesQuery
        .gte('expense_date', `${targetYear}-01-01`)
        .lt('expense_date', `${targetYear + 1}-01-01`);
    } else {
      const nextMonth = targetMonth === 12 ? 1 : targetMonth + 1;
      const nextYear = targetMonth === 12 ? targetYear + 1 : targetYear;
      expensesQuery = expensesQuery
        .gte('expense_date', `${targetYear}-${String(targetMonth).padStart(2, '0')}-01`)
        .lt('expense_date', `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`);
    }
    const { data: expenses } = await expensesQuery;

    // Build data summary for Claude
    let dataContext = `Period: ${isYearly ? `Full year ${targetYear}` : `${targetMonth}/${targetYear}`}\n\n`;

    let totalReceivable = 0;
    let totalReceived = 0;
    let totalOverdue = 0;
    let confirmedCount = 0;
    let pendingCount = 0;
    let overdueCount = 0;
    let totalTenants = 0;

    if (properties) {
      for (const prop of properties) {
        const tenants = (prop as any).tenants ?? [];
        dataContext += `Property: "${prop.name}" (${prop.city})\n`;
        for (const t of tenants) {
          totalTenants++;
          const payments = (t.payments ?? []).filter((p: any) => {
            if (isYearly) return p.year === targetYear;
            return p.month === targetMonth && p.year === targetYear;
          });
          for (const p of payments) {
            totalReceivable += p.amount_due;
            totalReceived += p.amount_paid;
            if (p.status === 'overdue') { totalOverdue += p.amount_due - p.amount_paid; overdueCount++; }
            if (p.status === 'confirmed') confirmedCount++;
            if (p.status === 'pending') pendingCount++;
            dataContext += `  ${t.tenant_name} (Flat ${t.flat_no}): status=${p.status}, due=₹${p.amount_due}, paid=₹${p.amount_paid}\n`;
          }
        }
      }
    }

    const totalExpenses = (expenses ?? []).reduce((s: number, e: any) => s + (e.amount ?? 0), 0);
    dataContext += `\nTotal receivable: ₹${totalReceivable}\nTotal received: ₹${totalReceived}\nTotal overdue: ₹${totalOverdue}\nTotal expenses: ₹${totalExpenses}\nNet: ₹${totalReceived - totalExpenses}\n`;
    dataContext += `Tenants: ${totalTenants}, Confirmed: ${confirmedCount}, Pending: ${pendingCount}, Overdue: ${overdueCount}\n`;

    const isNudge = mode === 'nudge';
    const systemPrompt = isNudge
      ? `You are Dwella AI. Given this rental data, return a single actionable sentence (max 80 chars) as a dashboard nudge. Be specific with numbers. Examples: "3 tenants haven't paid March rent yet — ₹45,000 outstanding" or "All March payments confirmed! Net profit: ₹1,20,000". Return JSON: { "nudge": "<sentence>" }`
      : `You are Dwella AI, a rental analytics assistant. Analyze this data and return JSON:
{
  "summary": "<2-3 sentence overview>",
  "highlights": ["<key metric or insight>", ...],
  "trends": ["<trend observation>", ...],
  "recommendations": ["<actionable suggestion>", ...],
  "metrics": {
    "collection_rate": <percentage>,
    "net_income": <number>,
    "overdue_amount": <number>
  }
}
Use ₹ for currency. Be concise and actionable.`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 512,
        system: systemPrompt,
        messages: [{ role: 'user', content: dataContext }],
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Claude API error: ${response.status} ${err}`);
    }

    const data = await response.json();
    const rawContent: string = data.content?.[0]?.text ?? '{}';
    const jsonMatch = rawContent.match(/```(?:json)?\s*([\s\S]*?)```/) ?? rawContent.match(/(\{[\s\S]*\})/);
    const jsonStr = jsonMatch ? jsonMatch[1] : rawContent;

    let result: Record<string, unknown>;
    try {
      result = JSON.parse(jsonStr.trim());
    } catch {
      console.error('ai-insights: failed to parse Claude response:', jsonStr);
      return new Response(JSON.stringify({ error: 'Failed to parse AI response' }), {
        status: 502,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    }

    return new Response(JSON.stringify(result), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  } catch (err) {
    console.error('ai-insights error:', err);
    return new Response(JSON.stringify({ error: 'Internal server error', details: String(err) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }
});
