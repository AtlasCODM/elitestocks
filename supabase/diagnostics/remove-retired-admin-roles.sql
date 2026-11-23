-- EliteStocks administrator cleanup
-- Supabase SQL Editor compatible: PostgreSQL SQL only; no psql meta-commands.
--
-- Scope is intentionally limited to two exact user_roles assignments:
--   Meback  41f53e7d-c2ef-4510-a672-1417e5aeb1a4
--   WebTest 8741995f-5ef5-4674-8143-eeff5ab99305
--
-- Auth accounts and all associated application data are preserved.
-- Testing (5031f488-3ed2-4acd-86b7-931ac6404728) must retain admin.

DO $cleanup$
DECLARE
  v_removed integer;
  v_testing_admin boolean;
BEGIN
  IF to_regclass('public.user_roles') IS NULL THEN
    RAISE EXCEPTION 'Required table public.user_roles does not exist; no changes made';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'user_roles'
      AND column_name = 'user_id'
  ) OR NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'user_roles'
      AND column_name = 'role'
  ) THEN
    RAISE EXCEPTION 'Expected public.user_roles(user_id, role) columns are missing; no changes made';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = '5031f488-3ed2-4acd-86b7-931ac6404728'::uuid
      AND role::text = 'admin'
  ) THEN
    RAISE EXCEPTION 'Testing administrator assignment is absent; no changes made';
  END IF;

  DELETE FROM public.user_roles
  WHERE role::text = 'admin'
    AND user_id IN (
      '41f53e7d-c2ef-4510-a672-1417e5aeb1a4'::uuid,
      '8741995f-5ef5-4674-8143-eeff5ab99305'::uuid
    );
  GET DIAGNOSTICS v_removed = ROW_COUNT;

  IF v_removed <> 2 THEN
    RAISE EXCEPTION 'Expected to remove exactly 2 admin assignments, removed %', v_removed;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = '5031f488-3ed2-4acd-86b7-931ac6404728'::uuid
      AND role::text = 'admin'
  ) INTO v_testing_admin;

  IF NOT v_testing_admin THEN
    RAISE EXCEPTION 'Testing administrator assignment was not preserved';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE role::text = 'admin'
      AND user_id IN (
        '41f53e7d-c2ef-4510-a672-1417e5aeb1a4'::uuid,
        '8741995f-5ef5-4674-8143-eeff5ab99305'::uuid
      )
  ) THEN
    RAISE EXCEPTION 'A retired administrator assignment remains';
  END IF;
END;
$cleanup$;

-- Verification result: exactly one of the three identified accounts remains admin.
SELECT
  user_id,
  role::text AS role,
  CASE
    WHEN user_id = '5031f488-3ed2-4acd-86b7-931ac6404728'::uuid THEN 'RETAINED: Testing'
    WHEN user_id = '41f53e7d-c2ef-4510-a672-1417e5aeb1a4'::uuid THEN 'REMOVED: Meback'
    WHEN user_id = '8741995f-5ef5-4674-8143-eeff5ab99305'::uuid THEN 'REMOVED: WebTest'
    ELSE 'OTHER ADMIN: outside cleanup scope'
  END AS expected_state
FROM public.user_roles
WHERE role::text = 'admin'
  AND user_id IN (
    '41f53e7d-c2ef-4510-a672-1417e5aeb1a4'::uuid,
    '5031f488-3ed2-4acd-86b7-931ac6404728'::uuid,
    '8741995f-5ef5-4674-8143-eeff5ab99305'::uuid
  )
ORDER BY user_id;

SELECT
  (SELECT count(*) FROM public.user_roles
   WHERE role::text = 'admin'
     AND user_id IN (
       '41f53e7d-c2ef-4510-a672-1417e5aeb1a4'::uuid,
       '8741995f-5ef5-4674-8143-eeff5ab99305'::uuid
     )) = 0 AS retired_admins_absent,
  (SELECT count(*) FROM public.user_roles
   WHERE role::text = 'admin'
     AND user_id = '5031f488-3ed2-4acd-86b7-931ac6404728'::uuid) = 1 AS testing_admin_retained;
