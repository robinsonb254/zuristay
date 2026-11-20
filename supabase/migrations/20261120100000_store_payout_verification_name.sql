alter table public.partner_payout_accounts
  add column if not exists provider_account_name text;
