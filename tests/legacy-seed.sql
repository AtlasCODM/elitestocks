-- Seed BEFORE the upgrade migration to prove existing records are not rewritten.
INSERT INTO auth.users(id,email) VALUES
 ('00000000-0000-0000-0000-000000000001','admin@test.invalid'),
 ('00000000-0000-0000-0000-000000000002','user@test.invalid'),
 ('00000000-0000-0000-0000-000000000003','other@test.invalid');
INSERT INTO public.user_roles(user_id,role) VALUES ('00000000-0000-0000-0000-000000000001','admin');
UPDATE public.wallets SET balance=100000 WHERE asset='USDT';
UPDATE public.platform_settings SET min_withdrawal=10,max_withdrawal=100000,
  bitcoin_wallet_address='test-btc-address',ethereum_wallet_address='test-eth-address',
  solana_wallet_address='test-sol-address',usdt_wallet_address='test-usdt-address';
INSERT INTO public.investments(id,user_id,plan_tier,amount,profit_pct,duration_days,status,created_at,matures_at)
VALUES ('10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002','Legacy special contract',432.1234567890,17.123,9,'active','2026-11-01T12:34:56Z','2099-11-10T12:34:56Z');
INSERT INTO public.investments(id,user_id,plan_tier,amount,profit_pct,duration_days,status,created_at,matures_at,completed_at)
VALUES ('10000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000002','Previously settled',100,35,3,'matured','2026-01-01T00:00:00Z','2026-01-04T00:00:00Z','2026-01-04T00:00:00Z');
INSERT INTO public.transactions(id,user_id,type,amount,asset,status,reference_id,metadata)
VALUES ('20000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002','return',135,'USDT','completed','10000000-0000-0000-0000-000000000002','{"legacy":true}');
