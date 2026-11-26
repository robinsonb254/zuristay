-- Restrict privileged helper RPCs to signed-in users and service role.
-- These SECURITY DEFINER helpers validate auth.uid() internally and are used by
-- authenticated RLS policies; anonymous callers do not need direct execution.
REVOKE EXECUTE ON FUNCTION public.is_admin() FROM anon;
REVOKE EXECUTE ON FUNCTION public.owns_property(uuid) FROM anon;
