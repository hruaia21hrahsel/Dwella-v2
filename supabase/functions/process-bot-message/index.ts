import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY')!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// ----------------------------------------------------------------
// Types
// ----------------------------------------------------------------
interface BotRequest {
  user_id: string;
  message: string;
  source: 'app' | 'telegram';
  telegram_chat_id?: number;
}

interface BotResponse {
  reply: string;
  intent?: string;
  action_taken?: string;
}

interface ClaudeIntent {
  intent: string;
  entities: Record<string, unknown>;
  action_description: string;
  needs_confirmation: boolean;
  reply: string;
}

// ----------------------------------------------------------------
// Build context string from user's properties/tenants/payments
// ----------------------------------------------------------------
async function buildContext(supabase: ReturnType<typeof createClient>, userId: string): Promise<string> {
  // Owned properties
  const { data: properties } = await supabase
    .from('properties')
    .select('*, tenants!inner(*, payments(*))')
    .eq('owner_id', userId)
    .eq('is_archived', false);

  // Properties where user is a tenant
  const { data: tenantRows } = await supabase
    .from('tenants')
    .select('*, properties(*), payments(*)')
    .eq('user_id', userId)
    .eq('is_archived', false);

  const today = new Date().toISOString().split('T')[0];
  const currentMonth = new Date().getMonth() + 1;
  const currentYear = new Date().getFullYear();

  let ctx = `Today: ${today}. Current month: ${currentMonth}/${currentYear}.\n\n`;

  if (properties && properties.length > 0) {
    ctx += `LANDLORD CONTEXT — You own ${properties.length} property/properties:\n`;
    for (const p of properties) {
      const tenants = (p as Record<string, unknown[]>).tenants ?? [];
      ctx += `\nProperty: "${p.name}" (ID: ${p.id}), ${p.address}, ${p.city}. Total units: ${p.total_units}. Active tenants: ${tenants.length}.\n`;
      for (const t of tenants as Record<string, unknown>[]) {
        const payments = (t['payments'] as Record<string, unknown>[]) ?? [];
        const currentPayment = payments.find(
          (pay) => pay['month'] === currentMonth && pay['year'] === currentYear
        );
        ctx += `  Tenant: "${t['tenant_name']}" (ID: ${t['id']}), Flat ${t['flat_no']}, Rent: ₹${t['monthly_rent']}/mo, Due day: ${t['due_day']}.\n`;
        if (currentPayment) {
          ctx += `    This month payment: status=${currentPayment['status']}, due=₹${currentPayment['amount_due']}, paid=₹${currentPayment['amount_paid']}.\n`;
        } else {
          ctx += `    This month payment: no record yet.\n`;
        }
      }
    }
    ctx += '\n';
  }

  if (tenantRows && tenantRows.length > 0) {
    ctx += `TENANT CONTEXT — You are a tenant at:\n`;
    for (const t of tenantRows) {
      const prop = t.properties as Record<string, unknown>;
      const payments = (t.payments as Record<string, unknown>[]) ?? [];
      const currentPayment = payments.find(
        (pay) => pay['month'] === currentMonth && pay['year'] === currentYear
      );
      ctx += `\nProperty: "${prop?.['name']}" (${prop?.['address']}). Flat ${t.flat_no}. Rent: ₹${t.monthly_rent}/mo, Due day: ${t.due_day}.\n`;
      if (currentPayment) {
        ctx += `  This month payment: status=${currentPayment['status']}, due=₹${currentPayment['amount_due']}, paid=₹${currentPayment['amount_paid']}.\n`;
      }
    }
    ctx += '\n';
  }

  if ((!properties || properties.length === 0) && (!tenantRows || tenantRows.length === 0)) {
    ctx += 'No properties or tenancies found for this user yet.\n';
  }

  return ctx;
}

// ----------------------------------------------------------------
// Fetch last N conversation messages for history
// ----------------------------------------------------------------
async function getHistory(supabase: ReturnType<typeof createClient>, userId: string, limit = 10) {
  const { data } = await supabase
    .from('bot_conversations')
    .select('role, content')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  return (data ?? []).reverse() as { role: 'user' | 'assistant'; content: string }[];
}

// ----------------------------------------------------------------
// Call Claude API
// ----------------------------------------------------------------
async function callClaude(context: string, history: { role: string; content: string }[], userMessage: string): Promise<ClaudeIntent> {
  const systemPrompt = `You are Dwella Assistant, an AI helper for a rental property management app called Dwella.

You help landlords and tenants with: checking payment status, viewing tenant info, understanding rent history, and general property questions.

PROPERTY/TENANT CONTEXT (refreshed for this request):
${context}

RESPONSE FORMAT: Always respond with valid JSON matching this schema:
{
  "intent": "<one of: query_status|query_summary|query_overdue|query_tenant|general_chat>",
  "entities": {},
  "action_description": "<what you understood>",
  "needs_confirmation": false,
  "reply": "<friendly natural language reply to the user>"
}

Keep replies concise and conversational. Use ₹ for Indian Rupees. Format dates as DD MMM YYYY.
Note: Payment actions (mark_paid, confirm_payment) must be done through the app UI for security.`;

  const messages = [
    ...history.map((h) => ({ role: h.role, content: h.content })),
    { role: 'user', content: userMessage },
  ];

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
      messages,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Claude API error: ${response.status} ${err}`);
  }

  const data = await response.json();
  const rawContent: string = data.content?.[0]?.text ?? '{}';

  // Extract JSON from response (Claude may wrap it in markdown code fences)
  const jsonMatch = rawContent.match(/```(?:json)?\s*([\s\S]*?)```/) ?? rawContent.match(/(\{[\s\S]*\})/);
  const jsonStr = jsonMatch ? jsonMatch[1] : rawContent;

  try {
    return JSON.parse(jsonStr.trim()) as ClaudeIntent;
  } catch {
    // Fallback if Claude returns non-JSON
    return {
      intent: 'general_chat',
      entities: {},
      action_description: 'general response',
      needs_confirmation: false,
      reply: rawContent,
    };
  }
}

// ----------------------------------------------------------------
// Save messages to bot_conversations
// ----------------------------------------------------------------
async function saveMessages(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  userMessage: string,
  assistantReply: string
) {
  await supabase.from('bot_conversations').insert([
    { user_id: userId, role: 'user', content: userMessage },
    { user_id: userId, role: 'assistant', content: assistantReply },
  ]);
}

// ----------------------------------------------------------------
// Main handler
// ----------------------------------------------------------------
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
    const body: BotRequest = await req.json();
    const { user_id, message, source } = body;

    if (!user_id || !message) {
      return new Response(JSON.stringify({ error: 'user_id and message required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // Build context + history in parallel
    const [context, history] = await Promise.all([
      buildContext(supabase, user_id),
      getHistory(supabase, user_id),
    ]);

    // Call Claude
    const result = await callClaude(context, history, message);

    // Persist conversation
    await saveMessages(supabase, user_id, message, result.reply);

    const botResponse: BotResponse = {
      reply: result.reply,
      intent: result.intent,
      action_taken: result.action_description,
    };

    return new Response(JSON.stringify(botResponse), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (err) {
    console.error('process-bot-message error:', err);
    return new Response(JSON.stringify({ error: 'Internal server error', details: String(err) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }
});
