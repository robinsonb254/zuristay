-- Partner payout preferences: one verified destination per approved partner.
-- Sensitive payout details are server-only; no client role receives table access.
create table if not exists public.partner_payout_accounts (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null unique references public.property_partners(id) on delete cascade,
  payout_method text not null check (payout_method in ('mpesa', 'till_paybill', 'bank')),
  account_holder_name text not null,
  mpesa_phone text,
  merchant_type text check (merchant_type in ('till', 'paybill')),
  merchant_number text,
  merchant_account_number text,
  bank_name text,
  bank_branch text,
  bank_account_name text,
  bank_account_number text,
  verification_status text not null default 'pending'
    check (verification_status in ('pending', 'verified', 'rejected')),
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint partner_payout_method_details check (
    (payout_method = 'mpesa' and mpesa_phone is not null
      and merchant_type is null and merchant_number is null
      and bank_name is null and bank_account_number is null)
    or
    (payout_method = 'till_paybill' and merchant_type is not null
      and merchant_number is not null and mpesa_phone is null
      and bank_name is null and bank_account_number is null)
    or
    (payout_method = 'bank' and bank_name is not null
      and bank_account_name is not null and bank_account_number is not null
      and mpesa_phone is null and merchant_number is null)
  )
);

create index if not exists partner_payout_accounts_verification_idx
  on public.partner_payout_accounts(verification_status);

alter table public.partner_payout_accounts enable row level security;
revoke all on public.partner_payout_accounts from anon, authenticated;
grant all on public.partner_payout_accounts to service_role;
