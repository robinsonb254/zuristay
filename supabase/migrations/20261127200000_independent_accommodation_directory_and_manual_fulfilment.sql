create table if not exists public.accommodation_sources (
  id uuid primary key default gen_random_uuid(),
  source_name text not null unique,
  source_url text not null,
  source_type text not null default 'directory',
  attribution_text text,
  terms_url text,
  import_method text not null default 'manual_review',
  active boolean not null default true,
  last_checked_at timestamptz,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.independent_accommodations (
  id uuid primary key default gen_random_uuid(),
  source_id uuid references public.accommodation_sources(id) on delete set null,
  external_source_id text,
  name text not null,
  property_type text not null check (property_type in ('hotel','resort','villa','apartment','lodge','guesthouse','hostel','camp','other')),
  description text,
  address text,
  city text not null,
  county text,
  country text not null default 'Kenya',
  country_code text not null default 'KE',
  latitude numeric,
  longitude numeric,
  public_website_url text,
  source_listing_url text not null,
  contact_phone text,
  contact_email text,
  published_payment_route text,
  payment_route_type text,
  currency text not null default 'KES',
  published_base_rate numeric check (published_base_rate is null or published_base_rate >= 0),
  rate_checked_at timestamptz,
  rate_source_url text,
  image_urls jsonb not null default '[]'::jsonb,
  image_licence_notes text,
  data_attribution text,
  source_terms_reviewed boolean not null default false,
  owner_authorised_booking boolean not null default false,
  owner_authorised_payment boolean not null default false,
  booking_method text not null default 'manual_admin' check (booking_method in ('manual_admin','api','channel_manager')),
  listing_status text not null default 'pending_review' check (listing_status in ('pending_review','published','suspended','removed')),
  booking_enabled boolean not null default false,
  availability_status text not null default 'unverified' check (availability_status in ('unverified','owner_confirmed','temporarily_unavailable')),
  last_verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(source_id, external_source_id)
);

create index if not exists independent_accommodations_public_idx
  on public.independent_accommodations(listing_status, country_code, county, city);
create index if not exists independent_accommodations_name_idx
  on public.independent_accommodations using gin (to_tsvector('simple', name || ' ' || city || ' ' || coalesce(county,'')));

create table if not exists public.independent_booking_orders (
  id uuid primary key default gen_random_uuid(),
  order_reference text not null unique,
  accommodation_id uuid not null references public.independent_accommodations(id),
  guest_user_id uuid references auth.users(id) on delete set null,
  guest_name text not null,
  guest_email text not null,
  guest_phone text not null,
  check_in date not null,
  check_out date not null,
  guests integer not null check (guests > 0),
  rooms integer not null default 1 check (rooms > 0),
  currency text not null default 'KES',
  property_base_amount numeric not null check (property_base_amount >= 0),
  markup_rate numeric not null default 0.15 check (markup_rate = 0.15),
  markup_amount numeric not null check (markup_amount >= 0),
  guest_total numeric not null check (guest_total >= 0),
  payment_method text,
  payment_provider_reference text,
  payment_status text not null default 'unpaid' check (payment_status in ('unpaid','pending','paid','failed','refund_pending','refunded')),
  fulfilment_status text not null default 'awaiting_payment' check (fulfilment_status in ('awaiting_payment','awaiting_admin','contacting_property','property_confirmed','property_paid','confirmed','unavailable','refund_required','refunded','cancelled')),
  property_payment_route_snapshot text,
  property_contact_snapshot text,
  admin_assigned_to uuid references auth.users(id),
  admin_payment_reference text,
  admin_payment_proof_url text,
  admin_paid_amount numeric,
  admin_paid_at timestamptz,
  property_confirmation_reference text,
  admin_notes text,
  guest_notified_at timestamptz,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (check_out > check_in),
  check (guest_total = property_base_amount + markup_amount)
);

create index if not exists independent_booking_orders_queue_idx
  on public.independent_booking_orders(payment_status, fulfilment_status, created_at desc);

create table if not exists public.independent_booking_events (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.independent_booking_orders(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  event_type text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.accommodation_sources enable row level security;
alter table public.independent_accommodations enable row level security;
alter table public.independent_booking_orders enable row level security;
alter table public.independent_booking_events enable row level security;

drop policy if exists "Public can read published independent accommodations" on public.independent_accommodations;
create policy "Public can read published independent accommodations"
on public.independent_accommodations for select to anon, authenticated
using (listing_status = 'published');

drop policy if exists "Admins manage accommodation sources" on public.accommodation_sources;
create policy "Admins manage accommodation sources"
on public.accommodation_sources for all to authenticated
using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'))
with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

drop policy if exists "Admins manage independent accommodations" on public.independent_accommodations;
create policy "Admins manage independent accommodations"
on public.independent_accommodations for all to authenticated
using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'))
with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

drop policy if exists "Admins read independent booking orders" on public.independent_booking_orders;
create policy "Admins read independent booking orders"
on public.independent_booking_orders for select to authenticated
using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

drop policy if exists "Admins update independent booking orders" on public.independent_booking_orders;
create policy "Admins update independent booking orders"
on public.independent_booking_orders for update to authenticated
using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'))
with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

drop policy if exists "Admins read independent booking events" on public.independent_booking_events;
create policy "Admins read independent booking events"
on public.independent_booking_events for select to authenticated
using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

insert into public.accommodation_sources (source_name, source_url, source_type, attribution_text, terms_url, import_method, notes)
values
('OpenStreetMap', 'https://www.openstreetmap.org/', 'open_geodata', '© OpenStreetMap contributors', 'https://www.openstreetmap.org/copyright', 'overpass_review', 'Open geodata; retain attribution and comply with ODbL. Use as discovery data, verify every accommodation record.'),
('Chochote', 'https://www.chochote.co.ke/hotels', 'directory', 'Source: Chochote Kenya accommodation directory', 'https://www.chochote.co.ke/', 'manual_review', 'Directory discovery source only. Do not bulk copy protected photos or proprietary content without permission.'),
('Twende Kenya', 'https://twende.ke/accommodation-in-kenya', 'directory', 'Source: Twende Kenya accommodation directory', 'https://twende.ke/', 'manual_review', 'Directory discovery source only. Verify contact and rates with property owners; review terms before reuse.'),
('Where to Rest', 'https://wheretorest.com/kenya', 'directory', 'Source: Where to Rest Kenya accommodation directory', 'https://wheretorest.com/', 'manual_review', 'Discovery and source attribution only; verify reuse terms and listing accuracy.'),
('KenBiz Directory', 'https://kenbiz.co.ke/category/hotel-lodge', 'directory', 'Source: KenBiz Directory Kenya', 'https://kenbiz.co.ke/', 'manual_review', 'Discovery source; verify property details and terms before reuse.'),
('BusinessList Kenya', 'https://www.businesslist.co.ke/category/tourism-accommodation', 'directory', 'Source: BusinessList Kenya', 'https://www.businesslist.co.ke/', 'manual_review', 'Discovery source; verify property details and terms before reuse.')
on conflict (source_name) do update set source_url=excluded.source_url, attribution_text=excluded.attribution_text, terms_url=excluded.terms_url, notes=excluded.notes;
