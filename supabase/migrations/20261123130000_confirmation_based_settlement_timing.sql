alter table public.commission_rules drop constraint if exists commission_rules_settlement_timing_check;
alter table public.commission_rules add constraint commission_rules_settlement_timing_check
  check (settlement_timing in ('after_checkout','after_guest_and_partner_confirmation'));
update public.commission_rules set settlement_timing='after_guest_and_partner_confirmation'
where active=true;