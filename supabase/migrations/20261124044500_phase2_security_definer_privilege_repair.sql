-- EliteStocks Phase 2 SECURITY DEFINER privilege repair
--
-- The supplied staging preflight found 55 public SECURITY DEFINER functions;
-- 24 retained PUBLIC EXECUTE and 10 retained explicit anon EXECUTE.
-- This migration removes only PUBLIC and anon EXECUTE. It does not revoke
-- authenticated, service_role, or postgres privileges, and it does not change
-- function bodies, data, roles, or administrator assignments.
--
-- Run before the coordinated workspace-aware RPC migration, after reviewing the
-- staging preflight result and taking a verified backup. This file is safe in
-- the Supabase SQL Editor and contains no psql meta-commands.

BEGIN;

DO $$
DECLARE
  f record;
BEGIN
  FOR f IN
    SELECT p.oid::regprocedure::text AS signature
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prosecdef
  LOOP
    EXECUTE format(
      'REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon',
      f.signature
    );
  END LOOP;
END;
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prosecdef
      AND (
        has_function_privilege('PUBLIC', p.oid, 'EXECUTE')
        OR has_function_privilege('anon', p.oid, 'EXECUTE')
      )
  ) THEN
    RAISE EXCEPTION 'PUBLIC or anon EXECUTE remains on a SECURITY DEFINER function';
  END IF;
END;
$$;

COMMIT;
