alter table public.bookings
  add column if not exists guest_access_token_hash text;

create index if not exists bookings_guest_access_token_hash_idx
  on public.bookings (guest_access_token_hash)
  where guest_access_token_hash is not null;
