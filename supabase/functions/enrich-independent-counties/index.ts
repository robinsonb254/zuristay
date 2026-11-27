import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.0";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const db = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

const COUNTY_NAMES = [
  "Baringo", "Bomet", "Bungoma", "Busia", "Elgeyo-Marakwet", "Embu",
  "Garissa", "Homa Bay", "Isiolo", "Kajiado", "Kakamega", "Kericho",
  "Kiambu", "Kilifi", "Kirinyaga", "Kisii", "Kisumu", "Kitui", "Kwale",
  "Laikipia", "Lamu", "Machakos", "Makueni", "Mandera", "Marsabit",
  "Meru", "Migori", "Mombasa", "Murang'a", "Nairobi", "Nakuru", "Nandi",
  "Narok", "Nyamira", "Nyandarua", "Nyeri", "Samburu", "Siaya",
  "Taita Taveta", "Tana River", "Tharaka-Nithi", "Trans Nzoia", "Turkana",
  "Uasin Gishu", "Vihiga", "Wajir", "West Pokot",
] as const;

const COUNTY_ALIASES: Record<string, string> = {
  "elgeyo marakwet": "Elgeyo-Marakwet",
  "homabay": "Homa Bay",
  "muranga": "Murang'a",
  "muranga county": "Murang'a",
  "nairobi city": "Nairobi",
  "taita-taveta": "Taita Taveta",
  "tharaka nithi": "Tharaka-Nithi",
  "transnzoia": "Trans Nzoia",
  "uasin-gishu": "Uasin Gishu",
};

function normalize(value: string) {
  return value.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ").trim();
}

const countyByNormalizedName = new Map<string, string>();
for (const county of COUNTY_NAMES) countyByNormalizedName.set(normalize(county), county);
for (const [alias, canonical] of Object.entries(COUNTY_ALIASES)) {
  countyByNormalizedName.set(normalize(alias), canonical);
}

function countyFromProperties(properties: Record<string, unknown> | null) {
  if (!properties) return null;
  const entries = Object.entries(properties);
  for (const [key, value] of entries) {
    if (typeof value !== "string") continue;
    const normalizedKey = key.toLowerCase().replace(/[^a-z0-9]+/g, "");
    const isCountyNameField =
      normalizedKey.includes("county") ||
      normalizedKey === "name" ||
      normalizedKey.startsWith("name") ||
      normalizedKey.includes("admin1");
    const matched = countyByNormalizedName.get(normalize(value));
    if (matched && isCountyNameField) return matched;
  }
  return null;
}

function pointInRing(lon: number, lat: number, ring: number[][]) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0], yi = ring[i][1];
    const xj = ring[j][0], yj = ring[j][1];
    const intersects = ((yi > lat) !== (yj > lat)) &&
      (lon < ((xj - xi) * (lat - yi)) / ((yj - yi) || Number.EPSILON) + xi);
    if (intersects) inside = !inside;
  }
  return inside;
}

function pointInPolygon(lon: number, lat: number, rings: number[][][]) {
  if (!rings.length || !pointInRing(lon, lat, rings[0])) return false;
  for (let i = 1; i < rings.length; i++) {
    if (pointInRing(lon, lat, rings[i])) return false;
  }
  return true;
}

function pointInGeometry(lon: number, lat: number, geometry: any) {
  if (!geometry) return false;
  if (geometry.type === "Polygon") return pointInPolygon(lon, lat, geometry.coordinates);
  if (geometry.type === "MultiPolygon") {
    return geometry.coordinates.some((polygon: number[][][]) => pointInPolygon(lon, lat, polygon));
  }
  return false;
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return Response.json({ error: "POST required" }, { status: 405 });

  try {
    const authorization = req.headers.get("authorization") || "";
    const token = authorization.replace(/^Bearer\s+/i, "");
    if (!token) return Response.json({ error: "Authentication required." }, { status: 401 });

    const { data: authData, error: authError } = await db.auth.getUser(token);
    if (authError || !authData.user) return Response.json({ error: "Invalid session." }, { status: 401 });

    const { data: profile, error: profileError } = await db.from("profiles")
      .select("role").eq("id", authData.user.id).maybeSingle();
    if (profileError || profile?.role !== "admin") {
      return Response.json({ error: "Administrator access required." }, { status: 403 });
    }

    const boundaryUrl = "https://wwfke-giscoe.wwfkenya.org/arcgis/rest/services/Basedata_Kenya/KenyaCountyBoundary/MapServer/0/query?where=1%3D1&outFields=*&returnGeometry=true&outSR=4326&f=geojson";
    const boundaryResponse = await fetch(boundaryUrl, {
      headers: { "accept": "application/geo+json,application/json", "user-agent": "ZuriStayWorldwide/1.0 (county data enrichment; bookings@zuristayworldwide.com)" },
      signal: AbortSignal.timeout(60_000),
    });
    if (!boundaryResponse.ok) throw new Error(`County boundary source returned HTTP ${boundaryResponse.status}.`);
    const boundaryData = await boundaryResponse.json();
    const features = Array.isArray(boundaryData.features) ? boundaryData.features : [];
    const counties = features.map((feature: any) => ({
      name: countyFromProperties(feature.properties),
      geometry: feature.geometry,
    })).filter((item: any) => item.name && item.geometry);

    const uniqueCounties = new Set(counties.map((item: any) => item.name));
    if (uniqueCounties.size !== 47 || counties.length < 47) {
      throw new Error(`County boundary validation failed: expected 47 named counties, received ${uniqueCounties.size}.`);
    }

    const candidates: any[] = [];
    for (let offset = 0; ; offset += 500) {
      const { data, error } = await db.from("independent_accommodations")
        .select("id,latitude,longitude,county")
        .or("county.is.null,county.ilike.Kenya")
        .order("id", { ascending: true })
        .range(offset, offset + 499);
      if (error) throw error;
      candidates.push(...(data || []));
      if (!data || data.length < 500) break;
    }

    const assignments: { id: string; county: string }[] = [];
    let unmatched = 0;
    let ambiguous = 0;
    for (const item of candidates) {
      const lat = Number(item.latitude);
      const lon = Number(item.longitude);
      if (!Number.isFinite(lat) || !Number.isFinite(lon) || lat < -5.2 || lat > 5.6 || lon < 33.8 || lon > 42.1) {
        unmatched++;
        continue;
      }
      const matches = counties.filter((county: any) => pointInGeometry(lon, lat, county.geometry));
      if (matches.length === 1) assignments.push({ id: item.id, county: matches[0].name });
      else if (matches.length > 1) ambiguous++;
      else unmatched++;
    }

    let updated = 0;
    for (let offset = 0; offset < assignments.length; offset += 250) {
      const batch = assignments.slice(offset, offset + 250);
      const { data, error } = await db.rpc("apply_independent_county_enrichment", { assignments: batch });
      if (error) throw error;
      updated += Number(data || 0);
    }

    return Response.json({
      success: true,
      boundary_counties_validated: uniqueCounties.size,
      candidates_checked: candidates.length,
      county_assignments_matched: assignments.length,
      rows_updated: updated,
      unmatched_coordinates: unmatched,
      ambiguous_boundary_matches: ambiguous,
      attribution: "County boundaries: WWF-Kenya layer sourced from Survey of Kenya, Ministry of Lands. This assigns administrative county only; it does not verify the accommodation, owner, price, images, or availability.",
    });
  } catch (error) {
    console.error(error);
    return Response.json({ success: false, error: error instanceof Error ? error.message : "County enrichment failed." }, { status: 500 });
  }
});
