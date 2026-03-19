import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY')!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

interface SearchFilters {
  type: 'payments' | 'tenants' | 'properties';
  status?: string;
  tenant_name?: string;
  property_name?: string;
  month?: number;
  year?: number;
  min_amount?: number;
  max_amount?: number;
  explanation: string;
}

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
    const { user_id, query } = await req.json() as { user_id: string; query: string };

    if (!user_id || !query) {
      return new Response(JSON.stringify({ error: 'user_id and query required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const now = new Date();

    // Step 1: Ask Claude to parse the natural language query into filters
    const systemPrompt = `You parse natural language search queries about rental properties into structured filters. Return JSON:
{
  "type": "payments" | "tenants" | "properties",
  "status": "<optional: pending|partial|paid|confirmed|overdue>",
  "tenant_name": "<optional: partial name match>",
  "property_name": "<optional: partial name match>",
  "month": <optional: 1-12>,
  "year": <optional: e.g. 2026>,
  "min_amount": <optional: number>,
  "max_amount": <optional: number>,
  "explanation": "<what you understood from the query>"
}
Today is ${now.toISOString().split('T')[0]}. Current month: ${now.getMonth() + 1}/${now.getFullYear()}.
If the user says "this month", use current month/year. If "last month", use previous month.
Only include fields that are relevant to the query.`;

    const parseResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 256,
        system: systemPrompt,
        messages: [{ role: 'user', content: query }],
      }),
    });

    if (!parseResponse.ok) {
      const err = await parseResponse.text();
      throw new Error(`Claude API error: ${parseResponse.status} ${err}`);
    }

    const parseData = await parseResponse.json();
    const rawContent: string = parseData.content?.[0]?.text ?? '{}';
    const jsonMatch = rawContent.match(/```(?:json)?\s*([\s\S]*?)```/) ?? rawContent.match(/(\{[\s\S]*\})/);
    const jsonStr = jsonMatch ? jsonMatch[1] : rawContent;
    let filters: SearchFilters;
    try {
      const parsed = JSON.parse(jsonStr.trim());
      // Validate type field is one of the expected values
      const validTypes = ['payments', 'tenants', 'properties'];
      if (!parsed || typeof parsed !== 'object' || !validTypes.includes(parsed.type)) {
        console.error('ai-search: invalid filter type from Claude:', parsed?.type);
        // Default to properties search as safest fallback
        filters = { type: 'properties', explanation: 'Could not parse search query' };
      } else {
        filters = parsed as SearchFilters;
      }
    } catch {
      console.error('ai-search: failed to parse Claude response:', jsonStr);
      return new Response(JSON.stringify({ error: 'Failed to parse search query' }), {
        status: 502,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    }

    // Step 2: Execute the structured query
    // First get user's property IDs for scoping
    const { data: userProperties } = await supabase
      .from('properties')
      .select('id, name')
      .eq('owner_id', user_id)
      .eq('is_archived', false);

    const propertyIds = (userProperties ?? []).map((p: any) => p.id);

    let results: any[] = [];

    if (filters.type === 'payments') {
      let q = supabase
        .from('payments')
        .select('*, tenants!inner(tenant_name, flat_no, property_id, properties!inner(name))')
        .in('property_id', propertyIds)
        .order('due_date', { ascending: false })
        .limit(50);

      if (filters.status) q = q.eq('status', filters.status);
      if (filters.month) q = q.eq('month', filters.month);
      if (filters.year) q = q.eq('year', filters.year);
      if (filters.min_amount) q = q.gte('amount_due', filters.min_amount);
      if (filters.max_amount) q = q.lte('amount_due', filters.max_amount);
      if (filters.tenant_name) q = q.ilike('tenants.tenant_name', `%${filters.tenant_name}%`);

      const { data } = await q;
      results = (data ?? []).map((p: any) => ({
        type: 'payment',
        id: p.id,
        tenant_name: p.tenants?.tenant_name,
        flat_no: p.tenants?.flat_no,
        property_name: p.tenants?.properties?.name,
        month: p.month,
        year: p.year,
        amount_due: p.amount_due,
        amount_paid: p.amount_paid,
        status: p.status,
        due_date: p.due_date,
      }));
    } else if (filters.type === 'tenants') {
      let q = supabase
        .from('tenants')
        .select('*, properties!inner(name)')
        .in('property_id', propertyIds)
        .eq('is_archived', false)
        .limit(50);

      if (filters.tenant_name) q = q.ilike('tenant_name', `%${filters.tenant_name}%`);
      if (filters.property_name) q = q.ilike('properties.name', `%${filters.property_name}%`);

      const { data } = await q;
      results = (data ?? []).map((t: any) => ({
        type: 'tenant',
        id: t.id,
        tenant_name: t.tenant_name,
        flat_no: t.flat_no,
        property_name: t.properties?.name,
        monthly_rent: t.monthly_rent,
        due_day: t.due_day,
        invite_status: t.invite_status,
      }));
    } else {
      let q = supabase
        .from('properties')
        .select('*')
        .eq('owner_id', user_id)
        .eq('is_archived', false)
        .limit(50);

      if (filters.property_name) q = q.ilike('name', `%${filters.property_name}%`);

      const { data } = await q;
      results = (data ?? []).map((p: any) => ({
        type: 'property',
        id: p.id,
        name: p.name,
        address: p.address,
        city: p.city,
        total_units: p.total_units,
      }));
    }

    return new Response(JSON.stringify({
      explanation: filters.explanation,
      filters,
      results,
      count: results.length,
    }), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  } catch (err) {
    console.error('ai-search error:', err);
    return new Response(JSON.stringify({ error: 'Internal server error', details: String(err) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }
});
