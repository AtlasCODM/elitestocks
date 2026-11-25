-- Phase 1 authenticated read repair.
-- Safe to run repeatedly. This exposes only the validated, non-secret configuration
-- needed by authenticated application clients; it does not alter financial records.

CREATE OR REPLACE FUNCTION public.get_investment_configuration()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_config jsonb;
  v_version integer;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'authentication required' USING ERRCODE = '42501';
  END IF;

  SELECT c.config, c.version
    INTO v_config, v_version
  FROM public.investment_engine_config AS c
  WHERE c.id = true;

  IF v_config IS NULL THEN
    RAISE EXCEPTION 'investment configuration is unavailable' USING ERRCODE = 'P0001';
  END IF;

  RETURN jsonb_build_object('config', v_config, 'version', v_version);
END;
$$;

REVOKE ALL ON FUNCTION public.get_investment_configuration() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_investment_configuration() FROM anon;
GRANT EXECUTE ON FUNCTION public.get_investment_configuration() TO authenticated;

-- Verify the function and privilege without revealing configuration values.
SELECT
  to_regprocedure('public.get_investment_configuration()') IS NOT NULL AS function_exists,
  has_function_privilege('authenticated', 'public.get_investment_configuration()', 'EXECUTE') AS authenticated_can_execute;
