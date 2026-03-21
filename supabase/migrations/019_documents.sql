-- ============================================================
-- Migration 019: Document Storage
-- ============================================================
-- Creates the documents table, storage bucket, RLS policies,
-- and archive cascade trigger for tenant soft-delete.

-- ============================================================
-- TABLE: documents
-- ============================================================

CREATE TABLE public.documents (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id   uuid REFERENCES public.properties(id) ON DELETE CASCADE,
  tenant_id     uuid REFERENCES public.tenants(id) ON DELETE SET NULL,
  uploader_id   uuid NOT NULL REFERENCES auth.users(id),
  name          text NOT NULL,
  category      text NOT NULL CHECK (category IN ('lease','id','insurance','receipts','other')),
  storage_path  text NOT NULL UNIQUE,
  mime_type     text NOT NULL,
  file_size     bigint NOT NULL,
  is_archived   boolean NOT NULL DEFAULT FALSE,
  archived_at   timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_documents_property ON public.documents(property_id) WHERE is_archived = FALSE;
CREATE INDEX idx_documents_tenant   ON public.documents(tenant_id)   WHERE is_archived = FALSE;
CREATE INDEX idx_documents_uploader ON public.documents(uploader_id);

ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- STORAGE BUCKET: documents (private, 10 MB, allowed MIME types)
-- ============================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'documents', 'documents', FALSE,
  10485760,
  ARRAY[
    'application/pdf',
    'image/jpeg',
    'image/png',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]
)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- DB RLS POLICIES
-- Uses public.is_property_owner() SECURITY DEFINER (from migration 005)
-- to avoid infinite recursion between documents and properties.
-- ============================================================

-- SELECT: uploader sees own, landlord sees all property docs,
--         tenant sees property-wide + their own tenant-specific docs
CREATE POLICY "documents_select" ON public.documents
  FOR SELECT USING (
    uploader_id = auth.uid()
    OR public.is_property_owner(property_id)
    OR (
      tenant_id IS NULL
      AND EXISTS (
        SELECT 1 FROM public.tenants t
        WHERE t.property_id = documents.property_id
          AND t.user_id = auth.uid()
          AND t.is_archived = FALSE
      )
    )
    OR EXISTS (
      SELECT 1 FROM public.tenants t
      WHERE t.id = documents.tenant_id
        AND t.user_id = auth.uid()
    )
  );

-- INSERT: uploader_id must be auth.uid();
--         landlord uploads to any scope; tenant uploads to their own tenancy only
CREATE POLICY "documents_insert" ON public.documents
  FOR INSERT WITH CHECK (
    uploader_id = auth.uid()
    AND (
      public.is_property_owner(property_id)
      OR (
        tenant_id IS NOT NULL
        AND EXISTS (
          SELECT 1 FROM public.tenants t
          WHERE t.id = tenant_id AND t.user_id = auth.uid()
        )
      )
    )
  );

-- DELETE: only uploader can delete
CREATE POLICY "documents_delete" ON public.documents
  FOR DELETE USING (uploader_id = auth.uid());

-- UPDATE: only uploader can update (rename)
CREATE POLICY "documents_update" ON public.documents
  FOR UPDATE USING (uploader_id = auth.uid())
  WITH CHECK (uploader_id = auth.uid());

-- ============================================================
-- STORAGE RLS POLICIES
-- Path structure:
--   {property_id}/property/{uuid}.{ext}    -- property-wide
--   {property_id}/{tenant_id}/{uuid}.{ext} -- tenant-specific
-- Note: storage.objects.name does NOT include the bucket name prefix.
-- ============================================================

-- Landlord: full access to all documents in their properties
CREATE POLICY "documents_storage_landlord_all" ON storage.objects
  FOR ALL TO authenticated
  USING (
    bucket_id = 'documents'
    AND EXISTS (
      SELECT 1 FROM public.properties p
      WHERE p.id::text = split_part(name, '/', 1)
        AND p.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    bucket_id = 'documents'
    AND EXISTS (
      SELECT 1 FROM public.properties p
      WHERE p.id::text = split_part(name, '/', 1)
        AND p.owner_id = auth.uid()
    )
  );

-- Tenant: read property-wide docs (path segment 2 = 'property')
--         and their own tenant-scoped docs (path segment 2 = their tenant_id)
CREATE POLICY "documents_storage_tenant_read" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'documents'
    AND (
      (
        split_part(name, '/', 2) = 'property'
        AND EXISTS (
          SELECT 1 FROM public.tenants t
          WHERE t.property_id::text = split_part(name, '/', 1)
            AND t.user_id = auth.uid()
            AND t.is_archived = FALSE
        )
      )
      OR EXISTS (
        SELECT 1 FROM public.tenants t
        WHERE t.id::text = split_part(name, '/', 2)
          AND t.user_id = auth.uid()
      )
    )
  );

-- Tenant: upload only to their own tenant-scoped path
CREATE POLICY "documents_storage_tenant_upload" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'documents'
    AND EXISTS (
      SELECT 1 FROM public.tenants t
      WHERE t.id::text = split_part(name, '/', 2)
        AND t.user_id = auth.uid()
    )
  );

-- ============================================================
-- SOFT-DELETE CASCADE TRIGGER
-- When a tenant is archived, archive their documents too.
-- When a tenant is restored, restore their documents.
-- ============================================================

CREATE OR REPLACE FUNCTION public.cascade_archive_documents()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NEW.is_archived = TRUE AND OLD.is_archived = FALSE THEN
    UPDATE public.documents
    SET is_archived = TRUE, archived_at = now()
    WHERE tenant_id = NEW.id AND is_archived = FALSE;
  END IF;
  IF NEW.is_archived = FALSE AND OLD.is_archived = TRUE THEN
    UPDATE public.documents
    SET is_archived = FALSE, archived_at = NULL
    WHERE tenant_id = NEW.id AND is_archived = TRUE;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_cascade_archive_documents
  AFTER UPDATE OF is_archived ON public.tenants
  FOR EACH ROW
  EXECUTE FUNCTION public.cascade_archive_documents();
