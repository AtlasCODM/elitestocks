\set VERBOSITY verbose
CREATE FUNCTION pg_temp.assert(ok boolean, message text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN IF ok IS DISTINCT FROM true THEN RAISE EXCEPTION 'ASSERTION FAILED: %',message; END IF;
RAISE NOTICE 'PASS: %',message; END $$;

SELECT pg_temp.assert((SELECT amount=432.1234567890 AND profit_pct=17.123 AND duration_days=9 AND plan_tier='Legacy special contract' AND created_at='2026-11-01T12:34:56Z' AND matures_at='2099-11-10T12:34:56Z' AND status='active' FROM investments WHERE id='10000000-0000-0000-0000-000000000001'), 'legacy original terms and timestamps preserved');
SELECT pg_temp.assert((SELECT amount=135 AND metadata='{"legacy":true}'::jsonb FROM transactions WHERE id='20000000-0000-0000-0000-000000000001'), 'historical ledger preserved');
SELECT pg_temp.assert((SELECT jsonb_array_length(config->'plans')=6 AND config->>'minWithdrawal'='10' AND config->>'maxWithdrawal'='100000' FROM investment_engine_config), 'six seeded plans and legacy withdrawal limits');
SELECT pg_temp.assert((SELECT count(*)=4 FROM wallets WHERE user_id='00000000-0000-0000-0000-000000000002'), 'existing auth signup trigger creates four wallets');

DO $$ DECLARE c jsonb; v int; before_balance numeric; result jsonb; position_id uuid; copy_id uuid; deposit_id uuid; withdrawal_id uuid; before_audit int; blocked boolean;
BEGIN
 SELECT config,version INTO c,v FROM investment_engine_config WHERE id=true;
 BEGIN
  PERFORM engine_update_configuration('00000000-0000-0000-0000-000000000002',v,c);
  RAISE EXCEPTION 'normal user updated configuration';
 EXCEPTION WHEN OTHERS THEN
  IF SQLERRM='normal user updated configuration' THEN RAISE; END IF;
 END;
 PERFORM pg_temp.assert(true,'non-admin configuration modification rejected');
 c:=jsonb_set(c,'{minInvestment}','100');
 c:=jsonb_set(c,'{maxInvestment}','2000');
 c:=jsonb_set(c,'{minDeposit}','5');
 c:=jsonb_set(c,'{maxDeposit}','500');
 c:=jsonb_set(c,'{minWithdrawal}','20');
 c:=jsonb_set(c,'{maxWithdrawal}','600');
 c:=jsonb_set(c,'{calculationInterval}','"hourly"');
 c:=jsonb_set(c,'{plans,0,profitPct}','12');
 c:=jsonb_set(c,'{plans,0,days}','2');
 c:=engine_update_configuration('00000000-0000-0000-0000-000000000001',v,c);
 PERFORM pg_temp.assert((c->>'version')::int=v+1,'admin configuration persists and increments version');
 PERFORM pg_temp.assert((SELECT min_withdrawal=20 AND max_withdrawal=600 FROM platform_settings),'legacy settings synchronized');
 PERFORM pg_temp.assert((SELECT count(*)>=1 FROM investment_engine_audit),'admin change has audit record');
 BEGIN
  PERFORM engine_update_configuration('00000000-0000-0000-0000-000000000001',v,c);
  RAISE EXCEPTION 'stale update succeeded';
 EXCEPTION WHEN OTHERS THEN IF SQLERRM='stale update succeeded' THEN RAISE; END IF; END;
 PERFORM pg_temp.assert(true,'optimistic version rejects stale saves');
 BEGIN
  PERFORM engine_update_configuration('00000000-0000-0000-0000-000000000001',(c->>'version')::int,jsonb_set(c,'{maxInvestment}','1'));
  RAISE EXCEPTION 'invalid limits succeeded';
 EXCEPTION WHEN OTHERS THEN IF SQLERRM='invalid limits succeeded' THEN RAISE; END IF; END;
 PERFORM pg_temp.assert(true,'database rejects invalid configuration limits');
 SELECT balance INTO before_balance FROM wallets WHERE user_id='00000000-0000-0000-0000-000000000002' AND asset='USDT';
 BEGIN
  PERFORM engine_create_investment('00000000-0000-0000-0000-000000000002','Starter 3D',99);
  RAISE EXCEPTION 'below limit succeeded';
 EXCEPTION WHEN OTHERS THEN IF SQLERRM='below limit succeeded' THEN RAISE; END IF; END;
 PERFORM pg_temp.assert((SELECT balance=before_balance FROM wallets WHERE user_id='00000000-0000-0000-0000-000000000002' AND asset='USDT'),'rejected creation leaves wallet unchanged');
 result:=engine_create_investment('00000000-0000-0000-0000-000000000002','Starter 3D',1000);
 position_id:=(result->>'id')::uuid;
 PERFORM pg_temp.assert((SELECT balance=before_balance-1000 FROM wallets WHERE user_id='00000000-0000-0000-0000-000000000002' AND asset='USDT'),'creation debits principal exactly once');
 PERFORM pg_temp.assert((SELECT profit_pct=12 AND duration_days=2 AND calculation_interval='hourly' AND config_version=(c->>'version')::int FROM investments WHERE id=position_id),'new investment snapshots config version/rate/duration/interval');
 PERFORM pg_temp.assert((SELECT count(*)=1 FROM transactions WHERE reference_id=position_id AND type='investment'),'creation records ledger atomically');
 c:=jsonb_set(c,'{plans,0,profitPct}','99');
 c:=jsonb_set(c,'{plans,0,enabled}','false');
 c:=engine_update_configuration('00000000-0000-0000-0000-000000000001',(c->>'version')::int,c);
 PERFORM pg_temp.assert((SELECT profit_pct=12 AND duration_days=2 FROM investments WHERE id=position_id),'edited plan does not alter active original terms');
 BEGIN
  PERFORM engine_create_investment('00000000-0000-0000-0000-000000000002','Starter 3D',1000);
  RAISE EXCEPTION 'disabled plan succeeded';
 EXCEPTION WHEN OTHERS THEN IF SQLERRM='disabled plan succeeded' THEN RAISE; END IF; END;
 PERFORM pg_temp.assert(true,'disabled plan rejects new creation');
 BEGIN
  PERFORM engine_cancel_position('00000000-0000-0000-0000-000000000003',position_id,'investment');
  RAISE EXCEPTION 'cross-user cancellation succeeded';
 EXCEPTION WHEN OTHERS THEN IF SQLERRM='cross-user cancellation succeeded' THEN RAISE; END IF; END;
 PERFORM pg_temp.assert(true,'cross-user cancellation rejected');
 PERFORM engine_cancel_position('00000000-0000-0000-0000-000000000002',position_id,'investment');
 BEGIN PERFORM engine_cancel_position('00000000-0000-0000-0000-000000000002',position_id,'investment'); EXCEPTION WHEN OTHERS THEN NULL; END;
 PERFORM pg_temp.assert((SELECT balance=before_balance FROM wallets WHERE user_id='00000000-0000-0000-0000-000000000002' AND asset='USDT'),'repeated cancellation refunds once');
 PERFORM pg_temp.assert((SELECT count(*)=1 FROM transactions WHERE reference_id=position_id AND type='return'),'single cancellation return entry');

 BEGIN
  PERFORM engine_confirm_deposit('00000000-0000-0000-0000-000000000002','USDT',4);
  RAISE EXCEPTION 'below deposit limit succeeded';
 EXCEPTION WHEN OTHERS THEN IF SQLERRM='below deposit limit succeeded' THEN RAISE; END IF; END;
 result:=engine_confirm_deposit('00000000-0000-0000-0000-000000000002','USDT',100);
 deposit_id:=(result->>'id')::uuid;
 PERFORM pg_temp.assert((SELECT status='pending_confirmation' AND address='test-usdt-address' FROM transactions WHERE id=deposit_id),'deposit workflow preserves configured address and pending state');
 UPDATE transactions SET created_at=clock_timestamp()-interval '10 minutes' WHERE id=deposit_id;
 PERFORM engine_process_jobs(); PERFORM engine_process_jobs();
 PERFORM pg_temp.assert((SELECT balance=before_balance+100 FROM wallets WHERE user_id='00000000-0000-0000-0000-000000000002' AND asset='USDT'),'repeated deposit processing credits once');
 BEGIN
  PERFORM engine_create_withdrawal('00000000-0000-0000-0000-000000000002','USDT',19,'destination-address');
  RAISE EXCEPTION 'below withdrawal limit succeeded';
 EXCEPTION WHEN OTHERS THEN IF SQLERRM='below withdrawal limit succeeded' THEN RAISE; END IF; END;
 result:=engine_create_withdrawal('00000000-0000-0000-0000-000000000002','USDT',30,'destination-address');
 withdrawal_id:=(result->>'id')::uuid;
 PERFORM pg_temp.assert((SELECT balance=before_balance+70 FROM wallets WHERE user_id='00000000-0000-0000-0000-000000000002' AND asset='USDT'),'withdrawal debits exactly once');
 PERFORM admin_update_transaction(withdrawal_id,'decline','00000000-0000-0000-0000-000000000001');
 PERFORM pg_temp.assert((SELECT balance=before_balance+100 FROM wallets WHERE user_id='00000000-0000-0000-0000-000000000002' AND asset='USDT'),'existing administrative decline refunds withdrawal');

 c:=jsonb_set(c,'{plans,0,enabled}','true');
 c:=engine_update_configuration('00000000-0000-0000-0000-000000000001',(c->>'version')::int,c);
 result:=engine_create_investment('00000000-0000-0000-0000-000000000002','Starter 3D',1000);
 position_id:=(result->>'id')::uuid;
 UPDATE investments SET matures_at=clock_timestamp()-interval '1 second',created_at=clock_timestamp()-interval '2 days' WHERE id=position_id;
 PERFORM engine_process_jobs(); PERFORM engine_process_jobs();
 PERFORM pg_temp.assert((SELECT balance=before_balance+100 FROM wallets WHERE user_id='00000000-0000-0000-0000-000000000002' AND asset='USDT'),'maturity releases principal once without fabricated projected profits');
 PERFORM pg_temp.assert((SELECT status='matured' AND credited_profit=0 FROM investments WHERE id=position_id),'accurate matured status and zero unverified credits');
 BEGIN
  PERFORM engine_record_performance('00000000-0000-0000-0000-000000000002','investment',position_id,25,'audit:verified-trades-1','contract:terms-1');
  RAISE EXCEPTION 'non-admin performance succeeded';
 EXCEPTION WHEN OTHERS THEN IF SQLERRM='non-admin performance succeeded' THEN RAISE; END IF; END;
 BEGIN
  PERFORM engine_record_performance('00000000-0000-0000-0000-000000000001','investment',position_id,25,'','contract:terms-1');
  RAISE EXCEPTION 'empty evidence succeeded';
 EXCEPTION WHEN OTHERS THEN IF SQLERRM='empty evidence succeeded' THEN RAISE; END IF; END;
 PERFORM pg_temp.assert(true,'performance requires authorized administrator and nonempty evidence');
 PERFORM engine_record_performance('00000000-0000-0000-0000-000000000001','investment',position_id,25,'audit:verified-trades-1','contract:terms-1');
 PERFORM engine_process_jobs(); PERFORM engine_process_jobs();
 PERFORM pg_temp.assert((SELECT balance=before_balance+125 FROM wallets WHERE user_id='00000000-0000-0000-0000-000000000002' AND asset='USDT'),'verified actual profit credited once, distinct from configured percentage');
 PERFORM pg_temp.assert((SELECT credited_profit=25 FROM investments WHERE id=position_id),'actual credited profit matches verifiable performance record');
 BEGIN
  PERFORM engine_record_performance('00000000-0000-0000-0000-000000000001','investment',position_id,50,'audit:duplicate','contract:terms-1');
  RAISE EXCEPTION 'duplicate verification succeeded';
 EXCEPTION WHEN OTHERS THEN IF SQLERRM='duplicate verification succeeded' THEN RAISE; END IF; END;
 PERFORM pg_temp.assert(true,'duplicate actual-performance record rejected');
 PERFORM pg_temp.assert((SELECT count(*)=1 FROM transactions WHERE reference_id='10000000-0000-0000-0000-000000000002'),'historically matured investment never settled twice');

 result:=engine_create_copy_trade('00000000-0000-0000-0000-000000000002',(SELECT id FROM traders ORDER BY name LIMIT 1),100);
 copy_id:=(result->>'id')::uuid;
 PERFORM engine_cancel_position('00000000-0000-0000-0000-000000000002',copy_id,'copy_trade');
 PERFORM pg_temp.assert((SELECT status='cancelled' FROM copy_trades WHERE id=copy_id),'copy-trading workflow remains compatible');
 SELECT count(*) INTO before_audit FROM investment_engine_audit;
 PERFORM admin_update_settings('test-btc-address','test-eth-address','test-sol-address','test-usdt-address',21,601,'00000000-0000-0000-0000-000000000001');
 PERFORM pg_temp.assert((SELECT (config->>'minWithdrawal')::numeric=21 AND (config->>'maxWithdrawal')::numeric=601 FROM investment_engine_config),'legacy settings writes synchronize centralized financial limits');
 PERFORM pg_temp.assert((SELECT count(*)=before_audit+1 FROM investment_engine_audit),'legacy financial setting change also audited once');
END $$;

-- Direct authenticated/anonymous callers cannot invoke privileged financial RPCs.
SELECT pg_temp.assert(NOT EXISTS (
 SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname='public' AND p.proname LIKE 'engine_%'
 AND p.proname IN ('engine_update_configuration','engine_create_investment','engine_create_copy_trade','engine_confirm_deposit','engine_create_withdrawal','engine_cancel_position','engine_process_jobs','engine_record_performance')
 AND (has_function_privilege('anon',p.oid,'EXECUTE') OR has_function_privilege('authenticated',p.oid,'EXECUTE'))
),'all financial mutation RPCs deny anonymous/authenticated direct execution');
SELECT pg_temp.assert(NOT has_table_privilege('authenticated','investment_engine_config','UPDATE'),'authenticated users cannot update financial configuration table');
SELECT pg_temp.assert(NOT has_table_privilege('authenticated','investment_engine_audit','DELETE'),'authenticated users cannot delete audit history');
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000002',false);
DO $$ BEGIN IF EXISTS(SELECT 1 FROM wallets WHERE user_id<>'00000000-0000-0000-0000-000000000002') THEN RAISE EXCEPTION 'cross-user wallet leak'; END IF; END $$;
RESET ROLE;
SELECT pg_temp.assert(true,'Supabase-style authenticated ownership RLS still protects wallet reads');
