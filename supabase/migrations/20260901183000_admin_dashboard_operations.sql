-- Admin dashboard operations: four deposit wallets, complete user management,
-- and atomic transaction review. Authorization is always user_roles.role = admin.
ALTER TABLE public.platform_settings
  ADD COLUMN IF NOT EXISTS bitcoin_wallet_address text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS ethereum_wallet_address text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS solana_wallet_address text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS usdt_wallet_address text NOT NULL DEFAULT '';

CREATE OR REPLACE FUNCTION public.is_admin(actor uuid DEFAULT auth.uid())
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = actor AND role::text = 'admin'
  );
$$;
REVOKE EXECUTE ON FUNCTION public.is_admin(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_admin(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.admin_update_transaction(
  p_transaction_id uuid,
  p_action text,
  p_admin_id uuid DEFAULT auth.uid()
) RETURNS public.transactions
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE tx public.transactions;
BEGIN
  IF NOT public.is_admin(p_admin_id) THEN RAISE EXCEPTION 'Forbidden'; END IF;
  IF p_action NOT IN ('approve', 'decline') THEN RAISE EXCEPTION 'Invalid action'; END IF;

  SELECT * INTO tx
  FROM public.transactions
  WHERE id = p_transaction_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Transaction not found'; END IF;
  IF tx.status NOT IN ('pending_confirmation','verifying','pending') THEN
    RAISE EXCEPTION 'Transaction has already been processed';
  END IF;

  IF p_action = 'approve' AND tx.type = 'deposit' THEN
    UPDATE public.wallets
    SET balance = balance + tx.amount, updated_at = now()
    WHERE user_id = tx.user_id AND asset = tx.asset;
    IF NOT FOUND THEN RAISE EXCEPTION 'Wallet not found'; END IF;
  ELSIF p_action = 'decline' AND tx.type = 'withdrawal' THEN
    UPDATE public.wallets
    SET balance = balance + tx.amount, updated_at = now()
    WHERE user_id = tx.user_id AND asset = tx.asset;
    IF NOT FOUND THEN RAISE EXCEPTION 'Wallet not found'; END IF;
  END IF;

  UPDATE public.transactions
  SET status = CASE
      WHEN p_action = 'approve' AND tx.type = 'withdrawal' THEN 'completed'::public.tx_status
      WHEN p_action = 'approve' THEN 'confirmed'::public.tx_status
      ELSE 'cancelled'::public.tx_status
    END,
    updated_at = now(),
    metadata = coalesce(tx.metadata, '{}'::jsonb) || jsonb_build_object(
      'reviewed_by', p_admin_id,
      'reviewed_at', now(),
      'decision', p_action || 'd'
    )
  WHERE id = tx.id
  RETURNING * INTO tx;
  RETURN tx;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_update_transaction(uuid, text, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_update_transaction(uuid, text, uuid) TO service_role;

DROP FUNCTION IF EXISTS public.admin_update_settings(text, numeric, numeric, uuid);
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
DECLARE result public.platform_settings;
BEGIN
  IF NOT public.is_admin(p_admin_id) THEN RAISE EXCEPTION 'Forbidden'; END IF;
  IF length(trim(p_bitcoin_wallet_address)) > 200
     OR length(trim(p_ethereum_wallet_address)) > 200
     OR length(trim(p_solana_wallet_address)) > 200
     OR length(trim(p_usdt_wallet_address)) > 200 THEN
    RAISE EXCEPTION 'Wallet address is too long';
  END IF;
  IF p_min_withdrawal < 0 OR p_max_withdrawal <= p_min_withdrawal THEN
    RAISE EXCEPTION 'Invalid withdrawal limits';
  END IF;
  UPDATE public.platform_settings
  SET wallet_address = trim(p_usdt_wallet_address),
      bitcoin_wallet_address = trim(p_bitcoin_wallet_address),
      ethereum_wallet_address = trim(p_ethereum_wallet_address),
      solana_wallet_address = trim(p_solana_wallet_address),
      usdt_wallet_address = trim(p_usdt_wallet_address),
      min_withdrawal = p_min_withdrawal,
      max_withdrawal = p_max_withdrawal,
      updated_at = now(),
      updated_by = p_admin_id
  WHERE id = true
  RETURNING * INTO result;
  RETURN result;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_update_settings(text, text, text, text, numeric, numeric, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_update_settings(text, text, text, text, numeric, numeric, uuid) TO service_role;
