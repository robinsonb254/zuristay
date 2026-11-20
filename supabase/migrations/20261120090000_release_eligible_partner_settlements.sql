-- Promote partner settlements to the payout queue only after checkout,
-- while the partner is still approved and has a verified payout destination.
create or replace function public.release_eligible_partner_settlements()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_updated integer;
begin
  update public.partner_settlements ps
  set status = 'pending'
  from public.bookings b,
       public.property_partners pp,
       public.partner_payout_accounts pa
  where ps.booking_id = b.id
    and ps.partner_id = pp.id
    and pa.partner_id = pp.id
    and ps.status = 'awaiting_checkout'
    and ps.eligible_at is not null
    and ps.eligible_at <= pg_catalog.now()
    and b.booking_status = 'confirmed'
    and b.payment_status = 'paid'
    and pp.status = 'approved'
    and pa.verification_status = 'verified';

  get diagnostics v_updated = row_count;
  return v_updated;
end;
$$;

revoke all on function public.release_eligible_partner_settlements() from public, anon, authenticated;
grant execute on function public.release_eligible_partner_settlements() to service_role;

do $$
begin
  if not exists (
    select 1 from cron.job
    where jobname = 'zuristay-release-eligible-partner-settlements'
  ) then
    perform cron.schedule(
      'zuristay-release-eligible-partner-settlements',
      '*/5 * * * *',
      'select public.release_eligible_partner_settlements();'
    );
  end if;
end;
$$;
