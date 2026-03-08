-- Add photo and notes fields to tenants
ALTER TABLE public.tenants ADD COLUMN photo_url TEXT;
ALTER TABLE public.tenants ADD COLUMN notes TEXT;

-- Create tenant-photos storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('tenant-photos', 'tenant-photos', false)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS: owners can upload/read tenant photos
CREATE POLICY "Owners can manage tenant photos"
ON storage.objects FOR ALL
USING (
  bucket_id = 'tenant-photos'
  AND (storage.foldername(name))[1] IN (
    SELECT id::text FROM public.properties WHERE owner_id = auth.uid()
  )
);
