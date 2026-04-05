-- ============================================================
-- Dwella v2 — Receipts Storage Bucket + Policies
-- ============================================================
--
-- Private bucket for cached rent-payment receipt PDFs.
-- Path convention: {payment_id}.pdf (flat layout, deterministic).
--
-- Receipts are uploaded by the app whenever a receipt is shared
-- or a payment is confirmed. The Telegram bot (service role) reads
-- from this bucket to deliver receipts on request without needing
-- any external HTML→PDF API.
--
-- Idempotent: bucket insert uses ON CONFLICT, policies are dropped
-- and recreated so the file can be re-run safely.
-- ============================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'receipts',
  'receipts',
  FALSE,
  2097152, -- 2 MB
  ARRAY['application/pdf']
)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- STORAGE RLS POLICIES
-- ============================================================
-- Receipts are named {payment_id}.pdf. Authorization joins
-- storage.objects.name → payments → tenants → properties to
-- verify the caller owns the property or is the linked tenant.
-- ============================================================

DROP POLICY IF EXISTS "landlord_upload_receipt" ON storage.objects;
DROP POLICY IF EXISTS "landlord_update_receipt" ON storage.objects;
DROP POLICY IF EXISTS "landlord_read_receipt" ON storage.objects;
DROP POLICY IF EXISTS "tenant_upload_receipt" ON storage.objects;
DROP POLICY IF EXISTS "tenant_read_receipt" ON storage.objects;

-- Landlord: can upload receipts for payments on their properties
CREATE POLICY "landlord_upload_receipt" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'receipts'
    AND EXISTS (
      SELECT 1
      FROM public.payments pay
      JOIN public.tenants t ON t.id = pay.tenant_id
      JOIN public.properties p ON p.id = t.property_id
      WHERE pay.id::text = replace(name, '.pdf', '')
        AND p.owner_id = auth.uid()
    )
  );

-- Landlord: can overwrite existing receipts (e.g. re-cache on confirm)
CREATE POLICY "landlord_update_receipt" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'receipts'
    AND EXISTS (
      SELECT 1
      FROM public.payments pay
      JOIN public.tenants t ON t.id = pay.tenant_id
      JOIN public.properties p ON p.id = t.property_id
      WHERE pay.id::text = replace(name, '.pdf', '')
        AND p.owner_id = auth.uid()
    )
  );

-- Landlord: can read receipts for their properties
CREATE POLICY "landlord_read_receipt" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'receipts'
    AND EXISTS (
      SELECT 1
      FROM public.payments pay
      JOIN public.tenants t ON t.id = pay.tenant_id
      JOIN public.properties p ON p.id = t.property_id
      WHERE pay.id::text = replace(name, '.pdf', '')
        AND p.owner_id = auth.uid()
    )
  );

-- Tenant: can upload their own receipts
CREATE POLICY "tenant_upload_receipt" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'receipts'
    AND EXISTS (
      SELECT 1
      FROM public.payments pay
      JOIN public.tenants t ON t.id = pay.tenant_id
      WHERE pay.id::text = replace(name, '.pdf', '')
        AND t.user_id = auth.uid()
    )
  );

-- Tenant: can read their own receipts
CREATE POLICY "tenant_read_receipt" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'receipts'
    AND EXISTS (
      SELECT 1
      FROM public.payments pay
      JOIN public.tenants t ON t.id = pay.tenant_id
      WHERE pay.id::text = replace(name, '.pdf', '')
        AND t.user_id = auth.uid()
    )
  );

-- Note: service_role bypasses RLS, so the bot (telegram-webhook /
-- process-bot-message) can read any receipt without an explicit policy.
