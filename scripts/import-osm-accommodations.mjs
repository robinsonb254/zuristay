/**
 * Import named accommodation features from OpenStreetMap into the ZuriStay
 * independent-accommodation review queue.
 *
 * Run with:
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/import-osm-accommodations.mjs
 *
 * Imported records are ALWAYS pending_review, never publicly published or bookable.
 * OSM does not supply verified room rates, availability, booking permission, or
 * property-payment authorisation. Those fields must be confirmed by an admin/owner.
 */
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !serviceKey) {
  throw new Error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY before running this import.");
}

const db = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
const overpassEndpoints = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
];
const query = `[out:json][timeout:180];
area["ISO3166-1"="KE"][admin_level=2]->.kenya;
(
  nwr["tourism"~"^(hotel|motel|hostel|guest_house|apartment|chalet|camp_site|caravan_site|alpine_hut)$"](area.kenya);
);
out center tags;`;

async function fetchOverpass() {
  let lastError;
  for (const endpoint of overpassEndpoints) {
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded;charset=UTF-8", "user-agent": "ZuriStayWorldwide/1.0 (accommodation discovery; contact bookings@zuristayworldwide.com)" },
        body: new URLSearchParams({ data: query }),
        signal: AbortSignal.timeout(210_000),
      });
      if (!response.ok) throw new Error(`${endpoint} returned HTTP ${response.status}`);
      return await response.json();
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError || new Error("All Overpass endpoints failed.");
}

function typeFor(tags) {
  const value = tags.tourism;
  if (value === "hotel" || value === "motel") return "hotel";
  if (value === "hostel") return "hostel";
  if (value === "guest_house") return "guesthouse";
  if (value === "apartment" || value === "chalet") return "apartment";
  if (value === "camp_site" || value === "caravan_site" || value === "alpine_hut") return "camp";
  return "other";
}

const { data: source, error: sourceError } = await db
  .from("accommodation_sources")
  .select("id")
  .eq("source_name", "OpenStreetMap")
  .single();
if (sourceError || !source?.id) throw new Error("OpenStreetMap must exist in accommodation_sources before import.");

console.log("Fetching Kenya accommodation features from OpenStreetMap…");
const payload = await fetchOverpass();
const features = (payload.elements || []).filter((element) => element.tags?.name);
const records = [];

for (const element of features) {
  const tags = element.tags || {};
  const lat = element.lat ?? element.center?.lat;
  const lon = element.lon ?? element.center?.lon;
  if (typeof lat !== "number" || typeof lon !== "number") continue;

  const locality = tags["addr:city"] || tags["addr:town"] || tags["addr:village"] ||
    tags["addr:suburb"] || tags["addr:place"] || "Unspecified locality";
  const county = tags["addr:county"] || tags["addr:state"] || null;
  const osmType = element.type;
  const osmId = String(element.id);
  records.push({
    source_id: source.id,
    external_source_id: `${osmType}/${osmId}`,
    name: String(tags.name).slice(0, 180),
    property_type: typeFor(tags),
    description: tags.description || tags["description:en"] || null,
    address: [tags["addr:housenumber"], tags["addr:street"], tags["addr:suburb"]].filter(Boolean).join(", ") || null,
    city: String(locality).slice(0, 100),
    county: county ? String(county).slice(0, 100) : null,
    country: "Kenya",
    country_code: "KE",
    latitude: lat,
    longitude: lon,
    public_website_url: tags.website || tags["contact:website"] || null,
    source_listing_url: `https://www.openstreetmap.org/${osmType}/${osmId}`,
    contact_phone: tags.phone || tags["contact:phone"] || null,
    contact_email: tags.email || tags["contact:email"] || null,
    currency: "KES",
    image_urls: [],
    data_attribution: "© OpenStreetMap contributors",
    image_licence_notes: "No images imported. Obtain property-authorised photos or verify each image licence separately.",
    source_terms_reviewed: true,
    owner_authorised_booking: false,
    owner_authorised_payment: false,
    listing_status: "pending_review",
    booking_enabled: false,
    availability_status: "unverified",
    booking_method: "manual_admin",
  });
}

let imported = 0;
for (let offset = 0; offset < records.length; offset += 100) {
  const batch = records.slice(offset, offset + 100);
  const { error } = await db.from("independent_accommodations")
    .upsert(batch, { onConflict: "source_id,external_source_id", ignoreDuplicates: false });
  if (error) throw new Error(`Import failed at batch ${offset / 100 + 1}: ${error.message}`);
  imported += batch.length;
  console.log(`Imported/reconciled ${imported} of ${records.length} review records…`);
}

await db.from("accommodation_sources")
  .update({ last_checked_at: new Date().toISOString(), notes: "OpenStreetMap Kenya accommodation features imported to pending review. No listings are auto-published; owner permission, contact, current rates, availability and photos require verification." })
  .eq("id", source.id);

console.log(JSON.stringify({
  fetched_named_features: features.length,
  imported_or_updated_review_records: imported,
  publicly_published: 0,
  note: "All records remain pending_review until verified by ZuriStay."
}, null, 2));
