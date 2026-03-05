-- Drop all existing storage policies for payment-proofs and replace with simpler ones.
-- The split_part(name, '/') approach is fragile across Supabase versions.
-- Strategy: any authenticated user can INSERT/UPDATE (upload).
--           SELECT and DELETE are still scoped to owners/tenants.

DROP POLICY IF EXISTS "landlord_upload_proof"  ON storage.objects;
DROP POLICY IF EXISTS "landlord_update_proof"  ON storage.objects;
DROP POLICY IF EXISTS "tenant_upload_proof"    ON storage.objects;
DROP POLICY IF EXISTS "tenant_update_proof"    ON storage.objects;
DROP POLICY IF EXISTS "landlord_read_proof"    ON storage.objects;
DROP POLICY IF EXISTS "landlord_delete_proof"  ON storage.objects;
DROP POLICY IF EXISTS "tenant_read_proof"      ON storage.objects;

-- INSERT: any authenticated user may upload to this bucket
CREATE POLICY "authenticated_upload_proof" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'payment-proofs');

-- UPDATE: any authenticated user may overwrite (needed for upsert)
CREATE POLICY "authenticated_update_proof" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'payment-proofs')
  WITH CHECK (bucket_id = 'payment-proofs');

-- SELECT: landlords can read proofs in their properties' folders
CREATE POLICY "landlord_read_proof" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'payment-proofs'
    AND EXISTS (
      SELECT 1 FROM public.properties p
      WHERE p.id::text = split_part(name, '/', 1)
        AND p.owner_id = auth.uid()
    )
  );

-- SELECT: tenants can read their own proof files
CREATE POLICY "tenant_read_proof" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'payment-proofs'
    AND EXISTS (
      SELECT 1 FROM public.tenants t
      WHERE t.id::text = split_part(name, '/', 2)
        AND t.user_id = auth.uid()
    )
  );

-- DELETE: landlords only
CREATE POLICY "landlord_delete_proof" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'payment-proofs'
    AND EXISTS (
      SELECT 1 FROM public.properties p
      WHERE p.id::text = split_part(name, '/', 1)
        AND p.owner_id = auth.uid()
    )
  );
