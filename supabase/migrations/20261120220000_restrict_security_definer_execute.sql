-- Restrict privileged helper functions to the roles that actually need them.
-- Trigger and event-trigger functions run through their registered triggers;
-- callers do not need direct EXECUTE permission.

REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM anon, authenticated, service_role;

REVOKE ALL ON FUNCTION public.rls_auto_enable() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.rls_auto_enable() FROM anon, authenticated, service_role;

-- These helpers are used by authenticated-user RLS policies. Keep authenticated
-- access while preventing anonymous RPC invocation.
REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_admin() FROM anon;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.owns_property(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.owns_property(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.owns_property(uuid) TO authenticated, service_role;
