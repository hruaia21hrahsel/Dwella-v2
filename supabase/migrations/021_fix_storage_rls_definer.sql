-- ============================================================
-- Migration 021: Fix storage RLS using SECURITY DEFINER helper
-- ============================================================
-- The inline EXISTS against public.properties was blocked by
-- properties table RLS. Use is_property_owner() SECURITY DEFINER
-- function (from migration 005) to bypass the RLS chain.

-- Drop all landlord storage policies
DROP POLICY IF EXISTS "documents_storage_landlord_select" ON storage.objects;
DROP POLICY IF EXISTS "documents_storage_landlord_insert" ON storage.objects;
DROP POLICY IF EXISTS "documents_storage_landlord_update" ON storage.objects;
DROP POLICY IF EXISTS "documents_storage_landlord_delete" ON storage.objects;

-- Helper: extract property_id UUID from storage path's first segment
CREATE OR REPLACE FUNCTION public.storage_path_property_id(path text)
RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT split_part(path, '/', 1)::uuid;
$$;

-- Landlord SELECT
CREATE POLICY "documents_storage_landlord_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'documents'
    AND public.is_property_owner(public.storage_path_property_id(name))
  );

-- Landlord INSERT
CREATE POLICY "documents_storage_landlord_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'documents'
    AND public.is_property_owner(public.storage_path_property_id(name))
  );

-- Landlord UPDATE
CREATE POLICY "documents_storage_landlord_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'documents'
    AND public.is_property_owner(public.storage_path_property_id(name))
  )
  WITH CHECK (
    bucket_id = 'documents'
    AND public.is_property_owner(public.storage_path_property_id(name))
  );

-- Landlord DELETE
CREATE POLICY "documents_storage_landlord_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'documents'
    AND public.is_property_owner(public.storage_path_property_id(name))
  );

-- Also fix tenant policies to use SECURITY DEFINER for consistency
DROP POLICY IF EXISTS "documents_storage_tenant_read" ON storage.objects;
DROP POLICY IF EXISTS "documents_storage_tenant_upload" ON storage.objects;

-- Helper: check if current user is a tenant of the property in the storage path
CREATE OR REPLACE FUNCTION public.is_tenant_of_property(prop_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.tenants t
    WHERE t.property_id = prop_id
      AND t.user_id = auth.uid()
      AND t.is_archived = FALSE
  );
$$;

-- Helper: check if current user owns the tenant_id in segment 2
CREATE OR REPLACE FUNCTION public.is_tenant_owner_by_id(tid text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.tenants t
    WHERE t.id::text = tid
      AND t.user_id = auth.uid()
  );
$$;

-- Tenant SELECT: property-wide docs + their own tenant-scoped docs
CREATE POLICY "documents_storage_tenant_read" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'documents'
    AND (
      (
        split_part(name, '/', 2) = 'property'
        AND public.is_tenant_of_property(public.storage_path_property_id(name))
      )
      OR public.is_tenant_owner_by_id(split_part(name, '/', 2))
    )
  );

-- Tenant INSERT: upload only to their own tenant-scoped path
CREATE POLICY "documents_storage_tenant_upload" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'documents'
    AND public.is_tenant_owner_by_id(split_part(name, '/', 2))
  );
