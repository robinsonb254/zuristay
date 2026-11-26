GRANT SELECT ON TABLE public.platform_commissions TO authenticated;

CREATE POLICY "Admins can read platform commissions"
ON public.platform_commissions
FOR SELECT
TO authenticated
USING (public.is_admin());
