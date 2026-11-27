-- Public approved-listing SELECT policies call these read-only SECURITY DEFINER helpers.
-- Guests need EXECUTE permission so RLS can evaluate the public branch; this does not grant table writes.
GRANT EXECUTE ON FUNCTION public.owns_property(uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.is_admin() TO anon;
