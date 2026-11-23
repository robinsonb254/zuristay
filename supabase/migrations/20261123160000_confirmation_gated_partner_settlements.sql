-- New paid bookings must enter the three-confirmation hold.
create or replace function public.create_partner_settlement_for_paid_booking()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.payment_status = 'paid'
     and old.payment_status is distinct from 'paid' then
    insert into public.partner_settlements (
      booking_id, partner_id, amount_due, currency, status, eligible_at
    )
    select bi.booking_id, bi.partner_id, bi.partner_payable, bi.currency,
           'awaiting_confirmations', null
    from public.booking_items bi
    where bi.booking_id = new.id and bi.partner_id is not null
    on conflict (booking_id, partner_id) do nothing;
  end if;
  return new;
end;
$$;
revoke all on function public.create_partner_settlement_for_paid_booking() from public, anon, authenticated;

-- Promote only after every item for the partner has all three confirmations
-- and the partner has an approved account with a verified payout destination.
create or replace function public.release_eligible_partner_settlements()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare v_updated integer;
begin
  update public.partner_settlements ps
  set status = 'pending', eligible_at = pg_catalog.now()
  from public.bookings b, public.property_partners pp, public.partner_payout_accounts pa
  where ps.booking_id = b.id
    and ps.partner_id = pp.id
    and pa.partner_id = pp.id
    and ps.status = 'awaiting_confirmations'
    and b.booking_status = 'confirmed'
    and b.payment_status = 'paid'
    and pp.status = 'approved'
    and pa.verification_status = 'verified'
    and exists (
      select 1 from public.booking_items bi
      where bi.booking_id = ps.booking_id and bi.partner_id = ps.partner_id
        and bi.partner_room_secured_at is not null
        and bi.partner_guest_arrived_at is not null
        and bi.guest_room_access_confirmed_at is not null
    )
    and not exists (
      select 1 from public.booking_items bi
      where bi.booking_id = ps.booking_id and bi.partner_id = ps.partner_id
        and (bi.partner_room_secured_at is null
          or bi.partner_guest_arrived_at is null
          or bi.guest_room_access_confirmed_at is null)
    );
  get diagnostics v_updated = row_count;
  return v_updated;
end;
$$;
revoke all on function public.release_eligible_partner_settlements() from public, anon, authenticated;
grant execute on function public.release_eligible_partner_settlements() to service_role;
