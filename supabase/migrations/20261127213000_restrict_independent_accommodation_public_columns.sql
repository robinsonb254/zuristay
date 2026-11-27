-- Restrict the public directory table to fields intended for guest discovery.
-- Private owner contacts, internal verification flags and payment routing remain server-side.
REVOKE ALL PRIVILEGES ON TABLE public.independent_accommodations FROM anon, authenticated;

GRANT SELECT (
  id,
  name,
  property_type,
  description,
  address,
  city,
  county,
  country,
  currency,
  published_base_rate,
  public_website_url,
  source_listing_url,
  data_attribution,
  image_urls,
  booking_enabled,
  availability_status,
  last_verified_at,
  listing_status
) ON TABLE public.independent_accommodations TO anon, authenticated;

-- Cover the foreign keys used by reservation lookups and event history.
CREATE INDEX IF NOT EXISTS independent_booking_orders_accommodation_id_idx
  ON public.independent_booking_orders (accommodation_id);

CREATE INDEX IF NOT EXISTS independent_booking_events_order_id_idx
  ON public.independent_booking_events (order_id);
