-- LOCAL TEST FIXTURE ONLY. Never run this against Supabase.
ALTER TABLE public.platform_settings
  DROP COLUMN wallet_address,
  DROP COLUMN updated_by,
  ALTER COLUMN min_withdrawal TYPE numeric,
  ALTER COLUMN max_withdrawal TYPE numeric,
  ADD COLUMN withdrawal_fee_pct numeric NOT NULL DEFAULT 2.5,
  ADD COLUMN withdrawals_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN deposits_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN addr_btc text NOT NULL DEFAULT '',
  ADD COLUMN addr_erc20 text NOT NULL DEFAULT '',
  ADD COLUMN addr_trc20 text NOT NULL DEFAULT '',
  ADD COLUMN addr_solana text NOT NULL DEFAULT '',
  ADD COLUMN created_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN maintenance_fee_pct numeric NOT NULL DEFAULT 1.25,
  ADD COLUMN mining_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN maintenance_enabled boolean NOT NULL DEFAULT true;
CREATE TYPE public.app_role AS ENUM ('admin', 'user');
ALTER TABLE public.user_roles
  ALTER COLUMN role TYPE public.app_role USING role::public.app_role,
  ADD COLUMN id uuid NOT NULL DEFAULT gen_random_uuid(),
  ADD COLUMN created_at timestamptz NOT NULL DEFAULT now();
UPDATE public.platform_settings SET
  addr_btc='existing-legacy-btc',addr_erc20='existing-legacy-eth',
  addr_trc20='existing-legacy-usdt',addr_solana='existing-legacy-sol';
CREATE TABLE public.test_settings_snapshot AS
  SELECT to_jsonb(s) AS settings FROM public.platform_settings s WHERE id=true;
