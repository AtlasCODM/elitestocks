-- Make admin recognition durable across the account promotion methods used by the app.
-- Supports explicit grants, profile status, and Supabase auth metadata.
CREATE OR REPLACE FUNCTION public.is_admin(actor uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = actor)
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = actor AND lower(trim(status)) IN ('admin', 'administrator')
    )
    OR EXISTS (
      SELECT 1 FROM auth.users
      WHERE id = actor
        AND (
          lower(coalesce(raw_app_meta_data ->> 'role', '')) IN ('admin', 'administrator')
          OR lower(coalesce(raw_user_meta_data ->> 'role', '')) IN ('admin', 'administrator')
          OR lower(coalesce(raw_app_meta_data ->> 'is_admin', '')) = 'true'
          OR lower(coalesce(raw_user_meta_data ->> 'is_admin', '')) = 'true'
        )
    );
$$;
REVOKE EXECUTE ON FUNCTION public.is_admin(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_admin(uuid) TO authenticated, service_role;
