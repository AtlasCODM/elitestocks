CREATE FUNCTION pg_temp.assert(ok boolean, message text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN IF ok IS DISTINCT FROM true THEN RAISE EXCEPTION 'ASSERTION FAILED: %',message; END IF;
RAISE NOTICE 'PASS: %',message; END $$;
DO $$ DECLARE c jsonb; result jsonb; v_user_id uuid := '00000000-0000-0000-0000-000000000006';
BEGIN
 SELECT config INTO c FROM investment_engine_config WHERE id=true;
 c:=jsonb_set(c,'{maxInvestment}','10000000000');
 c:=engine_update_configuration('00000000-0000-0000-0000-000000000001',(c->>'version')::int,c);
 INSERT INTO auth.users(id,email) VALUES(v_user_id,'precision@test.invalid');
 UPDATE wallets w SET balance=10000000000 WHERE w.user_id=v_user_id AND asset='USDT';
 result:=engine_create_investment(v_user_id,'Starter 3D','9999999999.1234567890'::numeric);
 PERFORM pg_temp.assert((SELECT amount=9999999999.1234567890::numeric FROM investments WHERE id=(result->>'id')::uuid),'ten-decimal large principal recorded exactly');
 PERFORM pg_temp.assert((SELECT balance=10000000000::numeric-9999999999.1234567890::numeric FROM wallets w WHERE w.user_id=v_user_id AND asset='USDT'),'ten-decimal large principal debited exactly');
 PERFORM pg_temp.assert((SELECT amount=9999999999.1234567890::numeric FROM transactions WHERE reference_id=(result->>'id')::uuid),'ten-decimal large ledger entry recorded exactly');
 PERFORM engine_cancel_position(v_user_id,(result->>'id')::uuid,'investment');
 PERFORM pg_temp.assert((SELECT balance=10000000000::numeric FROM wallets w WHERE w.user_id=v_user_id AND asset='USDT'),'exact principal fully refunded without rounding');
END $$;
