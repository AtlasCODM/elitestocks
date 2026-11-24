-- EliteStocks Phase 1 workspace foundation
-- Prepared from the supplied PostgreSQL 17.6 verification export.
--
-- This migration is additive and data-preserving. It creates one primary
-- workspace, maps every existing profile to it, and adds workspace ownership
-- to tenant data. It does not change public.user_roles, appoint administrators,
-- create a super-admin hierarchy, reset data, or disable RLS.
--
-- IMPORTANT:
-- 1. Run the read-only preflight and take a verified backup first.
-- 2. Run this file as the Supabase SQL Editor postgres owner in one execution.
-- 3. Do not run it concurrently with application writes.
-- 4. Existing application RPCs remain backward-compatible through the primary
--    workspace default, but the application and SECURITY DEFINER engine/admin/
--    support RPCs must be made workspace-aware before a second workspace is
--    opened. This migration alone is not a complete application rollout.
-- 5. The immutable engine-history rows are assigned by ADD COLUMN ... DEFAULT;
--    no UPDATE is issued against those tables and their immutable triggers remain
--    installed and unconditional.

BEGIN;

SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '5min';

-- The target export has no workspace tables. If a partial implementation exists,
-- stop rather than silently accepting an incompatible definition.
DO $$
DECLARE
  required text[] := ARRAY['id','slug','name','is_active','created_at','updated_at'];
  c text;
BEGIN
  IF to_regclass('public.workspaces') IS NOT NULL THEN
    FOREACH c IN ARRAY required LOOP
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'workspaces' AND column_name = c
      ) THEN
        RAISE EXCEPTION 'Existing public.workspaces is incompatible: missing column %', c;
      END IF;
    END LOOP;
  ELSE
    CREATE TABLE public.workspaces (
      id uuid PRIMARY KEY,
      slug text NOT NULL UNIQUE,
      name text NOT NULL,
      is_active boolean NOT NULL DEFAULT true,
      created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
      updated_at timestamptz NOT NULL DEFAULT clock_timestamp()
    );
  END IF;

  required := ARRAY['workspace_id','user_id','created_at'];
  IF to_regclass('public.workspace_members') IS NOT NULL THEN
    FOREACH c IN ARRAY required LOOP
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'workspace_members' AND column_name = c
      ) THEN
        RAISE EXCEPTION 'Existing public.workspace_members is incompatible: missing column %', c;
      END IF;
    END LOOP;
  ELSE
    CREATE TABLE public.workspace_members (
      workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
      user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
      created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
      PRIMARY KEY (workspace_id, user_id)
    );
  END IF;
END;
$$;

-- The fixed UUID makes reruns deterministic and avoids selecting an arbitrary
-- existing row. If this UUID is already occupied by a different workspace,
-- abort instead of merging unrelated data.
DO $$
DECLARE
  v_name text;
  v_slug text;
BEGIN
  SELECT name, slug INTO v_name, v_slug
  FROM public.workspaces
  WHERE id = '00000000-0000-0000-0000-000000000001'::uuid;

  IF FOUND AND (v_name IS DISTINCT FROM 'EliteStocks Primary Workspace'
                OR v_slug IS DISTINCT FROM 'elitestocks-primary') THEN
    RAISE EXCEPTION 'Reserved primary workspace UUID is occupied by an incompatible workspace';
  END IF;

  IF NOT FOUND THEN
    INSERT INTO public.workspaces(id, slug, name)
    VALUES (
      '00000000-0000-0000-0000-000000000001'::uuid,
      'elitestocks-primary',
      'EliteStocks Primary Workspace'
    );
  END IF;
END;
$$;

-- Every existing account is a member of the primary workspace. This does not
-- alter public.user_roles and therefore does not modify administrator assignment.
INSERT INTO public.workspace_members(workspace_id, user_id)
SELECT '00000000-0000-0000-0000-000000000001'::uuid, p.id
FROM public.profiles AS p
ON CONFLICT (workspace_id, user_id) DO NOTHING;

-- The workspace context is session-local. Existing calls with no context use
-- the primary workspace only when the caller is a member (or is the server-side
-- service role with no auth.uid()). A user cannot select another workspace by
-- setting an arbitrary GUC value.
CREATE OR REPLACE FUNCTION public.current_workspace_id()
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_raw text;
  v_workspace uuid;
  v_actor uuid := auth.uid();
BEGIN
  v_raw := current_setting('app.workspace_id', true);
  IF v_raw IS NOT NULL AND btrim(v_raw) <> '' THEN
    BEGIN
      v_workspace := v_raw::uuid;
    EXCEPTION WHEN invalid_text_representation THEN
      RAISE EXCEPTION 'Invalid workspace context';
    END;

    IF NOT EXISTS (SELECT 1 FROM public.workspaces w WHERE w.id = v_workspace AND w.is_active)
       OR (v_actor IS NOT NULL AND NOT public.workspace_has_access(v_workspace, v_actor)) THEN
      RAISE EXCEPTION 'Workspace context is not authorized';
    END IF;
    RETURN v_workspace;
  END IF;

  IF v_actor IS NULL THEN
    RETURN '00000000-0000-0000-0000-000000000001'::uuid;
  END IF;

  IF NOT public.workspace_has_access('00000000-0000-0000-0000-000000000001'::uuid, v_actor) THEN
    RAISE EXCEPTION 'No workspace membership';
  END IF;
  RETURN '00000000-0000-0000-0000-000000000001'::uuid;
END;
$$;

CREATE OR REPLACE FUNCTION public.workspace_has_access(p_workspace_id uuid, p_actor_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p_workspace_id IS NOT NULL
     AND p_actor_id IS NOT NULL
     AND EXISTS (
       SELECT 1 FROM public.workspaces w
       WHERE w.id = p_workspace_id AND w.is_active
     )
     AND (
       EXISTS (
         SELECT 1 FROM public.user_roles r
         WHERE r.user_id = p_actor_id AND r.role::text = 'admin'
       )
       OR EXISTS (
         SELECT 1 FROM public.workspace_members m
         WHERE m.workspace_id = p_workspace_id AND m.user_id = p_actor_id
       )
     );
$$;

CREATE OR REPLACE FUNCTION public.set_workspace_context(p_workspace_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.workspace_has_access(p_workspace_id, auth.uid()) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;
  PERFORM set_config('app.workspace_id', p_workspace_id::text, true);
  RETURN p_workspace_id;
END;
$$;

-- Validate/add workspace ownership columns. A pre-existing nullable column is
-- rejected rather than backfilled blindly. This is especially important for
-- immutable engine history. The default remains in place so existing trigger
-- and RPC writers continue to target the primary workspace until they are
-- explicitly upgraded to pass workspace_id.
DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'wallets','transactions','investments','copy_trades','traders',
    'support_conversations','support_messages',
    'investment_engine_audit','investment_engine_performance'
  ];
  v_attnotnull boolean;
  v_udt text;
BEGIN
  FOREACH t IN ARRAY tables LOOP
    SELECT c.udt_name, c.is_nullable = 'NO'
    INTO v_udt, v_attnotnull
    FROM information_schema.columns c
    WHERE c.table_schema = 'public' AND c.table_name = t AND c.column_name = 'workspace_id';

    IF NOT FOUND THEN
      EXECUTE format(
        'ALTER TABLE public.%I ADD COLUMN workspace_id uuid NOT NULL DEFAULT %L::uuid',
        t, '00000000-0000-0000-0000-000000000001'
      );
    ELSE
      IF v_udt <> 'uuid' OR NOT v_attnotnull THEN
        RAISE EXCEPTION 'public.%.workspace_id exists but is incompatible (type %, not-null %)', t, v_udt, v_attnotnull;
      END IF;
    END IF;
  END LOOP;
END;
$$;

-- Support messages inherit the conversation workspace. This UPDATE is not an
-- immutable engine-history table and is safe for the verified target.
UPDATE public.support_messages sm
SET workspace_id = sc.workspace_id
FROM public.support_conversations sc
WHERE sc.id = sm.conversation_id
  AND sm.workspace_id IS DISTINCT FROM sc.workspace_id;

-- Explicit foreign keys are added only when absent. Existing incompatible
-- constraints are not replaced automatically.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'wallets_workspace_id_fkey' AND conrelid = 'public.wallets'::regclass) THEN
    ALTER TABLE public.wallets ADD CONSTRAINT wallets_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'transactions_workspace_id_fkey' AND conrelid = 'public.transactions'::regclass) THEN
    ALTER TABLE public.transactions ADD CONSTRAINT transactions_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'investments_workspace_id_fkey' AND conrelid = 'public.investments'::regclass) THEN
    ALTER TABLE public.investments ADD CONSTRAINT investments_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'copy_trades_workspace_id_fkey' AND conrelid = 'public.copy_trades'::regclass) THEN
    ALTER TABLE public.copy_trades ADD CONSTRAINT copy_trades_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'traders_workspace_id_fkey' AND conrelid = 'public.traders'::regclass) THEN
    ALTER TABLE public.traders ADD CONSTRAINT traders_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'support_conversations_workspace_id_fkey' AND conrelid = 'public.support_conversations'::regclass) THEN
    ALTER TABLE public.support_conversations ADD CONSTRAINT support_conversations_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'support_messages_workspace_id_fkey' AND conrelid = 'public.support_messages'::regclass) THEN
    ALTER TABLE public.support_messages ADD CONSTRAINT support_messages_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'investment_engine_audit_workspace_id_fkey' AND conrelid = 'public.investment_engine_audit'::regclass) THEN
    ALTER TABLE public.investment_engine_audit ADD CONSTRAINT investment_engine_audit_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'investment_engine_performance_workspace_id_fkey' AND conrelid = 'public.investment_engine_performance'::regclass) THEN
    ALTER TABLE public.investment_engine_performance ADD CONSTRAINT investment_engine_performance_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id);
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_workspace_members_user ON public.workspace_members(user_id, workspace_id);
CREATE INDEX IF NOT EXISTS idx_wallets_workspace_user ON public.wallets(workspace_id, user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_workspace_user_created ON public.transactions(workspace_id, user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_investments_workspace_user_created ON public.investments(workspace_id, user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_copy_trades_workspace_user_created ON public.copy_trades(workspace_id, user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_traders_workspace_created ON public.traders(workspace_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_support_conversations_workspace_user ON public.support_conversations(workspace_id, user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_support_messages_workspace_conversation ON public.support_messages(workspace_id, conversation_id, created_at);
CREATE INDEX IF NOT EXISTS idx_engine_audit_workspace_created ON public.investment_engine_audit(workspace_id, created_at);
CREATE INDEX IF NOT EXISTS idx_engine_performance_workspace_created ON public.investment_engine_performance(workspace_id, created_at);

ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;

-- Replace the known single-workspace read policies with workspace-aware forms.
DROP POLICY IF EXISTS "own wallets read" ON public.wallets;
DROP POLICY IF EXISTS "workspace member wallets read" ON public.wallets;
CREATE POLICY "workspace member wallets read" ON public.wallets
  FOR SELECT TO authenticated
  USING (public.workspace_has_access(workspace_id, auth.uid()) AND user_id = auth.uid());

DROP POLICY IF EXISTS "own tx read" ON public.transactions;
DROP POLICY IF EXISTS "workspace member transactions read" ON public.transactions;
CREATE POLICY "workspace member transactions read" ON public.transactions
  FOR SELECT TO authenticated
  USING (public.workspace_has_access(workspace_id, auth.uid()) AND user_id = auth.uid());

DROP POLICY IF EXISTS "own investments read" ON public.investments;
DROP POLICY IF EXISTS "workspace member investments read" ON public.investments;
CREATE POLICY "workspace member investments read" ON public.investments
  FOR SELECT TO authenticated
  USING (public.workspace_has_access(workspace_id, auth.uid()) AND user_id = auth.uid());

DROP POLICY IF EXISTS "own copy read" ON public.copy_trades;
DROP POLICY IF EXISTS "workspace member copy trades read" ON public.copy_trades;
CREATE POLICY "workspace member copy trades read" ON public.copy_trades
  FOR SELECT TO authenticated
  USING (public.workspace_has_access(workspace_id, auth.uid()) AND user_id = auth.uid());

DROP POLICY IF EXISTS "traders public read" ON public.traders;
DROP POLICY IF EXISTS "workspace member traders read" ON public.traders;
CREATE POLICY "workspace member traders read" ON public.traders
  FOR SELECT TO authenticated
  USING (public.workspace_has_access(workspace_id, auth.uid()));
DROP POLICY IF EXISTS "workspace public traders read" ON public.traders;
CREATE POLICY "workspace public traders read" ON public.traders
  FOR SELECT TO anon
  USING (workspace_id = '00000000-0000-0000-0000-000000000001'::uuid);

DROP POLICY IF EXISTS "support conversation participant read" ON public.support_conversations;
DROP POLICY IF EXISTS "workspace support conversation participant read" ON public.support_conversations;
CREATE POLICY "workspace support conversation participant read" ON public.support_conversations
  FOR SELECT TO authenticated
  USING (public.workspace_has_access(workspace_id, auth.uid())
         AND (user_id = auth.uid() OR public.is_admin(auth.uid())));

DROP POLICY IF EXISTS "support conversation owner create" ON public.support_conversations;
DROP POLICY IF EXISTS "workspace support conversation owner create" ON public.support_conversations;
CREATE POLICY "workspace support conversation owner create" ON public.support_conversations
  FOR INSERT TO authenticated
  WITH CHECK (public.workspace_has_access(workspace_id, auth.uid()) AND user_id = auth.uid());

DROP POLICY IF EXISTS "support message participant read" ON public.support_messages;
DROP POLICY IF EXISTS "workspace support message participant read" ON public.support_messages;
CREATE POLICY "workspace support message participant read" ON public.support_messages
  FOR SELECT TO authenticated
  USING (
    public.workspace_has_access(workspace_id, auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.support_conversations c
      WHERE c.id = conversation_id
        AND c.workspace_id = public.support_messages.workspace_id
        AND (c.user_id = auth.uid() OR public.is_admin(auth.uid()))
    )
  );

DROP POLICY IF EXISTS "support message participant create" ON public.support_messages;
DROP POLICY IF EXISTS "workspace support message participant create" ON public.support_messages;
CREATE POLICY "workspace support message participant create" ON public.support_messages
  FOR INSERT TO authenticated
  WITH CHECK (
    public.workspace_has_access(workspace_id, auth.uid())
    AND sender_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.support_conversations c
      WHERE c.id = conversation_id
        AND c.workspace_id = public.support_messages.workspace_id
        AND (c.user_id = auth.uid() OR public.is_admin(auth.uid()))
    )
  );

DROP POLICY IF EXISTS "platform settings public read" ON public.platform_settings;
DROP POLICY IF EXISTS "workspace compatible platform settings read" ON public.platform_settings;
-- The legacy singleton remains readable to authenticated users for compatibility.
-- It is not claimed to be independently configurable per workspace in Phase 1.
CREATE POLICY "workspace compatible platform settings read" ON public.platform_settings
  FOR SELECT TO authenticated USING (public.workspace_has_access(
    '00000000-0000-0000-0000-000000000001'::uuid, auth.uid()
  ));

DROP POLICY IF EXISTS "workspace member read" ON public.workspaces;
CREATE POLICY "workspace member read" ON public.workspaces
  FOR SELECT TO authenticated
  USING (public.workspace_has_access(id, auth.uid()));

DROP POLICY IF EXISTS "workspace member list" ON public.workspace_members;
CREATE POLICY "workspace member list" ON public.workspace_members
  FOR SELECT TO authenticated
  USING (public.workspace_has_access(workspace_id, auth.uid()) AND user_id = auth.uid());

REVOKE ALL ON public.workspaces, public.workspace_members FROM anon;
GRANT SELECT ON public.workspaces, public.workspace_members TO authenticated;
GRANT ALL ON public.workspaces, public.workspace_members TO service_role;
GRANT EXECUTE ON FUNCTION public.current_workspace_id() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.workspace_has_access(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.set_workspace_context(uuid) TO authenticated, service_role;

-- Postcondition checks. Any failure rolls back the entire migration.
DO $$
DECLARE
  v_count bigint;
  v_nulls bigint;
BEGIN
  SELECT count(*) INTO v_count FROM public.workspaces WHERE id = '00000000-0000-0000-0000-000000000001'::uuid;
  IF v_count <> 1 THEN RAISE EXCEPTION 'Primary workspace was not created exactly once'; END IF;

  SELECT count(*) INTO v_count FROM public.profiles;
  IF v_count <> (SELECT count(*) FROM public.workspace_members WHERE workspace_id = '00000000-0000-0000-0000-000000000001'::uuid) THEN
    RAISE EXCEPTION 'Not every profile received primary workspace membership';
  END IF;

  SELECT count(*) INTO v_nulls FROM public.wallets WHERE workspace_id IS NULL;
  IF v_nulls <> 0 THEN RAISE EXCEPTION 'wallets contains NULL workspace_id'; END IF;
  SELECT count(*) INTO v_nulls FROM public.transactions WHERE workspace_id IS NULL;
  IF v_nulls <> 0 THEN RAISE EXCEPTION 'transactions contains NULL workspace_id'; END IF;
  SELECT count(*) INTO v_nulls FROM public.investment_engine_audit WHERE workspace_id IS NULL;
  IF v_nulls <> 0 THEN RAISE EXCEPTION 'investment_engine_audit contains NULL workspace_id'; END IF;
  SELECT count(*) INTO v_nulls FROM public.investment_engine_performance WHERE workspace_id IS NULL;
  IF v_nulls <> 0 THEN RAISE EXCEPTION 'investment_engine_performance contains NULL workspace_id'; END IF;
END;
$$;

COMMIT;

-- Run supabase/diagnostics/workspace-post-migration-verification.sql separately.
