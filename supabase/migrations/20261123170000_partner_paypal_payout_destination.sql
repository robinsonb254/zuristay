-- Add PayPal as a partner payout destination while keeping M-Pesa B2C
-- and B2B support available behind explicit activation flags.
alter table public.partner_payout_accounts
  add column if not exists paypal_email text;

alter table public.partner_payout_accounts
  drop constraint if exists partner_payout_accounts_payout_method_check,
  drop constraint if exists partner_payout_method_details;

alter table public.partner_payout_accounts
  add constraint partner_payout_accounts_payout_method_check
    check (payout_method in ('mpesa', 'till_paybill', 'bank', 'paypal')),
  add constraint partner_payout_method_details check (
    (payout_method = 'mpesa' and mpesa_phone is not null
      and merchant_type is null and merchant_number is null
      and bank_name is null and bank_code is null and bank_account_number is null
      and paypal_email is null)
    or
    (payout_method = 'till_paybill' and merchant_type is not null
      and merchant_number is not null and mpesa_phone is null
      and bank_name is null and bank_code is null and bank_account_number is null
      and paypal_email is null)
    or
    (payout_method = 'bank' and bank_name is not null and bank_code is not null
      and bank_account_name is not null and bank_account_number is not null
      and mpesa_phone is null and merchant_number is null and paypal_email is null)
    or
    (payout_method = 'paypal' and paypal_email is not null
      and mpesa_phone is null and merchant_number is null
      and bank_name is null and bank_code is null and bank_account_number is null)
  );

alter table public.partner_payout_attempts
  drop constraint if exists partner_payout_attempts_payout_method_check;
alter table public.partner_payout_attempts
  add constraint partner_payout_attempts_payout_method_check
    check (payout_method in ('mpesa', 'till_paybill', 'bank', 'paypal'));

comment on column public.partner_payout_accounts.paypal_email is
  'Partner PayPal payout destination. Transfers remain disabled until PayPal Payouts is configured and approved.';
