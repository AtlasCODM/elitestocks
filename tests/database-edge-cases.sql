-- Runs in the same isolated fixture after the main financial cases.
CREATE FUNCTION pg_temp.assert(ok boolean, message text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN IF ok IS DISTINCT FROM true THEN RAISE EXCEPTION 'ASSERTION FAILED: %',message; END IF;
RAISE NOTICE 'PASS: %',message; END $$;
DO $$ DECLARE c jsonb; result jsonb; position_id uuid; blocked boolean; before_balance numeric; editor uuid := '00000000-0000-0000-0000-000000000005';
BEGIN
 SELECT config INTO c FROM investment_engine_config WHERE id=true;
 FOR result IN SELECT value FROM jsonb_array_elements('[{"calculationInterval":null},{"returnMode":null},{"maxDeposit":null}]'::jsonb) LOOP
  blocked:=false;
  BEGIN
   PERFORM engine_update_configuration('00000000-0000-0000-0000-000000000001',(c->>'version')::int,c || result);
  EXCEPTION WHEN OTHERS THEN blocked:=true; END;
  PERFORM pg_temp.assert(blocked,'null mandatory configuration value rejected');
 END LOOP;
 blocked:=false;
 BEGIN PERFORM engine_confirm_deposit('00000000-0000-0000-0000-000000000002','USDT',0.00000000001); EXCEPTION WHEN OTHERS THEN blocked:=true; END;
 PERFORM pg_temp.assert(blocked,'unrepresentable sub-10-decimal amount cannot create zero ledger entries');
 SELECT balance INTO before_balance FROM wallets WHERE user_id='00000000-0000-0000-0000-000000000002' AND asset='USDT';
 blocked:=false;
 BEGIN PERFORM engine_record_performance('00000000-0000-0000-0000-000000000001','investment','10000000-0000-0000-0000-000000000002',35,'historical-evidence','historical-contract'); EXCEPTION WHEN OTHERS THEN blocked:=true; END;
 PERFORM pg_temp.assert(blocked,'historically settled legacy position cannot receive a duplicate profit');
 PERFORM engine_process_jobs();
 PERFORM pg_temp.assert((SELECT balance=before_balance FROM wallets WHERE user_id='00000000-0000-0000-0000-000000000002' AND asset='USDT'),'historical duplicate-credit attempt leaves wallet unchanged');
 blocked:=false;
 BEGIN UPDATE investment_engine_audit SET created_at=clock_timestamp(); EXCEPTION WHEN OTHERS THEN blocked:=true; END;
 PERFORM pg_temp.assert(blocked,'audit history cannot be rewritten');
 blocked:=false;
 BEGIN DELETE FROM investment_engine_performance; EXCEPTION WHEN OTHERS THEN blocked:=true; END;
 PERFORM pg_temp.assert(blocked,'verified performance provenance cannot be deleted');
 INSERT INTO auth.users(id,email) VALUES(editor,'former-editor@test.invalid');
 INSERT INTO user_roles(user_id,role) VALUES(editor,'admin');
 c:=engine_update_configuration(editor,(c->>'version')::int,c);
 DELETE FROM auth.users WHERE id=editor;
 PERFORM pg_temp.assert(EXISTS(SELECT 1 FROM investment_engine_audit WHERE actor_id=editor),'existing admin user deletion does not erase or invalidate immutable historical audit');
END $$;
