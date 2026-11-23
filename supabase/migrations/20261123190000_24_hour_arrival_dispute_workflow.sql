-- Hold partner settlements for 24 hours after the scheduled check-in
-- when neither the partner nor guest has completed the arrival confirmations.
-- Scheduled check-in is 14:00 Africa/Nairobi because bookings currently store
-- a check-in date (not a guest-reported arrival timestamp).

alter table public.partner_settlements
  drop constraint if exists partner_settlements_status_check;

alter table public.partner_settlements
  add constraint partner_settlements_status_check
  check (status = any (array[
    'awaiting_checkout'::text,
    'awaiting_confirmations'::text,
    'pending'::text,
    'processing'::text,
    'paid'::text,
    'held'::text,
    'cancelled'::text
  ]));

create table if not exists public.partner_settlement_disputes (
  id uuid primary key default gen_random_uuid(),
  settlement_id uuid not null unique references public.partner_settlements(id) on delete restrict,
  booking_id uuid not null references public.bookings(id) on delete restrict,
  partner_id uuid not null references public.property_partners(id) on delete restrict,
  reason text not null default 'arrival_unconfirmed_after_24_hours',
  check_in_deadline_at timestamptz not null,
  status text not null default 'open' check (status in ('open', 'resolved')),
  resolution text check (resolution in ('partner_paid', 'guest_refunded')),
  resolution_notes text,
  external_reference text,
  resolved_by uuid references auth.users(id),
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint partner_settlement_dispute_resolution_consistency check (
    (status = 'open' and resolution is null and resolved_at is null and resolved_by is null)
    or
    (status = 'resolved' and resolution is not null and resolved_at is not null and resolved_by is not null)
  )
);

create table if not exists public.partner_settlement_dispute_events (
  id uuid primary key default gen_random_uuid(),
  dispute_id uuid not null references public.partner_settlement_disputes(id) on delete restrict,
  admin_user_id uuid references auth.users(id),
  event_type text not null,
  notes text not null,
  external_reference text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists partner_settlement_disputes_status_created_idx
  on public.partner_settlement_disputes(status, created_at desc);
create index if not exists partner_settlement_disputes_deadline_idx
  on public.partner_settlement_disputes(check_in_deadline_at);

alter table public.partner_settlement_disputes enable row level security;
alter table public.partner_settlement_dispute_events enable row level security;
revoke all on public.partner_settlement_disputes from public, anon, authenticated;
revoke all on public.partner_settlement_dispute_events from public, anon, authenticated;
grant all on public.partner_settlement_disputes to service_role;
grant all on public.partner_settlement_dispute_events to service_role;

create or replace function public.flag_overdue_partner_settlement_disputes()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_flagged integer := 0;
begin
  with overdue as (
    select
      ps.id as settlement_id,
      ps.booking_id,
      ps.partner_id,
      (((b.check_in + time '14:00') at time zone 'Africa/Nairobi') + interval '24 hours') as deadline_at
    from public.partner_settlements ps
    join public.bookings b on b.id = ps.booking_id
    where ps.status = 'awaiting_confirmations'
      and b.payment_status = 'paid'
      and b.booking_status in ('confirmed', 'checked_in')
      and pg_catalog.now() >= (((b.check_in + time '14:00') at time zone 'Africa/Nairobi') + interval '24 hours')
      and exists (
        select 1 from public.booking_items bi
        where bi.booking_id = ps.booking_id and bi.partner_id = ps.partner_id
      )
      and exists (
        select 1 from public.booking_items bi
        where bi.booking_id = ps.booking_id and bi.partner_id = ps.partner_id
          and (bi.partner_room_secured_at is null
            or bi.partner_guest_arrived_at is null
            or bi.guest_room_access_confirmed_at is null)
      )
  ),
  inserted as (
    insert into public.partner_settlement_disputes (
      settlement_id, booking_id, partner_id, check_in_deadline_at
    )
    select settlement_id, booking_id, partner_id, deadline_at
    from overdue
    on conflict (settlement_id) do nothing
    returning settlement_id
  )
  update public.partner_settlements ps
  set status = 'held'
  where ps.id in (select settlement_id from inserted)
    and ps.status = 'awaiting_confirmations';

  get diagnostics v_flagged = row_count;
  return v_flagged;
end;
$$;

revoke all on function public.flag_overdue_partner_settlement_disputes() from public, anon, authenticated;
grant execute on function public.flag_overdue_partner_settlement_disputes() to service_role;

create or replace function public.resolve_partner_settlement_dispute(
  p_dispute_id uuid,
  p_admin_user_id uuid,
  p_resolution text,
  p_notes text,
  p_external_reference text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_dispute public.partner_settlement_disputes%rowtype;
  v_settlement public.partner_settlements%rowtype;
begin
  if p_resolution not in ('partner_paid', 'guest_refunded') then
    raise exception 'Choose partner_paid or guest_refunded.';
  end if;
  if pg_catalog.length(pg_catalog.btrim(coalesce(p_notes, ''))) < 10 then
    raise exception 'Enter investigation notes of at least 10 characters.';
  end if;
  if pg_catalog.length(pg_catalog.btrim(coalesce(p_external_reference, ''))) < 3 then
    raise exception 'Enter the external payment or refund reference.';
  end if;
  if not exists (
    select 1 from public.profiles p
    where p.id = p_admin_user_id and p.role = 'admin'
  ) then
    raise exception 'Administrator permission is required.';
  end if;

  select * into v_dispute
  from public.partner_settlement_disputes
  where id = p_dispute_id
  for update;

  if not found then
    raise exception 'Dispute not found.';
  end if;
  if v_dispute.status <> 'open' then
    raise exception 'This dispute has already been resolved.';
  end if;

  select * into v_settlement
  from public.partner_settlements
  where id = v_dispute.settlement_id
  for update;

  if not found or v_settlement.status <> 'held' then
    raise exception 'The related settlement is not held for manual review.';
  end if;

  if p_resolution = 'partner_paid' then
    update public.partner_settlements
    set status = 'paid',
        paid_at = pg_catalog.now(),
        payment_reference = pg_catalog.btrim(p_external_reference)
    where id = v_dispute.settlement_id;
  else
    update public.partner_settlements
    set status = 'cancelled',
        payment_reference = pg_catalog.btrim(p_external_reference)
    where id = v_dispute.settlement_id;
  end if;

  update public.partner_settlement_disputes
  set status = 'resolved',
      resolution = p_resolution,
      resolution_notes = pg_catalog.btrim(p_notes),
      external_reference = pg_catalog.btrim(p_external_reference),
      resolved_by = p_admin_user_id,
      resolved_at = pg_catalog.now(),
      updated_at = pg_catalog.now()
  where id = p_dispute_id;

  insert into public.partner_settlement_dispute_events (
    dispute_id, admin_user_id, event_type, notes, external_reference
  ) values (
    p_dispute_id, p_admin_user_id, p_resolution,
    pg_catalog.btrim(p_notes), pg_catalog.btrim(p_external_reference)
  );

  return jsonb_build_object(
    'success', true,
    'dispute_id', p_dispute_id,
    'resolution', p_resolution,
    'settlement_status', case when p_resolution = 'partner_paid' then 'paid' else 'cancelled' end
  );
end;
$$;

revoke all on function public.resolve_partner_settlement_dispute(uuid, uuid, text, text, text) from public, anon, authenticated;
grant execute on function public.resolve_partner_settlement_dispute(uuid, uuid, text, text, text) to service_role;

do $$
begin
  if not exists (
    select 1 from cron.job where jobname = 'zuristay-flag-unconfirmed-arrivals'
  ) then
    perform cron.schedule(
      'zuristay-flag-unconfirmed-arrivals',
      '*/5 * * * *',
      'select public.flag_overdue_partner_settlement_disputes();'
    );
  end if;
end;
$$;
