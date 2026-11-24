alter table public.partner_applications
  add column if not exists acknowledgement_status text not null default 'pending',
  add column if not exists acknowledgement_attempts integer not null default 0,
  add column if not exists acknowledgement_sent_at timestamptz,
  add column if not exists acknowledgement_error text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.partner_applications'::regclass
      and conname = 'partner_applications_acknowledgement_status_check'
  ) then
    alter table public.partner_applications
      add constraint partner_applications_acknowledgement_status_check
      check (acknowledgement_status in ('pending','sending','sent','failed'));
  end if;
end $$;
