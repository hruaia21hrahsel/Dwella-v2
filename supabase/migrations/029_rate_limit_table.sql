-- Rate limiting table for public edge functions (SEC-05)
-- Fixed-window counter: IP + function + minute window -> count

CREATE TABLE IF NOT EXISTS rate_limits (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  ip_address text NOT NULL,
  function_name text NOT NULL,
  window_start timestamptz NOT NULL,
  request_count int NOT NULL DEFAULT 1,
  UNIQUE(ip_address, function_name, window_start)
);

-- Index for fast lookups during rate-limit checks
CREATE INDEX idx_rate_limits_lookup
  ON rate_limits (ip_address, function_name, window_start);

-- RPC function: atomic increment-or-insert, returns true if under limit
CREATE OR REPLACE FUNCTION check_rate_limit(
  p_ip text,
  p_function_name text,
  p_window_start timestamptz,
  p_max_requests int
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  current_count int;
BEGIN
  INSERT INTO rate_limits (ip_address, function_name, window_start, request_count)
  VALUES (p_ip, p_function_name, p_window_start, 1)
  ON CONFLICT (ip_address, function_name, window_start)
  DO UPDATE SET request_count = rate_limits.request_count + 1
  RETURNING request_count INTO current_count;

  RETURN current_count <= p_max_requests;
END;
$$;

-- Cleanup function: delete entries older than 1 hour (called periodically)
CREATE OR REPLACE FUNCTION cleanup_rate_limits()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM rate_limits WHERE window_start < NOW() - INTERVAL '1 hour';
END;
$$;
