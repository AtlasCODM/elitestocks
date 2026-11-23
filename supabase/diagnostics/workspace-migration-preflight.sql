-- EliteStocks Phase 1 workspace migration preflight.
-- READ ONLY: run against the target Supabase database before authoring or applying
-- any workspace migration. This script intentionally performs no DDL or DML.

\set ON_ERROR_STOP on

\echo '=== Installed migration history ==='
SELECT version, name
FROM supabase_migrations.schema_migrations
ORDER BY version;

\echo '=== Relevant relations and row counts ==='
WITH names(name) AS (
  VALUES
    ('profiles'), ('user_roles'), ('wallets'), ('transactions'), ('traders'),
    ('investments'), ('copy_trades'), ('platform_settings'),
    ('investment_engine_config'), ('investment_engine_audit'),
    ('investment_engine_performance'), ('support_conversations'),
    ('support_messages'), ('workspaces'), ('workspace_members')
)
SELECT n.name,
       to_regclass('public.' || n.name) AS relation,
       CASE WHEN to_regclass('public.' || n.name) IS NULL THEN NULL
            ELSE (xpath('/row/c/text()', query_to_xml(
              format('SELECT count(*) AS c FROM public.%I', n.name), true, false, ''))[1]::text)::bigint
       END AS row_count
FROM names n
ORDER BY n.name;

\echo '=== Columns, defaults, and nullability ==='
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

\echo '=== Constraints and indexes ==='
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
WHERE schemaname = 'public'
  AND tablename IN (
    'profiles','user_roles','wallets','transactions','traders','investments',
    'copy_trades','platform_settings','investment_engine_config',
    'investment_engine_audit','investment_engine_performance',
    'support_conversations','support_messages','workspaces','workspace_members'
  )
ORDER BY tablename, indexname;

\echo '=== Triggers and trigger functions ==='
SELECT event_object_table AS table_name, trigger_name, event_manipulation,
       action_timing, action_statement
FROM information_schema.triggers
WHERE event_object_schema = 'public'
  AND event_object_table IN (
    'profiles','user_roles','wallets','transactions','traders','investments',
    'copy_trades','platform_settings','investment_engine_config',
    'investment_engine_audit','investment_engine_performance',
    'support_conversations','support_messages','workspaces','workspace_members'
  )
ORDER BY event_object_table, trigger_name, event_manipulation;

\echo '=== Relevant function definitions ==='
SELECT p.oid::regprocedure AS signature,
       n.nspname AS schema_name,
       p.prosecdef AS security_definer,
       pg_get_function_identity_arguments(p.oid) AS arguments,
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

\echo '=== RLS state and policies ==='
SELECT c.relname AS table_name, c.relrowsecurity AS rls_enabled,
       c.relforcerowsecurity AS force_rls
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname IN (
    'profiles','user_roles','wallets','transactions','traders','investments',
    'copy_trades','platform_settings','investment_engine_config',
    'investment_engine_audit','investment_engine_performance',
    'support_conversations','support_messages','workspaces','workspace_members'
  )
ORDER BY table_name;

SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies
WHERE schemaname IN ('public','storage')
ORDER BY schemaname, tablename, policyname;

\echo '=== Function and table privileges ==='
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
WHERE table_schema IN ('public','storage')
  AND table_name IN (
    'profiles','user_roles','wallets','transactions','traders','investments',
    'copy_trades','platform_settings','investment_engine_config',
    'investment_engine_audit','investment_engine_performance',
    'support_conversations','support_messages','objects','buckets'
  )
ORDER BY table_schema, table_name, grantee, privilege_type;

\echo '=== Engine history backfill safety checks ==='
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

\echo '=== Candidate administrator identities (do not infer super-admin ownership) ==='
SELECT ur.user_id, ur.role, u.email,
       u.raw_app_meta_data, u.raw_user_meta_data
FROM public.user_roles ur
LEFT JOIN auth.users u ON u.id = ur.user_id
WHERE ur.role::text = 'admin'
ORDER BY ur.user_id;

\echo '=== Preflight complete: no changes were made ==='
