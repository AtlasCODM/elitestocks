-- EliteStocks Phase 2 workspace migration preflight
-- READ ONLY: this file performs no DDL, DML, privilege changes, or storage writes.
-- Run it against the staging copy first, then save the complete JSON result.
-- It is compatible with the Supabase SQL Editor and contains no psql commands.
--
-- Required before authoring the financial RPC migration:
--   1. A verified backup and a staging/isolated database copy.
--   2. The complete output of this script from staging.
--   3. Confirmation that the staging copy can be reset and rerun during testing.

WITH target_tables(table_name) AS (
  VALUES ('platform_settings'::text), ('platform_deposit_addresses'::text)
),
table_columns AS (
  SELECT
    c.table_name,
    jsonb_agg(
      jsonb_build_object(
        'ordinal_position', c.ordinal_position,
        'column_name', c.column_name,
        'data_type', c.data_type,
        'udt_schema', c.udt_schema,
        'udt_name', c.udt_name,
        'is_nullable', c.is_nullable,
        'column_default', c.column_default,
        'character_maximum_length', c.character_maximum_length,
        'numeric_precision', c.numeric_precision,
        'numeric_scale', c.numeric_scale
      ) ORDER BY c.ordinal_position
    ) AS columns
  FROM information_schema.columns c
  JOIN target_tables t ON t.table_name = c.table_name
  WHERE c.table_schema = 'public'
  GROUP BY c.table_name
),
table_constraints AS (
  SELECT
    cls.relname AS table_name,
    jsonb_agg(
      jsonb_build_object(
        'constraint_name', con.conname,
        'constraint_type', con.contype,
        'definition', pg_get_constraintdef(con.oid, true)
      ) ORDER BY con.conname
    ) AS constraints
  FROM pg_constraint con
  JOIN pg_class cls ON cls.oid = con.conrelid
  JOIN pg_namespace ns ON ns.oid = cls.relnamespace
  JOIN target_tables t ON t.table_name = cls.relname
  WHERE ns.nspname = 'public'
  GROUP BY cls.relname
),
table_indexes AS (
  SELECT
    i.tablename AS table_name,
    jsonb_agg(
      jsonb_build_object(
        'index_name', i.indexname,
        'definition', i.indexdef
      ) ORDER BY i.indexname
    ) AS indexes
  FROM pg_indexes i
  JOIN target_tables t ON t.table_name = i.tablename
  WHERE i.schemaname = 'public'
  GROUP BY i.tablename
),
table_triggers AS (
  SELECT
    cls.relname AS table_name,
    jsonb_agg(
      jsonb_build_object(
        'trigger_name', tg.tgname,
        'enabled', CASE tg.tgenabled
          WHEN 'O' THEN 'origin'
          WHEN 'D' THEN 'disabled'
          WHEN 'R' THEN 'replica'
          WHEN 'A' THEN 'always'
        END,
        'definition', pg_get_triggerdef(tg.oid, true)
      ) ORDER BY tg.tgname
    ) AS triggers
  FROM pg_trigger tg
  JOIN pg_class cls ON cls.oid = tg.tgrelid
  JOIN pg_namespace ns ON ns.oid = cls.relnamespace
  JOIN target_tables t ON t.table_name = cls.relname
  WHERE ns.nspname = 'public' AND NOT tg.tgisinternal
  GROUP BY cls.relname
),
table_policies AS (
  SELECT
    p.tablename AS table_name,
    jsonb_agg(
      jsonb_build_object(
        'policy_name', p.policyname,
        'permissive', p.permissive,
        'roles', p.roles,
        'command', p.cmd,
        'using_expression', p.qual,
        'check_expression', p.with_check
      ) ORDER BY p.policyname
    ) AS policies
  FROM pg_policies p
  JOIN target_tables t ON t.table_name = p.tablename
  WHERE p.schemaname = 'public'
  GROUP BY p.tablename
),
table_grants AS (
  SELECT
    g.table_name,
    jsonb_agg(
      jsonb_build_object(
        'grantee', g.grantee,
        'privilege_type', g.privilege_type,
        'is_grantable', g.is_grantable
      ) ORDER BY g.grantee, g.privilege_type
    ) AS grants
  FROM information_schema.role_table_grants g
  JOIN target_tables t ON t.table_name = g.table_name
  WHERE g.table_schema = 'public'
  GROUP BY g.table_name
),
table_row_counts AS (
  SELECT
    t.table_name,
    CASE WHEN to_regclass(format('public.%I', t.table_name)) IS NULL THEN NULL
      ELSE (xpath('/row/count/text()', query_to_xml(format('SELECT count(*) AS count FROM public.%I', t.table_name), true, false, '')))[1]::text::bigint
    END AS row_count
  FROM target_tables t
)
SELECT
  'configuration_table_definitions' AS section,
  jsonb_agg(
    jsonb_build_object(
      'table_name', t.table_name,
      'exists', to_regclass(format('public.%I', t.table_name)) IS NOT NULL,
      'row_count', rc.row_count,
      'columns', coalesce(tc.columns, '[]'::jsonb),
      'constraints', coalesce(tk.constraints, '[]'::jsonb),
      'indexes', coalesce(ti.indexes, '[]'::jsonb),
      'triggers', coalesce(tt.triggers, '[]'::jsonb),
      'policies', coalesce(tp.policies, '[]'::jsonb),
      'grants', coalesce(tg.grants, '[]'::jsonb)
    ) ORDER BY t.table_name
  ) AS result
FROM target_tables t
LEFT JOIN table_columns tc USING (table_name)
LEFT JOIN table_constraints tk USING (table_name)
LEFT JOIN table_indexes ti USING (table_name)
LEFT JOIN table_triggers tt USING (table_name)
LEFT JOIN table_policies tp USING (table_name)
LEFT JOIN table_grants tg USING (table_name)
LEFT JOIN table_row_counts rc USING (table_name)

UNION ALL

SELECT
  'security_definer_functions' AS section,
  coalesce(
    jsonb_agg(
      jsonb_build_object(
        'schema', n.nspname,
        'function_name', p.proname,
        'signature', p.oid::regprocedure::text,
        'identity_arguments', pg_get_function_identity_arguments(p.oid),
        'return_type', pg_get_function_result(p.oid),
        'security_definer', p.prosecdef,
        'volatility', p.provolatile,
        'parallel_safety', p.proparallel,
        'search_path', p.proconfig,
        'definition', pg_get_functiondef(p.oid)
      ) ORDER BY p.proname, p.oid
    ), '[]'::jsonb
  ) AS result
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.prosecdef

UNION ALL

SELECT
  'security_definer_function_privileges' AS section,
  coalesce(
    jsonb_agg(
      jsonb_build_object(
        'schema', n.nspname,
        'function_name', p.proname,
        'signature', p.oid::regprocedure::text,
        'grantee', coalesce(gr.rolname, 'PUBLIC'),
        'privilege_type', ax.privilege_type,
        'is_grantable', ax.is_grantable
      ) ORDER BY p.proname, p.oid, coalesce(gr.rolname, 'PUBLIC'), ax.privilege_type
    ), '[]'::jsonb
  ) AS result
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
CROSS JOIN LATERAL aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) ax
LEFT JOIN pg_roles gr ON gr.oid = ax.grantee
WHERE n.nspname = 'public' AND p.prosecdef

UNION ALL

SELECT
  'security_definer_effective_privileges' AS section,
  coalesce(
    jsonb_agg(
      jsonb_build_object(
        'signature', p.oid::regprocedure::text,
        'role_name', r.rolname,
        'has_execute', has_function_privilege(r.rolname, p.oid, 'EXECUTE')
      ) ORDER BY p.proname, p.oid, r.rolname
    ), '[]'::jsonb
  ) AS result
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
CROSS JOIN (VALUES ('anon'::name), ('authenticated'::name), ('service_role'::name), ('postgres'::name)) AS roles(role_name)
JOIN pg_roles r ON r.rolname = roles.role_name
WHERE n.nspname = 'public' AND p.prosecdef

UNION ALL

SELECT
  'representative_data_counts' AS section,
  jsonb_build_object(
    'workspaces', (SELECT count(*) FROM public.workspaces),
    'workspace_members', (SELECT count(*) FROM public.workspace_members),
    'profiles', (SELECT count(*) FROM public.profiles),
    'wallets', (SELECT count(*) FROM public.wallets),
    'transactions', (SELECT count(*) FROM public.transactions),
    'investments', (SELECT count(*) FROM public.investments),
    'copy_trades', (SELECT count(*) FROM public.copy_trades),
    'deposit_requests', (SELECT count(*) FROM public.deposit_requests),
    'withdrawal_requests', (SELECT count(*) FROM public.withdrawal_requests),
    'maintenance_requests', (SELECT count(*) FROM public.maintenance_requests),
    'user_miners', (SELECT count(*) FROM public.user_miners),
    'mining_rewards', (SELECT count(*) FROM public.mining_rewards),
    'spot_orders', (SELECT count(*) FROM public.spot_orders),
    'support_conversations', (SELECT count(*) FROM public.support_conversations),
    'support_messages', (SELECT count(*) FROM public.support_messages),
    'investment_engine_audit', (SELECT count(*) FROM public.investment_engine_audit),
    'investment_engine_performance', (SELECT count(*) FROM public.investment_engine_performance),
    'platform_settings', (SELECT count(*) FROM public.platform_settings),
    'investment_engine_config', (SELECT count(*) FROM public.investment_engine_config),
    'platform_deposit_addresses', (SELECT count(*) FROM public.platform_deposit_addresses)
  )

UNION ALL

SELECT
  'workspace_data_consistency' AS section,
  jsonb_build_object(
    'null_workspace_wallets', (SELECT count(*) FROM public.wallets WHERE workspace_id IS NULL),
    'null_workspace_transactions', (SELECT count(*) FROM public.transactions WHERE workspace_id IS NULL),
    'null_workspace_investments', (SELECT count(*) FROM public.investments WHERE workspace_id IS NULL),
    'null_workspace_copy_trades', (SELECT count(*) FROM public.copy_trades WHERE workspace_id IS NULL),
    'null_workspace_deposit_requests', (SELECT count(*) FROM public.deposit_requests WHERE workspace_id IS NULL),
    'null_workspace_withdrawal_requests', (SELECT count(*) FROM public.withdrawal_requests WHERE workspace_id IS NULL),
    'null_workspace_maintenance_requests', (SELECT count(*) FROM public.maintenance_requests WHERE workspace_id IS NULL),
    'null_workspace_user_miners', (SELECT count(*) FROM public.user_miners WHERE workspace_id IS NULL),
    'null_workspace_mining_rewards', (SELECT count(*) FROM public.mining_rewards WHERE workspace_id IS NULL),
    'null_workspace_spot_orders', (SELECT count(*) FROM public.spot_orders WHERE workspace_id IS NULL),
    'null_workspace_support_conversations', (SELECT count(*) FROM public.support_conversations WHERE workspace_id IS NULL),
    'null_workspace_support_messages', (SELECT count(*) FROM public.support_messages WHERE workspace_id IS NULL),
    'null_workspace_engine_audit', (SELECT count(*) FROM public.investment_engine_audit WHERE workspace_id IS NULL),
    'null_workspace_engine_performance', (SELECT count(*) FROM public.investment_engine_performance WHERE workspace_id IS NULL),
    'wallet_duplicate_keys', (SELECT count(*) FROM (SELECT workspace_id, user_id, asset FROM public.wallets GROUP BY workspace_id, user_id, asset HAVING count(*) > 1) q),
    'active_support_duplicate_keys', (SELECT count(*) FROM (SELECT workspace_id, user_id FROM public.support_conversations WHERE status = 'active' GROUP BY workspace_id, user_id HAVING count(*) > 1) q)
  );
