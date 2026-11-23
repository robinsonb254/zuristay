-- Dual-control process for dispute funds proposed for an administrator's personal account.
alter table public.partner_settlement_disputes
  drop constraint if exists partner_settlement_disputes_resolution_check,
  drop constraint if exists partner_settlement_disputes_status_check,
  drop constraint if exists partner_settlement_dispute_resolution_consistency;

alter table public.partner_settlement_disputes
  add column if not exists personal_destination_type text,
  add column if not exists personal_destination_masked text,
  add column if not exists personal_release_requested_by uuid references auth.users(id),
  add column if not exists personal_release_approved_by uuid references auth.users(id),
  add column if not exists personal_release_approved_at timestamptz;

alter table public.partner_settlement_disputes
  add constraint partner_settlement_disputes_resolution_check
  check (resolution is null or resolution = any (array[
    'partner_paid'::text, 'guest_refunded'::text, 'admin_personal_account'::text
  ])),
  add constraint partner_settlement_disputes_status_check
  check (status = any (array[
    'open'::text, 'awaiting_second_approval'::text, 'approved_for_payment'::text, 'resolved'::text
  ])),
  add constraint partner_settlement_dispute_resolution_consistency
  check (
    (status = 'open' and resolution is null and resolved_at is null and resolved_by is null)
    or
    (status in ('awaiting_second_approval','approved_for_payment')
      and resolution = 'admin_personal_account'
      and personal_release_requested_by is not null
      and personal_destination_type is not null
      and personal_destination_masked is not null
      and resolved_at is null and resolved_by is null)
    or
    (status = 'resolved' and resolution is not null and resolved_at is not null and resolved_by is not null)
  );

create or replace function public.request_admin_personal_settlement_release(
  p_dispute_id uuid,
  p_admin_user_id uuid,
  p_destination_type text,
  p_destination_masked text,
  p_notes text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_dispute public.partner_settlement_disputes%rowtype;
begin
  if p_destination_type not in ('mpesa','bank','paypal') then
    raise exception 'Choose M-Pesa, bank or PayPal as the destination.';
  end if;
  if pg_catalog.length(pg_catalog.btrim(coalesce(p_destination_masked,''))) < 4
     or pg_catalog.length(pg_catalog.btrim(p_destination_masked)) > 100 then
    raise exception 'Enter a masked destination identifier, not full account credentials.';
  end if;
  if pg_catalog.length(pg_catalog.btrim(coalesce(p_notes,''))) < 20 then
    raise exception 'Provide at least 20 characters explaining why the funds are payable to the administrator.';
  end if;
  if not exists (select 1 from public.profiles p where p.id=p_admin_user_id and p.role='admin') then
    raise exception 'Administrator permission is required.';
  end if;

  select * into v_dispute from public.partner_settlement_disputes
  where id=p_dispute_id for update;
  if not found or v_dispute.status <> 'open' then
    raise exception 'Only an open dispute can be submitted for personal-account review.';
  end if;

  update public.partner_settlement_disputes
  set status='awaiting_second_approval',
      resolution='admin_personal_account',
      resolution_notes=pg_catalog.btrim(p_notes),
      personal_destination_type=p_destination_type,
      personal_destination_masked=pg_catalog.btrim(p_destination_masked),
      personal_release_requested_by=p_admin_user_id,
      updated_at=pg_catalog.now()
  where id=p_dispute_id;

  insert into public.partner_settlement_dispute_events
    (dispute_id,admin_user_id,event_type,notes,metadata)
  values
    (p_dispute_id,p_admin_user_id,'admin_personal_release_requested',
     pg_catalog.btrim(p_notes),
     pg_catalog.jsonb_build_object('destination_type',p_destination_type,'destination_masked',pg_catalog.btrim(p_destination_masked)));

  return pg_catalog.jsonb_build_object('success',true,'status','awaiting_second_approval');
end;
$$;

create or replace function public.approve_admin_personal_settlement_release(
  p_dispute_id uuid,
  p_approver_user_id uuid,
  p_approval_notes text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_dispute public.partner_settlement_disputes%rowtype;
begin
  if pg_catalog.length(pg_catalog.btrim(coalesce(p_approval_notes,''))) < 20 then
    raise exception 'Provide an independent approval explanation of at least 20 characters.';
  end if;
  if not exists (select 1 from public.profiles p where p.id=p_approver_user_id and p.role='admin') then
    raise exception 'Administrator permission is required.';
  end if;

  select * into v_dispute from public.partner_settlement_disputes
  where id=p_dispute_id for update;
  if not found or v_dispute.status <> 'awaiting_second_approval' then
    raise exception 'This request is not awaiting approval.';
  end if;
  if v_dispute.personal_release_requested_by = p_approver_user_id then
    raise exception 'The requesting administrator cannot approve their own personal-account release.';
  end if;

  update public.partner_settlement_disputes
  set status='approved_for_payment',
      personal_release_approved_by=p_approver_user_id,
      personal_release_approved_at=pg_catalog.now(),
      updated_at=pg_catalog.now()
  where id=p_dispute_id;

  insert into public.partner_settlement_dispute_events
    (dispute_id,admin_user_id,event_type,notes,metadata)
  values
    (p_dispute_id,p_approver_user_id,'admin_personal_release_approved',
     pg_catalog.btrim(p_approval_notes),
     pg_catalog.jsonb_build_object('requester',v_dispute.personal_release_requested_by));

  return pg_catalog.jsonb_build_object('success',true,'status','approved_for_payment');
end;
$$;

create or replace function public.complete_admin_personal_settlement_release(
  p_dispute_id uuid,
  p_admin_user_id uuid,
  p_external_reference text,
  p_completion_notes text
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
  if pg_catalog.length(pg_catalog.btrim(coalesce(p_external_reference,''))) < 3 then
    raise exception 'Enter the completed transfer reference.';
  end if;
  if pg_catalog.length(pg_catalog.btrim(coalesce(p_completion_notes,''))) < 10 then
    raise exception 'Enter completion notes.';
  end if;
  if not exists (select 1 from public.profiles p where p.id=p_admin_user_id and p.role='admin') then
    raise exception 'Administrator permission is required.';
  end if;

  select * into v_dispute from public.partner_settlement_disputes
  where id=p_dispute_id for update;
  if not found or v_dispute.status <> 'approved_for_payment' then
    raise exception 'The personal-account release has not received independent approval.';
  end if;

  select * into v_settlement from public.partner_settlements
  where id=v_dispute.settlement_id for update;
  if not found or v_settlement.status <> 'held' then
    raise exception 'The settlement is not held for manual review.';
  end if;

  update public.partner_settlements
  set status='paid', paid_at=pg_catalog.now(),
      payment_reference=pg_catalog.btrim(p_external_reference)
  where id=v_dispute.settlement_id;

  update public.partner_settlement_disputes
  set status='resolved',
      external_reference=pg_catalog.btrim(p_external_reference),
      resolved_by=p_admin_user_id,
      resolved_at=pg_catalog.now(),
      updated_at=pg_catalog.now()
  where id=p_dispute_id;

  insert into public.partner_settlement_dispute_events
    (dispute_id,admin_user_id,event_type,notes,external_reference,metadata)
  values
    (p_dispute_id,p_admin_user_id,'admin_personal_release_completed',
     pg_catalog.btrim(p_completion_notes),
     pg_catalog.btrim(p_external_reference),
     pg_catalog.jsonb_build_object(
       'destination_type',v_dispute.personal_destination_type,
       'destination_masked',v_dispute.personal_destination_masked,
       'approved_by',v_dispute.personal_release_approved_by
     ));

  return pg_catalog.jsonb_build_object('success',true,'status','resolved','settlement_status','paid');
end;
$$;

revoke all on function public.request_admin_personal_settlement_release(uuid,uuid,text,text,text) from public,anon,authenticated;
revoke all on function public.approve_admin_personal_settlement_release(uuid,uuid,text) from public,anon,authenticated;
revoke all on function public.complete_admin_personal_settlement_release(uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.request_admin_personal_settlement_release(uuid,uuid,text,text,text) to service_role;
grant execute on function public.approve_admin_personal_settlement_release(uuid,uuid,text) to service_role;
grant execute on function public.complete_admin_personal_settlement_release(uuid,uuid,text,text) to service_role;
