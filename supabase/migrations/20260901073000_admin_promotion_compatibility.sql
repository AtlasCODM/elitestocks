-- Keep administrator access compatible with the existing promotion flow.
-- Existing deployments may promote accounts by setting profiles.status = 'admin';
-- admin_users remains supported for explicit grants and revocation.
CREATE OR REPLACE FUNCTION public.is_admin(actor uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.admin_users WHERE user_id = actor
  ) OR EXISTS (
    SELECT 1 FROM public.profiles WHERE id = actor AND lower(status) IN ('admin', 'administrator')
  );
$$;
REVOKE EXECUTE ON FUNCTION public.is_admin(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_admin(uuid) TO authenticated, service_role;
