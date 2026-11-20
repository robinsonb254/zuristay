alter table public.partner_payout_accounts
  add column if not exists bank_code text;

alter table public.partner_payout_accounts
  drop constraint if exists partner_payout_method_details;

alter table public.partner_payout_accounts
  add constraint partner_payout_method_details check (
    (payout_method = 'mpesa' and mpesa_phone is not null
      and merchant_type is null and merchant_number is null
      and bank_name is null and bank_code is null and bank_account_number is null)
    or
    (payout_method = 'till_paybill' and merchant_type is not null
      and merchant_number is not null and mpesa_phone is null
      and bank_name is null and bank_code is null and bank_account_number is null)
    or
    (payout_method = 'bank' and bank_name is not null and bank_code is not null
      and bank_account_name is not null and bank_account_number is not null
      and mpesa_phone is null and merchant_number is null)
  );
