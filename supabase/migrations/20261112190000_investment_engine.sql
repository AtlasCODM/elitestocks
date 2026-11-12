-- Targeted investment engine upgrade.
-- Additive only: legacy position terms and transaction history are preserved.

-- Some established deployments have only per-asset wallet columns and no editor
-- pointer. Add audit bookkeeping, not a generic wallet or replacement settings.
ALTER TABLE public.platform_settings
  ADD COLUMN IF NOT EXISTS updated_by uuid;

-- Deleting a former settings editor must not break established user management.
-- Immutable audit rows retain the UUID; only the live editor pointer becomes null.
ALTER TABLE public.platform_settings
  DROP CONSTRAINT IF EXISTS platform_settings_updated_by_fkey,
  ADD CONSTRAINT platform_settings_updated_by_fkey
    FOREIGN KEY (updated_by) REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS public.investment_engine_config (
  id boolean PRIMARY KEY DEFAULT true CHECK (id = true),
  config jsonb NOT NULL,
  version integer NOT NULL CHECK (version >= 0),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS public.investment_engine_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Preserve the historical actor UUID even if an administrator is later
  -- removed; this is an immutable audit record, not a live ownership link.
  actor_id uuid,
  old_config jsonb NOT NULL,
  new_config jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

CREATE TABLE IF NOT EXISTS public.investment_engine_performance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid NOT NULL,
  kind text NOT NULL CHECK (kind IN ('investment', 'copy_trade')),
  position_id uuid NOT NULL,
  profit numeric(30,10) NOT NULL CHECK (profit >= 0),
  evidence_ref text NOT NULL CHECK (char_length(trim(evidence_ref)) > 0),
  contract_ref text NOT NULL CHECK (char_length(trim(contract_ref)) > 0),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE (kind, position_id)
);

ALTER TABLE public.investments
  ADD COLUMN IF NOT EXISTS calculation_interval text NOT NULL DEFAULT 'daily',
  ADD COLUMN IF NOT EXISTS config_version integer,
  ADD COLUMN IF NOT EXISTS credited_profit numeric(30,10) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS performance_status text NOT NULL DEFAULT 'legacy_unverified';
ALTER TABLE public.copy_trades
  ADD COLUMN IF NOT EXISTS calculation_interval text NOT NULL DEFAULT 'daily',
  ADD COLUMN IF NOT EXISTS config_version integer,
  ADD COLUMN IF NOT EXISTS credited_profit numeric(30,10) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS performance_status text NOT NULL DEFAULT 'legacy_unverified';

ALTER TABLE public.investments
  DROP CONSTRAINT IF EXISTS investments_calculation_interval_check,
  ADD CONSTRAINT investments_calculation_interval_check CHECK (calculation_interval IN ('hourly', 'daily'));
ALTER TABLE public.copy_trades
  DROP CONSTRAINT IF EXISTS copy_trades_calculation_interval_check,
  ADD CONSTRAINT copy_trades_calculation_interval_check CHECK (calculation_interval IN ('hourly', 'daily'));

CREATE INDEX IF NOT EXISTS idx_investments_engine_maturity
  ON public.investments(status, matures_at, performance_status);
CREATE INDEX IF NOT EXISTS idx_copy_trades_engine_maturity
  ON public.copy_trades(status, matures_at, performance_status);
CREATE INDEX IF NOT EXISTS idx_engine_performance_position
  ON public.investment_engine_performance(kind, position_id);

ALTER TABLE public.investment_engine_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.investment_engine_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.investment_engine_performance ENABLE ROW LEVEL SECURITY;
-- Explicitly override any hosting-provider default grants. All writes must use
-- the validated SECURITY DEFINER RPCs, including writes from the service role.
REVOKE ALL ON public.investment_engine_config, public.investment_engine_audit,
  public.investment_engine_performance FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON public.investment_engine_config, public.investment_engine_audit,
  public.investment_engine_performance TO service_role;

-- The seed is deliberately the only source of the established six rates.
INSERT INTO public.investment_engine_config (id, config, version, updated_at)
SELECT true,
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
FROM public.platform_settings ps
WHERE ps.id = true
ON CONFLICT (id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.engine_validate_configuration(p_config jsonb)
RETURNS void
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  v_key text;
  v_plan jsonb;
  v_tier text;
  v_days integer;
  v_profit numeric;
  v_expected_keys text[] := ARRAY[
    'version', 'minInvestment', 'maxInvestment', 'minDeposit', 'maxDeposit',
    'minWithdrawal', 'maxWithdrawal', 'calculationInterval', 'returnMode', 'plans'
  ];
  v_actual_keys text[];
BEGIN
  IF p_config IS NULL OR jsonb_typeof(p_config) <> 'object' THEN
    RAISE EXCEPTION 'Configuration must be a JSON object';
  END IF;
  SELECT array_agg(key ORDER BY key) INTO v_actual_keys FROM jsonb_object_keys(p_config) AS key;
  IF v_actual_keys IS DISTINCT FROM (SELECT array_agg(key ORDER BY key) FROM unnest(v_expected_keys) AS key) THEN
    RAISE EXCEPTION 'Configuration keys do not match FinancialConfiguration';
  END IF;
  IF jsonb_typeof(p_config->'version') IS DISTINCT FROM 'number'
     OR (p_config->>'version')::numeric % 1 <> 0
     OR (p_config->>'version')::numeric < 0 THEN
    RAISE EXCEPTION 'Configuration version must be a nonnegative integer';
  END IF;
  FOREACH v_key IN ARRAY ARRAY['minInvestment','maxInvestment','minDeposit','maxDeposit','minWithdrawal','maxWithdrawal'] LOOP
    IF jsonb_typeof(p_config->v_key) IS DISTINCT FROM 'number' THEN
      RAISE EXCEPTION 'Configuration limit % must be numeric', v_key;
    END IF;
    IF (p_config->>v_key)::numeric < 0 OR (p_config->>v_key)::numeric > 10000000000 THEN
      RAISE EXCEPTION 'Configuration limit % is outside the supported range', v_key;
    END IF;
  END LOOP;
  IF (p_config->>'maxInvestment')::numeric <= (p_config->>'minInvestment')::numeric
     OR (p_config->>'maxDeposit')::numeric <= (p_config->>'minDeposit')::numeric
     OR (p_config->>'maxWithdrawal')::numeric <= (p_config->>'minWithdrawal')::numeric THEN
    RAISE EXCEPTION 'Configuration maximums must exceed minimums';
  END IF;
  IF jsonb_typeof(p_config->'calculationInterval') IS DISTINCT FROM 'string'
     OR coalesce(p_config->>'calculationInterval', '') NOT IN ('hourly', 'daily') THEN
    RAISE EXCEPTION 'Invalid calculation interval';
  END IF;
  IF jsonb_typeof(p_config->'returnMode') IS DISTINCT FROM 'string'
     OR coalesce(p_config->>'returnMode', '') <> 'verified_performance' THEN
    RAISE EXCEPTION 'Invalid return mode';
  END IF;
  IF jsonb_typeof(p_config->'plans') <> 'array' OR jsonb_array_length(p_config->'plans') <> 6 THEN
    RAISE EXCEPTION 'Exactly six plans are required';
  END IF;
  IF (SELECT count(DISTINCT value->>'tier') FROM jsonb_array_elements(p_config->'plans')) <> 6
     OR EXISTS (
       SELECT 1 FROM unnest(ARRAY['Starter 3D','Growth 7D','Boost 14D','Pro 21D','Elite 30D','Apex 60D']) AS expected(tier)
       WHERE NOT EXISTS (
         SELECT 1 FROM jsonb_array_elements(p_config->'plans') AS item(value)
         WHERE item.value->>'tier' = expected.tier
       )
     ) THEN
    RAISE EXCEPTION 'Each established plan must appear exactly once';
  END IF;
  FOR v_plan IN SELECT value FROM jsonb_array_elements(p_config->'plans') LOOP
    IF (SELECT array_agg(key ORDER BY key) FROM jsonb_object_keys(v_plan) AS key)
       IS DISTINCT FROM ARRAY['days','enabled','profitPct','tier']::text[] THEN
      RAISE EXCEPTION 'Plan shape is invalid';
    END IF;
    v_tier := v_plan->>'tier';
    IF v_tier IS NULL OR jsonb_typeof(v_plan->'days') IS DISTINCT FROM 'number'
       OR (v_plan->>'days')::numeric % 1 <> 0 THEN
      RAISE EXCEPTION 'Plan duration is invalid';
    END IF;
    v_days := (v_plan->>'days')::integer;
    IF v_days < 1 OR v_days > 3650 THEN RAISE EXCEPTION 'Plan duration is invalid'; END IF;
    IF jsonb_typeof(v_plan->'profitPct') IS DISTINCT FROM 'number' THEN RAISE EXCEPTION 'Plan profit is invalid'; END IF;
    v_profit := (v_plan->>'profitPct')::numeric;
    IF v_profit < 0 OR v_profit > 1000 THEN RAISE EXCEPTION 'Plan profit is invalid'; END IF;
    IF jsonb_typeof(v_plan->'enabled') IS DISTINCT FROM 'boolean' THEN RAISE EXCEPTION 'Plan enabled flag is invalid'; END IF;
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.engine_require_service_role()
RETURNS void
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
BEGIN
  -- EXECUTE is revoked from PUBLIC/anon/authenticated and granted only to
  -- service_role below. The isolated owner-run SQL suite intentionally invokes
  -- SECURITY DEFINER RPCs directly, so the privilege boundary is authoritative.
  RETURN;
END;
$$;

CREATE OR REPLACE FUNCTION public.engine_prevent_immutable_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'Investment engine records are immutable';
END;
$$;
DROP TRIGGER IF EXISTS investment_engine_audit_immutable ON public.investment_engine_audit;
CREATE TRIGGER investment_engine_audit_immutable
  BEFORE UPDATE OR DELETE ON public.investment_engine_audit
  FOR EACH ROW EXECUTE FUNCTION public.engine_prevent_immutable_mutation();
DROP TRIGGER IF EXISTS investment_engine_performance_immutable ON public.investment_engine_performance;
CREATE TRIGGER investment_engine_performance_immutable
  BEFORE UPDATE OR DELETE ON public.investment_engine_performance
  FOR EACH ROW EXECUTE FUNCTION public.engine_prevent_immutable_mutation();

-- A statement trigger takes the singleton config lock before a platform_settings
-- update takes its row lock. This is the same config -> settings order used by
-- engine_update_configuration and prevents the compatibility trigger from
-- introducing a lock inversion.
CREATE OR REPLACE FUNCTION public.engine_platform_settings_lock_config()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM 1 FROM public.investment_engine_config WHERE id = true FOR UPDATE;
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.engine_platform_settings_sync_config()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current public.investment_engine_config;
  v_new jsonb;
  v_actor uuid;
BEGIN
  IF NEW.min_withdrawal IS NOT DISTINCT FROM OLD.min_withdrawal
     AND NEW.max_withdrawal IS NOT DISTINCT FROM OLD.max_withdrawal THEN
    RETURN NEW;
  END IF;
  SELECT * INTO v_current FROM public.investment_engine_config WHERE id = true FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Investment engine configuration is not initialized'; END IF;
  -- engine_update_configuration updates the singleton first, then the legacy
  -- row. Matching values therefore skip this trigger without a session GUC;
  -- legacy settings writes still take this branch and create one audit entry.
  IF (v_current.config->>'minWithdrawal')::numeric = NEW.min_withdrawal
     AND (v_current.config->>'maxWithdrawal')::numeric = NEW.max_withdrawal THEN
    RETURN NEW;
  END IF;
  v_new := jsonb_set(v_current.config, '{minWithdrawal}', to_jsonb(NEW.min_withdrawal), true);
  v_new := jsonb_set(v_new, '{maxWithdrawal}', to_jsonb(NEW.max_withdrawal), true);
  v_new := jsonb_set(v_new, '{version}', to_jsonb(v_current.version + 1), true);
  PERFORM public.engine_validate_configuration(v_new);
  v_actor := NEW.updated_by;
  UPDATE public.investment_engine_config
  SET config = v_new, version = v_current.version + 1,
      updated_at = clock_timestamp(), updated_by = v_actor
  WHERE id = true;
  INSERT INTO public.investment_engine_audit(actor_id, old_config, new_config)
  VALUES (v_actor, v_current.config, v_new);
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS platform_settings_engine_config_lock ON public.platform_settings;
CREATE TRIGGER platform_settings_engine_config_lock
  BEFORE UPDATE ON public.platform_settings
  FOR EACH STATEMENT EXECUTE FUNCTION public.engine_platform_settings_lock_config();
DROP TRIGGER IF EXISTS platform_settings_engine_config_sync ON public.platform_settings;
CREATE TRIGGER platform_settings_engine_config_sync
  AFTER UPDATE OF min_withdrawal, max_withdrawal ON public.platform_settings
  FOR EACH ROW EXECUTE FUNCTION public.engine_platform_settings_sync_config();

CREATE OR REPLACE FUNCTION public.engine_update_configuration(
  p_actor_id uuid,
  p_expected_version integer,
  p_config jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current public.investment_engine_config;
  v_new jsonb;
BEGIN
  PERFORM public.engine_require_service_role();
  IF p_actor_id IS NULL OR NOT public.is_admin(p_actor_id) THEN RAISE EXCEPTION 'Forbidden'; END IF;
  SELECT * INTO v_current FROM public.investment_engine_config WHERE id = true FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Investment engine configuration is not initialized'; END IF;
  IF p_expected_version IS NULL OR p_expected_version <> v_current.version THEN
    RAISE EXCEPTION 'Configuration version conflict' USING ERRCODE = '40001';
  END IF;
  PERFORM public.engine_validate_configuration(p_config);
  v_new := jsonb_set(p_config, '{version}', to_jsonb(v_current.version + 1), true);
  PERFORM public.engine_validate_configuration(v_new);
  PERFORM set_config('app.investment_engine_sync', 'on', true);
  UPDATE public.investment_engine_config
  SET config = v_new, version = v_current.version + 1,
      updated_at = clock_timestamp(), updated_by = p_actor_id
  WHERE id = true;
  UPDATE public.platform_settings
  SET min_withdrawal = (v_new->>'minWithdrawal')::numeric,
      max_withdrawal = (v_new->>'maxWithdrawal')::numeric,
      updated_at = clock_timestamp(), updated_by = p_actor_id
  WHERE id = true;
  INSERT INTO public.investment_engine_audit(actor_id, old_config, new_config)
  VALUES (p_actor_id, v_current.config, v_new);
  RETURN v_new;
END;
$$;

-- Replace the legacy settings RPC while retaining its existing signature. The
-- config lock is acquired before platform_settings; the row trigger then creates
-- the single compatibility audit entry.
DROP FUNCTION IF EXISTS public.admin_update_settings(text, numeric, numeric, uuid);
DROP FUNCTION IF EXISTS public.admin_update_settings(text, text, text, text, numeric, numeric, uuid);
CREATE OR REPLACE FUNCTION public.admin_update_settings(
  p_bitcoin_wallet_address text,
  p_ethereum_wallet_address text,
  p_solana_wallet_address text,
  p_usdt_wallet_address text,
  p_min_withdrawal numeric,
  p_max_withdrawal numeric,
  p_admin_id uuid DEFAULT auth.uid()
) RETURNS public.platform_settings
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  result public.platform_settings;
  v_column text;
  v_value text;
BEGIN
  IF p_admin_id IS NULL OR NOT public.is_admin(p_admin_id) THEN RAISE EXCEPTION 'Forbidden'; END IF;
  IF length(coalesce(trim(p_bitcoin_wallet_address), '')) > 200
     OR length(coalesce(trim(p_ethereum_wallet_address), '')) > 200
     OR length(coalesce(trim(p_solana_wallet_address), '')) > 200
     OR length(coalesce(trim(p_usdt_wallet_address), '')) > 200 THEN
    RAISE EXCEPTION 'Wallet address is too long';
  END IF;
  IF p_min_withdrawal IS NULL OR p_max_withdrawal IS NULL
     OR p_min_withdrawal < 0 OR p_max_withdrawal <= p_min_withdrawal THEN
    RAISE EXCEPTION 'Invalid withdrawal limits';
  END IF;
  PERFORM 1 FROM public.investment_engine_config WHERE id = true FOR UPDATE;
  UPDATE public.platform_settings
  SET bitcoin_wallet_address = trim(coalesce(p_bitcoin_wallet_address, '')),
      ethereum_wallet_address = trim(coalesce(p_ethereum_wallet_address, '')),
      solana_wallet_address = trim(coalesce(p_solana_wallet_address, '')),
      usdt_wallet_address = trim(coalesce(p_usdt_wallet_address, '')),
      min_withdrawal = p_min_withdrawal,
      max_withdrawal = p_max_withdrawal,
      updated_at = clock_timestamp(), updated_by = p_admin_id
  WHERE id = true
  RETURNING * INTO result;
  IF NOT FOUND THEN RAISE EXCEPTION 'Platform settings are not initialized'; END IF;

  -- Keep existing legacy readers consistent after an intentional admin address
  -- edit. Only aliases already present are written; no wallet values are seeded,
  -- copied or cleared when installing this migration. Parameters remain bound.
  FOR v_column, v_value IN SELECT * FROM (VALUES
    ('addr_btc', p_bitcoin_wallet_address),
    ('addr_erc20', p_ethereum_wallet_address),
    ('addr_solana', p_solana_wallet_address),
    ('addr_trc20', p_usdt_wallet_address),
    ('wallet_address', p_usdt_wallet_address)
  ) AS aliases(column_name, address_value)
  LOOP
    IF to_jsonb(result) ? v_column THEN
      EXECUTE format('UPDATE public.platform_settings SET %I = $1 WHERE id = true', v_column)
        USING trim(coalesce(v_value, ''));
    END IF;
  END LOOP;
  SELECT * INTO result FROM public.platform_settings WHERE id = true;
  RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION public.engine_create_investment(
  p_user_id uuid, p_tier text, p_amount numeric
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_config public.investment_engine_config;
  v_plan jsonb;
  v_wallet public.wallets;
  v_created timestamptz := clock_timestamp();
  v_id uuid;
  v_days integer;
  v_profit numeric;
BEGIN
  PERFORM public.engine_require_service_role();
  IF p_user_id IS NULL OR p_amount IS NULL OR p_amount <= 0
     OR p_amount <> trunc(p_amount, 10)
     OR p_amount::text IN ('NaN', 'Infinity', '-Infinity') THEN
    RAISE EXCEPTION 'Invalid investment amount';
  END IF;
  SELECT * INTO v_config FROM public.investment_engine_config WHERE id = true FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Investment engine configuration is not initialized'; END IF;
  PERFORM public.engine_validate_configuration(v_config.config);
  SELECT value INTO v_plan FROM jsonb_array_elements(v_config.config->'plans') AS item(value)
    WHERE value->>'tier' = p_tier;
  IF v_plan IS NULL OR coalesce((v_plan->>'enabled')::boolean, false) = false THEN RAISE EXCEPTION 'Investment plan is unavailable'; END IF;
  IF p_amount < (v_config.config->>'minInvestment')::numeric OR p_amount > (v_config.config->>'maxInvestment')::numeric THEN
    RAISE EXCEPTION 'Investment must be between % and %', v_config.config->>'minInvestment', v_config.config->>'maxInvestment';
  END IF;
  v_days := (v_plan->>'days')::integer;
  v_profit := (v_plan->>'profitPct')::numeric;
  SELECT * INTO v_wallet FROM public.wallets WHERE user_id = p_user_id AND asset = 'USDT' FOR UPDATE;
  IF NOT FOUND OR v_wallet.balance < p_amount THEN RAISE EXCEPTION 'Insufficient balance'; END IF;
  UPDATE public.wallets SET balance = balance - p_amount, updated_at = clock_timestamp()
    WHERE user_id = p_user_id AND asset = 'USDT';
  INSERT INTO public.investments(
    user_id, plan_tier, amount, asset, profit_pct, duration_days, matures_at,
    created_at, calculation_interval, config_version, credited_profit, performance_status
  ) VALUES (
    p_user_id, p_tier, p_amount, 'USDT', v_profit, v_days,
    v_created + (v_days::text || ' days')::interval, v_created,
    v_config.config->>'calculationInterval', v_config.version, 0, 'pending_verification'
  ) RETURNING id INTO v_id;
  INSERT INTO public.transactions(user_id, type, amount, asset, status, reference_id, metadata)
  VALUES (p_user_id, 'investment', p_amount, 'USDT', 'completed', v_id,
    jsonb_build_object('plan', p_tier, 'matures_at', v_created + (v_days::text || ' days')::interval,
      'config_version', v_config.version, 'calculation_interval', v_config.config->>'calculationInterval'));
  RETURN jsonb_build_object('id', v_id, 'matures_at', v_created + (v_days::text || ' days')::interval);
END;
$$;

CREATE OR REPLACE FUNCTION public.engine_create_copy_trade(
  p_user_id uuid, p_trader_id uuid, p_amount numeric
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_config public.investment_engine_config;
  v_trader public.traders;
  v_wallet public.wallets;
  v_created timestamptz := clock_timestamp();
  v_id uuid;
BEGIN
  PERFORM public.engine_require_service_role();
  IF p_user_id IS NULL OR p_amount IS NULL OR p_amount <= 0
     OR p_amount <> trunc(p_amount, 10)
     OR p_amount::text IN ('NaN', 'Infinity', '-Infinity') THEN
    RAISE EXCEPTION 'Invalid copy trade amount';
  END IF;
  SELECT * INTO v_config FROM public.investment_engine_config WHERE id = true FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Investment engine configuration is not initialized'; END IF;
  PERFORM public.engine_validate_configuration(v_config.config);
  IF p_amount < (v_config.config->>'minInvestment')::numeric OR p_amount > (v_config.config->>'maxInvestment')::numeric THEN
    RAISE EXCEPTION 'Copy trade amount must be between % and %', v_config.config->>'minInvestment', v_config.config->>'maxInvestment';
  END IF;
  SELECT * INTO v_trader FROM public.traders WHERE id = p_trader_id FOR SHARE;
  IF NOT FOUND OR v_trader.duration_days < 1 OR v_trader.profit_pct < 0 THEN RAISE EXCEPTION 'Trader not found'; END IF;
  SELECT * INTO v_wallet FROM public.wallets WHERE user_id = p_user_id AND asset = 'USDT' FOR UPDATE;
  IF NOT FOUND OR v_wallet.balance < p_amount THEN RAISE EXCEPTION 'Insufficient balance'; END IF;
  UPDATE public.wallets SET balance = balance - p_amount, updated_at = clock_timestamp()
    WHERE user_id = p_user_id AND asset = 'USDT';
  INSERT INTO public.copy_trades(
    user_id, trader_id, amount, asset, profit_pct, duration_days, matures_at,
    created_at, calculation_interval, config_version, credited_profit, performance_status
  ) VALUES (
    p_user_id, p_trader_id, p_amount, 'USDT', v_trader.profit_pct, v_trader.duration_days,
    v_created + (v_trader.duration_days::text || ' days')::interval, v_created,
    v_config.config->>'calculationInterval', v_config.version, 0, 'pending_verification'
  ) RETURNING id INTO v_id;
  INSERT INTO public.transactions(user_id, type, amount, asset, status, reference_id, metadata)
  VALUES (p_user_id, 'copy_trade', p_amount, 'USDT', 'completed', v_id,
    jsonb_build_object('trader', v_trader.name, 'handle', v_trader.handle,
      'matures_at', v_created + (v_trader.duration_days::text || ' days')::interval,
      'config_version', v_config.version, 'calculation_interval', v_config.config->>'calculationInterval'));
  RETURN jsonb_build_object('id', v_id, 'matures_at', v_created + (v_trader.duration_days::text || ' days')::interval);
END;
$$;

CREATE OR REPLACE FUNCTION public.engine_confirm_deposit(
  p_user_id uuid, p_asset public.asset_type, p_amount numeric
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_config public.investment_engine_config;
  v_settings public.platform_settings;
  v_address text;
  v_id uuid;
BEGIN
  PERFORM public.engine_require_service_role();
  IF p_user_id IS NULL OR p_amount IS NULL OR p_amount <= 0
     OR p_amount <> trunc(p_amount, 10)
     OR p_amount::text IN ('NaN', 'Infinity', '-Infinity') THEN
    RAISE EXCEPTION 'Invalid deposit amount';
  END IF;
  SELECT * INTO v_config FROM public.investment_engine_config WHERE id = true FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Investment engine configuration is not initialized'; END IF;
  PERFORM public.engine_validate_configuration(v_config.config);
  IF p_amount < (v_config.config->>'minDeposit')::numeric OR p_amount > (v_config.config->>'maxDeposit')::numeric THEN
    RAISE EXCEPTION 'Deposit must be between % and %', v_config.config->>'minDeposit', v_config.config->>'maxDeposit';
  END IF;
  SELECT * INTO v_settings FROM public.platform_settings WHERE id = true FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Deposit settings are not initialized'; END IF;
  IF coalesce((to_jsonb(v_settings)->>'deposits_enabled')::boolean, true) = false THEN
    RAISE EXCEPTION 'Deposits are currently disabled';
  END IF;
  v_address := CASE p_asset
    WHEN 'BTC' THEN coalesce(nullif(trim(v_settings.bitcoin_wallet_address), ''), nullif(trim(to_jsonb(v_settings)->>'addr_btc'), ''), '')
    WHEN 'ETH' THEN coalesce(nullif(trim(v_settings.ethereum_wallet_address), ''), nullif(trim(to_jsonb(v_settings)->>'addr_erc20'), ''), '')
    WHEN 'SOL' THEN coalesce(nullif(trim(v_settings.solana_wallet_address), ''), nullif(trim(to_jsonb(v_settings)->>'addr_solana'), ''), '')
    WHEN 'USDT' THEN coalesce(nullif(trim(v_settings.usdt_wallet_address), ''), nullif(trim(to_jsonb(v_settings)->>'addr_trc20'), ''), nullif(trim(to_jsonb(v_settings)->>'wallet_address'), ''), '')
  END;
  IF v_address = '' THEN RAISE EXCEPTION '% deposit address is not configured', p_asset; END IF;
  INSERT INTO public.transactions(user_id, type, amount, asset, status, address, metadata)
  VALUES (p_user_id, 'deposit', p_amount, p_asset, 'pending_confirmation', v_address,
    jsonb_build_object('source', 'user_confirm', 'config_version', v_config.version))
  RETURNING id INTO v_id;
  RETURN jsonb_build_object('id', v_id, 'status', 'pending_confirmation');
END;
$$;

CREATE OR REPLACE FUNCTION public.engine_create_withdrawal(
  p_user_id uuid, p_asset public.asset_type, p_amount numeric, p_address text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_config public.investment_engine_config;
  v_settings public.platform_settings;
  v_wallet public.wallets;
  v_id uuid;
BEGIN
  PERFORM public.engine_require_service_role();
  IF p_user_id IS NULL OR p_amount IS NULL OR p_amount <= 0
     OR p_amount <> trunc(p_amount, 10)
     OR p_amount::text IN ('NaN', 'Infinity', '-Infinity')
     OR length(trim(coalesce(p_address, ''))) < 10 THEN
    RAISE EXCEPTION 'Invalid withdrawal request';
  END IF;
  SELECT * INTO v_config FROM public.investment_engine_config WHERE id = true FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Investment engine configuration is not initialized'; END IF;
  PERFORM public.engine_validate_configuration(v_config.config);
  IF p_amount < (v_config.config->>'minWithdrawal')::numeric OR p_amount > (v_config.config->>'maxWithdrawal')::numeric THEN
    RAISE EXCEPTION 'Withdrawal must be between % and %', v_config.config->>'minWithdrawal', v_config.config->>'maxWithdrawal';
  END IF;
  SELECT * INTO v_settings FROM public.platform_settings WHERE id = true FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Withdrawal settings are not initialized'; END IF;
  IF coalesce((to_jsonb(v_settings)->>'withdrawals_enabled')::boolean, true) = false THEN
    RAISE EXCEPTION 'Withdrawals are currently disabled';
  END IF;
  SELECT * INTO v_wallet FROM public.wallets WHERE user_id = p_user_id AND asset = p_asset FOR UPDATE;
  IF NOT FOUND OR v_wallet.balance < p_amount THEN RAISE EXCEPTION 'Insufficient balance'; END IF;
  UPDATE public.wallets SET balance = balance - p_amount, updated_at = clock_timestamp()
    WHERE user_id = p_user_id AND asset = p_asset;
  INSERT INTO public.transactions(user_id, type, amount, asset, status, address, metadata)
  VALUES (p_user_id, 'withdrawal', p_amount, p_asset, 'pending', trim(p_address),
    jsonb_build_object('locked_at', clock_timestamp(), 'config_version', v_config.version))
  RETURNING id INTO v_id;
  RETURN jsonb_build_object('id', v_id, 'status', 'pending');
END;
$$;

CREATE OR REPLACE FUNCTION public.engine_cancel_position(
  p_user_id uuid, p_position_id uuid, p_kind text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_inv public.investments;
  v_copy public.copy_trades;
  v_wallet public.wallets;
  v_completed timestamptz;
BEGIN
  PERFORM public.engine_require_service_role();
  IF p_user_id IS NULL OR p_position_id IS NULL OR p_kind NOT IN ('investment', 'copy_trade') THEN RAISE EXCEPTION 'Invalid position'; END IF;
  v_completed := clock_timestamp();
  IF p_kind = 'investment' THEN
    SELECT * INTO v_inv FROM public.investments WHERE id = p_position_id AND user_id = p_user_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Position not found'; END IF;
    IF v_inv.status = 'cancelled' THEN RETURN jsonb_build_object('ok', true); END IF;
    IF v_inv.status <> 'active' THEN RAISE EXCEPTION 'Position is not active'; END IF;
    SELECT * INTO v_wallet FROM public.wallets WHERE user_id = p_user_id AND asset = v_inv.asset FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Wallet not found'; END IF;
    UPDATE public.wallets SET balance = balance + v_inv.amount, updated_at = v_completed
      WHERE user_id = p_user_id AND asset = v_inv.asset;
    UPDATE public.investments SET status = 'cancelled', completed_at = v_completed WHERE id = v_inv.id;
    INSERT INTO public.transactions(user_id, type, amount, asset, status, reference_id, metadata)
    VALUES (p_user_id, 'return', v_inv.amount, v_inv.asset, 'completed', v_inv.id,
      jsonb_build_object('event', 'cancellation', 'principal_refunded', true, 'principal', v_inv.amount));
  ELSE
    SELECT * INTO v_copy FROM public.copy_trades WHERE id = p_position_id AND user_id = p_user_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Position not found'; END IF;
    IF v_copy.status = 'cancelled' THEN RETURN jsonb_build_object('ok', true); END IF;
    IF v_copy.status <> 'active' THEN RAISE EXCEPTION 'Position is not active'; END IF;
    SELECT * INTO v_wallet FROM public.wallets WHERE user_id = p_user_id AND asset = v_copy.asset FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Wallet not found'; END IF;
    UPDATE public.wallets SET balance = balance + v_copy.amount, updated_at = v_completed
      WHERE user_id = p_user_id AND asset = v_copy.asset;
    UPDATE public.copy_trades SET status = 'cancelled', completed_at = v_completed WHERE id = v_copy.id;
    INSERT INTO public.transactions(user_id, type, amount, asset, status, reference_id, metadata)
    VALUES (p_user_id, 'copy_return', v_copy.amount, v_copy.asset, 'completed', v_copy.id,
      jsonb_build_object('event', 'cancellation', 'principal_refunded', true, 'principal', v_copy.amount));
  END IF;
  RETURN jsonb_build_object('ok', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.engine_record_performance(
  p_actor_id uuid, p_kind text, p_position_id uuid, p_profit numeric,
  p_evidence_ref text, p_contract_ref text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_status public.investment_status;
  v_user uuid;
  v_id uuid;
BEGIN
  PERFORM public.engine_require_service_role();
  IF p_actor_id IS NULL OR NOT public.is_admin(p_actor_id) THEN RAISE EXCEPTION 'Forbidden'; END IF;
  IF p_kind IS NULL OR p_kind NOT IN ('investment', 'copy_trade') OR p_position_id IS NULL
     OR p_profit IS NULL OR p_profit < 0
     OR p_profit <> trunc(p_profit, 10)
     OR p_profit::text IN ('NaN', 'Infinity', '-Infinity')
     OR length(trim(coalesce(p_evidence_ref, ''))) = 0
     OR length(trim(coalesce(p_contract_ref, ''))) = 0 THEN
    RAISE EXCEPTION 'Invalid performance record';
  END IF;
  IF p_kind = 'investment' THEN
    SELECT status, user_id INTO v_status, v_user FROM public.investments WHERE id = p_position_id FOR UPDATE;
  ELSE
    SELECT status, user_id INTO v_status, v_user FROM public.copy_trades WHERE id = p_position_id FOR UPDATE;
  END IF;
  IF v_user IS NULL THEN RAISE EXCEPTION 'Position not found'; END IF;
  IF v_status = 'cancelled' THEN RAISE EXCEPTION 'Cancelled position cannot receive performance'; END IF;
  IF v_status = 'matured' AND NOT EXISTS (
    SELECT 1 FROM public.transactions
    WHERE reference_id = p_position_id
      AND type IN ('return', 'copy_return')
      AND metadata->>'event' = 'maturity'
      AND metadata->>'principal_released' = 'true'
  ) THEN
    RAISE EXCEPTION 'Historical matured position cannot receive new performance';
  END IF;
  INSERT INTO public.investment_engine_performance(actor_id, kind, position_id, profit, evidence_ref, contract_ref)
  VALUES (p_actor_id, p_kind, p_position_id, p_profit, trim(p_evidence_ref), trim(p_contract_ref))
  RETURNING id INTO v_id;
  IF p_kind = 'investment' THEN
    UPDATE public.investments SET performance_status = 'verified'
      WHERE id = p_position_id AND performance_status <> 'profit_credited';
  ELSE
    UPDATE public.copy_trades SET performance_status = 'verified'
      WHERE id = p_position_id AND performance_status <> 'profit_credited';
  END IF;
  RETURN jsonb_build_object('id', v_id, 'kind', p_kind, 'position_id', p_position_id, 'profit', p_profit);
END;
$$;

CREATE OR REPLACE FUNCTION public.engine_process_jobs()
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  tx public.transactions;
  inv public.investments;
  cp public.copy_trades;
  perf public.investment_engine_performance;
  wallet public.wallets;
  v_now timestamptz;
  v_profit numeric;
  v_principal_count integer := 0;
  v_profit_count integer := 0;
  v_deposit_count integer := 0;
  v_withdrawal_count integer := 0;
BEGIN
  PERFORM public.engine_require_service_role();
  -- Each transaction is locked before its wallet, matching admin review order.
  FOR tx IN
    SELECT * FROM public.transactions
    WHERE type = 'deposit' AND status IN ('pending_confirmation','verifying','pending')
      AND created_at <= clock_timestamp() - interval '5 minutes'
    ORDER BY created_at, id LIMIT 200 FOR UPDATE SKIP LOCKED
  LOOP
    SELECT * INTO wallet FROM public.wallets
      WHERE user_id = tx.user_id AND asset = tx.asset FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Wallet not found for deposit %', tx.id; END IF;
    UPDATE public.wallets SET balance = balance + tx.amount, updated_at = clock_timestamp()
      WHERE user_id = tx.user_id AND asset = tx.asset;
    UPDATE public.transactions SET status = 'confirmed', updated_at = clock_timestamp(),
      metadata = coalesce(tx.metadata, '{}'::jsonb) || jsonb_build_object('processor', 'investment_engine')
      WHERE id = tx.id;
    v_deposit_count := v_deposit_count + 1;
  END LOOP;

  FOR tx IN
    SELECT * FROM public.transactions
    WHERE type = 'withdrawal' AND status IN ('pending','processing')
    ORDER BY created_at, id LIMIT 200 FOR UPDATE SKIP LOCKED
  LOOP
    IF tx.status = 'pending' AND tx.created_at <= clock_timestamp() - interval '2 minutes' THEN
      UPDATE public.transactions SET status = 'processing', updated_at = clock_timestamp() WHERE id = tx.id;
      v_withdrawal_count := v_withdrawal_count + 1;
    ELSIF tx.status = 'processing' AND tx.created_at <= clock_timestamp() - interval '5 minutes' THEN
      UPDATE public.transactions SET status = 'successful', updated_at = clock_timestamp() WHERE id = tx.id;
      v_withdrawal_count := v_withdrawal_count + 1;
    END IF;
  END LOOP;

  -- Principal is settled exactly once from active -> matured. Profit_pct is
  -- never used for a wallet credit; only an attested performance row is used.
  FOR inv IN
    SELECT * FROM public.investments
    WHERE status = 'active' AND matures_at <= clock_timestamp()
    ORDER BY matures_at, id LIMIT 200 FOR UPDATE SKIP LOCKED
  LOOP
    v_now := clock_timestamp();
    SELECT * INTO perf FROM public.investment_engine_performance
      WHERE kind = 'investment' AND position_id = inv.id;
    SELECT * INTO wallet FROM public.wallets WHERE user_id = inv.user_id AND asset = inv.asset FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Wallet not found for investment %', inv.id; END IF;
    UPDATE public.wallets SET balance = balance + inv.amount + coalesce(perf.profit, 0), updated_at = v_now
      WHERE user_id = inv.user_id AND asset = inv.asset;
    UPDATE public.investments SET status = 'matured', completed_at = v_now,
      credited_profit = coalesce(perf.profit, 0),
      performance_status = CASE WHEN perf.id IS NOT NULL THEN 'profit_credited'
        WHEN inv.config_version IS NULL THEN 'legacy_unverified' ELSE 'pending_verification' END
      WHERE id = inv.id;
    INSERT INTO public.transactions(user_id, type, amount, asset, status, reference_id, metadata)
    VALUES (inv.user_id, 'return', inv.amount, inv.asset, 'completed', inv.id,
      jsonb_build_object('event', 'maturity', 'principal_released', true,
        'principal', inv.amount, 'profit_credited', coalesce(perf.profit, 0),
        'performance_id', perf.id, 'legacy_terms_preserved', inv.config_version IS NULL));
    IF perf.id IS NOT NULL AND perf.profit > 0 THEN
      INSERT INTO public.transactions(user_id, type, amount, asset, status, reference_id, metadata)
      VALUES (inv.user_id, 'return', perf.profit, inv.asset, 'completed', inv.id,
        jsonb_build_object('event', 'verified_performance', 'performance_id', perf.id,
          'evidence_ref', perf.evidence_ref, 'contract_ref', perf.contract_ref));
    END IF;
    v_principal_count := v_principal_count + 1;
  END LOOP;

  FOR cp IN
    SELECT * FROM public.copy_trades
    WHERE status = 'active' AND matures_at <= clock_timestamp()
    ORDER BY matures_at, id LIMIT 200 FOR UPDATE SKIP LOCKED
  LOOP
    v_now := clock_timestamp();
    SELECT * INTO perf FROM public.investment_engine_performance
      WHERE kind = 'copy_trade' AND position_id = cp.id;
    SELECT * INTO wallet FROM public.wallets WHERE user_id = cp.user_id AND asset = cp.asset FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Wallet not found for copy trade %', cp.id; END IF;
    UPDATE public.wallets SET balance = balance + cp.amount + coalesce(perf.profit, 0), updated_at = v_now
      WHERE user_id = cp.user_id AND asset = cp.asset;
    UPDATE public.copy_trades SET status = 'matured', completed_at = v_now,
      credited_profit = coalesce(perf.profit, 0),
      performance_status = CASE WHEN perf.id IS NOT NULL THEN 'profit_credited'
        WHEN cp.config_version IS NULL THEN 'legacy_unverified' ELSE 'pending_verification' END
      WHERE id = cp.id;
    INSERT INTO public.transactions(user_id, type, amount, asset, status, reference_id, metadata)
    VALUES (cp.user_id, 'copy_return', cp.amount, cp.asset, 'completed', cp.id,
      jsonb_build_object('event', 'maturity', 'principal_released', true,
        'principal', cp.amount, 'profit_credited', coalesce(perf.profit, 0),
        'performance_id', perf.id, 'legacy_terms_preserved', cp.config_version IS NULL));
    IF perf.id IS NOT NULL AND perf.profit > 0 THEN
      INSERT INTO public.transactions(user_id, type, amount, asset, status, reference_id, metadata)
      VALUES (cp.user_id, 'copy_return', perf.profit, cp.asset, 'completed', cp.id,
        jsonb_build_object('event', 'verified_performance', 'performance_id', perf.id,
          'evidence_ref', perf.evidence_ref, 'contract_ref', perf.contract_ref));
    END IF;
    v_principal_count := v_principal_count + 1;
  END LOOP;

  -- A verified record may arrive after maturity. The position lock, status, and
  -- credited_profit guard make this idempotent under repeated/parallel jobs.
  FOR inv IN
    SELECT i.* FROM public.investments i
    JOIN public.investment_engine_performance p ON p.kind = 'investment' AND p.position_id = i.id
    WHERE i.status = 'matured' AND i.performance_status = 'verified' AND i.credited_profit = 0
    ORDER BY i.matures_at, i.id LIMIT 200 FOR UPDATE OF i SKIP LOCKED
  LOOP
    SELECT * INTO perf FROM public.investment_engine_performance WHERE kind = 'investment' AND position_id = inv.id;
    SELECT * INTO wallet FROM public.wallets WHERE user_id = inv.user_id AND asset = inv.asset FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Wallet not found for investment performance %', inv.id; END IF;
    UPDATE public.wallets SET balance = balance + perf.profit, updated_at = clock_timestamp()
      WHERE user_id = inv.user_id AND asset = inv.asset;
    UPDATE public.investments SET credited_profit = perf.profit, performance_status = 'profit_credited' WHERE id = inv.id;
    IF perf.profit > 0 THEN
      INSERT INTO public.transactions(user_id, type, amount, asset, status, reference_id, metadata)
      VALUES (inv.user_id, 'return', perf.profit, inv.asset, 'completed', inv.id,
        jsonb_build_object('event', 'verified_performance', 'performance_id', perf.id,
          'evidence_ref', perf.evidence_ref, 'contract_ref', perf.contract_ref));
    END IF;
    v_profit_count := v_profit_count + 1;
  END LOOP;

  FOR cp IN
    SELECT c.* FROM public.copy_trades c
    JOIN public.investment_engine_performance p ON p.kind = 'copy_trade' AND p.position_id = c.id
    WHERE c.status = 'matured' AND c.performance_status = 'verified' AND c.credited_profit = 0
    ORDER BY c.matures_at, c.id LIMIT 200 FOR UPDATE OF c SKIP LOCKED
  LOOP
    SELECT * INTO perf FROM public.investment_engine_performance WHERE kind = 'copy_trade' AND position_id = cp.id;
    SELECT * INTO wallet FROM public.wallets WHERE user_id = cp.user_id AND asset = cp.asset FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Wallet not found for copy performance %', cp.id; END IF;
    UPDATE public.wallets SET balance = balance + perf.profit, updated_at = clock_timestamp()
      WHERE user_id = cp.user_id AND asset = cp.asset;
    UPDATE public.copy_trades SET credited_profit = perf.profit, performance_status = 'profit_credited' WHERE id = cp.id;
    IF perf.profit > 0 THEN
      INSERT INTO public.transactions(user_id, type, amount, asset, status, reference_id, metadata)
      VALUES (cp.user_id, 'copy_return', perf.profit, cp.asset, 'completed', cp.id,
        jsonb_build_object('event', 'verified_performance', 'performance_id', perf.id,
          'evidence_ref', perf.evidence_ref, 'contract_ref', perf.contract_ref));
    END IF;
    v_profit_count := v_profit_count + 1;
  END LOOP;

  RETURN jsonb_build_object('deposits', v_deposit_count, 'withdrawals', v_withdrawal_count,
    'principal_settled', v_principal_count, 'profit_settled', v_profit_count);
END;
$$;

-- New mutation RPCs are intentionally service-role-only. The server functions
-- validate the bearer and pass only the verified context user id.
REVOKE ALL ON FUNCTION public.engine_update_configuration(uuid, integer, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.engine_create_investment(uuid, text, numeric) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.engine_create_copy_trade(uuid, uuid, numeric) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.engine_confirm_deposit(uuid, public.asset_type, numeric) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.engine_create_withdrawal(uuid, public.asset_type, numeric, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.engine_cancel_position(uuid, uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.engine_record_performance(uuid, text, uuid, numeric, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.engine_process_jobs() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.engine_update_configuration(uuid, integer, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.engine_create_investment(uuid, text, numeric) TO service_role;
GRANT EXECUTE ON FUNCTION public.engine_create_copy_trade(uuid, uuid, numeric) TO service_role;
GRANT EXECUTE ON FUNCTION public.engine_confirm_deposit(uuid, public.asset_type, numeric) TO service_role;
GRANT EXECUTE ON FUNCTION public.engine_create_withdrawal(uuid, public.asset_type, numeric, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.engine_cancel_position(uuid, uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.engine_record_performance(uuid, text, uuid, numeric, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.engine_process_jobs() TO service_role;
REVOKE ALL ON FUNCTION public.engine_require_service_role() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.engine_require_service_role() TO service_role;
REVOKE ALL ON FUNCTION public.engine_validate_configuration(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.engine_validate_configuration(jsonb) TO service_role;

-- Keep the compatibility admin RPC restricted to the same server-side path.
REVOKE ALL ON FUNCTION public.admin_update_settings(text, text, text, text, numeric, numeric, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_update_settings(text, text, text, text, numeric, numeric, uuid) TO service_role;
