-- Auditable, idempotent queue for external partner disbursements.
-- No payout provider is invoked by this migration.
create table if not exists public.partner_payout_attempts (
  id uuid primary key default gen_random_uuid(),
  settlement_id uuid not null references public.partner_settlements(id) on delete restrict,
  booking_id uuid not null references public.bookings(id) on delete restrict,
  partner_id uuid not null references public.property_partners(id) on delete restrict,
  amount numeric not null check (amount > 0),
  currency text not null default 'KES',
  payout_method text not null check (payout_method in ('mpesa', 'till_paybill', 'bank')),
  destination_snapshot jsonb not null,
  provider text,
  idempotency_key text not null unique,
  provider_reference text,
  status text not null default 'queued'
    check (status in ('queued', 'submitted', 'processing', 'paid', 'failed', 'needs_review', 'cancelled')),
  provider_response jsonb,
  failure_reason text,
  submitted_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists partner_payout_attempts_status_created_idx
  on public.partner_payout_attempts(status, created_at);

create index if not exists partner_payout_attempts_partner_created_idx
  on public.partner_payout_attempts(partner_id, created_at desc);

create unique index if not exists partner_payout_attempts_one_active_per_settlement
  on public.partner_payout_attempts(settlement_id)
  where status in ('queued', 'submitted', 'processing', 'needs_review');

alter table public.partner_payout_attempts enable row level security;
revoke all on public.partner_payout_attempts from public, anon, authenticated;
grant all on public.partner_payout_attempts to service_role;

comment on table public.partner_payout_attempts is
  'Private idempotent payout execution ledger. Destination snapshots and provider payloads are service-role only.';
