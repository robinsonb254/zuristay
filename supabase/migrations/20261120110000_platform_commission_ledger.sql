-- Keep ZuriStay's commission as a separate, auditable platform ledger.
create table if not exists public.platform_commissions (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null unique references public.bookings(id) on delete restrict,
  amount numeric not null check (amount >= 0),
  currency text not null default 'KES',
  status text not null default 'earned'
    check (status in ('earned', 'transferred', 'reversed')),
  transferred_at timestamptz,
  transfer_reference text,
  created_at timestamptz not null default now()
);

alter table public.platform_commissions enable row level security;
revoke all on public.platform_commissions from anon, authenticated;
grant all on public.platform_commissions to service_role;

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

    insert into public.platform_commissions (booking_id, amount, currency)
    select bi.booking_id, bi.commission_amount, bi.currency
    from public.booking_items bi
    where bi.booking_id = new.id
    on conflict (booking_id) do nothing;
  end if;

  return new;
end;
$$;

revoke all on function public.create_partner_settlement_for_paid_booking() from public, anon, authenticated;
