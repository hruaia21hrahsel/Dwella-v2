-- ============================================================
-- Dwella v2 — Storage Bucket + Policies
-- ============================================================

-- Create payment-proofs bucket (private)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'payment-proofs',
  'payment-proofs',
  FALSE,
  5242880, -- 5 MB
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- STORAGE RLS POLICIES
-- ============================================================

-- Landlord: full access to their property proof folders
CREATE POLICY "landlord_upload_proof" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'payment-proofs'
    AND (
      -- Path: {property_id}/{tenant_id}/{year-month}.jpg
      -- Check that the property belongs to the user
      EXISTS (
        SELECT 1 FROM public.properties p
        WHERE p.id::text = split_part(name, '/', 1)
          AND p.owner_id = auth.uid()
      )
    )
  );

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

-- Tenant: can upload and read their own proofs
CREATE POLICY "tenant_upload_proof" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'payment-proofs'
    AND EXISTS (
      SELECT 1 FROM public.tenants t
      WHERE t.id::text = split_part(name, '/', 2)
        AND t.user_id = auth.uid()
    )
  );

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

-- Allow delete/update by landlord only
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
