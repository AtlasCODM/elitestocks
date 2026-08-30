
-- ============ ENUMS ============
CREATE TYPE public.asset_type AS ENUM ('BTC','ETH','SOL','USDT');
CREATE TYPE public.tx_type AS ENUM ('deposit','withdrawal','investment','return','copy_trade','copy_return');
CREATE TYPE public.tx_status AS ENUM (
  'pending_confirmation','verifying','confirmed',
  'pending','processing','successful',
  'completed','failed','cancelled'
);
CREATE TYPE public.investment_status AS ENUM ('active','matured','cancelled');

-- ============ PROFILES ============
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text,
  email text,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own profile read" ON public.profiles FOR SELECT TO authenticated USING (id = auth.uid());
CREATE POLICY "own profile update" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid());

-- ============ WALLETS (cached balances) ============
CREATE TABLE public.wallets (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  asset public.asset_type NOT NULL,
  balance numeric(30,10) NOT NULL DEFAULT 0,
  locked numeric(30,10) NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, asset)
);
GRANT SELECT ON public.wallets TO authenticated;
GRANT ALL ON public.wallets TO service_role;
ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own wallets read" ON public.wallets FOR SELECT TO authenticated USING (user_id = auth.uid());

-- ============ TRANSACTIONS (ledger) ============
CREATE TABLE public.transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type public.tx_type NOT NULL,
  amount numeric(30,10) NOT NULL,
  asset public.asset_type NOT NULL,
  status public.tx_status NOT NULL,
  address text,
  reference_id uuid,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_tx_user_created ON public.transactions(user_id, created_at DESC);
CREATE INDEX idx_tx_status ON public.transactions(status);
GRANT SELECT ON public.transactions TO authenticated;
GRANT ALL ON public.transactions TO service_role;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own tx read" ON public.transactions FOR SELECT TO authenticated USING (user_id = auth.uid());

-- ============ TRADERS ============
CREATE TABLE public.traders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  handle text NOT NULL UNIQUE,
  win_rate numeric NOT NULL,
  roi numeric NOT NULL,
  risk_level text NOT NULL,
  duration_days int NOT NULL,
  profit_pct numeric NOT NULL,
  aum text,
  followers int NOT NULL DEFAULT 0,
  badge text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.traders TO authenticated, anon;
GRANT ALL ON public.traders TO service_role;
ALTER TABLE public.traders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "traders public read" ON public.traders FOR SELECT TO authenticated, anon USING (true);

INSERT INTO public.traders (name, handle, win_rate, roi, risk_level, duration_days, profit_pct, aum, followers, badge) VALUES
('Helios Capital','@helios_cap',78.2,312.4,'Medium',14,42,'12.4M',8421,'Pro'),
('Aurelia Quant','@aurelia_q',71.5,248.1,'Low',7,18,'8.9M',6212,'Elite'),
('Northwind Trading','@northwind',69.8,198.7,'High',30,75,'21.2M',12940,'Elite'),
('Vector Alpha','@vector_a',66.1,172.3,'Medium',14,38,'4.1M',3812,'Pro'),
('Onyx Strategies','@onyx_strat',64.4,154.9,'Low',7,15,'6.7M',5104,'Pro'),
('Meridian AI','@meridian_ai',62.7,141.2,'High',30,68,'9.8M',7321,'Elite');

-- ============ INVESTMENTS ============
CREATE TABLE public.investments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_tier text NOT NULL,
  amount numeric(30,10) NOT NULL,
  asset public.asset_type NOT NULL DEFAULT 'USDT',
  profit_pct numeric NOT NULL,
  duration_days int NOT NULL,
  status public.investment_status NOT NULL DEFAULT 'active',
  matures_at timestamptz NOT NULL,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_inv_user ON public.investments(user_id, created_at DESC);
CREATE INDEX idx_inv_maturity ON public.investments(status, matures_at);
GRANT SELECT ON public.investments TO authenticated;
GRANT ALL ON public.investments TO service_role;
ALTER TABLE public.investments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own investments read" ON public.investments FOR SELECT TO authenticated USING (user_id = auth.uid());

-- ============ COPY TRADES ============
CREATE TABLE public.copy_trades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  trader_id uuid NOT NULL REFERENCES public.traders(id),
  amount numeric(30,10) NOT NULL,
  asset public.asset_type NOT NULL DEFAULT 'USDT',
  profit_pct numeric NOT NULL,
  duration_days int NOT NULL,
  status public.investment_status NOT NULL DEFAULT 'active',
  matures_at timestamptz NOT NULL,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_copy_user ON public.copy_trades(user_id, created_at DESC);
CREATE INDEX idx_copy_maturity ON public.copy_trades(status, matures_at);
GRANT SELECT ON public.copy_trades TO authenticated;
GRANT ALL ON public.copy_trades TO service_role;
ALTER TABLE public.copy_trades ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own copy read" ON public.copy_trades FOR SELECT TO authenticated USING (user_id = auth.uid());

-- ============ AUTO-CREATE PROFILE + WALLETS ON SIGNUP ============
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email,'@',1)));

  INSERT INTO public.wallets (user_id, asset, balance) VALUES
    (NEW.id, 'BTC', 0),
    (NEW.id, 'ETH', 0),
    (NEW.id, 'SOL', 0),
    (NEW.id, 'USDT', 0);
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
