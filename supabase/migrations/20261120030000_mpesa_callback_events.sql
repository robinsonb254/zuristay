create table if not exists public.mpesa_callback_events (
  id uuid primary key default gen_random_uuid(),
  checkout_request_id text not null unique,
  callback_payload jsonb not null,
  processing_status text not null default 'received'
    check (processing_status in ('received', 'processing', 'processed', 'needs_review')),
  processing_attempts integer not null default 0 check (processing_attempts >= 0),
  last_error text,
  received_at timestamptz not null default now(),
  processed_at timestamptz
);

create index if not exists mpesa_callback_events_status_received_idx
  on public.mpesa_callback_events (processing_status, received_at);

alter table public.mpesa_callback_events enable row level security;
revoke all on table public.mpesa_callback_events from anon, authenticated, public;
grant select, insert, update on table public.mpesa_callback_events to service_role;
