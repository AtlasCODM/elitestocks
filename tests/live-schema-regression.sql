-- LOCAL TEST ASSERTIONS ONLY. Never run this against Supabase.
CREATE FUNCTION pg_temp.assert(ok boolean, message text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN IF ok IS DISTINCT FROM true THEN RAISE EXCEPTION 'ASSERTION FAILED: %',message; END IF;
RAISE NOTICE 'PASS: %',message; END $$;
SELECT pg_temp.assert(NOT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='platform_settings' AND column_name='wallet_address'),'no generic wallet_address added to live layout');
SELECT pg_temp.assert((SELECT to_jsonb(s)-'updated_by'=snapshot.settings FROM platform_settings s CROSS JOIN test_settings_snapshot snapshot WHERE id=true),'all existing settings, addresses, fees, switches and timestamps unchanged on installation');
SELECT pg_temp.assert((SELECT updated_by IS NULL FROM platform_settings WHERE id=true),'nullable editor pointer added without fabricated historical actor');
SELECT pg_temp.assert((SELECT (config->>'minWithdrawal')::numeric=10 AND (config->>'maxWithdrawal')::numeric=100000 FROM investment_engine_config WHERE id=true),'unrestricted numeric withdrawal limits seeded exactly without stripping integer zeros');

DO $$ DECLARE v_result jsonb; v_blocked boolean; v_asset public.asset_type; v_expected text; v_before jsonb; v_after jsonb; v_count int;
BEGIN
 SELECT to_jsonb(s) INTO v_before FROM platform_settings s WHERE id=true;
 -- Empty canonical fields must retain each real legacy address as the fallback.
 UPDATE platform_settings SET bitcoin_wallet_address='',ethereum_wallet_address='',solana_wallet_address='',usdt_wallet_address='';
 FOR v_asset,v_expected IN SELECT * FROM (VALUES
   ('BTC'::public.asset_type,'existing-legacy-btc'),('ETH'::public.asset_type,'existing-legacy-eth'),
   ('SOL'::public.asset_type,'existing-legacy-sol'),('USDT'::public.asset_type,'existing-legacy-usdt')
 ) AS addresses(asset,address) LOOP
   v_result:=engine_confirm_deposit('00000000-0000-0000-0000-000000000002',v_asset,25);
   PERFORM pg_temp.assert((SELECT address=v_expected FROM transactions WHERE id=(v_result->>'id')::uuid),'deposit uses existing legacy address for '||v_asset::text);
 END LOOP;
 UPDATE platform_settings SET deposits_enabled=false;
 v_blocked:=false;
 BEGIN PERFORM engine_confirm_deposit('00000000-0000-0000-0000-000000000002','USDT',25); EXCEPTION WHEN OTHERS THEN v_blocked:=true; END;
 PERFORM pg_temp.assert(v_blocked,'existing deposits_enabled switch cannot be bypassed');
 UPDATE platform_settings SET deposits_enabled=true,withdrawals_enabled=false;
 v_blocked:=false;
 BEGIN PERFORM engine_create_withdrawal('00000000-0000-0000-0000-000000000002','USDT',25,'existing-destination'); EXCEPTION WHEN OTHERS THEN v_blocked:=true; END;
 PERFORM pg_temp.assert(v_blocked,'existing withdrawals_enabled switch cannot be bypassed');
 UPDATE platform_settings SET withdrawals_enabled=true;
 SELECT count(*) INTO v_count FROM investment_engine_audit;
 PERFORM admin_update_settings('new-btc-admin','new-eth-admin','new-sol-admin','new-usdt-admin',11,99999,'00000000-0000-0000-0000-000000000001');
 PERFORM pg_temp.assert((SELECT bitcoin_wallet_address=addr_btc AND ethereum_wallet_address=addr_erc20 AND solana_wallet_address=addr_solana AND usdt_wallet_address=addr_trc20 FROM platform_settings WHERE id=true),'authorized wallet edits synchronize existing aliases atomically');
 PERFORM pg_temp.assert((SELECT count(*)=v_count+1 FROM investment_engine_audit),'compatibility financial save audited exactly once');
 SELECT to_jsonb(s) INTO v_after FROM platform_settings s WHERE id=true;
 PERFORM pg_temp.assert(v_before->'withdrawal_fee_pct'=v_after->'withdrawal_fee_pct' AND v_before->'maintenance_fee_pct'=v_after->'maintenance_fee_pct' AND v_before->'mining_enabled'=v_after->'mining_enabled' AND v_before->'maintenance_enabled'=v_after->'maintenance_enabled','existing fees and unrelated switches preserved through admin writes');
 -- Restore limits expected by the common regression suite; do not touch audit.
 PERFORM admin_update_settings('test-btc-address','test-eth-address','test-sol-address','test-usdt-address',10,100000,'00000000-0000-0000-0000-000000000001');
END $$;
