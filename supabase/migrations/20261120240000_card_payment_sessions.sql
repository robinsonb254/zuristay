-- Store hosted card checkout sessions without exposing provider data to browser roles.
create unique index if not exists payments_one_pending_card_per_booking
  on public.payments (booking_id)
  where payment_method = 'card' and status = 'pending';

create table if not exists public.card_payment_sessions (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null unique references public.payments(id) on delete cascade,
  provider text not null check (length(trim(provider)) > 0),
  provider_session_id text unique,
  checkout_url text not null check (checkout_url like 'https://%'),
  status text not null default 'created'
    check (status in ('created', 'completed', 'expired', 'failed', 'cancelled')),
  expires_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists card_payment_sessions_provider_status_idx
  on public.card_payment_sessions (provider, status, created_at desc);

alter table public.card_payment_sessions enable row level security;

revoke all on table public.card_payment_sessions from public, anon, authenticated;
grant all on table public.card_payment_sessions to service_role;

comment on table public.card_payment_sessions is
  'Private server-side references for hosted card checkout sessions. Never store PAN or CVV data here.';
