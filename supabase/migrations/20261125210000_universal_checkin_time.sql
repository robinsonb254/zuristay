-- Universal 2:00 PM East Africa Time check-in and immutable booking-time snapshot.
alter table public.properties
  add column if not exists check_in_time time not null default time '14:00:00';

-- The platform-wide standard is fixed; property partners cannot set exceptions.
alter table public.properties
  drop constraint if exists properties_check_in_time_uniform;
alter table public.properties
  add constraint properties_check_in_time_uniform
  check (check_in_time = time '14:00:00');

update public.properties set check_in_time = time '14:00:00'
where check_in_time is distinct from time '14:00:00';

alter table public.bookings
  add column if not exists scheduled_check_in_at timestamptz;

-- Backfill historical bookings using the universal EAT check-in time.
update public.bookings
set scheduled_check_in_at = (check_in::timestamp + time '14:00:00') at time zone 'Africa/Nairobi'
where scheduled_check_in_at is null;

alter table public.bookings
  alter column scheduled_check_in_at set not null;

create index if not exists bookings_scheduled_check_in_at_idx
  on public.bookings(scheduled_check_in_at);

-- Preserve the existing secure booking contract while snapshotting the actual
-- scheduled check-in instant inside the same database transaction.
create or replace function public.create_booking_hold_with_policy_secure(
  p_unit_id uuid,
  p_check_in date,
  p_check_out date,
  p_quantity integer,
  p_guests integer,
  p_guest_name text,
  p_guest_email text,
  p_guest_phone text,
  p_idempotency_key uuid,
  p_customer_user_id uuid,
  p_special_requests text,
  p_guest_access_token_hash text,
  p_policy_version text,
  p_policy_accepted boolean
) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_result jsonb;
  v_booking_id uuid;
  v_property_id uuid;
  v_check_in_time time;
begin
  if p_policy_accepted is not true or p_policy_version <> '2026-11-25' then
    raise exception 'You must accept the current ZuriStay Worldwide cancellation and refund policy before booking.';
  end if;
  if p_guest_access_token_hash is null or p_guest_access_token_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'A valid guest access token hash is required.';
  end if;

  select property_id into v_property_id
  from public.property_units where id = p_unit_id and active = true;
  if v_property_id is null then
    raise exception 'The selected accommodation is not available.';
  end if;

  select check_in_time into v_check_in_time
  from public.properties
  where id = v_property_id and is_active = true and is_archived = false;
  if v_check_in_time is null then
    raise exception 'The accommodation check-in time is not configured.';
  end if;

  v_result := public.create_booking_hold(
    p_unit_id,p_check_in,p_check_out,p_quantity,p_guests,p_guest_name,
    p_guest_email,p_guest_phone,p_idempotency_key,p_customer_user_id,p_special_requests
  );
  if coalesce((v_result ->> 'success')::boolean,false) is not true
     or v_result ->> 'booking_id' is null then
    raise exception 'The booking hold could not be secured.';
  end if;
  v_booking_id := (v_result ->> 'booking_id')::uuid;

  update public.bookings
    set guest_access_token_hash = p_guest_access_token_hash,
        cancellation_policy_version = p_policy_version,
        cancellation_policy_accepted_at = coalesce(cancellation_policy_accepted_at, now()),
        scheduled_check_in_at = ((p_check_in::timestamp + v_check_in_time) at time zone 'Africa/Nairobi')
    where id = v_booking_id;
  if not found then
    raise exception 'The secure booking access and check-in time could not be stored.';
  end if;
  return v_result;
end;
$$;

revoke all on function public.create_booking_hold_with_policy_secure(uuid,date,date,integer,integer,text,text,text,uuid,uuid,text,text,text,boolean) from public,anon,authenticated;
grant execute on function public.create_booking_hold_with_policy_secure(uuid,date,date,integer,integer,text,text,text,uuid,uuid,text,text,text,boolean) to service_role;

-- Cancellation eligibility is evaluated against the immutable booking snapshot.
create or replace function public.submit_booking_cancellation_request(
  p_booking_id uuid,
  p_guest_access_token_hash text,
  p_reason text
) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_booking public.bookings%rowtype;
  v_request_id uuid;
begin
  if length(btrim(coalesce(p_reason,''))) < 5 or length(p_reason) > 2000 then
    raise exception 'Please provide a cancellation reason (5–2,000 characters).';
  end if;
  select * into v_booking from public.bookings where id=p_booking_id for update;
  if not found or v_booking.guest_access_token_hash is null
     or v_booking.guest_access_token_hash <> p_guest_access_token_hash then
    raise exception 'Booking not found or secure guest access is invalid.';
  end if;
  if v_booking.booking_status not in ('confirmed','pending') then
    raise exception 'Only pending or confirmed bookings can be cancelled through this request.';
  end if;
  if v_booking.scheduled_check_in_at is null then
    raise exception 'The scheduled check-in time is unavailable. Please contact ZuriStay Worldwide support.';
  end if;
  if v_booking.scheduled_check_in_at <= now() then
    raise exception 'Check-in time has passed. Please contact ZuriStay Worldwide support.';
  end if;
  insert into public.booking_cancellation_requests(booking_id,reason)
  values (p_booking_id,btrim(p_reason))
  returning id into v_request_id;

  insert into public.booking_cancellation_settlement_holds(
    cancellation_request_id, settlement_id, previous_status, previous_eligible_at
  )
  select v_request_id, ps.id, ps.status, ps.eligible_at
  from public.partner_settlements ps
  where ps.booking_id=p_booking_id
    and ps.status in ('awaiting_checkout','awaiting_confirmations','pending','processing')
  on conflict do nothing;

  update public.partner_settlements
  set status='held', eligible_at=null
  where booking_id=p_booking_id
    and status in ('awaiting_checkout','awaiting_confirmations','pending','processing');

  return jsonb_build_object(
    'success',true,
    'request_id',v_request_id,
    'status','pending_review',
    'requested_at',now(),
    'scheduled_check_in_at',v_booking.scheduled_check_in_at,
    'full_refund_deadline',v_booking.scheduled_check_in_at - interval '48 hours'
  );
end;
$$;
revoke all on function public.submit_booking_cancellation_request(uuid,text,text) from public,anon,authenticated;
grant execute on function public.submit_booking_cancellation_request(uuid,text,text) to service_role;
