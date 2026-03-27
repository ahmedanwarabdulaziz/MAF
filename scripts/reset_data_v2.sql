-- ============================================================
-- MAF System — Dynamic Full Data Reset (v2)
-- Discovers real table names from information_schema
-- Run in: Supabase SQL Editor
-- WARNING: IRREVERSIBLE
-- ============================================================

DO $$
DECLARE
  keep_uid  uuid;
  tbl_name  text;
BEGIN
  -- 1. Verify a@a.com exists before doing anything
  SELECT id INTO keep_uid
  FROM auth.users
  WHERE email = 'a@a.com';

  IF keep_uid IS NULL THEN
    RAISE EXCEPTION 'a@a.com not found in auth.users — aborting!';
  END IF;

  -- 2. Truncate every table in public schema WITH CASCADE
  --    Skipping: users (handled separately), schema_migrations, any Supabase internal tables
  FOR tbl_name IN
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_type   = 'BASE TABLE'
      AND table_name  != 'users'
  LOOP
    EXECUTE format('TRUNCATE TABLE public.%I CASCADE', tbl_name);
    RAISE NOTICE 'Truncated: %', tbl_name;
  END LOOP;

  -- 3. Delete all users EXCEPT the super admin
  --    public.users.id IS the auth UID directly (no separate auth_user_id column)
  DELETE FROM public.users
  WHERE id != keep_uid;

  RAISE NOTICE 'Done. Kept a@a.com (uid: %)', keep_uid;
END $$;

-- Confirm what remains
SELECT 'users remaining:' AS info, count(*)::text AS value FROM public.users
UNION ALL
SELECT 'auth.users remaining:', count(*)::text FROM auth.users WHERE email = 'a@a.com';
