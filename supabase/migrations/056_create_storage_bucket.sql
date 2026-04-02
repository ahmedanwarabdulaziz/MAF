-- Create Storage Bucket "maf-documents"
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'maf-documents') THEN
    INSERT INTO storage.buckets (id, name, public, avif_autodetection, file_size_limit, allowed_mime_types) 
    VALUES ('maf-documents', 'maf-documents', true, false, null, null);
  END IF;
END $$;

-- Drop existing policies if any to prevent conflicts
DROP POLICY IF EXISTS "Public Access" ON storage.objects;
DROP POLICY IF EXISTS "Auth Insert" ON storage.objects;
DROP POLICY IF EXISTS "Auth Delete" ON storage.objects;
DROP POLICY IF EXISTS "Auth Update" ON storage.objects;

-- Create Policies for storage.objects
CREATE POLICY "Public Access" ON storage.objects FOR SELECT USING (bucket_id = 'maf-documents');
CREATE POLICY "Auth Insert" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'maf-documents' AND auth.role() = 'authenticated');
CREATE POLICY "Auth Delete" ON storage.objects FOR DELETE USING (bucket_id = 'maf-documents' AND auth.role() = 'authenticated');
CREATE POLICY "Auth Update" ON storage.objects FOR UPDATE USING (bucket_id = 'maf-documents' AND auth.role() = 'authenticated');
