-- Uniform ZuriStay Worldwide cancellation requests and auditable refund decisions.
create table if not exists public.booking_cancellation_requests (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete restrict,
  reason text not null,
  status text not null default 'pending_review'
    check (status in ('pending_review','approved','denied','refund_pending','refunded')),
  policy_version text not null default '2026-11-25',
  requested_at timestamptz not null default now(),
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  refund_amount numeric(12,2),
  retained_amount numeric(12,2),
  decision_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (length(btrim(reason)) between 5 and 2000),
  check (refund_amount is null or refund_amount >= 0),
  check (retained_amount is null or retained_amount >= 0)
);

create unique index if not exists booking_cancellation_one_open_request
  on public.booking_cancellation_requests(booking_id)
  where status in ('pending_review','approved','refund_pending');

create index if not exists booking_cancellation_requests_status_created
  on public.booking_cancellation_requests(status, created_at desc);

create table if not exists public.booking_refund_transactions (
  id uuid primary key default gen_random_uuid(),
  cancellation_request_id uuid not null references public.booking_cancellation_requests(id) on delete restrict,
  booking_id uuid not null references public.bookings(id) on delete restrict,
  payment_method text not null check (payment_method in ('mpesa','paypal')),
  amount numeric(12,2) not null check (amount > 0),
  currency text not null,
  status text not null default 'pending' check (status in ('pending','succeeded','failed')),
  provider_reference text,
  initiated_by uuid references auth.users(id),
  completed_by uuid references auth.users(id),
  failure_reason text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists booking_refund_transactions_booking
  on public.booking_refund_transactions(booking_id, created_at desc);

alter table public.booking_cancellation_requests enable row level security;
alter table public.booking_refund_transactions enable row level security;
revoke all on public.booking_cancellation_requests from anon, authenticated;
revoke all on public.booking_refund_transactions from anon, authenticated;
grant all on public.booking_cancellation_requests to service_role;
grant all on public.booking_refund_transactions to service_role;

create or replace function public.submit_booking_cancellation_request(
  p_booking_id uuid,
  p_guest_access_token_hash text,
  p_reason text
) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare v_booking public.bookings%rowtype; v_request_id uuid;
begin
  if length(btrim(coalesce(p_reason,''))) < 5 or length(p_reason) > 2000 then
    raise exception 'Please provide a cancellation reason (5–2,000 characters).';
  end if;
  select * into v_booking from public.bookings
    where id=p_booking_id for update;
  if not found or v_booking.guest_access_token_hash is null
     or v_booking.guest_access_token_hash <> p_guest_access_token_hash then
    raise exception 'Booking not found or secure guest access is invalid.';
  end if;
  if v_booking.booking_status not in ('confirmed','pending') then
    raise exception 'Only pending or confirmed bookings can be cancelled through this request.';
  end if;
  if v_booking.check_in < current_date then
    raise exception 'For a stay that has already started, please contact ZuriStay Worldwide support.';
  end if;
  insert into public.booking_cancellation_requests(booking_id,reason)
  values (p_booking_id,btrim(p_reason))
  returning id into v_request_id;
  update public.partner_settlements
    set status='held', eligible_at=null
    where booking_id=p_booking_id
      and status in ('awaiting_checkout','awaiting_confirmations','pending','processing');
  return jsonb_build_object('success',true,'request_id',v_request_id,'status','pending_review');
end;
$$;

create or replace function public.admin_review_booking_cancellation(
  p_request_id uuid,
  p_admin_user_id uuid,
  p_action text,
  p_refund_amount numeric,
  p_notes text
) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare v_req public.booking_cancellation_requests%rowtype;
        v_booking public.bookings%rowtype;
        v_method text;
        v_refund_id uuid;
begin
  if not exists (select 1 from public.profiles where id=p_admin_user_id and role='admin') then
    raise exception 'Administrator permission is required.';
  end if;
  if length(btrim(coalesce(p_notes,''))) < 10 or length(p_notes) > 4000 then
    raise exception 'Provide decision notes (10–4,000 characters).';
  end if;
  select * into v_req from public.booking_cancellation_requests
    where id=p_request_id for update;
  if not found or v_req.status <> 'pending_review' then
    raise exception 'This cancellation request is no longer awaiting review.';
  end if;
  select * into v_booking from public.bookings where id=v_req.booking_id for update;

  if p_action='deny' then
    update public.booking_cancellation_requests
      set status='denied', reviewed_by=p_admin_user_id, reviewed_at=now(),
          decision_notes=btrim(p_notes), updated_at=now()
      where id=p_request_id;
    -- Only release held settlements if the booking is still eligible under
    -- the existing confirmation and payout checks.
    update public.partner_settlements
      set status='awaiting_confirmations'
      where booking_id=v_req.booking_id and status='held'
        and v_booking.payment_status='paid';
    return jsonb_build_object('success',true,'status','denied');
  end if;

  if p_action <> 'approve' then raise exception 'Unsupported cancellation action.'; end if;
  if p_refund_amount is null or p_refund_amount < 0 or p_refund_amount > v_booking.total_amount then
    raise exception 'Refund amount must be between zero and the booking total.';
  end if;
  if p_refund_amount > 0 and v_booking.payment_status <> 'paid' then
    raise exception 'A refund can only be approved for a paid booking.';
  end if;

  select payment_method into v_method from public.payments
    where booking_id=v_req.booking_id and status='successful'
    order by verified_at desc nulls last, created_at desc limit 1;
  if p_refund_amount > 0 and v_method not in ('mpesa','paypal') then
    raise exception 'The original payment method could not be verified for refund recording.';
  end if;

  update public.booking_cancellation_requests
    set status=case when p_refund_amount > 0 then 'refund_pending' else 'approved' end,
        reviewed_by=p_admin_user_id, reviewed_at=now(),
        refund_amount=p_refund_amount,
        retained_amount=greatest(v_booking.total_amount-p_refund_amount,0),
        decision_notes=btrim(p_notes), updated_at=now()
    where id=p_request_id;

  update public.bookings set booking_status='cancelled'
    where id=v_req.booking_id;

  update public.partner_settlements
    set status='held', eligible_at=null
    where booking_id=v_req.booking_id
      and status in ('awaiting_checkout','awaiting_confirmations','pending','processing');

  if p_refund_amount > 0 then
    insert into public.booking_refund_transactions(
      cancellation_request_id,booking_id,payment_method,amount,currency,initiated_by
    ) values (p_request_id,v_req.booking_id,v_method,p_refund_amount,v_booking.currency,p_admin_user_id)
    returning id into v_refund_id;
  end if;

  return jsonb_build_object(
    'success',true,
    'status',case when p_refund_amount > 0 then 'refund_pending' else 'approved' end,
    'refund_transaction_id',v_refund_id,
    'refund_amount',p_refund_amount,
    'retained_amount',greatest(v_booking.total_amount-p_refund_amount,0)
  );
end;
$$;

create or replace function public.record_booking_refund_result(
  p_refund_transaction_id uuid,
  p_admin_user_id uuid,
  p_result text,
  p_provider_reference text,
  p_notes text
) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare v_refund public.booking_refund_transactions%rowtype;
        v_total_refunded numeric(12,2);
        v_booking_total numeric(12,2);
begin
  if not exists (select 1 from public.profiles where id=p_admin_user_id and role='admin') then
    raise exception 'Administrator permission is required.';
  end if;
  if p_result not in ('succeeded','failed') then raise exception 'Invalid refund result.'; end if;
  if length(btrim(coalesce(p_notes,''))) < 10 or length(p_notes) > 4000 then
    raise exception 'Provide refund reconciliation notes (10–4,000 characters).';
  end if;
  if p_result='succeeded' and length(btrim(coalesce(p_provider_reference,''))) < 3 then
    raise exception 'Enter the payment provider refund reference.';
  end if;
  select * into v_refund from public.booking_refund_transactions
    where id=p_refund_transaction_id for update;
  if not found or v_refund.status <> 'pending' then
    raise exception 'This refund record is not pending.';
  end if;
  update public.booking_refund_transactions
    set status=p_result, provider_reference=nullif(btrim(p_provider_reference),''),
        failure_reason=case when p_result='failed' then btrim(p_notes) else null end,
        completed_by=p_admin_user_id, completed_at=now()
    where id=p_refund_transaction_id;

  if p_result='failed' then
    update public.booking_cancellation_requests
      set status='refund_pending', updated_at=now()
      where id=v_refund.cancellation_request_id;
    return jsonb_build_object('success',true,'status','failed','requires_follow_up',true);
  end if;

  select coalesce(sum(amount),0) into v_total_refunded
    from public.booking_refund_transactions
    where booking_id=v_refund.booking_id and status='succeeded';
  select total_amount into v_booking_total from public.bookings where id=v_refund.booking_id;

  update public.bookings
    set payment_status=case when v_total_refunded >= v_booking_total then 'refunded' else 'partially_refunded' end
    where id=v_refund.booking_id;

  update public.booking_cancellation_requests
    set status='refunded', updated_at=now()
    where id=v_refund.cancellation_request_id;

  -- Settlement remains held for a human reconciliation of partner payable
  -- versus the refund. It is never released automatically by this function.
  return jsonb_build_object('success',true,'status','refunded','total_refunded',v_total_refunded,
    'settlement_requires_reconciliation',true);
end;
$$;

revoke all on function public.submit_booking_cancellation_request(uuid,text,text) from public,anon,authenticated;
revoke all on function public.admin_review_booking_cancellation(uuid,uuid,text,numeric,text) from public,anon,authenticated;
revoke all on function public.record_booking_refund_result(uuid,uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.submit_booking_cancellation_request(uuid,text,text) to service_role;
grant execute on function public.admin_review_booking_cancellation(uuid,uuid,text,numeric,text) to service_role;
grant execute on function public.record_booking_refund_result(uuid,uuid,text,text,text) to service_role;
