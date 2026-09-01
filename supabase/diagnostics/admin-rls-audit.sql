-- Run this in the Supabase SQL Editor for the project used by Vercel.
-- This is read-only and does not change policies or data.

-- 1. Confirm the table, RLS state, and forced-RLS state.
SELECT
  n.nspname AS schema_name,
  c.relname AS table_name,
  c.relrowsecurity AS rls_enabled,
  c.relforcerowsecurity AS rls_forced
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relname = 'user_roles';

-- 2. Show every policy and its roles/expressions.
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'user_roles'
ORDER BY policyname;

-- 3. Show table privileges for API roles.
SELECT grantee, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND table_name = 'user_roles'
  AND grantee IN ('anon', 'authenticated', 'service_role')
ORDER BY grantee, privilege_type;

-- 4. Confirm the actual is_admin function source and argument names.
SELECT
  p.oid::regprocedure AS function_signature,
  pg_get_function_arguments(p.oid) AS arguments,
  pg_get_function_result(p.oid) AS result_type,
  pg_get_functiondef(p.oid) AS definition
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.proname = 'is_admin';

-- 5. Run the check as the current SQL-editor role only if the editor session
-- has an authenticated JWT; otherwise auth.uid() is null by design.
SELECT public.is_admin(auth.uid()) AS is_admin_for_current_session;
