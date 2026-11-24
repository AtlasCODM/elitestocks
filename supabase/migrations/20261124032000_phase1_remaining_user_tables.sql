-- EliteStocks Phase 1 remaining live user-table workspace scope
-- Prepared from the supplied workspace_candidate_relations_without_workspace_id
-- result. The target export verified these six public tables have user_id but no
-- workspace_id:
--   deposit_requests, maintenance_requests, mining_rewards, spot_orders,
--   user_miners, withdrawal_requests
--
-- This migration does not recreate tables, delete data, reset balances, alter
-- business columns, or replace existing application policies. It adds a
-- restrictive workspace boundary, which is ANDed with existing permissive RLS
-- policies. Existing global-admin reads remain available to the existing admin
-- role; user reads/writes remain limited to the authenticated user's workspace.
--
-- Run after:
--   1. 20261123230000_phase1_workspace_foundation.sql
--   2. 20261124031000_phase1_workspace_function_privileges.sql
--
-- Run as the Supabase SQL Editor postgres owner during a write-maintenance
-- window, after a verified backup.

BEGIN;

SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '5min';

DO $$
DECLARE
  v_table text;
  v_tables text[] := ARRAY[
    'deposit_requests',
    'maintenance_requests',
    'mining_rewards',
    'spot_orders',
    'user_miners',
    'withdrawal_requests'
  ];
  v_user_udt text;
  v_udt text;
  v_not_null boolean;
  v_fk_exists boolean;
  v_constraint_def text;
BEGIN
  FOREACH v_table IN ARRAY v_tables LOOP
    IF to_regclass(format('public.%I', v_table)) IS NULL THEN
      RAISE EXCEPTION 'Expected live table public.% is missing', v_table;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = v_table AND column_name = 'user_id'
    ) THEN
      RAISE EXCEPTION 'Expected live table public.% has no user_id column', v_table;
    END IF;

    SELECT c.udt_name INTO v_user_udt
    FROM information_schema.columns c
    WHERE c.table_schema = 'public'
      AND c.table_name = v_table
      AND c.column_name = 'user_id';
    IF v_user_udt <> 'uuid' THEN
      RAISE EXCEPTION 'public.%.user_id is incompatible with auth.uid(): type %', v_table, v_user_udt;
    END IF;

    SELECT c.udt_name, c.is_nullable = 'NO'
    INTO v_udt, v_not_null
    FROM information_schema.columns c
    WHERE c.table_schema = 'public'
      AND c.table_name = v_table
      AND c.column_name = 'workspace_id';

    IF NOT FOUND THEN
      EXECUTE format(
        'ALTER TABLE public.%I ADD COLUMN workspace_id uuid NOT NULL DEFAULT %L::uuid',
        v_table, '00000000-0000-0000-0000-000000000001'
      );
    ELSIF v_udt <> 'uuid' OR NOT v_not_null THEN
      RAISE EXCEPTION 'public.%.workspace_id is incompatible (type %, not-null %)', v_table, v_udt, v_not_null;
    END IF;

    SELECT EXISTS (
      SELECT 1
      FROM pg_constraint con
      WHERE con.conrelid = format('public.%I', v_table)::regclass
        AND con.contype = 'f'
        AND pg_get_constraintdef(con.oid) LIKE 'FOREIGN KEY (workspace_id) REFERENCES workspaces(id)%'
    ) INTO v_fk_exists;

    IF NOT v_fk_exists THEN
      IF EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = format('public.%I', v_table)::regclass
          AND conname = format('%s_workspace_id_fkey', v_table)
      ) THEN
        SELECT pg_get_constraintdef(con.oid)
        INTO v_constraint_def
        FROM pg_constraint con
        WHERE conrelid = format('public.%I', v_table)::regclass
          AND conname = format('%s_workspace_id_fkey', v_table);
        RAISE EXCEPTION 'Existing constraint %.workspace_id_fkey is incompatible: %', v_table, v_constraint_def;
      END IF;

      EXECUTE format(
        'ALTER TABLE public.%I ADD CONSTRAINT %I FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id)',
        v_table, format('%s_workspace_id_fkey', v_table)
      );
    END IF;

    EXECUTE format(
      'CREATE INDEX IF NOT EXISTS %I ON public.%I(workspace_id, user_id)',
      format('idx_%s_workspace_user', v_table), v_table
    );

    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', v_table);

    -- Restrictive policies are intentionally used: existing policies remain
    -- intact for their original operation semantics, while every authenticated
    -- operation must also satisfy this workspace boundary.
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', format('workspace_scope_%s', v_table), v_table);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I AS RESTRICTIVE FOR ALL TO authenticated
       USING (
         public.workspace_has_access(workspace_id, auth.uid())
         AND (user_id = auth.uid() OR public.is_admin(auth.uid()))
       )
       WITH CHECK (
         public.workspace_has_access(workspace_id, auth.uid())
         AND (user_id = auth.uid() OR public.is_admin(auth.uid()))
       )',
      format('workspace_scope_%s', v_table), v_table
    );
  END LOOP;
END;
$$;

DO $$
DECLARE
  v_table text;
  v_tables text[] := ARRAY[
    'deposit_requests',
    'maintenance_requests',
    'mining_rewards',
    'spot_orders',
    'user_miners',
    'withdrawal_requests'
  ];
  v_nulls bigint;
BEGIN
  FOREACH v_table IN ARRAY v_tables LOOP
    EXECUTE format('SELECT count(*) FROM public.%I WHERE workspace_id IS NULL', v_table)
      INTO v_nulls;
    IF v_nulls <> 0 THEN
      RAISE EXCEPTION 'public.% contains NULL workspace_id rows', v_table;
    END IF;
  END LOOP;
END;
$$;

COMMIT;
