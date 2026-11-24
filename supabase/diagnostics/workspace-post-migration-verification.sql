-- EliteStocks consolidated post-migration verification.
-- Supabase SQL Editor compatible: PostgreSQL only, no psql meta-commands.
-- Read-only. Returns one result set with section and JSON result columns.

WITH
relation_checks AS (
  SELECT jsonb_agg(to_jsonb(x) ORDER BY x.schema_name, x.relation_name) AS result
  FROM (
    SELECT n.nspname AS schema_name,
           r.relation_name,
           (c.oid IS NOT NULL) AS exists,
           c.relkind,
           coalesce(c.relrowsecurity, false) AS rls_enabled,
           coalesce(c.relforcerowsecurity, false) AS force_rls,
           s.n_live_tup AS estimated_live_rows
    FROM (VALUES
      ('public','profiles'),('public','user_roles'),('public','wallets'),
      ('public','transactions'),('public','traders'),('public','investments'),
      ('public','copy_trades'),('public','platform_settings'),
      ('public','investment_engine_config'),('public','investment_engine_audit'),
      ('public','investment_engine_performance'),('public','support_conversations'),
      ('public','support_messages'),('public','workspaces'),('public','workspace_members'),
      ('storage','buckets'),('storage','objects')
    ) AS r(schema_name, relation_name)
    JOIN pg_namespace n ON n.nspname = r.schema_name
    LEFT JOIN pg_class c ON c.relnamespace = n.oid AND c.relname = r.relation_name
    LEFT JOIN pg_stat_all_tables s ON s.relid = c.oid
  ) x
),
column_checks AS (
  SELECT jsonb_agg(to_jsonb(x) ORDER BY x.table_schema, x.table_name, x.ordinal_position) AS result
  FROM (
    SELECT c.table_schema, c.table_name, c.ordinal_position, c.column_name,
           c.data_type, c.udt_name, c.is_nullable, c.column_default
    FROM information_schema.columns c
    WHERE c.table_schema IN ('public','storage')
      AND c.table_name IN (
        'profiles','user_roles','wallets','transactions','traders','investments',
        'copy_trades','platform_settings','investment_engine_config',
        'investment_engine_audit','investment_engine_performance',
        'support_conversations','support_messages','workspaces','workspace_members',
        'buckets','objects'
      )
  ) x
),
constraint_checks AS (
  SELECT jsonb_agg(to_jsonb(x) ORDER BY x.schema_name, x.relation_name, x.constraint_name) AS result
  FROM (
    SELECT n.nspname AS schema_name, c.relname AS relation_name,
           con.conname AS constraint_name,
           con.contype AS constraint_type,
           pg_get_constraintdef(con.oid) AS definition
    FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname IN (
        'profiles','user_roles','wallets','transactions','traders','investments',
        'copy_trades','platform_settings','investment_engine_config',
        'investment_engine_audit','investment_engine_performance',
        'support_conversations','support_messages','workspaces','workspace_members'
      )
  ) x
),
index_checks AS (
  SELECT jsonb_agg(to_jsonb(x) ORDER BY x.schemaname, x.tablename, x.indexname) AS result
  FROM (
    SELECT schemaname, tablename, indexname, indexdef
    FROM pg_indexes
    WHERE schemaname IN ('public','storage')
      AND tablename IN (
        'profiles','user_roles','wallets','transactions','traders','investments',
        'copy_trades','platform_settings','investment_engine_config',
        'investment_engine_audit','investment_engine_performance',
        'support_conversations','support_messages','workspaces','workspace_members',
        'buckets','objects'
      )
  ) x
),
function_checks AS (
  SELECT jsonb_agg(to_jsonb(x) ORDER BY x.signature::text) AS result
  FROM (
    SELECT p.oid::regprocedure AS signature,
           p.prosecdef AS security_definer,
           p.proconfig AS configuration,
           pg_get_function_result(p.oid) AS return_type,
           pg_get_functiondef(p.oid) AS definition
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN (
        'is_admin','engine_update_configuration','engine_create_investment',
        'engine_create_copy_trade','engine_confirm_deposit','engine_create_withdrawal',
        'engine_cancel_position','engine_record_performance','engine_process_jobs',
        'admin_update_transaction','admin_update_settings',
        'support_get_or_create_conversation','support_send_message',
        'support_mark_read','support_resolve_conversation','handle_new_user',
        'current_workspace_id','workspace_has_access','set_workspace_context'
      )
  ) x
),
trigger_checks AS (
  SELECT jsonb_agg(to_jsonb(x) ORDER BY x.event_object_schema, x.event_object_table, x.trigger_name, x.event_manipulation) AS result
  FROM (
    SELECT event_object_schema, event_object_table, trigger_name,
           event_manipulation, action_timing, action_statement
    FROM information_schema.triggers
    WHERE event_object_schema IN ('public','storage')
      AND event_object_table IN (
        'profiles','user_roles','wallets','transactions','traders','investments',
        'copy_trades','platform_settings','investment_engine_config',
        'investment_engine_audit','investment_engine_performance',
        'support_conversations','support_messages','workspaces','workspace_members',
        'buckets','objects'
      )
  ) x
),
policy_checks AS (
  SELECT jsonb_agg(to_jsonb(x) ORDER BY x.schemaname, x.tablename, x.policyname) AS result
  FROM (
    SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
    FROM pg_policies
    WHERE schemaname IN ('public','storage')
  ) x
),
privilege_checks AS (
  SELECT jsonb_agg(to_jsonb(x) ORDER BY x.object_kind, x.object_name, x.grantee, x.privilege_type) AS result
  FROM (
    SELECT 'table'::text AS object_kind,
           table_schema || '.' || table_name AS object_name,
           grantee, privilege_type
    FROM information_schema.role_table_grants
    WHERE table_schema IN ('public','storage')
      AND table_name IN (
        'profiles','user_roles','wallets','transactions','traders','investments',
        'copy_trades','platform_settings','investment_engine_config',
        'investment_engine_audit','investment_engine_performance',
        'support_conversations','support_messages','workspaces','workspace_members',
        'buckets','objects'
      )
    UNION ALL
    SELECT 'function'::text AS object_kind,
           routine_schema || '.' || routine_name || '(' || specific_name || ')' AS object_name,
           grantee, privilege_type
    FROM information_schema.routine_privileges
    WHERE routine_schema = 'public'
      AND routine_name IN (
        'is_admin','engine_update_configuration','engine_create_investment',
        'engine_create_copy_trade','engine_confirm_deposit','engine_create_withdrawal',
        'engine_cancel_position','engine_record_performance','engine_process_jobs',
        'admin_update_transaction','admin_update_settings',
        'support_get_or_create_conversation','support_send_message',
        'support_mark_read','support_resolve_conversation',
        'current_workspace_id','workspace_has_access','set_workspace_context'
      )
  ) x
),
engine_checks AS (
  SELECT jsonb_build_object(
    'config_rows', (SELECT count(*) FROM public.investment_engine_config),
    'audit_rows', (SELECT count(*) FROM public.investment_engine_audit),
    'audit_null_actors', (SELECT count(*) FROM public.investment_engine_audit WHERE actor_id IS NULL),
    'performance_rows', (SELECT count(*) FROM public.investment_engine_performance),
    'performance_missing_evidence', (SELECT count(*) FROM public.investment_engine_performance WHERE btrim(evidence_ref) = ''),
    'performance_missing_contract', (SELECT count(*) FROM public.investment_engine_performance WHERE btrim(contract_ref) = ''),
    'investment_rows', (SELECT count(*) FROM public.investments),
    'copy_trade_rows', (SELECT count(*) FROM public.copy_trades),
    'transaction_rows', (SELECT count(*) FROM public.transactions),
    'wallet_rows', (SELECT count(*) FROM public.wallets),
    'profile_rows', (SELECT count(*) FROM public.profiles),
    'workspace_rows', (SELECT count(*) FROM public.workspaces),
    'workspace_member_rows', (SELECT count(*) FROM public.workspace_members),
    'workspace_memberless_profiles', (SELECT count(*) FROM public.profiles p
      WHERE NOT EXISTS (SELECT 1 FROM public.workspace_members m WHERE m.user_id = p.id)),
    'workspace_null_wallets', (SELECT count(*) FROM public.wallets WHERE workspace_id IS NULL),
    'workspace_null_transactions', (SELECT count(*) FROM public.transactions WHERE workspace_id IS NULL),
    'workspace_null_investments', (SELECT count(*) FROM public.investments WHERE workspace_id IS NULL),
    'workspace_null_copy_trades', (SELECT count(*) FROM public.copy_trades WHERE workspace_id IS NULL),
    'workspace_null_audit', (SELECT count(*) FROM public.investment_engine_audit WHERE workspace_id IS NULL),
    'workspace_null_performance', (SELECT count(*) FROM public.investment_engine_performance WHERE workspace_id IS NULL)
  ) AS result
),
admin_checks AS (
  SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY x.user_id), '[]'::jsonb) AS result
  FROM (
    SELECT ur.user_id, ur.role::text AS role, u.email,
           u.raw_user_meta_data ->> 'display_name' AS display_name
    FROM public.user_roles ur
    LEFT JOIN auth.users u ON u.id = ur.user_id
    WHERE ur.role::text = 'admin'
  ) x
),
migration_relation_checks AS (
  SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY x.schema_name, x.relation_name), '[]'::jsonb) AS result
  FROM (
    SELECT n.nspname AS schema_name, c.relname AS relation_name,
           c.relkind,
           CASE
             WHEN n.nspname = 'supabase_migrations' AND c.relname = 'schema_migrations'
               THEN 'expected application migration history relation'
             ELSE 'migration-like relation; verify semantics'
           END AS interpretation
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relname IN ('schema_migrations','migrations')
  ) x
)
SELECT section, result
FROM (
  SELECT 'relations'::text AS section, result FROM relation_checks
  UNION ALL SELECT 'columns', result FROM column_checks
  UNION ALL SELECT 'constraints', result FROM constraint_checks
  UNION ALL SELECT 'indexes', result FROM index_checks
  UNION ALL SELECT 'functions', result FROM function_checks
  UNION ALL SELECT 'triggers', result FROM trigger_checks
  UNION ALL SELECT 'rls_policies', result FROM policy_checks
  UNION ALL SELECT 'privileges', result FROM privilege_checks
  UNION ALL SELECT 'engine_and_data_checks', result FROM engine_checks
  UNION ALL SELECT 'administrator_assignments', result FROM admin_checks
  UNION ALL SELECT 'migration_history_relations', result FROM migration_relation_checks
) consolidated
ORDER BY section;
