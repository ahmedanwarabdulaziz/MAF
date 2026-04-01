-- Migration 051: Add attachments to owner collections and create storage bucket
-- 1. Add attachments column to owner_collections table
ALTER TABLE public.owner_collections
ADD COLUMN IF NOT EXISTS attachments jsonb DEFAULT '[]'::jsonb;

-- 2. Create the storage bucket 'owner_collections'
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'owner_collections', 
    'owner_collections', 
    true, 
    5242880, -- 5MB limit
    '{"image/jpeg","image/png","application/pdf"}'
) ON CONFLICT (id) DO UPDATE SET public = true;

-- 3. Define Storage RLS Policies for the public "owner_collections" bucket

-- Allow authenticated users to upload files
CREATE POLICY "Allow authenticated uploads for owner_collections" 
ON storage.objects FOR INSERT 
TO authenticated 
WITH CHECK (
    bucket_id = 'owner_collections' 
);

-- Allow authenticated users to view/download files
CREATE POLICY "Allow authenticated reads for owner_collections" 
ON storage.objects FOR SELECT 
TO authenticated 
USING (
    bucket_id = 'owner_collections'
);

-- Allow users to delete their own uploaded files
CREATE POLICY "Allow users to delete their own uploads for owner_collections" 
ON storage.objects FOR DELETE 
TO authenticated 
USING (
    bucket_id = 'owner_collections' AND auth.uid() = owner
);

-- Allow users to update their own uploads
CREATE POLICY "Allow users to update their own uploads for owner_collections" 
ON storage.objects FOR UPDATE 
TO authenticated 
USING (
    bucket_id = 'owner_collections' AND auth.uid() = owner
);
