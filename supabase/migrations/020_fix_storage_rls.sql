-- ============================================================
-- Migration 020: Fix document storage RLS policies
-- ============================================================
-- Split the landlord FOR ALL policy into explicit per-operation
-- policies. FOR ALL on storage.objects can be unreliable.

-- Drop the problematic FOR ALL policy
DROP POLICY IF EXISTS "documents_storage_landlord_all" ON storage.objects;

-- Landlord SELECT: read all documents in their properties
CREATE POLICY "documents_storage_landlord_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'documents'
    AND EXISTS (
      SELECT 1 FROM public.properties p
      WHERE p.id::text = split_part(name, '/', 1)
        AND p.owner_id = auth.uid()
    )
  );

-- Landlord INSERT: upload documents to their properties
CREATE POLICY "documents_storage_landlord_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'documents'
    AND EXISTS (
      SELECT 1 FROM public.properties p
      WHERE p.id::text = split_part(name, '/', 1)
        AND p.owner_id = auth.uid()
    )
  );

-- Landlord UPDATE: update documents in their properties
CREATE POLICY "documents_storage_landlord_update" ON storage.objects
  FOR UPDATE TO authenticated
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

-- Landlord DELETE: delete documents in their properties
CREATE POLICY "documents_storage_landlord_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'documents'
    AND EXISTS (
      SELECT 1 FROM public.properties p
      WHERE p.id::text = split_part(name, '/', 1)
        AND p.owner_id = auth.uid()
    )
  );
