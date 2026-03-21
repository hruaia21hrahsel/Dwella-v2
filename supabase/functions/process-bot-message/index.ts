import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY')!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const GENERATE_PDF_URL = `${SUPABASE_URL}/functions/v1/generate-pdf`;

// ----------------------------------------------------------------
// Types
// ----------------------------------------------------------------
interface BotRequest {
  user_id: string;
  message: string;
  source: 'app' | 'telegram' | 'whatsapp';
  telegram_chat_id?: number;
  button_id?: string;   // Present when user tapped a button
}

interface BotResponse {
  reply: string;
  intent?: string;
  action_taken?: string;
  buttons?: Array<Array<{ id: string; title: string }>>;
  additional_messages?: ButtonResponse[];
  document?: {
    url: string;
    filename: string;
    caption: string;
  };
}

type ButtonResponse = {
  reply: string;
  buttons?: Array<Array<{ id: string; title: string }>>;
  document?: {
    url: string;
    filename: string;
    caption: string;
  };
};

interface ClaudeIntent {
  intent: string;
  entities: Record<string, unknown>;
  action_description: string;
  needs_confirmation: boolean;
  reply: string;
}

/**
 * Validates that Claude's parsed JSON has all required fields for intent dispatch.
 * Prevents malformed AI output from reaching action handlers (EDGE-03).
 */
function isValidClaudeIntent(obj: unknown): obj is ClaudeIntent {
  if (typeof obj !== 'object' || obj === null) return false;
  const o = obj as Record<string, unknown>;
  return (
    typeof o.intent === 'string' &&
    typeof o.entities === 'object' && o.entities !== null &&
    typeof o.action_description === 'string' &&
    typeof o.needs_confirmation === 'boolean' &&
    typeof o.reply === 'string'
  );
}

type ActionHandler = (
  supabase: ReturnType<typeof createClient>,
  userId: string,
  entities: Record<string, unknown>,
) => Promise<string>;

// ----------------------------------------------------------------
// Menu Builder Functions (BUTTON_LOOKUP infrastructure)
// ----------------------------------------------------------------

/**
 * Builds the main menu — 2 messages (3 + 2 buttons) per D-11.
 */
function buildMainMenu(): ButtonResponse[] {
  return [
    {
      reply: 'What would you like to do? (1/2)',
      buttons: [
        [{ id: 'menu_properties', title: 'Properties' }],
        [{ id: 'menu_payments', title: 'Payments' }],
        [{ id: 'menu_history', title: 'History' }],
      ],
    },
    {
      reply: 'More options (2/2)',
      buttons: [
        [{ id: 'menu_maintenance', title: 'Maintenance' }],
        [{ id: 'menu_others', title: 'Others' }],
      ],
    },
  ];
}

/**
 * Builds sub-option messages for a given category.
 * Splits items into groups of 2, with 1 slot reserved for back button (per D-12).
 */
function buildSubMenu(category: string): ButtonResponse[] {
  const subMenus: Record<string, Array<{ id: string; title: string }>> = {
    properties: [
      { id: 'sub_properties_view', title: 'View Properties' },
      { id: 'sub_properties_add', title: 'Add Property' },
      { id: 'sub_properties_edit', title: 'Edit Property' },
      { id: 'sub_properties_occupancy', title: 'Occupancy' },
      { id: 'sub_properties_summary', title: 'Summary' },
      { id: 'sub_properties_delete', title: 'Delete Property' },
    ],
    payments: [
      { id: 'sub_payments_log', title: 'Log Payment' },
      { id: 'sub_payments_confirm', title: 'Confirm Payment' },
      { id: 'sub_payments_upcoming', title: 'Upcoming' },
      { id: 'sub_payments_remind', title: 'Send Reminder' },
    ],
    history: [
      { id: 'sub_history_payments', title: 'Payment History' },
      { id: 'sub_history_maintenance', title: 'Maintenance Log' },
      { id: 'sub_history_recent', title: 'Recent Activity' },
      { id: 'sub_history_pdf', title: 'Download PDF Report' },
    ],
    maintenance: [
      { id: 'sub_maint_submit', title: 'Submit Request' },
      { id: 'sub_maint_status', title: 'Check Status' },
      { id: 'sub_maint_update', title: 'Update Request' },
    ],
    others: [
      { id: 'sub_others_upload', title: 'Upload Document' },
      { id: 'sub_others_link', title: 'Link/Unlink' },
      { id: 'sub_others_help', title: 'Help' },
      { id: 'sub_others_contact', title: 'Contact' },
      { id: 'sub_others_chat', title: 'Chat with Bot' },
    ],
  };

  const items = subMenus[category];
  if (!items) return [{ reply: 'Unknown category. Type "menu" to see options.' }];

  const backBtn = { id: 'back_main', title: 'Main Menu' };
  const messages: ButtonResponse[] = [];
  const label = category.charAt(0).toUpperCase() + category.slice(1);

  // Split items into groups of 2 (leaving 1 slot for back button per D-12)
  for (let i = 0; i < items.length; i += 2) {
    const chunk = items.slice(i, i + 2);
    const page = Math.floor(i / 2) + 1;
    const totalPages = Math.ceil(items.length / 2);
    const suffix = totalPages > 1 ? ` (${page}/${totalPages})` : '';
    messages.push({
      reply: `${label}${suffix}:`,
      buttons: [...chunk.map(b => [b]), [backBtn]],
    });
  }
  return messages;
}

/**
 * Handles sub-option button taps — returns instructional text for each action.
 * Per D-16 through D-20.
 */
function handleSubAction(buttonId: string): ButtonResponse {
  const actions: Record<string, string> = {
    sub_properties_view: 'To view your properties, just type: "show my properties" or "list properties"',
    sub_properties_add: 'To add a property, type something like: "add property called Sunrise Apartments at 123 Main St"',
    sub_properties_edit: 'To edit a property, please use the Dwella app. Go to Properties tab and tap the property to edit.',
    sub_properties_occupancy: 'To check occupancy, type: "what is the occupancy of [property name]?"',
    sub_properties_summary: 'To get a property summary, type: "summary of [property name]"',
    sub_properties_delete: 'For safety, properties can only be deleted from the Dwella app. Go to Properties tab, tap the property, then use the delete option.',
    sub_payments_log: 'To log a payment, type something like: "log payment for [tenant name] for March"',
    sub_payments_confirm: 'To confirm a payment, type: "confirm payment for [tenant name]"',
    sub_payments_upcoming: 'To see upcoming payments, type: "what payments are due?" or "upcoming payments"',
    sub_payments_remind: 'To send a reminder, type: "send reminder to [tenant name]"',
    sub_history_payments: 'To view payment history, type: "payment history for [tenant name]" or "show payments"',
    sub_history_maintenance: 'To view maintenance history, type: "maintenance history" or "show maintenance requests"',
    sub_history_recent: 'To see recent activity, type: "what happened recently?" or "recent activity"',
    sub_history_pdf: 'To download a PDF payment report, pick a year below:',
    sub_maint_submit: 'To submit a maintenance request, type: "I need to report a maintenance issue at [property/flat]"',
    sub_maint_status: 'To check maintenance status, type: "what is the status of my maintenance request?"',
    sub_maint_update: 'To update a request, type: "update maintenance request [description]"',
    sub_others_upload: 'To upload a document, just send a photo or file in this chat. I will classify and store it automatically.',
    sub_others_link: 'To link or unlink your account, go to the Dwella app -> Profile -> Link WhatsApp/Telegram.',
    sub_others_help: 'I can help you manage properties, payments, maintenance, and documents. Just type what you need in plain English, or use the menu buttons for shortcuts. Type "menu" anytime to see the main menu.',
    sub_others_contact: 'To contact your landlord or tenant, type: "message [name]" and I will help you reach them.',
    sub_others_chat: 'Just type anything! I am here to help with your property management needs.',
  };

  const reply = actions[buttonId] ?? 'I did not recognize that option. Type "menu" to see available options.';

  // For PDF report, show year picker buttons instead of text
  if (buttonId === 'sub_history_pdf') {
    const currentYear = new Date().getFullYear();
    return {
      reply,
      buttons: [
        [{ id: `pdf_year_${currentYear - 2}`, title: `${currentYear - 2}` }],
        [{ id: `pdf_year_${currentYear - 1}`, title: `${currentYear - 1}` }],
        [{ id: `pdf_year_${currentYear}`, title: `${currentYear}` }],
      ],
    };
  }

  // Add back button for all sub-actions
  return {
    reply,
    buttons: [[{ id: 'back_main', title: 'Main Menu' }]],
  };
}

/**
 * Builds month picker messages for PDF year selection.
 * Months split into groups of 3 per D-23.
 */
function buildMonthPickerMessages(year: number): ButtonResponse[] {
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];
  const messages: ButtonResponse[] = [];
  for (let i = 0; i < 12; i += 3) {
    const chunk = months.slice(i, i + 3);
    const page = Math.floor(i / 3) + 1;
    messages.push({
      reply: `Pick a month for ${year} (${page}/4):`,
      buttons: chunk.map((m, j) => [{
        id: `pdf_month_${year}_${String(i + j + 1).padStart(2, '0')}`,
        title: m,
      }]),
    });
  }
  return messages;
}

/**
 * Handles PDF report generation for the selected month.
 * Calls the generate-pdf Edge Function and returns document delivery instructions.
 */
async function handlePdfGeneration(buttonId: string, userId: string): Promise<ButtonResponse[]> {
  // Parse year and month from button_id: pdf_month_2025_03
  const parts = buttonId.replace('pdf_month_', '').split('_');
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10);

  if (isNaN(year) || isNaN(month) || month < 1 || month > 12) {
    return [{ reply: 'Invalid month/year selection. Please try again from the menu.' }];
  }

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];
  const monthName = monthNames[month - 1];

  try {
    const res = await fetch(GENERATE_PDF_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
      },
      body: JSON.stringify({ user_id: userId, year, month }),
    });

    const data = await res.json();

    if (data.error === 'no_data') {
      return [{
        reply: data.message ?? `No data found for ${monthName} ${year}.`,
        buttons: [[{ id: 'sub_history_pdf', title: 'Try Another Month' }], [{ id: 'back_main', title: 'Main Menu' }]],
      }];
    }

    if (!res.ok || data.error) {
      return [{
        reply: `Sorry, I could not generate the report for ${monthName} ${year}. Please try again later.`,
        buttons: [[{ id: 'back_main', title: 'Main Menu' }]],
      }];
    }

    // Return document delivery instruction — the webhook will use signed_url to send document
    return [{
      reply: `Your payment report for ${monthName} ${year} is ready!`,
      document: {
        url: data.signed_url,
        filename: data.filename,
        caption: data.caption,
      },
      buttons: [[{ id: 'sub_history_pdf', title: 'Another Report' }], [{ id: 'back_main', title: 'Main Menu' }]],
    }];
  } catch (err) {
    console.error('PDF generation request error:', err);
    return [{
      reply: 'Sorry, something went wrong generating your report. Please try again later.',
      buttons: [[{ id: 'back_main', title: 'Main Menu' }]],
    }];
  }
}

/**
 * BUTTON_LOOKUP dispatch — maps button_id prefixes to handler functions.
 * Returns array of ButtonResponse (multi-message support).
 * Per D-14: bypasses Claude entirely.
 */
async function handleButtonPress(buttonId: string, userId?: string): Promise<ButtonResponse[]> {
  // Main menu back navigation
  if (buttonId === 'back_main') return buildMainMenu();
  // Main menu categories
  if (buttonId.startsWith('menu_')) {
    const category = buttonId.replace('menu_', '');
    return buildSubMenu(category);
  }
  // Sub-option actions
  if (buttonId.startsWith('sub_')) {
    return [handleSubAction(buttonId)];
  }
  // PDF year picker
  if (buttonId.startsWith('pdf_year_')) {
    const year = parseInt(buttonId.replace('pdf_year_', ''), 10);
    return buildMonthPickerMessages(year);
  }
  // PDF month picker — trigger generation
  if (buttonId.startsWith('pdf_month_') && userId) {
    return await handlePdfGeneration(buttonId, userId);
  }
  // Unknown button
  return [{ reply: 'I did not recognize that button. Type "menu" to see options.' }];
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
    .ilike('tenant_name', `%${tenantName.slice(0, 200)}%`);

  if (!tenants || tenants.length === 0) return null;
  return { tenant: tenants[0], property: tenants[0].properties };
}

const handleLogPayment: ActionHandler = async (supabase, userId, entities) => {
  const { tenant_name, amount, status } = entities as {
    tenant_name?: string;
    amount?: number | string;
    status?: string;
  };
  // Support both single month and multiple months
  const rawMonth = entities.month as number | string | undefined;
  const rawMonths = entities.months as (number | string)[] | undefined;
  const rawYear = entities.year as number | string | undefined;

  if (!tenant_name) return 'I need the tenant name to log a payment.';

  const result = await findTenantByName(supabase, userId, tenant_name);
  if (!result) return `Could not find a tenant matching "${tenant_name}" in your properties.`;

  const { tenant, property } = result;
  if (!(await verifyOwnership(supabase, userId, property.id))) {
    return 'You do not own this property.';
  }

  const now = new Date();
  const payYear = rawYear ? Number(rawYear) : now.getFullYear();
  const payAmount = amount ? Number(amount) : (tenant.monthly_rent ?? 0);

  // Build list of months to process
  let monthsList: number[] = [];
  if (rawMonths && Array.isArray(rawMonths)) {
    monthsList = rawMonths.map((m) => Number(m));
  } else if (rawMonth) {
    monthsList = [Number(rawMonth)];
  } else {
    monthsList = [now.getMonth() + 1];
  }

  const results: string[] = [];

  for (const payMonth of monthsList) {
    // Find existing payment row, or create one if it doesn't exist
    let { data: payment } = await supabase
      .from('payments')
      .select('*')
      .eq('tenant_id', tenant.id)
      .eq('month', payMonth)
      .eq('year', payYear)
      .single();

    if (!payment) {
      const dueDay = Math.min(tenant.due_day ?? 1, 28);
      const dueDate = `${payYear}-${String(payMonth).padStart(2, '0')}-${String(dueDay).padStart(2, '0')}`;
      const { data: newPayment, error: createErr } = await supabase
        .from('payments')
        .insert({
          tenant_id: tenant.id,
          property_id: property.id,
          month: payMonth,
          year: payYear,
          due_date: dueDate,
          amount_due: tenant.monthly_rent ?? 0,
          amount_paid: 0,
          status: 'pending',
        })
        .select()
        .single();

      if (createErr || !newPayment) {
        results.push(`${payMonth}/${payYear}: Failed to create record — ${createErr?.message ?? 'unknown error'}`);
        continue;
      }
      payment = newPayment;
    }

    if (payment.status === 'confirmed') {
      results.push(`${payMonth}/${payYear}: Already confirmed`);
      continue;
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

    if (error) {
      results.push(`${payMonth}/${payYear}: Failed — ${error.message}`);
    } else {
      results.push(`${payMonth}/${payYear}: Marked as ${newStatus} (Rs.${newAmountPaid})`);
    }
  }

  return `Payment update for ${tenant.tenant_name}:\n${results.join('\n')}`;
};

const handleConfirmPayment: ActionHandler = async (supabase, userId, entities) => {
  const { tenant_name } = entities as { tenant_name?: string };
  const rawMonth = entities.month as number | string | undefined;
  const rawYear = entities.year as number | string | undefined;

  if (!tenant_name) return 'I need the tenant name to confirm a payment.';

  const result = await findTenantByName(supabase, userId, tenant_name);
  if (!result) return `Could not find a tenant matching "${tenant_name}".`;

  const { tenant, property } = result;
  if (!(await verifyOwnership(supabase, userId, property.id))) {
    return 'You do not own this property.';
  }

  const now = new Date();
  const payMonth = rawMonth ? Number(rawMonth) : (now.getMonth() + 1);
  const payYear = rawYear ? Number(rawYear) : now.getFullYear();

  let { data: payment } = await supabase
    .from('payments')
    .select('*')
    .eq('tenant_id', tenant.id)
    .eq('month', payMonth)
    .eq('year', payYear)
    .single();

  if (!payment) return `No payment record found for ${tenant.tenant_name} (${payMonth}/${payYear}). Try logging the payment first.`;
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
    body: `Hi ${tenant.tenant_name}, this is a friendly reminder about your rent payment for ${property.name} (Flat ${tenant.flat_no}). Your monthly rent is Rs.${tenant.monthly_rent}.`,
  });

  if (error) return `Failed to send reminder: ${error.message}`;
  return `Reminder sent to ${tenant.tenant_name}!`;
};

const ACTION_HANDLERS: Record<string, ActionHandler> = {
  log_payment: handleLogPayment,
  add_property: handleAddProperty,
  add_tenant: handleAddTenant,
  send_reminder: handleSendReminder,
  confirm_payment: handleConfirmPayment,
};


// ----------------------------------------------------------------
// Sanitize user-controlled strings for Claude context (SEC-06)
// ----------------------------------------------------------------
/**
 * XML-escape user-controlled strings and truncate to prevent prompt injection
 * and context stuffing. Preserves apostrophes, accented chars, #, etc.
 * Only escapes XML metacharacters: &, <, > (SEC-06)
 */
function sanitizeForContext(value: string, maxLength = 200): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .slice(0, maxLength);
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
      ctx += `\nProperty: <property_name>${sanitizeForContext(p.name)}</property_name> (ID: ${p.id}), <property_address>${sanitizeForContext(p.address)}</property_address>, <property_city>${sanitizeForContext(p.city)}</property_city>. Total units: ${p.total_units}. Active tenants: ${tenants.length}.\n`;
      for (const t of tenants as Record<string, unknown>[]) {
        const payments = (t['payments'] as Record<string, unknown>[]) ?? [];
        const currentPayment = payments.find(
          (pay) => pay['month'] === currentMonth && pay['year'] === currentYear
        );
        ctx += `  Tenant: <tenant_name>${sanitizeForContext(t['tenant_name'] as string)}</tenant_name> (ID: ${t['id']}), Flat <flat_no>${sanitizeForContext(String(t['flat_no']))}</flat_no>, Rent: Rs.${t['monthly_rent']}/mo, Due day: ${t['due_day']}.\n`;
        if (currentPayment) {
          ctx += `    This month payment: status=${currentPayment['status']}, due=Rs.${currentPayment['amount_due']}, paid=Rs.${currentPayment['amount_paid']}.\n`;
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
      ctx += `\nProperty: <property_name>${sanitizeForContext(String(prop?.['name'] ?? ''))}</property_name> (<property_address>${sanitizeForContext(String(prop?.['address'] ?? ''))}</property_address>). Flat <flat_no>${sanitizeForContext(String(t.flat_no))}</flat_no>. Rent: Rs.${t.monthly_rent}/mo, Due day: ${t.due_day}.\n`;
      if (currentPayment) {
        ctx += `  This month payment: status=${currentPayment['status']}, due=Rs.${currentPayment['amount_due']}, paid=Rs.${currentPayment['amount_paid']}.\n`;
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
// Call Claude API
// ----------------------------------------------------------------
async function callClaude(context: string, history: { role: string; content: string }[], userMessage: string): Promise<ClaudeIntent> {
  const systemPrompt = `You are Dwella Assistant, an AI helper for a rental property management app called Dwella.

You help landlords and tenants with: checking payment status, viewing tenant info, understanding rent history, general property questions, AND executing actions like logging payments, adding properties/tenants, confirming payments, and sending reminders.

PROPERTY/TENANT CONTEXT (refreshed for this request):
${context}

AVAILABLE ACTIONS — You can perform these for the user:
- log_payment: Log a tenant's rent payment. Entities: { tenant_name, month?, months? (array of month numbers for multiple months e.g. [1,2,3]), year?, amount?, status? }
- confirm_payment: Confirm a paid payment. Entities: { tenant_name, month?, year? }
- add_property: Add a new property. Entities: { name, address?, city?, total_units? }
- add_tenant: Add a tenant to a property. Entities: { property_name, tenant_name, flat_no?, monthly_rent?, due_day? }
- send_reminder: Send a rent reminder to a tenant. Entities: { tenant_name }

QUERY INTENTS (no action needed):
- query_status, query_summary, query_overdue, query_tenant, general_chat

RESPONSE FORMAT: Always respond with valid JSON matching this schema:
{
  "intent": "<one of the action or query intents above>",
  "entities": { <relevant key-value pairs for the action> },
  "action_description": "<what you understood the user wants>",
  "needs_confirmation": false,
  "reply": "<friendly natural language reply — for actions, briefly describe what you're doing. The system will execute and append the result automatically.>"
}

RULES:
- For action intents, extract as many entities as possible from the message and context.
- If the user says a tenant name, match it to the tenant list in context. Use the exact name from context.
- If month/year is not specified for payment actions, default to the current month/year.
- If amount is not specified for log_payment, default to the tenant's monthly_rent.
- Always set needs_confirmation: false. Actions are executed immediately.
- Do NOT ask "Should I go ahead?" — just describe what you're doing. The result will be appended automatically.
- Keep replies concise and conversational. Use Rs. for Indian Rupees. Format dates as DD MMM YYYY.`;

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
    const parsed = JSON.parse(jsonStr.trim());
    if (!isValidClaudeIntent(parsed)) {
      // Fall back to general_chat — never execute DB action on invalid shape
      return {
        intent: 'general_chat',
        entities: {},
        action_description: 'general response',
        needs_confirmation: false,
        reply: typeof parsed?.reply === 'string' ? parsed.reply : rawContent,
      };
    }
    return parsed;
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
    const { user_id, message, button_id } = body;

    if (!user_id || !message) {
      return new Response(JSON.stringify({ error: 'user_id and message required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // ---- Button dispatch — bypass Claude entirely (per D-14) ----
    if (button_id) {
      const responses = await handleButtonPress(button_id, user_id);
      return jsonResponse({
        reply: responses[0]?.reply ?? '',
        buttons: responses[0]?.buttons,
        document: responses[0]?.document,
        // Include additional messages if multi-message response
        ...(responses.length > 1 ? { additional_messages: responses.slice(1) } : {}),
      });
    }

    // ---- "menu" or "help" text — show main menu (per D-08) ----
    if (/^(menu|help)$/i.test(message.trim())) {
      const menuMessages = buildMainMenu();
      return jsonResponse({
        reply: menuMessages[0].reply,
        buttons: menuMessages[0].buttons,
        ...(menuMessages.length > 1 ? { additional_messages: menuMessages.slice(1) } : {}),
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // Build context + history in parallel
    const [context, history] = await Promise.all([
      buildContext(supabase, user_id),
      getHistory(supabase, user_id),
    ]);

    // Call Claude to understand intent
    const result = await callClaude(context, history, message);

    const handler = ACTION_HANDLERS[result.intent];

    // After building reply, append menu for re-navigation (per D-07)
    const menuMessages = buildMainMenu();

    if (handler) {
      // Execute the action immediately and return the real result
      const actionResult = await handler(supabase, user_id, result.entities);
      const reply = `${result.reply}\n\n${actionResult}`;
      await saveMessages(supabase, user_id, message, reply);
      return jsonResponse({
        reply,
        intent: result.intent,
        action_taken: result.action_description,
        additional_messages: menuMessages,
      });
    } else {
      // Query intent — return reply as-is
      await saveMessages(supabase, user_id, message, result.reply);
      return jsonResponse({
        reply: result.reply,
        intent: result.intent,
        action_taken: result.action_description,
        additional_messages: menuMessages,
      });
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
