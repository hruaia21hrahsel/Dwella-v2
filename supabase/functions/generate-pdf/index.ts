// SETUP: Requires 'pdf-reports' Supabase Storage bucket (private).
// Create via: Supabase Dashboard → Storage → New bucket → "pdf-reports" → Private
// Also requires HTML2PDF_API_KEY env var set in Supabase secrets.

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const HTML2PDF_API_KEY = Deno.env.get('HTML2PDF_API_KEY')!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

interface GeneratePdfRequest {
  user_id: string;
  year: number;
  month: number;
}

// ── Fetch payment data for the report ───────────────────────────────

async function fetchReportData(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  year: number,
  month: number,
) {
  // Get all properties owned by user with tenants and payments for the month
  const { data: properties } = await supabase
    .from('properties')
    .select('id, name, address, city, tenants!inner(id, tenant_name, flat_no, monthly_rent, payments(*))')
    .eq('owner_id', userId)
    .eq('is_archived', false);

  if (!properties || properties.length === 0) return null;

  // Filter payments to the requested month/year
  const reportData = properties.map((prop: any) => {
    const tenants = (prop.tenants ?? []).map((t: any) => {
      const payment = (t.payments ?? []).find(
        (p: any) => p.month === month && p.year === year,
      );
      return {
        name: t.tenant_name,
        flat: t.flat_no,
        rent: t.monthly_rent,
        status: payment?.status ?? 'no record',
        amountPaid: payment?.amount_paid ?? 0,
        amountDue: payment?.amount_due ?? t.monthly_rent,
        paidAt: payment?.paid_at ?? null,
      };
    });
    return {
      propertyName: prop.name,
      address: prop.address,
      city: prop.city,
      tenants,
    };
  });

  return reportData;
}

// ── Build HTML for the report ───────────────────────────────────────

function buildReportHtml(
  reportData: Array<{
    propertyName: string;
    address: string;
    city: string;
    tenants: Array<{
      name: string;
      flat: string;
      rent: number;
      status: string;
      amountPaid: number;
      amountDue: number;
      paidAt: string | null;
    }>;
  }>,
  year: number,
  month: number,
): string {
  const monthName = MONTH_NAMES[month - 1] ?? 'Unknown';

  let totalExpected = 0;
  let totalCollected = 0;

  const propertyRows = reportData.map((prop) => {
    const tenantRows = prop.tenants.map((t) => {
      totalExpected += t.amountDue;
      totalCollected += t.amountPaid;

      const statusColor: Record<string, string> = {
        pending: '#94A3B8',
        partial: '#F59E0B',
        paid: '#3B82F6',
        confirmed: '#10B981',
        overdue: '#EF4444',
        'no record': '#CBD5E1',
      };
      const color = statusColor[t.status] ?? '#94A3B8';
      const paidDate = t.paidAt
        ? new Date(t.paidAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
        : '-';

      return `
        <tr>
          <td style="padding:8px;border-bottom:1px solid #E2E8F0;">${escapeHtml(t.name)}</td>
          <td style="padding:8px;border-bottom:1px solid #E2E8F0;">${escapeHtml(t.flat)}</td>
          <td style="padding:8px;border-bottom:1px solid #E2E8F0;text-align:right;">&#8377;${t.amountDue.toLocaleString('en-IN')}</td>
          <td style="padding:8px;border-bottom:1px solid #E2E8F0;text-align:right;">&#8377;${t.amountPaid.toLocaleString('en-IN')}</td>
          <td style="padding:8px;border-bottom:1px solid #E2E8F0;"><span style="color:${color};font-weight:600;">${t.status.toUpperCase()}</span></td>
          <td style="padding:8px;border-bottom:1px solid #E2E8F0;">${paidDate}</td>
        </tr>`;
    }).join('');

    return `
      <h3 style="color:#4F46E5;margin:24px 0 8px;">${escapeHtml(prop.propertyName)}</h3>
      <p style="color:#64748B;font-size:13px;margin:0 0 12px;">${escapeHtml(prop.address)}${prop.city ? ', ' + escapeHtml(prop.city) : ''}</p>
      <table style="width:100%;border-collapse:collapse;font-size:14px;">
        <thead>
          <tr style="background:#F1F5F9;">
            <th style="padding:8px;text-align:left;">Tenant</th>
            <th style="padding:8px;text-align:left;">Flat</th>
            <th style="padding:8px;text-align:right;">Due</th>
            <th style="padding:8px;text-align:right;">Paid</th>
            <th style="padding:8px;text-align:left;">Status</th>
            <th style="padding:8px;text-align:left;">Date Paid</th>
          </tr>
        </thead>
        <tbody>${tenantRows}</tbody>
      </table>`;
  }).join('');

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #1E293B; padding: 32px; max-width: 800px; margin: 0 auto; }
    h1 { color: #4F46E5; font-size: 24px; margin-bottom: 4px; }
    .subtitle { color: #64748B; font-size: 14px; margin-bottom: 24px; }
    .summary-box { background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 8px; padding: 16px; margin: 24px 0; display: flex; gap: 32px; }
    .summary-item { text-align: center; }
    .summary-label { font-size: 12px; color: #64748B; text-transform: uppercase; }
    .summary-value { font-size: 20px; font-weight: 700; color: #1E293B; }
    .footer { margin-top: 32px; padding-top: 16px; border-top: 1px solid #E2E8F0; font-size: 12px; color: #94A3B8; }
  </style>
</head>
<body>
  <h1>Dwella Payment Report</h1>
  <p class="subtitle">${monthName} ${year}</p>

  <div class="summary-box">
    <div class="summary-item">
      <div class="summary-label">Total Expected</div>
      <div class="summary-value">&#8377;${totalExpected.toLocaleString('en-IN')}</div>
    </div>
    <div class="summary-item">
      <div class="summary-label">Total Collected</div>
      <div class="summary-value" style="color:${totalCollected >= totalExpected ? '#10B981' : '#F59E0B'}">&#8377;${totalCollected.toLocaleString('en-IN')}</div>
    </div>
    <div class="summary-item">
      <div class="summary-label">Collection Rate</div>
      <div class="summary-value">${totalExpected > 0 ? Math.round((totalCollected / totalExpected) * 100) : 0}%</div>
    </div>
  </div>

  ${propertyRows}

  <div class="footer">
    Generated by Dwella on ${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
  </div>
</body>
</html>`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ── Convert HTML to PDF via html2pdf.app ────────────────────────────

async function htmlToPdf(html: string): Promise<Uint8Array> {
  const res = await fetch('https://api.html2pdf.app/v1/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ html, apiKey: HTML2PDF_API_KEY }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`html2pdf.app error: ${res.status} ${errText}`);
  }

  // Response field name has LOW confidence — try multiple field names (Open Question 3)
  const data = await res.json();
  const base64Pdf = data.pdf ?? data.base64 ?? data.content ?? data.data;

  if (!base64Pdf || typeof base64Pdf !== 'string') {
    console.error('html2pdf.app response keys:', Object.keys(data));
    throw new Error('html2pdf.app response missing PDF data');
  }

  // Decode base64 to Uint8Array (chunked to avoid stack overflow per Phase 12 pattern)
  const binaryString = atob(base64Pdf);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

// ── Handler ─────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: CORS_HEADERS });
  }

  const jsonHeaders = { 'Content-Type': 'application/json', ...CORS_HEADERS };

  try {
    const body: GeneratePdfRequest = await req.json();
    const { user_id, year, month } = body;

    if (!user_id || !year || !month) {
      return new Response(
        JSON.stringify({ error: 'user_id, year, and month required' }),
        { status: 400, headers: jsonHeaders },
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // Fetch payment data
    const reportData = await fetchReportData(supabase, user_id, year, month);
    if (!reportData || reportData.length === 0) {
      return new Response(
        JSON.stringify({ error: 'no_data', message: `No property data found for ${MONTH_NAMES[month - 1]} ${year}` }),
        { status: 200, headers: jsonHeaders },
      );
    }

    // Build HTML and convert to PDF
    const html = buildReportHtml(reportData, year, month);
    const pdfBytes = await htmlToPdf(html);

    // Upload to Supabase Storage
    const storagePath = `${user_id}/${year}-${String(month).padStart(2, '0')}.pdf`;
    const { error: uploadErr } = await supabase.storage
      .from('pdf-reports')
      .upload(storagePath, pdfBytes, {
        contentType: 'application/pdf',
        upsert: true,
      });

    if (uploadErr) {
      throw new Error(`Storage upload error: ${uploadErr.message}`);
    }

    // Create signed URL (1 hour expiry per D-24)
    const { data: signedData, error: signedErr } = await supabase.storage
      .from('pdf-reports')
      .createSignedUrl(storagePath, 3600);

    if (signedErr || !signedData?.signedUrl) {
      throw new Error(`Signed URL error: ${signedErr?.message ?? 'no URL returned'}`);
    }

    const monthName = MONTH_NAMES[month - 1];
    return new Response(
      JSON.stringify({
        success: true,
        signed_url: signedData.signedUrl,
        filename: `Dwella-${year}-${String(month).padStart(2, '0')}.pdf`,
        caption: `Payment report for ${monthName} ${year}`,
      }),
      { status: 200, headers: jsonHeaders },
    );
  } catch (err) {
    console.error('generate-pdf error:', err);
    return new Response(
      JSON.stringify({ error: 'PDF generation failed', details: String(err) }),
      { status: 500, headers: jsonHeaders },
    );
  }
});
