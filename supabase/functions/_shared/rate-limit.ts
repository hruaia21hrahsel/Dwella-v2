import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

/**
 * Check rate limit for an IP + function combination.
 * Uses a fixed-window counter stored in the rate_limits table.
 * Returns true if request is allowed, false if rate-limited.
 * Fails OPEN on DB errors (allows request through).
 */
export async function checkRateLimit(
  ip: string,
  functionName: string,
  maxRequests: number,
  windowMinutes: number = 1,
): Promise<boolean> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !supabaseKey) return true; // fail open

  const client = createClient(supabaseUrl, supabaseKey);

  // Fixed-window: truncate to minute boundary
  const now = new Date();
  const windowStart = new Date(
    now.getFullYear(), now.getMonth(), now.getDate(),
    now.getHours(), now.getMinutes(), 0, 0
  );

  try {
    const { data, error } = await client.rpc('check_rate_limit', {
      p_ip: ip,
      p_function_name: functionName,
      p_window_start: windowStart.toISOString(),
      p_max_requests: maxRequests,
    });

    if (error) {
      console.error('[rate-limit] check failed:', error.message);
      return true; // fail open
    }

    return data as boolean;
  } catch (err) {
    console.error('[rate-limit] unexpected error:', err);
    return true; // fail open
  }
}

/**
 * Extract client IP from request headers.
 * Supabase Edge Functions set x-forwarded-for.
 */
export function getClientIp(req: Request): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    ?? req.headers.get('x-real-ip')
    ?? 'unknown';
}
