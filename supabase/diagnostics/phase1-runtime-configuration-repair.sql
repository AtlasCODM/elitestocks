-- EliteStocks Phase 1 runtime configuration repair
--
-- Run manually in the Supabase SQL Editor only if the wallet reports that
-- financial configuration is unavailable. This script does not modify wallets,
-- balances, transactions, profiles, roles, administrators, or settings.
-- It only restores the singleton investment_engine_config row when the table
-- and engine validation function already exist.

BEGIN;

SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '2min';

DO $$
BEGIN
  IF to_regclass('public.platform_settings') IS NULL THEN
    RAISE EXCEPTION 'public.platform_settings is missing; no changes applied';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.platform_settings WHERE id = true
  ) THEN
    RAISE EXCEPTION 'The singleton public.platform_settings row is missing; no changes applied';
  END IF;

  IF to_regclass('public.investment_engine_config') IS NULL
     OR to_regprocedure('public.engine_validate_configuration(jsonb)') IS NULL THEN
    RAISE EXCEPTION
      'Investment engine migration is incomplete. Apply and verify supabase/migrations/20261112190000_investment_engine.sql first; no changes applied';
  END IF;
END;
$$;

INSERT INTO public.investment_engine_config (id, config, version, updated_at)
SELECT
  true,
  jsonb_build_object(
    'version', 1,
    'minInvestment', 500,
    'maxInvestment', 10000000,
    'minDeposit', 0,
    'maxDeposit', 1000000,
    'minWithdrawal', trim_scale(ps.min_withdrawal),
    'maxWithdrawal', trim_scale(ps.max_withdrawal),
    'calculationInterval', 'daily',
    'returnMode', 'verified_performance',
    'plans', jsonb_build_array(
      jsonb_build_object('tier', 'Starter 3D', 'days', 3, 'profitPct', 35, 'enabled', true),
      jsonb_build_object('tier', 'Growth 7D', 'days', 7, 'profitPct', 45, 'enabled', true),
      jsonb_build_object('tier', 'Boost 14D', 'days', 14, 'profitPct', 55, 'enabled', true),
      jsonb_build_object('tier', 'Pro 21D', 'days', 21, 'profitPct', 68, 'enabled', true),
      jsonb_build_object('tier', 'Elite 30D', 'days', 30, 'profitPct', 80, 'enabled', true),
      jsonb_build_object('tier', 'Apex 60D', 'days', 60, 'profitPct', 100, 'enabled', true)
    )
  ),
  1,
  clock_timestamp()
FROM public.platform_settings AS ps
WHERE ps.id = true
ON CONFLICT (id) DO NOTHING;

DO $$
DECLARE
  v_config jsonb;
  v_version integer;
BEGIN
  SELECT config, version
  INTO v_config, v_version
  FROM public.investment_engine_config
  WHERE id = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Investment engine configuration row was not restored';
  END IF;

  IF v_version <> (v_config->>'version')::integer THEN
    RAISE EXCEPTION 'Investment engine configuration version is inconsistent';
  END IF;

  PERFORM public.engine_validate_configuration(v_config);
END;
$$;

COMMIT;

SELECT
  id,
  version,
  updated_at,
  config->>'minInvestment' AS min_investment,
  config->>'maxInvestment' AS max_investment,
  config->>'minDeposit' AS min_deposit,
  config->>'maxDeposit' AS max_deposit,
  config->>'minWithdrawal' AS min_withdrawal,
  config->>'maxWithdrawal' AS max_withdrawal
FROM public.investment_engine_config
WHERE id = true;
