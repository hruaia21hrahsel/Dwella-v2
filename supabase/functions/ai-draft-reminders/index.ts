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
    const { user_id } = await req.json() as { user_id: string };

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

    // Fetch properties with tenants and current month payments
    const { data: properties } = await supabase
      .from('properties')
      .select('*, tenants!inner(*, payments(*))')
      .eq('owner_id', user_id)
      .eq('is_archived', false);

    if (!properties || properties.length === 0) {
      return new Response(JSON.stringify({ reminders: [] }), {
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    }

    // Collect tenants who need reminders (overdue or pending)
    const tenantsNeedingReminder: {
      tenant_id: string;
      tenant_name: string;
      flat_no: string;
      property_name: string;
      monthly_rent: number;
      status: string;
      amount_due: number;
      amount_paid: number;
      days_overdue: number;
      user_id: string | null;
    }[] = [];

    for (const prop of properties) {
      const tenants = (prop as any).tenants ?? [];
      for (const t of tenants) {
        const currentPayment = (t.payments ?? []).find(
          (p: any) => p.month === currentMonth && p.year === currentYear
        );
        if (currentPayment && (currentPayment.status === 'pending' || currentPayment.status === 'overdue' || currentPayment.status === 'partial')) {
          const dueDate = new Date(currentPayment.due_date);
          const daysOverdue = Math.max(0, Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)));

          tenantsNeedingReminder.push({
            tenant_id: t.id,
            tenant_name: t.tenant_name,
            flat_no: t.flat_no,
            property_name: prop.name,
            monthly_rent: t.monthly_rent,
            status: currentPayment.status,
            amount_due: currentPayment.amount_due,
            amount_paid: currentPayment.amount_paid,
            days_overdue: daysOverdue,
            user_id: t.user_id,
          });
        }
      }
    }

    if (tenantsNeedingReminder.length === 0) {
      return new Response(JSON.stringify({ reminders: [] }), {
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    }

    // Build context for Claude to draft messages
    let context = `Draft friendly, professional rent reminder messages for each tenant. Personalize based on their status.\n\n`;
    for (const t of tenantsNeedingReminder) {
      context += `- ${t.tenant_name} (Flat ${t.flat_no}, ${t.property_name}): Status: ${t.status}, Rent: ₹${t.monthly_rent}, Paid: ₹${t.amount_paid}, Balance: ₹${t.amount_due - t.amount_paid}`;
      if (t.days_overdue > 0) context += `, ${t.days_overdue} days overdue`;
      context += '\n';
    }

    const systemPrompt = `You are Dwella AI. Draft personalized, friendly rent reminder messages. Be warm but clear about the outstanding amount. Return JSON array:
[
  {
    "tenant_name": "<name>",
    "draft_message": "<the reminder message, 2-3 sentences max>"
  },
  ...
]
Use ₹ for currency. Keep messages concise and professional.`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1024,
        system: systemPrompt,
        messages: [{ role: 'user', content: context }],
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Claude API error: ${response.status} ${err}`);
    }

    const data = await response.json();
    const rawContent: string = data.content?.[0]?.text ?? '[]';
    const jsonMatch = rawContent.match(/```(?:json)?\s*([\s\S]*?)```/) ?? rawContent.match(/(\[[\s\S]*\])/);
    const jsonStr = jsonMatch ? jsonMatch[1] : rawContent;

    const drafts = JSON.parse(jsonStr.trim()) as { tenant_name: string; draft_message: string }[];

    // Merge drafts with tenant data
    const reminders = tenantsNeedingReminder.map((t) => {
      const draft = drafts.find((d) => d.tenant_name === t.tenant_name);
      return {
        tenant_id: t.tenant_id,
        tenant_name: t.tenant_name,
        flat_no: t.flat_no,
        property_name: t.property_name,
        status: t.status,
        amount_due: t.amount_due,
        amount_paid: t.amount_paid,
        can_notify: !!t.user_id,
        draft_message: draft?.draft_message ?? `Hi ${t.tenant_name}, this is a reminder about your rent payment of ₹${t.amount_due - t.amount_paid} for ${t.property_name}.`,
      };
    });

    return new Response(JSON.stringify({ reminders }), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  } catch (err) {
    console.error('ai-draft-reminders error:', err);
    return new Response(JSON.stringify({ error: 'Internal server error', details: String(err) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }
});
