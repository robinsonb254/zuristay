create table if not exists public.paypal_checkout_sessions (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete restrict,
  order_id text not null unique,
  guest_access_token_hash text not null,
  booking_amount_kes numeric(12,2) not null check (booking_amount_kes > 0),
  paypal_amount_usd numeric(12,2) not null check (paypal_amount_usd > 0),
  usd_per_kes numeric(18,10) not null check (usd_per_kes > 0),
  exchange_rate_source text not null,
  status text not null default 'created' check (status in ('created','approved','captured','needs_review','cancelled','expired')),
  capture_id text unique,
  captured_at timestamptz,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists paypal_checkout_sessions_booking_idx
  on public.paypal_checkout_sessions(booking_id, created_at desc);

alter table public.paypal_checkout_sessions enable row level security;

create unique index if not exists payments_one_pending_paypal_per_booking
  on public.payments(booking_id)
  where payment_method = 'paypal' and status = 'pending';
