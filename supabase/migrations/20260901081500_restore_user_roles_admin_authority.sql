-- The established authorization source is public.user_roles.
-- Earlier application migrations incorrectly redefined is_admin() around legacy
-- admin_users/profile fields. Restore one authoritative function so all RPCs,
-- server functions, navigation, and route protection agree.
CREATE OR REPLACE FUNCTION public.is_admin(actor uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = actor
      AND role::text = 'admin'
  );
$$;
REVOKE EXECUTE ON FUNCTION public.is_admin(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_admin(uuid) TO authenticated, service_role;
