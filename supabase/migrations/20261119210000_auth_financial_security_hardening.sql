-- Additive authorization and financial-state hardening.
-- Preserves every existing row; does not infer deposits or payouts from elapsed time.
BEGIN;

DO $guard$
DECLARE
  profiles_oid oid := to_regclass('public.profiles');
  roles_oid oid := to_regclass('public.user_roles');
  rel record;
BEGIN
  IF profiles_oid IS NULL THEN
    RAISE EXCEPTION 'Required public.profiles table is missing; no changes applied';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' AND column_name='id')
     OR NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' AND column_name='display_name')
     OR NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' AND column_name='status') THEN
    RAISE EXCEPTION 'Expected public.profiles columns are missing; no changes applied';
  END IF;
  SELECT c.relrowsecurity AS rls_enabled INTO rel FROM pg_class c WHERE c.oid = profiles_oid;
  IF NOT coalesce(rel.rls_enabled, false) THEN
    RAISE EXCEPTION 'RLS is not enabled on public.profiles; review live policies before applying';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies p
    WHERE p.schemaname='public' AND p.tablename='profiles'
      AND p.cmd IN ('UPDATE','ALL') AND 'authenticated'=ANY(p.roles)
      AND coalesce(p.qual,'') ILIKE '%auth.uid%'
      AND coalesce(p.qual,'') ILIKE '%id%'
      AND coalesce(p.with_check,p.qual,'') ILIKE '%auth.uid%'
      AND coalesce(p.with_check,p.qual,'') ILIKE '%id%'
  ) THEN
    RAISE EXCEPTION 'No owner-scoped profiles UPDATE policy was found; review live policies before applying';
  END IF;
  IF roles_oid IS NULL
     OR NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='user_roles' AND column_name='user_id')
     OR NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='user_roles' AND column_name='role') THEN
    RAISE EXCEPTION 'Expected public.user_roles authorization table/columns are missing; no changes applied';
  END IF;
  IF to_regprocedure('public.engine_process_jobs()') IS NULL THEN
    RAISE EXCEPTION 'Expected public.engine_process_jobs() is missing; apply the investment-engine migration first';
  END IF;
END;
$guard$;

-- A user's profile status/email are not self-editable authorization fields.
-- Keep the existing owner RLS policy and permit only the profile display-name edit.
REVOKE UPDATE ON public.profiles FROM PUBLIC, anon, authenticated;
GRANT UPDATE (display_name) ON public.profiles TO authenticated;

-- Authenticated users may ask about their own admin role only. Trusted service-role
-- RPCs continue to validate a supplied actor against the same user_roles authority.
CREATE OR REPLACE FUNCTION public.is_admin(actor uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
  SELECT (auth.uid() IS NULL OR actor IS NOT DISTINCT FROM auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = actor AND role::text = 'admin'
    );
$function$;
REVOKE EXECUTE ON FUNCTION public.is_admin(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_admin(uuid) TO authenticated, service_role;

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
  -- A user-submitted deposit request is not payment evidence. Deposits remain
  -- pending until the existing authenticated administrator review path confirms them.
  -- Withdrawal requests remain pending until an authorized operator processes them;
  -- elapsed time alone is never proof of an external payout.

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
REVOKE ALL ON FUNCTION public.engine_process_jobs() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.engine_process_jobs() TO service_role;

COMMIT;
