-- Booking holds are internal inventory locks. All customer and partner
-- access is mediated by server-side booking APIs and privileged RPC functions.
REVOKE ALL ON TABLE public.booking_holds FROM anon, authenticated;
