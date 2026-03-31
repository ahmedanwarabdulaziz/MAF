-- Migration 027: Setup Storage Bucket for Petty Expenses Attachments

-- 1. Create the bucket (Public bucket so URLs are easily generated and viewed by admins without signing,
--                 or Private if strict confidentiality is required. Usually for expenses, authenticated 
--                 users can see them, but Supabase standard is a public bucket with UUID scrambled paths)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'petty_expenses', 
    'petty_expenses', 
    true, 
    5242880, -- 5MB limit
    '{"image/jpeg","image/png","application/pdf"}'
) ON CONFLICT (id) DO UPDATE SET public = true;

-- 2. Define Storage RLS Policies for the public "petty_expenses" bucket

-- Allow authenticated users to upload files
CREATE POLICY "Allow authenticated uploads" 
ON storage.objects FOR INSERT 
TO authenticated 
WITH CHECK (
    bucket_id = 'petty_expenses' 
);

-- Allow authenticated users to view/download files
CREATE POLICY "Allow authenticated reads" 
ON storage.objects FOR SELECT 
TO authenticated 
USING (
    bucket_id = 'petty_expenses'
);

-- Allow users to delete their own uploaded files (optional, but good for cleanup during drafts)
CREATE POLICY "Allow users to delete their own uploads" 
ON storage.objects FOR DELETE 
TO authenticated 
USING (
    bucket_id = 'petty_expenses' AND auth.uid() = owner
);

-- Allow users to update their own uploads
CREATE POLICY "Allow users to update their own uploads" 
ON storage.objects FOR UPDATE 
TO authenticated 
USING (
    bucket_id = 'petty_expenses' AND auth.uid() = owner
);
