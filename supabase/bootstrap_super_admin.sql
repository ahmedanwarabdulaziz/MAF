-- ============================================================
-- Super Admin Bootstrap Script
-- Run this ONCE in Supabase SQL Editor after the migrations.
-- REPLACE the values below with real credentials.
-- ============================================================

-- Step 1: Create the auth user (do this via Supabase dashboard 
-- Authentication → Users → Invite, then come back here for step 2)

-- Step 2: After user is created in auth.users, run this to elevate to Super Admin:
-- Replace 'PASTE_USER_EMAIL_HERE' with the actual email.

UPDATE public.users
SET 
  is_super_admin = true,
  display_name   = 'مدير النظام'
WHERE email = 'PASTE_USER_EMAIL_HERE';

-- If the profile row wasn't auto-created yet (trigger may not have run),
-- get the user's UUID from auth.users first:
-- SELECT id FROM auth.users WHERE email = 'PASTE_USER_EMAIL_HERE';
-- Then run:
-- INSERT INTO public.users (id, display_name, email, is_super_admin)
-- VALUES ('<UUID>', 'مدير النظام', 'PASTE_USER_EMAIL_HERE', true)
-- ON CONFLICT (id) DO UPDATE SET is_super_admin = true;

-- Step 3: Grant main_company + all_projects scope to Super Admin
INSERT INTO public.user_access_scopes (user_id, scope_type)
SELECT id, 'main_company' FROM public.users WHERE email = 'PASTE_USER_EMAIL_HERE'
ON CONFLICT DO NOTHING;

INSERT INTO public.user_access_scopes (user_id, scope_type)
SELECT id, 'all_projects' FROM public.users WHERE email = 'PASTE_USER_EMAIL_HERE'
ON CONFLICT DO NOTHING;

-- Verify:
SELECT id, display_name, email, is_super_admin FROM public.users WHERE email = 'PASTE_USER_EMAIL_HERE';
