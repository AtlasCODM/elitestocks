-- EliteStocks Phase 1 workspace migration preflight.
-- READ ONLY: run against the target Supabase database before authoring or applying
-- any workspace migration. This file is pure PostgreSQL for the Supabase SQL
-- Editor: it contains no psql meta-commands and performs no DDL or DML.

-- Installed migration history. Supabase projects normally provide this table.
SELECT version, name
FROM supabase_migrations.schema_migrations
ORDER BY version;

-- Relevant relations and estimated live row counts. Missing relations simply do
-- not appear; this query does not assume that a table exists.
SELECT n.nspname AS schema_name,
       c.relname AS relation_name,
       c.relkind,
       c.relrowsecurity AS rls_enabled,
       c.relforcerowsecurity AS force_rls,
       s.n_live_tup AS estimated_live_rows
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
LEFT JOIN pg_stat_all_tables s ON s.relid = c.oid
WHERE n.nspname IN ('public', 'storage')
  AND c.relname IN (
    'profiles','user_roles','wallets','transactions','traders','investments',
    'copy_trades','platform_settings','investment_engine_config',
    'investment_engine_audit','investment_engine_performance',
    'support_conversations','support_messages','workspaces','workspace_members',
    'objects','buckets'
  )
ORDER BY n.nspname, c.relname;

-- Exact columns, defaults, and nullability for public application tables.
SELECT table_name, ordinal_position, column_name, data_type, udt_name,
       is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN (
    'profiles','user_roles','wallets','transactions','traders','investments',
    'copy_trades','platform_settings','investment_engine_config',
    'investment_engine_audit','investment_engine_performance',
    'support_conversations','support_messages','workspaces','workspace_members'
  )
ORDER BY table_name, ordinal_position;

-- Constraints and indexes.
SELECT n.nspname AS schema_name, c.relname AS relation_name,
       con.conname, pg_get_constraintdef(con.oid) AS definition
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
ORDER BY relation_name, con.conname;

SELECT schemaname, tablename, indexname, indexdef
FROM pg_indexes
WHERE schemaname IN ('public', 'storage')
  AND tablename IN (
    'profiles','user_roles','wallets','transactions','traders','investments',
    'copy_trades','platform_settings','investment_engine_config',
    'investment_engine_audit','investment_engine_performance',
    'support_conversations','support_messages','objects','buckets',
    'workspaces','workspace_members'
  )
ORDER BY schemaname, tablename, indexname;

-- Triggers and trigger functions.
SELECT event_object_schema AS schema_name,
       event_object_table AS table_name,
       trigger_name,
       event_manipulation,
       action_timing,
       action_statement
FROM information_schema.triggers
WHERE event_object_schema IN ('public', 'storage')
  AND event_object_table IN (
    'profiles','user_roles','wallets','transactions','traders','investments',
    'copy_trades','platform_settings','investment_engine_config',
    'investment_engine_audit','investment_engine_performance',
    'support_conversations','support_messages','objects','buckets',
    'workspaces','workspace_members'
  )
ORDER BY event_object_schema, event_object_table, trigger_name, event_manipulation;

-- Relevant function definitions, including security-definer status and search
-- path. The complete body is returned for review in the SQL Editor results.
SELECT p.oid::regprocedure AS signature,
       n.nspname AS schema_name,
       p.prosecdef AS security_definer,
       pg_get_function_identity_arguments(p.oid) AS arguments,
       pg_get_function_result(p.oid) AS return_type,
       p.proconfig AS configuration,
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
    'support_mark_read','support_resolve_conversation','handle_new_user'
  )
ORDER BY p.proname, p.oid::regprocedure::text;

-- RLS policies. Both permissive and restrictive policy modes are included.
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies
WHERE schemaname IN ('public', 'storage')
ORDER BY schemaname, tablename, policyname;

-- Function and table privileges.
SELECT routine_schema, routine_name, specific_name, grantee, privilege_type
FROM information_schema.routine_privileges
WHERE routine_schema = 'public'
  AND routine_name IN (
    'is_admin','engine_update_configuration','engine_create_investment',
    'engine_create_copy_trade','engine_confirm_deposit','engine_create_withdrawal',
    'engine_cancel_position','engine_record_performance','engine_process_jobs',
    'admin_update_transaction','admin_update_settings',
    'support_get_or_create_conversation','support_send_message',
    'support_mark_read','support_resolve_conversation'
  )
ORDER BY routine_name, grantee, privilege_type;

SELECT table_schema, table_name, grantee, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema IN ('public', 'storage')
  AND table_name IN (
    'profiles','user_roles','wallets','transactions','traders','investments',
    'copy_trades','platform_settings','investment_engine_config',
    'investment_engine_audit','investment_engine_performance',
    'support_conversations','support_messages','objects','buckets'
  )
ORDER BY table_schema, table_name, grantee, privilege_type;

-- Engine history backfill safety checks.
SELECT count(*) AS audit_rows,
       count(*) FILTER (WHERE actor_id IS NULL) AS audit_null_actors,
       min(created_at) AS oldest_audit,
       max(created_at) AS newest_audit
FROM public.investment_engine_audit;

SELECT count(*) AS performance_rows,
       count(*) FILTER (WHERE actor_id IS NULL) AS performance_null_actors,
       count(*) FILTER (WHERE evidence_ref IS NULL OR btrim(evidence_ref) = '') AS missing_evidence,
       count(*) FILTER (WHERE contract_ref IS NULL OR btrim(contract_ref) = '') AS missing_contract,
       min(created_at) AS oldest_performance,
       max(created_at) AS newest_performance
FROM public.investment_engine_performance;

-- Administrator identities. Do not infer super-admin ownership from this list.
SELECT ur.user_id, ur.role::text AS role, u.email,
       u.raw_app_meta_data, u.raw_user_meta_data
FROM public.user_roles ur
LEFT JOIN auth.users u ON u.id = ur.user_id
WHERE ur.role::text = 'admin'
ORDER BY ur.user_id;
