import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// ── Env vars ────────────────────────────────────────────────────────
const WHATSAPP_ACCESS_TOKEN = Deno.env.get('WHATSAPP_ACCESS_TOKEN')!;
const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY')!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const WHATSAPP_SEND_URL = `${SUPABASE_URL}/functions/v1/whatsapp-send`;

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ── Types ────────────────────────────────────────────────────────────

interface WhatsAppMediaRequest {
  user_id: string;
  phone: string;
  msg_type: 'image' | 'document';
  media: {
    id: string;
    mime_type?: string;
    caption?: string;
    filename?: string;
    sha256?: string;
  };
}

interface ClassifyResult {
  is_payment_proof: boolean;
  tenant_name?: string | null;
  month?: number | null;
  year?: number | null;
  amount?: number | null;
}

interface TenantRow {
  id: string;
  property_id: string;
  tenant_name: string;
  monthly_rent: number;
  due_day: number;
  properties: { owner_id: string } | null;
}

// ── Meta CDN download (two-step) ─────────────────────────────────────

async function getMediaDownloadUrl(mediaId: string): Promise<{ url: string; mime_type: string }> {
  const res = await fetch(`https://graph.facebook.com/v21.0/${mediaId}`, {
    headers: { Authorization: `Bearer ${WHATSAPP_ACCESS_TOKEN}` },
  });
  if (!res.ok) throw new Error(`Media metadata fetch failed: ${res.status}`);
  return await res.json();
}

async function downloadMediaBinary(url: string): Promise<ArrayBuffer> {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${WHATSAPP_ACCESS_TOKEN}` },
  });
  if (!res.ok) throw new Error(`Media binary download failed: ${res.status}`);
  return await res.arrayBuffer();
}

// ── MIME type helper ─────────────────────────────────────────────────

function getExtFromMimeType(mime: string, filename?: string): string {
  const map: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'application/pdf': 'pdf',
    'application/msword': 'doc',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  };
  if (map[mime]) return map[mime];
  // Pitfall 4: application/octet-stream with .pdf filename — treat as pdf
  if (mime === 'application/octet-stream' && filename?.toLowerCase().endsWith('.pdf')) {
    return 'pdf';
  }
  // Final fallback: extract from filename extension
  if (filename) {
    const parts = filename.split('.');
    if (parts.length > 1) return parts[parts.length - 1].toLowerCase();
  }
  return 'bin';
}

// ── Tenant resolution ────────────────────────────────────────────────

async function findTenantForUser(
  supabase: ReturnType<typeof createClient>,
  userId: string,
): Promise<TenantRow | null> {
  const { data: tenants } = await supabase
    .from('tenants')
    .select('id, property_id, tenant_name, monthly_rent, due_day, properties(owner_id)')
    .eq('user_id', userId)
    .eq('is_archived', false);

  if (!tenants || tenants.length === 0) return null;
  if (tenants.length === 1) return tenants[0] as TenantRow;

  // Multiple tenancies — prefer the one with an open payment this month
  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();

  for (const t of tenants) {
    const { data: payment } = await supabase
      .from('payments')
      .select('id, status')
      .eq('tenant_id', t.id)
      .eq('month', currentMonth)
      .eq('year', currentYear)
      .in('status', ['pending', 'partial'])
      .single();
    if (payment) return t as TenantRow;
  }

  return tenants[0] as TenantRow;
}

// ── WhatsApp reply helper ────────────────────────────────────────────

async function sendWhatsApp(to: string, text: string): Promise<void> {
  const res = await fetch(WHATSAPP_SEND_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
    },
    body: JSON.stringify({ to, type: 'text', text }),
  });
  if (!res.ok) {
    const err = await res.text();
    console.error('whatsapp-send error:', err);
  }
}

// ── Claude vision classification ─────────────────────────────────────

async function classifyPaymentProof(
  imageBase64: string,
  mimeType: string,
  caption: string,
  userContext: string,
): Promise<ClassifyResult> {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 256,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: mimeType, data: imageBase64 },
            },
            {
              type: 'text',
              text: `User context (their tenants and payment status):\n${userContext}\n\nUser caption: "${caption}"\n\nIs this a rent payment proof screenshot/photo? If yes, identify: tenant_name (match to context), month (1-12), year (4 digits), amount (number if visible). Reply ONLY with JSON: {"is_payment_proof": bool, "tenant_name": string|null, "month": number|null, "year": number|null, "amount": number|null}`,
            },
          ],
        },
      ],
    }),
  });

  const data = await response.json();
  const raw: string = data?.content?.[0]?.text ?? '{}';
  const json = raw.match(/\{[\s\S]*\}/)?.[0] ?? '{}';
  try {
    return JSON.parse(json) as ClassifyResult;
  } catch {
    return { is_payment_proof: false };
  }
}

// ── Sanitize user-controlled strings for Claude context (SEC-06) ─────

function sanitizeForContext(value: string, maxLength = 200): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .slice(0, maxLength);
}

// ── Build context string from user's properties/tenants/payments ─────
// Copied from process-bot-message/index.ts (lines 368-431)

async function buildContext(
  supabase: ReturnType<typeof createClient>,
  userId: string,
): Promise<string> {
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
          (pay) => pay['month'] === currentMonth && pay['year'] === currentYear,
        );
        ctx += `  Tenant: <tenant_name>${sanitizeForContext(t['tenant_name'] as string)}</tenant_name> (ID: ${t['id']}), Flat <flat_no>${sanitizeForContext(String(t['flat_no']))}</flat_no>, Rent: ₹${t['monthly_rent']}/mo, Due day: ${t['due_day']}.\n`;
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
        (pay) => pay['month'] === currentMonth && pay['year'] === currentYear,
      );
      ctx += `\nProperty: <property_name>${sanitizeForContext(String(prop?.['name'] ?? ''))}</property_name> (<property_address>${sanitizeForContext(String(prop?.['address'] ?? ''))}</property_address>). Flat <flat_no>${sanitizeForContext(String(t.flat_no))}</flat_no>. Rent: ₹${t.monthly_rent}/mo, Due day: ${t.due_day}.\n`;
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

// ── ArrayBuffer to base64 (chunked to avoid stack overflow on large buffers) ──

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let result = '';
  const chunkSize = 8192;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    result += String.fromCharCode(...bytes.slice(i, i + chunkSize));
  }
  return btoa(result);
}

// ── Main handler ─────────────────────────────────────────────────────

serve(async (req) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: CORS_HEADERS });
  }

  const jsonHeaders = { 'Content-Type': 'application/json', ...CORS_HEADERS };

  try {
    const body: WhatsAppMediaRequest = await req.json();

    // Validate required fields
    if (!body.user_id || !body.phone || !body.msg_type || !body.media?.id) {
      console.error('whatsapp-media: missing required fields', { user_id: body.user_id, phone: body.phone, msg_type: body.msg_type, media_id: body.media?.id });
      return new Response(JSON.stringify({ error: 'Missing required fields: user_id, phone, msg_type, media.id' }), {
        status: 200,
        headers: jsonHeaders,
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // Step 1 + 2: Two-step CDN download (must happen immediately — CDN URL expires in ~5 min)
    const { url: cdnUrl, mime_type: cdnMimeType } = await getMediaDownloadUrl(body.media.id);
    const buffer = await downloadMediaBinary(cdnUrl);

    // Resolve effective MIME type: CDN response > webhook payload > filename fallback
    let effectiveMime = cdnMimeType || body.media.mime_type || 'application/octet-stream';
    // Pitfall 4: octet-stream with .pdf filename
    if (effectiveMime === 'application/octet-stream' && body.media.filename?.toLowerCase().endsWith('.pdf')) {
      effectiveMime = 'application/pdf';
    }

    // ── IMAGE path ───────────────────────────────────────────────────
    if (body.msg_type === 'image') {
      // Convert to base64 for Claude vision (chunked to avoid stack overflow)
      const imageBase64 = arrayBufferToBase64(buffer);

      // Build context for classification
      const userContext = await buildContext(supabase, body.user_id);

      // Classify via Claude vision
      const classification = await classifyPaymentProof(
        imageBase64,
        effectiveMime,
        body.media.caption ?? '',
        userContext,
      );

      if (classification.is_payment_proof === true) {
        // Resolve tenant
        const tenant = await findTenantForUser(supabase, body.user_id);

        if (!tenant) {
          await sendWhatsApp(
            body.phone,
            "I couldn't find a linked tenant account for your number. Link your account first in the Dwella app.",
          );
          return new Response(JSON.stringify({ success: true }), { status: 200, headers: jsonHeaders });
        }

        // Determine month/year: prefer classification result, fall back to current month/year
        const now = new Date();
        const month = classification.month ?? (now.getMonth() + 1);
        const year = classification.year ?? now.getFullYear();

        // Storage path
        const storagePath = `${tenant.property_id}/${tenant.id}/${year}-${String(month).padStart(2, '0')}.jpg`;

        // Upload to payment-proofs bucket (upsert: true — allows re-sends for same month)
        const { error: uploadError } = await supabase.storage
          .from('payment-proofs')
          .upload(storagePath, buffer, { contentType: effectiveMime, upsert: true });

        if (uploadError) {
          console.error('whatsapp-media: storage upload error', uploadError);
          await sendWhatsApp(
            body.phone,
            'Something went wrong processing your media. Please try again or use the Dwella app directly.',
          );
          return new Response(JSON.stringify({ error: 'Storage upload failed' }), { status: 200, headers: jsonHeaders });
        }

        // Check if a payment row already exists for this tenant/month/year
        const { data: existingPayment } = await supabase
          .from('payments')
          .select('id, status')
          .eq('tenant_id', tenant.id)
          .eq('month', month)
          .eq('year', year)
          .single();

        let newStatus: string;

        if (existingPayment) {
          // Update proof_url on existing payment row
          await supabase
            .from('payments')
            .update({ proof_url: storagePath, notes: 'Proof attached via WhatsApp' })
            .eq('tenant_id', tenant.id)
            .eq('month', month)
            .eq('year', year);
          newStatus = existingPayment.status as string;
        } else {
          // No payment row exists — create one with status 'paid'
          const dueDate = new Date(year, month - 1, tenant.due_day ?? 1).toISOString().split('T')[0];
          await supabase.from('payments').insert({
            tenant_id: tenant.id,
            month,
            year,
            status: 'paid',
            amount_paid: classification.amount ?? tenant.monthly_rent ?? 0,
            amount_due: tenant.monthly_rent ?? 0,
            due_date: dueDate,
            proof_url: storagePath,
            notes: 'Proof attached via WhatsApp',
          });
          newStatus = 'paid';
        }

        const monthName = new Date(year, month - 1).toLocaleString('en', { month: 'long' });
        await sendWhatsApp(
          body.phone,
          `Got it! I've attached your payment photo as proof for ${monthName} ${year}. Your payment is now recorded as "${newStatus}".`,
        );
      } else {
        // Classification returned false — could not identify as payment proof
        await sendWhatsApp(
          body.phone,
          "I couldn't tell if this photo is a payment receipt. If it is, add a caption like \"payment for March\" and send again, or log the payment via text: \"Mark Ravi's March rent as paid\"",
        );
      }

      return new Response(JSON.stringify({ success: true }), { status: 200, headers: jsonHeaders });
    }

    // ── DOCUMENT path ────────────────────────────────────────────────
    if (body.msg_type === 'document') {
      // Find tenant (primary) or check if owner (property-level doc)
      const tenant = await findTenantForUser(supabase, body.user_id);

      let propertyId: string | null = null;
      let tenantId: string | null = null;

      if (tenant) {
        propertyId = tenant.property_id;
        tenantId = tenant.id;
      } else {
        // Check if user is a property owner
        const { data: ownedProperties } = await supabase
          .from('properties')
          .select('id')
          .eq('owner_id', body.user_id)
          .eq('is_archived', false)
          .limit(1);

        if (ownedProperties && ownedProperties.length > 0) {
          propertyId = ownedProperties[0].id as string;
          tenantId = null; // property-level doc
        }
      }

      if (!propertyId) {
        await sendWhatsApp(
          body.phone,
          "I couldn't find a linked tenant account for your number. Link your account first in the Dwella app.",
        );
        return new Response(JSON.stringify({ success: true }), { status: 200, headers: jsonHeaders });
      }

      const ext = getExtFromMimeType(effectiveMime, body.media.filename);
      const filename = `${crypto.randomUUID()}.${ext}`;
      const storagePath = tenantId
        ? `${propertyId}/${tenantId}/${filename}`
        : `${propertyId}/property/${filename}`;

      // Upload to documents bucket
      const { error: docUploadError } = await supabase.storage
        .from('documents')
        .upload(storagePath, buffer, { contentType: effectiveMime });

      if (docUploadError) {
        console.error('whatsapp-media: document upload error', docUploadError);
        await sendWhatsApp(
          body.phone,
          'Something went wrong processing your media. Please try again or use the Dwella app directly.',
        );
        return new Response(JSON.stringify({ error: 'Document upload failed' }), { status: 200, headers: jsonHeaders });
      }

      // Insert documents row
      await supabase.from('documents').insert({
        property_id: propertyId,
        tenant_id: tenantId ?? null,
        uploader_id: body.user_id,
        name: body.media.filename ?? filename,
        category: 'other',
        storage_path: storagePath,
        mime_type: effectiveMime,
        file_size: buffer.byteLength,
      });

      const displayName = body.media.filename ?? filename;
      await sendWhatsApp(
        body.phone,
        `Your document "${displayName}" has been saved to your property files. You can view it in the Dwella app under Documents.`,
      );

      return new Response(JSON.stringify({ success: true }), { status: 200, headers: jsonHeaders });
    }

    // ── Unsupported media type ────────────────────────────────────────
    await sendWhatsApp(
      body.phone,
      'I can only accept photos (payment proofs) and documents (PDFs, Word files). For other requests, just type your message.',
    );

    return new Response(JSON.stringify({ success: true }), { status: 200, headers: jsonHeaders });
  } catch (err) {
    console.error('whatsapp-media error:', err);
    try {
      // Best-effort reply — phone may not be available if parse failed
      const raw = await req.text().catch(() => '{}');
      const parsed = JSON.parse(raw) as Partial<WhatsAppMediaRequest>;
      if (parsed.phone) {
        await sendWhatsApp(
          parsed.phone,
          'Something went wrong processing your media. Please try again or use the Dwella app directly.',
        );
      }
    } catch {
      // Ignore secondary errors in error handler
    }
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
    });
  }
});
