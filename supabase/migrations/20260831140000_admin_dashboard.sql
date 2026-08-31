-- Secure admin operations and persistent platform settings.
CREATE TABLE public.admin_users (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);
REVOKE ALL ON public.admin_users FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.admin_users TO service_role;
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.platform_settings (
  id boolean PRIMARY KEY DEFAULT true CHECK (id = true),
  wallet_address text NOT NULL DEFAULT '',
  min_withdrawal numeric(30,10) NOT NULL DEFAULT 0,
  max_withdrawal numeric(30,10) NOT NULL DEFAULT 1000000,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id)
);
INSERT INTO public.platform_settings (id) VALUES (true) ON CONFLICT (id) DO NOTHING;
GRANT SELECT ON public.platform_settings TO authenticated;
GRANT ALL ON public.platform_settings TO service_role;
ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "platform settings public read" ON public.platform_settings FOR SELECT TO authenticated USING (true);

CREATE OR REPLACE FUNCTION public.is_admin(actor uuid DEFAULT auth.uid())
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = actor) $$;
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
  SELECT * INTO tx FROM public.transactions WHERE id = p_transaction_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Transaction not found'; END IF;
  IF tx.status NOT IN ('pending_confirmation','verifying','pending') THEN
    RAISE EXCEPTION 'Transaction has already been processed';
  END IF;
  IF p_action NOT IN ('approve','decline') THEN RAISE EXCEPTION 'Invalid action'; END IF;

  IF p_action = 'approve' THEN
    IF tx.type = 'deposit' THEN
      UPDATE public.wallets SET balance = balance + tx.amount, updated_at = now()
      WHERE user_id = tx.user_id AND asset = tx.asset;
      IF NOT FOUND THEN RAISE EXCEPTION 'Wallet not found'; END IF;
    END IF;
    UPDATE public.transactions SET status = CASE WHEN tx.type = 'withdrawal' THEN 'completed'::public.tx_status ELSE 'confirmed'::public.tx_status END,
      updated_at = now(), metadata = tx.metadata || jsonb_build_object('reviewed_by', p_admin_id, 'reviewed_at', now(), 'decision', 'approved')
      WHERE id = tx.id RETURNING * INTO tx;
  ELSE
    IF tx.type = 'withdrawal' THEN
      UPDATE public.wallets SET balance = balance + tx.amount, updated_at = now()
      WHERE user_id = tx.user_id AND asset = tx.asset;
      IF NOT FOUND THEN RAISE EXCEPTION 'Wallet not found'; END IF;
    END IF;
    UPDATE public.transactions SET status = 'cancelled'::public.tx_status, updated_at = now(),
      metadata = tx.metadata || jsonb_build_object('reviewed_by', p_admin_id, 'reviewed_at', now(), 'decision', 'declined')
      WHERE id = tx.id RETURNING * INTO tx;
  END IF;
  RETURN tx;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_update_transaction(uuid, text, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_update_transaction(uuid, text, uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.admin_update_settings(
  p_wallet_address text, p_min_withdrawal numeric, p_max_withdrawal numeric, p_admin_id uuid DEFAULT auth.uid()
) RETURNS public.platform_settings
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE result public.platform_settings;
BEGIN
  IF NOT public.is_admin(p_admin_id) THEN RAISE EXCEPTION 'Forbidden'; END IF;
  IF length(trim(p_wallet_address)) < 10 THEN RAISE EXCEPTION 'Wallet address is required'; END IF;
  IF p_min_withdrawal < 0 OR p_max_withdrawal <= p_min_withdrawal THEN RAISE EXCEPTION 'Invalid withdrawal limits'; END IF;
  UPDATE public.platform_settings SET wallet_address = trim(p_wallet_address), min_withdrawal = p_min_withdrawal,
    max_withdrawal = p_max_withdrawal, updated_at = now(), updated_by = p_admin_id WHERE id = true RETURNING * INTO result;
  RETURN result;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_update_settings(text, numeric, numeric, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_update_settings(text, numeric, numeric, uuid) TO service_role;
