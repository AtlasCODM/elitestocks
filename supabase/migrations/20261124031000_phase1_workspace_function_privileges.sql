-- EliteStocks Phase 1 helper-function privilege repair
-- The post-migration export showed PostgreSQL's default PUBLIC EXECUTE grant on
-- the workspace helper functions. Remove that grant and expose only the roles
-- required by the Phase 1 RLS/application compatibility design.
--
-- Run as the Supabase SQL Editor postgres owner. This migration changes no data,
-- tables, RLS policies, administrator assignments, or business records.

BEGIN;

REVOKE ALL ON FUNCTION public.current_workspace_id() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.workspace_has_access(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.set_workspace_context(uuid) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.current_workspace_id() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.workspace_has_access(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.set_workspace_context(uuid) TO authenticated, service_role;

DO $$
BEGIN
  IF has_function_privilege('anon', 'public.current_workspace_id()', 'EXECUTE')
     OR has_function_privilege('anon', 'public.workspace_has_access(uuid,uuid)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.set_workspace_context(uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'Anonymous EXECUTE privilege remains on a workspace helper function';
  END IF;
  IF NOT has_function_privilege('authenticated', 'public.current_workspace_id()', 'EXECUTE')
     OR NOT has_function_privilege('authenticated', 'public.workspace_has_access(uuid,uuid)', 'EXECUTE')
     OR NOT has_function_privilege('authenticated', 'public.set_workspace_context(uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'Authenticated EXECUTE privilege is missing from a workspace helper function';
  END IF;
END;
$$;

COMMIT;
