-- Enable required extensions
create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

-- Auto-confirm payments: every hour
-- Promotes payments marked as 'paid' for >48 hours to 'confirmed'
select cron.schedule(
  'auto-confirm-payments',
  '0 * * * *',
  $$
  select net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/auto-confirm-payments',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key'),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  $$
);

-- Mark overdue payments: daily at midnight UTC
-- Sets pending payments past due_day to 'overdue'
select cron.schedule(
  'mark-overdue',
  '0 0 * * *',
  $$
  select net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/mark-overdue',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key'),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  $$
);

-- Send reminders: daily at 9 AM UTC
-- Reminds tenants 3 days before, on, and 3 days after due_day
select cron.schedule(
  'send-reminders',
  '0 9 * * *',
  $$
  select net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/send-reminders',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key'),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  $$
);
