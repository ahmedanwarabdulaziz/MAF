-- Migration 044: Item Images Support

-- 1. Add image_url column to items table
ALTER TABLE public.items ADD COLUMN IF NOT EXISTS image_url TEXT;

-- 2. Create 'items' storage bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public) 
VALUES ('items', 'items', true) 
ON CONFLICT (id) DO NOTHING;

-- 3. Set up Storage RLS for 'items' bucket

-- Allow public read access to the items bucket
DROP POLICY IF EXISTS "Public View Access for Items Images" ON storage.objects;
CREATE POLICY "Public View Access for Items Images"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'items');

-- Allow authenticated users to upload and modify images in the items bucket
DROP POLICY IF EXISTS "Authenticated Users Manage Items Images" ON storage.objects;
CREATE POLICY "Authenticated Users Manage Items Images"
ON storage.objects FOR ALL
TO authenticated
USING (bucket_id = 'items')
WITH CHECK (bucket_id = 'items');
