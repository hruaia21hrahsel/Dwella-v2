-- Allow landlords and tenants to update (overwrite) existing proof files
-- Required for upsert:true uploads in ProofUploader

CREATE POLICY "landlord_update_proof" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'payment-proofs'
    AND EXISTS (
      SELECT 1 FROM public.properties p
      WHERE p.id::text = split_part(name, '/', 1)
        AND p.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    bucket_id = 'payment-proofs'
    AND EXISTS (
      SELECT 1 FROM public.properties p
      WHERE p.id::text = split_part(name, '/', 1)
        AND p.owner_id = auth.uid()
    )
  );

CREATE POLICY "tenant_update_proof" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'payment-proofs'
    AND EXISTS (
      SELECT 1 FROM public.tenants t
      WHERE t.id::text = split_part(name, '/', 2)
        AND t.user_id = auth.uid()
    )
  )
  WITH CHECK (
    bucket_id = 'payment-proofs'
    AND EXISTS (
      SELECT 1 FROM public.tenants t
      WHERE t.id::text = split_part(name, '/', 2)
        AND t.user_id = auth.uid()
    )
  );
