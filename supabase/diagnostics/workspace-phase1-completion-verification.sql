-- EliteStocks Phase 1 completion verification
-- Read only. Supabase SQL Editor compatible. Returns one result set.

WITH
relation_checks AS (
  SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY x.relation_name), '[]'::jsonb) AS result
  FROM (
    SELECT r.relation_name,
           (c.oid IS NOT NULL) AS exists,
           c.relkind,
           coalesce(c.relrowsecurity, false) AS rls_enabled,
           coalesce(c.relforcerowsecurity, false) AS force_rls
    FROM (VALUES
      ('workspaces'::text),
      ('workspace_members'::text),
      ('profiles'::text),
      ('wallets'::text),
      ('transactions'::text),
      ('investments'::text),
      ('copy_trades'::text),
      ('traders'::text),
      ('support_conversations'::text),
      ('support_messages'::text),
      ('deposit_requests'::text),
      ('maintenance_requests'::text),
      ('mining_rewards'::text),
      ('spot_orders'::text),
      ('user_miners'::text),
      ('withdrawal_requests'::text),
      ('investment_engine_audit'::text),
      ('investment_engine_performance'::text)
    ) AS r(relation_name)
    LEFT JOIN pg_class AS c
      ON c.relnamespace = 'public'::regnamespace
     AND c.relname = r.relation_name
  ) AS x
),
workspace_column_checks AS (
  SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY x.table_name), '[]'::jsonb) AS result
  FROM (
    SELECT t.table_name,
           c.udt_name,
           c.is_nullable,
           c.column_default,
           EXISTS (
             SELECT 1
             FROM pg_constraint AS con
             WHERE con.conrelid = format('public.%I', t.table_name)::regclass
               AND con.contype = 'f'
               AND con.confrelid = 'public.workspaces'::regclass
               AND con.conkey = ARRAY[
                 (SELECT attnum
                  FROM pg_attribute
                  WHERE attrelid = format('public.%I', t.table_name)::regclass
                    AND attname = 'workspace_id'
                    AND NOT attisdropped)
               ]::smallint[]
           ) AS references_workspaces
    FROM (VALUES
      ('wallets'::text),
      ('transactions'::text),
      ('investments'::text),
      ('copy_trades'::text),
      ('traders'::text),
      ('support_conversations'::text),
      ('support_messages'::text),
      ('deposit_requests'::text),
      ('maintenance_requests'::text),
      ('mining_rewards'::text),
      ('spot_orders'::text),
      ('user_miners'::text),
      ('withdrawal_requests'::text),
      ('investment_engine_audit'::text),
      ('investment_engine_performance'::text)
    ) AS t(table_name)
    LEFT JOIN information_schema.columns AS c
      ON c.table_schema = 'public'
     AND c.table_name = t.table_name
     AND c.column_name = 'workspace_id'
  ) AS x
),
workspace_data_checks AS (
  SELECT jsonb_build_object(
    'primary_workspace_count', (SELECT count(*) FROM public.workspaces WHERE id = '00000000-0000-0000-0000-000000000001'::uuid),
    'active_primary_workspace_count', (SELECT count(*) FROM public.workspaces WHERE id = '00000000-0000-0000-0000-000000000001'::uuid AND is_active),
    'profile_count', (SELECT count(*) FROM public.profiles),
    'primary_membership_count', (SELECT count(*) FROM public.workspace_members WHERE workspace_id = '00000000-0000-0000-0000-000000000001'::uuid),
    'profiles_without_primary_membership', (
      SELECT count(*)
      FROM public.profiles AS p
      WHERE NOT EXISTS (
        SELECT 1
        FROM public.workspace_members AS m
        WHERE m.workspace_id = '00000000-0000-0000-0000-000000000001'::uuid
          AND m.user_id = p.id
      )
    ),
    'workspace_members_with_null_keys', (
      SELECT count(*)
      FROM public.workspace_members
      WHERE workspace_id IS NULL OR user_id IS NULL
    ),
    'duplicate_wallet_keys', (
      SELECT count(*)
      FROM (
        SELECT workspace_id, user_id, asset
        FROM public.wallets
        GROUP BY workspace_id, user_id, asset
        HAVING count(*) > 1
      ) AS duplicates
    ),
    'duplicate_active_support_keys', (
      SELECT count(*)
      FROM (
        SELECT workspace_id, user_id
        FROM public.support_conversations
        WHERE status = 'active'
        GROUP BY workspace_id, user_id
        HAVING count(*) > 1
      ) AS duplicates
    ),
    'null_workspace_rows', jsonb_build_object(
      'wallets', (SELECT count(*) FROM public.wallets WHERE workspace_id IS NULL),
      'transactions', (SELECT count(*) FROM public.transactions WHERE workspace_id IS NULL),
      'investments', (SELECT count(*) FROM public.investments WHERE workspace_id IS NULL),
      'copy_trades', (SELECT count(*) FROM public.copy_trades WHERE workspace_id IS NULL),
      'traders', (SELECT count(*) FROM public.traders WHERE workspace_id IS NULL),
      'support_conversations', (SELECT count(*) FROM public.support_conversations WHERE workspace_id IS NULL),
      'support_messages', (SELECT count(*) FROM public.support_messages WHERE workspace_id IS NULL),
      'deposit_requests', (SELECT count(*) FROM public.deposit_requests WHERE workspace_id IS NULL),
      'maintenance_requests', (SELECT count(*) FROM public.maintenance_requests WHERE workspace_id IS NULL),
      'mining_rewards', (SELECT count(*) FROM public.mining_rewards WHERE workspace_id IS NULL),
      'spot_orders', (SELECT count(*) FROM public.spot_orders WHERE workspace_id IS NULL),
      'user_miners', (SELECT count(*) FROM public.user_miners WHERE workspace_id IS NULL),
      'withdrawal_requests', (SELECT count(*) FROM public.withdrawal_requests WHERE workspace_id IS NULL),
      'investment_engine_audit', (SELECT count(*) FROM public.investment_engine_audit WHERE workspace_id IS NULL),
      'investment_engine_performance', (SELECT count(*) FROM public.investment_engine_performance WHERE workspace_id IS NULL)
    )
  ) AS result
),
trigger_checks AS (
  SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY x.trigger_name), '[]'::jsonb) AS result
  FROM (
    SELECT tg.tgname AS trigger_name,
           pg_get_triggerdef(tg.oid, true) AS definition,
           NOT tg.tgenabled = 'D' AS enabled
    FROM pg_trigger AS tg
    WHERE tg.tgrelid = 'auth.users'::regclass
      AND tg.tgname = 'on_auth_user_created'
      AND NOT tg.tgisinternal
  ) AS x
),
function_checks AS (
  SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY x.signature), '[]'::jsonb) AS result
  FROM (
    SELECT p.oid::regprocedure::text AS signature,
           p.prosecdef AS security_definer,
           p.proconfig AS configuration,
           has_function_privilege('PUBLIC', p.oid, 'EXECUTE') AS public_execute,
           has_function_privilege('anon', p.oid, 'EXECUTE') AS anon_execute,
           has_function_privilege('authenticated', p.oid, 'EXECUTE') AS authenticated_execute,
           has_function_privilege('service_role', p.oid, 'EXECUTE') AS service_role_execute
    FROM pg_proc AS p
    WHERE p.oid IN (
      'public.current_workspace_id()'::regprocedure,
      'public.workspace_has_access(uuid,uuid)'::regprocedure,
      'public.set_workspace_context(uuid)'::regprocedure,
      'public.handle_new_user()'::regprocedure
    )
  ) AS x
),
policy_checks AS (
  SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY x.tablename, x.policyname), '[]'::jsonb) AS result
  FROM (
    SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN (
        'workspaces',
        'workspace_members',
        'wallets',
        'transactions',
        'investments',
        'copy_trades',
        'traders',
        'support_conversations',
        'support_messages',
        'deposit_requests',
        'maintenance_requests',
        'mining_rewards',
        'spot_orders',
        'user_miners',
        'withdrawal_requests',
        'platform_settings'
      )
  ) AS x
),
privilege_checks AS (
  SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY x.object_name, x.grantee, x.privilege_type), '[]'::jsonb) AS result
  FROM (
    SELECT 'function'::text AS object_kind,
           p.oid::regprocedure::text AS object_name,
           r.rolname AS grantee,
           has_function_privilege(r.rolname, p.oid, 'EXECUTE') AS has_execute
    FROM pg_proc AS p
    CROSS JOIN (VALUES ('public'::name), ('anon'::name), ('authenticated'::name), ('service_role'::name)) AS roles(role_name)
    JOIN pg_roles AS r ON r.rolname = roles.role_name
    WHERE p.oid IN (
      'public.current_workspace_id()'::regprocedure,
      'public.workspace_has_access(uuid,uuid)'::regprocedure,
      'public.set_workspace_context(uuid)'::regprocedure,
      'public.handle_new_user()'::regprocedure
    )
  ) AS x
),
administrator_checks AS (
  SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY x.user_id), '[]'::jsonb) AS result
  FROM (
    SELECT ur.user_id, ur.role::text AS role, u.email
    FROM public.user_roles AS ur
    LEFT JOIN auth.users AS u ON u.id = ur.user_id
    WHERE ur.role::text = 'admin'
  ) AS x
)
SELECT section, result
FROM (
  SELECT 'relations'::text AS section, result FROM relation_checks
  UNION ALL SELECT 'workspace_columns_and_foreign_keys', result FROM workspace_column_checks
  UNION ALL SELECT 'workspace_data', result FROM workspace_data_checks
  UNION ALL SELECT 'new_user_trigger', result FROM trigger_checks
  UNION ALL SELECT 'workspace_functions', result FROM function_checks
  UNION ALL SELECT 'rls_policies', result FROM policy_checks
  UNION ALL SELECT 'workspace_function_privileges', result FROM privilege_checks
  UNION ALL SELECT 'administrator_assignments', result FROM administrator_checks
) AS consolidated
ORDER BY section;
