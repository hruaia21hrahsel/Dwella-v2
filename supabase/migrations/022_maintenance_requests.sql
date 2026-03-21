-- ============================================================
-- Migration 022: Maintenance Requests
-- ============================================================
-- Creates maintenance_requests and maintenance_status_logs tables,
-- BEFORE UPDATE trigger for status transitions, storage bucket,
-- RLS policies, and ALTER TABLE expenses to add FK column.

-- ============================================================
-- TABLE: maintenance_requests
-- ============================================================

CREATE TABLE public.maintenance_requests (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id   uuid NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  tenant_id     uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  title         text NOT NULL,
  description   text NOT NULL,
  priority      text NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'urgent')),
  status        text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'acknowledged', 'in_progress', 'resolved', 'closed')),
  photo_paths   text[] NOT NULL DEFAULT '{}',
  is_archived   boolean NOT NULL DEFAULT FALSE,
  archived_at   timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_maintenance_requests_property ON public.maintenance_requests(property_id) WHERE is_archived = FALSE;
CREATE INDEX idx_maintenance_requests_tenant   ON public.maintenance_requests(tenant_id)   WHERE is_archived = FALSE;
CREATE INDEX idx_maintenance_requests_status   ON public.maintenance_requests(status)       WHERE is_archived = FALSE;

-- ============================================================
-- TABLE: maintenance_status_logs
-- ============================================================

CREATE TABLE public.maintenance_status_logs (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id    uuid NOT NULL REFERENCES public.maintenance_requests(id) ON DELETE CASCADE,
  changed_by    uuid NOT NULL REFERENCES auth.users(id),
  from_status   text,
  to_status     text NOT NULL,
  note          text,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_maintenance_status_logs_request ON public.maintenance_status_logs(request_id);

-- ============================================================
-- ALTER TABLE: expenses — add nullable FK to maintenance_requests
-- ============================================================

ALTER TABLE public.expenses
  ADD COLUMN maintenance_request_id uuid REFERENCES public.maintenance_requests(id) ON DELETE SET NULL;

-- ============================================================
-- TRIGGER: updated_at for maintenance_requests
-- (reuses the set_updated_at() function created in earlier migrations)
-- ============================================================

CREATE TRIGGER set_maintenance_requests_updated_at
  BEFORE UPDATE ON public.maintenance_requests
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- TRIGGER: BEFORE UPDATE status transition enforcement
-- Valid transitions:
--   open         -> acknowledged
--   acknowledged -> in_progress
--   in_progress  -> resolved
--   resolved     -> closed
-- ============================================================

CREATE OR REPLACE FUNCTION public.validate_maintenance_transition()
RETURNS TRIGGER AS $$
BEGIN
  -- Same-status update is always allowed (e.g. updating title without changing status)
  IF OLD.status = NEW.status THEN RETURN NEW; END IF;

  -- Valid transitions
  IF (OLD.status = 'open'         AND NEW.status = 'acknowledged') OR
     (OLD.status = 'acknowledged' AND NEW.status = 'in_progress')  OR
     (OLD.status = 'in_progress'  AND NEW.status = 'resolved')     OR
     (OLD.status = 'resolved'     AND NEW.status = 'closed')
  THEN RETURN NEW; END IF;

  RAISE EXCEPTION 'Invalid maintenance transition: % -> %', OLD.status, NEW.status;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER validate_maintenance_transition
  BEFORE UPDATE ON public.maintenance_requests
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION public.validate_maintenance_transition();

-- ============================================================
-- RLS: maintenance_requests
-- ============================================================

ALTER TABLE public.maintenance_requests ENABLE ROW LEVEL SECURITY;

-- Landlord: read all requests for their properties
CREATE POLICY "maintenance_requests_landlord_select" ON public.maintenance_requests
  FOR SELECT USING (public.is_property_owner(property_id));

-- Tenant: read their own requests
CREATE POLICY "maintenance_requests_tenant_select" ON public.maintenance_requests
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.tenants t
      WHERE t.id = maintenance_requests.tenant_id
        AND t.user_id = auth.uid()
    )
  );

-- Tenant: submit new requests (must own the tenant row)
CREATE POLICY "maintenance_requests_tenant_insert" ON public.maintenance_requests
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.tenants t
      WHERE t.id = tenant_id
        AND t.user_id = auth.uid()
    )
  );

-- Landlord: update status on their properties' requests
CREATE POLICY "maintenance_requests_landlord_update" ON public.maintenance_requests
  FOR UPDATE
  USING (public.is_property_owner(property_id))
  WITH CHECK (public.is_property_owner(property_id));

-- ============================================================
-- RLS: maintenance_status_logs
-- ============================================================

ALTER TABLE public.maintenance_status_logs ENABLE ROW LEVEL SECURITY;

-- Landlord: read all logs for their properties' requests
CREATE POLICY "maintenance_status_logs_landlord_select" ON public.maintenance_status_logs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.maintenance_requests r
      WHERE r.id = request_id
        AND public.is_property_owner(r.property_id)
    )
  );

-- Tenant: read logs for their own requests
CREATE POLICY "maintenance_status_logs_tenant_select" ON public.maintenance_status_logs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.maintenance_requests r
      JOIN public.tenants t ON t.id = r.tenant_id
      WHERE r.id = request_id
        AND t.user_id = auth.uid()
    )
  );

-- Landlord: insert status change logs for their properties' requests
CREATE POLICY "maintenance_status_logs_landlord_insert" ON public.maintenance_status_logs
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.maintenance_requests r
      WHERE r.id = request_id
        AND public.is_property_owner(r.property_id)
    )
  );

-- Tenant: insert initial submission log for their own requests
CREATE POLICY "maintenance_status_logs_tenant_insert" ON public.maintenance_status_logs
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.maintenance_requests r
      JOIN public.tenants t ON t.id = r.tenant_id
      WHERE r.id = request_id
        AND t.user_id = auth.uid()
    )
  );

-- ============================================================
-- STORAGE BUCKET: maintenance-photos (private)
-- Path structure: {property_id}/{request_id}/{uuid}.{ext}
-- ============================================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('maintenance-photos', 'maintenance-photos', FALSE)
ON CONFLICT (id) DO NOTHING;

-- Landlord: full access to photos in their properties
CREATE POLICY "maintenance_photos_landlord_all" ON storage.objects
  FOR ALL TO authenticated
  USING (
    bucket_id = 'maintenance-photos'
    AND EXISTS (
      SELECT 1 FROM public.properties p
      WHERE p.id::text = split_part(name, '/', 1)
        AND p.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    bucket_id = 'maintenance-photos'
    AND EXISTS (
      SELECT 1 FROM public.properties p
      WHERE p.id::text = split_part(name, '/', 1)
        AND p.owner_id = auth.uid()
    )
  );

-- Tenant: read photos for their own requests
CREATE POLICY "maintenance_photos_tenant_read" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'maintenance-photos'
    AND EXISTS (
      SELECT 1 FROM public.maintenance_requests r
      JOIN public.tenants t ON t.id = r.tenant_id
      WHERE r.id::text = split_part(name, '/', 2)
        AND t.user_id = auth.uid()
    )
  );

-- Tenant: upload photos for their own requests
CREATE POLICY "maintenance_photos_tenant_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'maintenance-photos'
    AND EXISTS (
      SELECT 1 FROM public.maintenance_requests r
      JOIN public.tenants t ON t.id = r.tenant_id
      WHERE r.id::text = split_part(name, '/', 2)
        AND t.user_id = auth.uid()
    )
  );

-- Tenant: delete their own request photos
CREATE POLICY "maintenance_photos_tenant_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'maintenance-photos'
    AND EXISTS (
      SELECT 1 FROM public.maintenance_requests r
      JOIN public.tenants t ON t.id = r.tenant_id
      WHERE r.id::text = split_part(name, '/', 2)
        AND t.user_id = auth.uid()
    )
  );
