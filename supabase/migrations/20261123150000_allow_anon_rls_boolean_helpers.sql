-- RLS policies on public catalog tables call these boolean helpers.
-- Anonymous callers have no auth.uid(), so both helpers safely return false.
grant execute on function public.owns_property(uuid) to anon;
grant execute on function public.is_admin() to anon;
