-- Trigger: notify on maintenance_requests status change via pg_net
-- Fires AFTER UPDATE (not BEFORE — BEFORE is used for state machine validation in 022)
-- Guards on status change only (Pitfall 2)

CREATE OR REPLACE FUNCTION public.notify_maintenance_status_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    PERFORM net.http_post(
      url := current_setting('app.settings.supabase_url') || '/functions/v1/notify-whatsapp',
      headers := jsonb_build_object(
        'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key'),
        'Content-Type', 'application/json'
      ),
      body := jsonb_build_object(
        'request_id', NEW.id,
        'tenant_id', NEW.tenant_id,
        'property_id', NEW.property_id,
        'old_status', OLD.status,
        'new_status', NEW.status,
        'title', NEW.title
      )
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER notify_maintenance_status_change
  AFTER UPDATE ON public.maintenance_requests
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION public.notify_maintenance_status_change();
