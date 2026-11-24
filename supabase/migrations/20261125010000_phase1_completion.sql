-- EliteStocks Phase 1 completion and compatibility repair
--
-- This migration does not create additional workspaces, change administrator
-- assignments, change financial values, or rewrite financial RPC business logic.
-- It repairs the new-user trigger so every future account receives primary
-- workspace membership, then validates the Phase 1 schema boundary.
--
-- Execute after:
--   1. 20261123230000_phase1_workspace_foundation.sql
--   2. 20261124031000_phase1_workspace_function_privileges.sql
--   3. 20261124032000_phase1_remaining_user_tables.sql
--   4. 20261124044500_phase2_security_definer_privilege_repair.sql
--
-- Execute as the Supabase SQL Editor postgres owner. Do not run concurrently
-- with account creation or financial writes.

BEGIN;

SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '5min';

DO $$
DECLARE
  v_primary constant uuid := '00000000-0000-0000-0000-000000000001'::uuid;
  v_table text;
  v_tables constant text[] := ARRAY[
    'wallets',
    'transactions',
    'investments',
    'copy_trades',
    'traders',
    'support_conversations',
    'support_messages',
    'investment_engine_audit',
    'investment_engine_performance',
    'deposit_requests',
    'maintenance_requests',
    'mining_rewards',
    'spot_orders',
    'user_miners',
    'withdrawal_requests'
  ];
  v_udt text;
  v_nullable text;
  v_default text;
  v_fk_count integer;
  v_fk_definition text;
BEGIN
  IF to_regclass('public.workspaces') IS NULL
     OR to_regclass('public.workspace_members') IS NULL THEN
    RAISE EXCEPTION 'Phase 1 foundation is missing workspaces or workspace_members';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.workspaces
    WHERE id = v_primary
      AND is_active
  ) THEN
    RAISE EXCEPTION 'Primary workspace is missing or inactive';
  END IF;

  IF to_regclass('public.profiles') IS NULL THEN
    RAISE EXCEPTION 'Required public.profiles table is missing';
  END IF;

  FOREACH v_table IN ARRAY v_tables LOOP
    IF to_regclass(format('public.%I', v_table)) IS NULL THEN
      RAISE EXCEPTION 'Required Phase 1 table public.% is missing', v_table;
    END IF;

    SELECT c.udt_name, c.is_nullable, c.column_default
      INTO v_udt, v_nullable, v_default
    FROM information_schema.columns AS c
    WHERE c.table_schema = 'public'
      AND c.table_name = v_table
      AND c.column_name = 'workspace_id';

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Required public.%.workspace_id column is missing', v_table;
    END IF;

    IF v_udt <> 'uuid' OR v_nullable <> 'NO' THEN
      RAISE EXCEPTION
        'Incompatible public.%.workspace_id definition: type %, nullable %',
        v_table, v_udt, v_nullable;
    END IF;

    IF v_default IS NULL
       OR position('00000000-0000-0000-0000-000000000001' IN v_default) = 0 THEN
      RAISE EXCEPTION
        'public.%.workspace_id does not default to the primary workspace: %',
        v_table, coalesce(v_default, '<null>');
    END IF;

    SELECT count(*), max(pg_get_constraintdef(con.oid, true))
      INTO v_fk_count, v_fk_definition
    FROM pg_constraint AS con
    WHERE con.conrelid = format('public.%I', v_table)::regclass
      AND con.contype = 'f'
      AND con.conkey = ARRAY[
        (SELECT attnum
         FROM pg_attribute
         WHERE attrelid = format('public.%I', v_table)::regclass
           AND attname = 'workspace_id'
           AND NOT attisdropped)
      ]::smallint[]
      AND con.confrelid = 'public.workspaces'::regclass;

    IF v_fk_count <> 1 THEN
      RAISE EXCEPTION
        'public.%.workspace_id must have exactly one foreign key to public.workspaces(id); found %',
        v_table, v_fk_count;
    END IF;

    IF v_fk_definition NOT LIKE 'FOREIGN KEY (workspace_id) REFERENCES workspaces(id)%' THEN
      RAISE EXCEPTION
        'public.%.workspace_id foreign key is incompatible: %',
        v_table, v_fk_definition;
    END IF;
  END LOOP;
END;
$$;

DO $$
DECLARE
  v_missing bigint;
BEGIN
  SELECT count(*)
    INTO v_missing
  FROM public.profiles AS p
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.workspace_members AS m
    WHERE m.workspace_id = '00000000-0000-0000-0000-000000000001'::uuid
      AND m.user_id = p.id
  );

  IF v_missing <> 0 THEN
    RAISE EXCEPTION
      'Phase 1 membership mapping is incomplete: % profiles have no primary membership',
      v_missing;
  END IF;
END;
$$;

DO $$
BEGIN
  IF to_regprocedure('public.handle_new_user()') IS NULL THEN
    RAISE EXCEPTION 'Required public.handle_new_user() trigger function is missing';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger AS tg
    WHERE tg.tgrelid = 'auth.users'::regclass
      AND tg.tgname = 'on_auth_user_created'
      AND NOT tg.tgisinternal
  ) THEN
    RAISE EXCEPTION 'Required auth.users trigger on_auth_user_created is missing';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1))
  );

  INSERT INTO public.workspace_members (workspace_id, user_id)
  VALUES ('00000000-0000-0000-0000-000000000001'::uuid, NEW.id)
  ON CONFLICT (workspace_id, user_id) DO NOTHING;

  INSERT INTO public.wallets (user_id, asset, balance)
  VALUES
    (NEW.id, 'BTC', 0),
    (NEW.id, 'ETH', 0),
    (NEW.id, 'SOL', 0),
    (NEW.id, 'USDT', 0);

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO service_role;

DO $$
DECLARE
  v_public_execute boolean;
  v_anon_execute boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM pg_proc AS p
    JOIN pg_namespace AS n ON n.oid = p.pronamespace
    CROSS JOIN LATERAL aclexplode(
      coalesce(p.proacl, acldefault('f', p.proowner))
    ) AS acl
    WHERE n.nspname = 'public'
      AND p.oid = 'public.handle_new_user()'::regprocedure
      AND acl.grantee = 0
      AND acl.privilege_type = 'EXECUTE'
  )
    INTO v_public_execute;
  SELECT has_function_privilege('anon', 'public.handle_new_user()', 'EXECUTE')
    INTO v_anon_execute;

  IF v_public_execute OR v_anon_execute THEN
    RAISE EXCEPTION 'handle_new_user retains PUBLIC or anon EXECUTE privilege';
  END IF;
END;
$$;

DO $$
DECLARE
  v_primary constant uuid := '00000000-0000-0000-0000-000000000001'::uuid;
  v_workspace_count bigint;
  v_profile_count bigint;
  v_member_count bigint;
  v_null_count bigint;
BEGIN
  SELECT count(*) INTO v_workspace_count
  FROM public.workspaces
  WHERE id = v_primary;

  SELECT count(*) INTO v_profile_count FROM public.profiles;

  SELECT count(*) INTO v_member_count
  FROM public.workspace_members
  WHERE workspace_id = v_primary;

  IF v_workspace_count <> 1 OR v_profile_count <> v_member_count THEN
    RAISE EXCEPTION
      'Primary workspace membership invariant failed: workspaces %, profiles %, members %',
      v_workspace_count, v_profile_count, v_member_count;
  END IF;

  SELECT count(*) INTO v_null_count
  FROM public.workspace_members
  WHERE workspace_id IS NULL OR user_id IS NULL;

  IF v_null_count <> 0 THEN
    RAISE EXCEPTION 'workspace_members contains NULL key values';
  END IF;
END;
$$;

COMMIT;

-- Run supabase/diagnostics/workspace-phase1-completion-verification.sql separately.
