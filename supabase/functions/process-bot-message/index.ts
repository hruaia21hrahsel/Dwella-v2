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

interface DocumentPayload {
  url: string;
  filename: string;
  caption?: string;
}

interface BotResponse {
  reply: string;
  intent?: string;
  action_taken?: string;
  pending_action?: PendingAction | null;
  document?: DocumentPayload;
}

type ActionHandlerResult = string | { text: string; document?: DocumentPayload };

interface ClaudeIntent {
  intent: string;
  entities: Record<string, unknown>;
  action_description: string;
  needs_confirmation: boolean;
  reply: string;
}

interface PendingAction {
  action: string;
  entities: Record<string, unknown>;
  description: string;
}

type ActionHandler = (
  supabase: ReturnType<typeof createClient>,
  userId: string,
  entities: Record<string, unknown>,
) => Promise<ActionHandlerResult>;

// ----------------------------------------------------------------
// Inline helpers (Deno Edge Function — cannot import from /lib)
// ----------------------------------------------------------------
const MONTH_NAMES_INLINE = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const monthName = (m: number) => MONTH_NAMES_INLINE[m - 1] ?? String(m);

function unwrapActionResult(result: ActionHandlerResult): { text: string; document?: DocumentPayload } {
  if (typeof result === 'string') return { text: result };
  return { text: result.text, document: result.document };
}

// ----------------------------------------------------------------
// Action Handlers
// ----------------------------------------------------------------

async function verifyOwnership(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  propertyId: string,
): Promise<boolean> {
  const { data } = await supabase
    .from('properties')
    .select('id')
    .eq('id', propertyId)
    .eq('owner_id', userId)
    .eq('is_archived', false)
    .single();
  return !!data;
}

async function findTenantByName(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  tenantName: string,
): Promise<{ tenant: any; property: any } | null> {
  // Find all properties owned by user, then find tenant by name
  const { data: properties } = await supabase
    .from('properties')
    .select('id')
    .eq('owner_id', userId)
    .eq('is_archived', false);

  if (!properties || properties.length === 0) return null;

  const propertyIds = properties.map((p: any) => p.id);
  const { data: tenants } = await supabase
    .from('tenants')
    .select('*, properties(*)')
    .in('property_id', propertyIds)
    .eq('is_archived', false)
    .ilike('tenant_name', `%${tenantName}%`);

  if (!tenants || tenants.length === 0) return null;
  return { tenant: tenants[0], property: tenants[0].properties };
}

const handleLogPayment: ActionHandler = async (supabase, userId, entities) => {
  const { tenant_name, month, year, amount, status } = entities as {
    tenant_name?: string;
    month?: number;
    year?: number;
    amount?: number;
    status?: string;
  };

  if (!tenant_name) return 'I need the tenant name to log a payment.';

  const result = await findTenantByName(supabase, userId, tenant_name);
  if (!result) return `Could not find a tenant matching "${tenant_name}" in your properties.`;

  const { tenant, property } = result;
  if (!(await verifyOwnership(supabase, userId, property.id))) {
    return 'You do not own this property.';
  }

  const now = new Date();
  const payMonth = month ?? (now.getMonth() + 1);
  const payYear = year ?? now.getFullYear();
  const payAmount = amount ?? tenant.monthly_rent;

  // Find existing payment row
  const { data: payment } = await supabase
    .from('payments')
    .select('*')
    .eq('tenant_id', tenant.id)
    .eq('month', payMonth)
    .eq('year', payYear)
    .single();

  if (!payment) {
    return `No payment record found for ${tenant.tenant_name} for ${payMonth}/${payYear}. The payment row may not exist yet — open the tenant in the app first.`;
  }

  if (payment.status === 'confirmed') {
    return `Payment for ${tenant.tenant_name} (${payMonth}/${payYear}) is already confirmed.`;
  }

  const newAmountPaid = payAmount;
  const newStatus = status === 'paid' || newAmountPaid >= payment.amount_due ? 'paid' : 'partial';

  const { error } = await supabase
    .from('payments')
    .update({
      amount_paid: newAmountPaid,
      status: newStatus,
      paid_at: new Date().toISOString(),
      notes: 'Logged via AI assistant',
    })
    .eq('id', payment.id);

  if (error) return `Failed to update payment: ${error.message}`;
  return `Done! Marked ${tenant.tenant_name}'s ${payMonth}/${payYear} payment as ${newStatus} (₹${newAmountPaid}).`;
};

const handleConfirmPayment: ActionHandler = async (supabase, userId, entities) => {
  const { tenant_name, month, year } = entities as {
    tenant_name?: string;
    month?: number;
    year?: number;
  };

  if (!tenant_name) return 'I need the tenant name to confirm a payment.';

  const result = await findTenantByName(supabase, userId, tenant_name);
  if (!result) return `Could not find a tenant matching "${tenant_name}".`;

  const { tenant, property } = result;
  if (!(await verifyOwnership(supabase, userId, property.id))) {
    return 'You do not own this property.';
  }

  const now = new Date();
  const payMonth = month ?? (now.getMonth() + 1);
  const payYear = year ?? now.getFullYear();

  const { data: payment } = await supabase
    .from('payments')
    .select('*')
    .eq('tenant_id', tenant.id)
    .eq('month', payMonth)
    .eq('year', payYear)
    .single();

  if (!payment) return `No payment record found for ${tenant.tenant_name} (${payMonth}/${payYear}).`;
  if (payment.status !== 'paid') return `Payment is currently "${payment.status}" — only "paid" payments can be confirmed.`;

  const { error } = await supabase
    .from('payments')
    .update({
      status: 'confirmed',
      confirmed_at: new Date().toISOString(),
      auto_confirmed: false,
    })
    .eq('id', payment.id);

  if (error) return `Failed to confirm: ${error.message}`;
  return `Confirmed ${tenant.tenant_name}'s payment for ${payMonth}/${payYear}.`;
};

const handleAddProperty: ActionHandler = async (supabase, userId, entities) => {
  const { name, address, city, total_units } = entities as {
    name?: string;
    address?: string;
    city?: string;
    total_units?: number;
  };

  if (!name) return 'I need at least a property name to add it.';

  const { data, error } = await supabase
    .from('properties')
    .insert({
      owner_id: userId,
      name,
      address: address ?? '',
      city: city ?? '',
      total_units: total_units ?? 1,
    })
    .select()
    .single();

  if (error) return `Failed to add property: ${error.message}`;
  return `Property "${name}" has been added! You can now add tenants to it in the app.`;
};

const handleAddTenant: ActionHandler = async (supabase, userId, entities) => {
  const { property_name, tenant_name, flat_no, monthly_rent, due_day } = entities as {
    property_name?: string;
    tenant_name?: string;
    flat_no?: string;
    monthly_rent?: number;
    due_day?: number;
  };

  if (!tenant_name) return 'I need the tenant name to add them.';
  if (!property_name) return 'Which property should I add this tenant to?';

  // Find property by name
  const { data: properties } = await supabase
    .from('properties')
    .select('*')
    .eq('owner_id', userId)
    .eq('is_archived', false)
    .ilike('name', `%${property_name}%`);

  if (!properties || properties.length === 0) return `No property found matching "${property_name}".`;
  const property = properties[0];

  // Generate invite token
  const inviteToken = crypto.randomUUID();

  const { error } = await supabase.from('tenants').insert({
    property_id: property.id,
    tenant_name,
    flat_no: flat_no ?? '—',
    monthly_rent: monthly_rent ?? 0,
    security_deposit: 0,
    due_day: due_day ?? 1,
    lease_start: new Date().toISOString().split('T')[0],
    invite_token: inviteToken,
    invite_status: 'pending',
  });

  if (error) return `Failed to add tenant: ${error.message}`;
  return `Added ${tenant_name} to "${property.name}" (Flat ${flat_no ?? '—'}). They can accept their invite in the app.`;
};

const handleSendReminder: ActionHandler = async (supabase, userId, entities) => {
  const { tenant_name } = entities as { tenant_name?: string };

  if (!tenant_name) return 'Which tenant should I send a reminder to?';

  const result = await findTenantByName(supabase, userId, tenant_name);
  if (!result) return `Could not find a tenant matching "${tenant_name}".`;

  const { tenant, property } = result;
  if (!(await verifyOwnership(supabase, userId, property.id))) {
    return 'You do not own this property.';
  }

  if (!tenant.user_id) {
    return `${tenant.tenant_name} hasn't accepted their invite yet, so I can't send them a notification.`;
  }

  // Create a notification for the tenant
  const { error } = await supabase.from('notifications').insert({
    user_id: tenant.user_id,
    tenant_id: tenant.id,
    type: 'reminder',
    title: 'Rent Reminder',
    body: `Hi ${tenant.tenant_name}, this is a friendly reminder about your rent payment for ${property.name} (Flat ${tenant.flat_no}). Your monthly rent is ₹${tenant.monthly_rent}.`,
  });

  if (error) return `Failed to send reminder: ${error.message}`;
  return `Reminder sent to ${tenant.tenant_name}!`;
};

// ----------------------------------------------------------------
// handleGetRentReceipt — fetch a cached receipt PDF from Supabase
// Storage (uploaded by the app on share or on confirmation) and
// return it as a document payload. Falls back to a formatted text
// receipt if no PDF is cached yet.
// ----------------------------------------------------------------
const handleGetRentReceipt: ActionHandler = async (supabase, userId, entities) => {
  const { tenant_name, month, year } = entities as {
    tenant_name?: string;
    month?: number;
    year?: number;
  };

  const now = new Date();
  const payMonth = month ?? (now.getMonth() + 1);
  const payYear = year ?? now.getFullYear();

  let payment: any = null;
  let tenant: any = null;
  let property: any = null;

  if (tenant_name) {
    // Landlord asking for a specific tenant's receipt
    const result = await findTenantByName(supabase, userId, tenant_name);
    if (!result) return `I couldn't find a tenant matching "${tenant_name}" in your properties.`;
    tenant = result.tenant;
    property = result.property;

    const { data } = await supabase
      .from('payments')
      .select('*')
      .eq('tenant_id', tenant.id)
      .eq('month', payMonth)
      .eq('year', payYear)
      .single();
    payment = data;
  } else {
    // User is a tenant asking for their own receipt
    const { data: tenantRows } = await supabase
      .from('tenants')
      .select('*, properties(*), payments(*)')
      .eq('user_id', userId)
      .eq('is_archived', false);

    if (!tenantRows || tenantRows.length === 0) {
      return "I couldn't find any tenancies linked to your account. If you're a landlord, tell me which tenant the receipt is for.";
    }
    if (tenantRows.length > 1) {
      const names = (tenantRows as any[])
        .map((t) => `${(t.properties as any)?.name ?? 'Property'} (Flat ${t.flat_no})`)
        .join(', ');
      return `You have multiple tenancies (${names}). Which one should I pull the receipt for?`;
    }
    tenant = tenantRows[0];
    property = (tenant as any).properties;
    payment = ((tenant as any).payments as any[] | null ?? []).find(
      (p) => p.month === payMonth && p.year === payYear,
    );
  }

  if (!payment) {
    return `I don't see a payment record for ${monthName(payMonth)} ${payYear}.`;
  }

  // Try to fetch the cached PDF from Storage
  const cachePath = `${payment.id}.pdf`;
  const { data: signed } = await supabase.storage
    .from('receipts')
    .createSignedUrl(cachePath, 600); // 10 minutes

  let pdfAvailable = false;
  if (signed?.signedUrl) {
    try {
      const head = await fetch(signed.signedUrl, { method: 'HEAD' });
      pdfAvailable = head.ok;
    } catch {
      pdfAvailable = false;
    }
  }

  if (pdfAvailable && signed?.signedUrl) {
    return {
      text: `Here's your ${monthName(payMonth)} ${payYear} rent receipt.`,
      document: {
        url: signed.signedUrl,
        filename: `rent-receipt-${tenant.tenant_name.replace(/\s+/g, '-')}-${payMonth}-${payYear}.pdf`,
        caption: `Rent receipt — ${tenant.tenant_name} — ${monthName(payMonth)} ${payYear}`,
      },
    };
  }

  // Fallback: formatted Markdown text receipt
  const statusLabel = String(payment.status).charAt(0).toUpperCase() + String(payment.status).slice(1);
  const lines = [
    `*Rent Payment Receipt*`,
    `${monthName(payMonth)} ${payYear}`,
    ``,
    `*Tenant:* ${tenant.tenant_name}`,
    `*Property:* ${property?.name ?? '—'}${property?.city ? ', ' + property.city : ''}`,
    `*Flat:* ${tenant.flat_no}`,
    ``,
    `*Amount Due:* ₹${payment.amount_due}`,
    `*Amount Paid:* ₹${payment.amount_paid}`,
    `*Status:* ${statusLabel}`,
  ];
  if (payment.paid_at) {
    lines.push(`*Paid On:* ${new Date(payment.paid_at).toLocaleDateString('en-IN')}`);
  }
  lines.push('', `_The PDF version isn't cached yet. Open this payment in the Dwella app once and the PDF will be delivered here next time._`);
  return lines.join('\n');
};

const ACTION_HANDLERS: Record<string, ActionHandler> = {
  log_payment: handleLogPayment,
  add_property: handleAddProperty,
  add_tenant: handleAddTenant,
  send_reminder: handleSendReminder,
  confirm_payment: handleConfirmPayment,
  get_rent_receipt: handleGetRentReceipt,
};

// Intents that require confirmation before execution
const CONFIRM_REQUIRED_INTENTS = new Set([
  'log_payment',
  'confirm_payment',
  'add_property',
  'add_tenant',
]);

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
    .select('role, content, metadata')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  return (data ?? []).reverse() as { role: 'user' | 'assistant'; content: string; metadata?: any }[];
}

// ----------------------------------------------------------------
// Check if user is confirming/canceling a pending action
// ----------------------------------------------------------------
function isConfirmation(message: string): boolean {
  const normalized = message.toLowerCase().trim();
  return ['yes', 'confirm', 'do it', 'go ahead', 'sure', 'yep', 'yeah', 'ok', 'okay', 'proceed'].includes(normalized);
}

function isCancellation(message: string): boolean {
  const normalized = message.toLowerCase().trim();
  return ['no', 'cancel', 'nope', 'stop', 'nevermind', 'never mind', 'nah', 'dont', "don't"].includes(normalized);
}

// ----------------------------------------------------------------
// Call Claude API
// ----------------------------------------------------------------
async function callClaude(context: string, history: { role: string; content: string }[], userMessage: string): Promise<ClaudeIntent> {
  const systemPrompt = `You are Dwella Assistant, an AI helper for a rental property management app called Dwella.

You help landlords and tenants with: checking payment status, viewing tenant info, understanding rent history, general property questions, AND executing actions like logging payments, adding properties/tenants, confirming payments, and sending reminders.

PROPERTY/TENANT CONTEXT (refreshed for this request):
${context}

AVAILABLE ACTIONS — You can perform these for the user:
- log_payment: Log a tenant's rent payment. Entities: { tenant_name, month?, year?, amount?, status? }
- confirm_payment: Confirm a paid payment. Entities: { tenant_name, month?, year? }
- add_property: Add a new property. Entities: { name, address?, city?, total_units? }
- add_tenant: Add a tenant to a property. Entities: { property_name, tenant_name, flat_no?, monthly_rent?, due_day? }
- send_reminder: Send a rent reminder to a tenant. Entities: { tenant_name }
- get_rent_receipt: Fetch and send a rent payment receipt (PDF preferred, text fallback). Entities: { tenant_name?, month?, year? }. Tenant users may omit tenant_name to get their own receipt. Defaults to current month/year if not specified. This is a read action — never needs confirmation.

QUERY INTENTS (no action needed):
- query_status, query_summary, query_overdue, query_tenant, general_chat

RESPONSE FORMAT: Always respond with valid JSON matching this schema:
{
  "intent": "<one of the action or query intents above>",
  "entities": { <relevant key-value pairs for the action> },
  "action_description": "<what you understood the user wants>",
  "needs_confirmation": <true for financial/destructive actions (log_payment, confirm_payment, add_property, add_tenant), false for queries and send_reminder>,
  "reply": "<friendly natural language reply — for actions needing confirmation, summarize what you'll do and ask 'Should I go ahead?'>"
}

RULES:
- For action intents, extract as many entities as possible from the message and context.
- If the user says a tenant name, match it to the tenant list in context. Use the exact name from context.
- If month/year is not specified for payment actions, default to the current month/year.
- If amount is not specified for log_payment, default to the tenant's monthly_rent.
- Set needs_confirmation: true for log_payment, confirm_payment, add_property, add_tenant.
- Set needs_confirmation: false for queries, send_reminder, and get_rent_receipt.
- Keep replies concise and conversational. Use ₹ for Indian Rupees. Format dates as DD MMM YYYY.`;

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
  assistantReply: string,
  metadata?: Record<string, unknown> | null,
) {
  await supabase.from('bot_conversations').insert([
    { user_id: userId, role: 'user', content: userMessage },
    { user_id: userId, role: 'assistant', content: assistantReply, metadata: metadata ?? null },
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
    const { user_id, message } = body;

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

    // Check if last assistant message has a pending action
    const lastAssistantMsg = [...history].reverse().find((m) => m.role === 'assistant');
    const pendingAction: PendingAction | null = lastAssistantMsg?.metadata?.pending_action ?? null;

    // Handle confirmation/cancellation of pending action
    if (pendingAction) {
      if (isConfirmation(message)) {
        const handler = ACTION_HANDLERS[pendingAction.action];
        if (handler) {
          const actionResult = await handler(supabase, user_id, pendingAction.entities);
          const { text: actionText, document: actionDoc } = unwrapActionResult(actionResult);
          await saveMessages(supabase, user_id, message, actionText);
          return jsonResponse({
            reply: actionText,
            intent: pendingAction.action,
            action_taken: pendingAction.description,
            document: actionDoc,
          });
        }
      } else if (isCancellation(message)) {
        const cancelReply = 'No problem, I\'ve cancelled that action.';
        await saveMessages(supabase, user_id, message, cancelReply);
        return jsonResponse({ reply: cancelReply, intent: 'cancelled' });
      }
      // If neither confirm nor cancel, treat as a new message (fall through to Claude)
    }

    // Call Claude
    const result = await callClaude(context, history, message);

    const handler = ACTION_HANDLERS[result.intent];

    if (handler) {
      // Action intent
      if (result.needs_confirmation || CONFIRM_REQUIRED_INTENTS.has(result.intent)) {
        // Save with pending action metadata, ask for confirmation
        const actionMetadata = {
          pending_action: {
            action: result.intent,
            entities: result.entities,
            description: result.action_description,
          },
        };
        await saveMessages(supabase, user_id, message, result.reply, actionMetadata);
        return jsonResponse({
          reply: result.reply,
          intent: result.intent,
          pending_action: actionMetadata.pending_action,
        });
      } else {
        // Execute immediately (e.g. send_reminder, get_rent_receipt)
        const actionResult = await handler(supabase, user_id, result.entities);
        const { text: actionText, document: actionDoc } = unwrapActionResult(actionResult);
        await saveMessages(supabase, user_id, message, actionText);
        return jsonResponse({
          reply: actionText,
          intent: result.intent,
          action_taken: result.action_description,
          document: actionDoc,
        });
      }
    } else {
      // Query intent — return reply as-is
      await saveMessages(supabase, user_id, message, result.reply);
      return jsonResponse({ reply: result.reply, intent: result.intent, action_taken: result.action_description });
    }
  } catch (err) {
    console.error('process-bot-message error:', err);
    return new Response(JSON.stringify({ error: 'Internal server error', details: String(err) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }
});

function jsonResponse(body: BotResponse): Response {
  return new Response(JSON.stringify(body), {
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
  });
}
