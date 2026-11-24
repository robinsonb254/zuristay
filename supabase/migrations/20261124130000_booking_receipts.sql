create table if not exists public.booking_receipts (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete restrict,
  payment_id uuid not null unique references public.payments(id) on delete restrict,
  receipt_number text not null unique,
  receipt_snapshot jsonb not null,
  email_status text not null default 'pending'
    check (email_status in ('pending','sending','sent','failed')),
  email_attempts integer not null default 0 check (email_attempts >= 0),
  emailed_at timestamptz,
  last_email_error text,
  created_at timestamptz not null default now()
);

create index if not exists booking_receipts_booking_id_idx
  on public.booking_receipts(booking_id, created_at desc);

alter table public.booking_receipts enable row level security;
revoke all on table public.booking_receipts from anon, authenticated;
grant all on table public.booking_receipts to service_role;
