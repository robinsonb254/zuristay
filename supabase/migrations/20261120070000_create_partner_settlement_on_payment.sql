-- Automatically create the partner's payable ledger entry in the same
-- transaction that marks a booking as paid. Actual disbursement is handled
-- separately by the payout processor after checkout and destination verification.
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
      booking_id,
      partner_id,
      amount_due,
      currency,
      status,
      eligible_at
    )
    select
      bi.booking_id,
      bi.partner_id,
      bi.partner_payable,
      bi.currency,
      'awaiting_checkout',
      ((new.check_out::timestamp + interval '10 hours') at time zone 'Africa/Nairobi')
    from public.booking_items bi
    where bi.booking_id = new.id
      and bi.partner_id is not null
    on conflict (booking_id, partner_id) do nothing;
  end if;

  return new;
end;
$$;

revoke all on function public.create_partner_settlement_for_paid_booking() from public, anon, authenticated;

drop trigger if exists bookings_create_partner_settlement on public.bookings;
create trigger bookings_create_partner_settlement
after update of payment_status on public.bookings
for each row
execute function public.create_partner_settlement_for_paid_booking();
