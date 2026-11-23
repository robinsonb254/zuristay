-- Keep this migration in sync with the live Supabase schema change.
alter table public.partner_applications add column if not exists has_conference_rooms boolean not null default false;
alter table public.properties add column if not exists has_conference_rooms boolean not null default false, add column if not exists conference_room_capacity integer, add column if not exists conference_room_details text;
alter table public.properties drop constraint if exists properties_conference_room_capacity_check;
alter table public.properties add constraint properties_conference_room_capacity_check check (conference_room_capacity is null or conference_room_capacity between 1 and 10000);
alter table public.booking_items add column if not exists partner_room_secured_at timestamptz, add column if not exists partner_guest_arrived_at timestamptz, add column if not exists guest_room_access_confirmed_at timestamptz;
alter table public.partner_settlements alter column eligible_at drop not null;
update public.commission_rules set commission_rate = 0.15, name = 'ZuriStay standard 15% commission' where active = true;
create or replace function public.create_partner_settlement_for_paid_booking() returns trigger language plpgsql security definer set search_path = '' as $$
begin
 if new.payment_status = 'paid' and old.payment_status is distinct from 'paid' then
  insert into public.partner_settlements (booking_id, partner_id, amount_due, currency, status, eligible_at)
  select bi.booking_id, bi.partner_id, bi.partner_payable, bi.currency, 'awaiting_confirmations', null from public.booking_items bi where bi.booking_id = new.id and bi.partner_id is not null on conflict (booking_id, partner_id) do nothing;
  insert into public.platform_commissions (booking_id, amount, currency) select bi.booking_id, bi.commission_amount, bi.currency from public.booking_items bi on conflict (booking_id) do nothing;
 end if;
 return new;
end; $$;
revoke all on function public.create_partner_settlement_for_paid_booking() from public, anon, authenticated;
create or replace function public.release_eligible_partner_settlements() returns integer language plpgsql security definer set search_path = '' as $$
declare v_updated integer;
begin
 update public.partner_settlements ps set status='pending', eligible_at=pg_catalog.now()
 from public.bookings b, public.property_partners pp, public.partner_payout_accounts pa
 where ps.booking_id=b.id and ps.partner_id=pp.id and pa.partner_id=pp.id
 and ps.status='awaiting_confirmations' and b.booking_status='confirmed' and b.payment_status='paid'
 and pp.status='approved' and pa.verification_status='verified'
 and exists (select 1 from public.booking_items bi where bi.booking_id=ps.booking_id and bi.partner_id=ps.partner_id and bi.partner_room_secured_at is not null and bi.partner_guest_arrived_at is not null and bi.guest_room_access_confirmed_at is not null)
 and not exists (select 1 from public.booking_items bi where bi.booking_id=ps.booking_id and bi.partner_id=ps.partner_id and (bi.partner_room_secured_at is null or bi.partner_guest_arrived_at is null or bi.guest_room_access_confirmed_at is null));
 get diagnostics v_updated=row_count; return v_updated;
end; $$;
revoke all on function public.release_eligible_partner_settlements() from public, anon, authenticated;
grant execute on function public.release_eligible_partner_settlements() to service_role;