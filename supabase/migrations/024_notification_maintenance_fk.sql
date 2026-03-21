-- Migration 024: Add maintenance_request_id FK to notifications
ALTER TABLE public.notifications
  ADD COLUMN maintenance_request_id uuid
    REFERENCES public.maintenance_requests(id) ON DELETE SET NULL;

CREATE INDEX idx_notifications_maintenance_request
  ON public.notifications(maintenance_request_id)
  WHERE maintenance_request_id IS NOT NULL;
