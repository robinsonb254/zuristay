import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.0";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const db = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
};
function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

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

type CountyGeometry =
  | { type: "Polygon"; coordinates: number[][][] }
  | { type: "MultiPolygon"; coordinates: number[][][][] };

type CountyFeature = {
  properties: Record<string, unknown> | null;
  geometry: CountyGeometry | null;
};

type CountyBoundary = {
  name: string;
  geometry: CountyGeometry;
};

type AccommodationCandidate = {
  id: string;
  latitude: number | string | null;
  longitude: number | string | null;
  county: string | null;
};

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
  // ArcGIS layers use inconsistent field labels. Match exact normalized
  // values against the authoritative 47-county allow-list, not field names.
  const matches = new Set<string>();
  for (const value of Object.values(properties)) {
    if (typeof value !== "string") continue;
    const matched = countyByNormalizedName.get(normalize(value));
    if (matched) matches.add(matched);
  }
  return matches.size === 1 ? [...matches][0] : null;
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

function pointInGeometry(lon: number, lat: number, geometry: CountyGeometry | null) {
  if (!geometry) return false;
  if (geometry.type === "Polygon") return pointInPolygon(lon, lat, geometry.coordinates);
  return geometry.coordinates.some((polygon) => pointInPolygon(lon, lat, polygon));
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "POST required" }, 405);

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

    // Fetch the county polygons directly in one bounded GeoJSON query.
    // The service layer contains 47 counties; the prior returnIdsOnly request
    // unexpectedly returned only 3 IDs, so avoid that unreliable ID-only path.
    const arcgisBase = "https://wwfke-giscoe.wwfkenya.org/arcgis/rest/services/Basedata_Kenya/KenyaCountyBoundary/MapServer/0/query";
    const url = new URL(arcgisBase);
    const query = {
      where: "1=1",
      outFields: "*",
      returnGeometry: "true",
      outSR: "4326",
      resultRecordCount: "1000",
      f: "geojson",
    };
    for (const [key, value] of Object.entries(query)) url.searchParams.set(key, value);
    const boundaryResponse = await fetch(url, {
      headers: { "accept": "application/geo+json,application/json", "user-agent": "ZuriStayWorldwide/1.0 (county data enrichment)" },
      signal: AbortSignal.timeout(60_000),
    });
    if (!boundaryResponse.ok) {
      throw new Error(`County boundary source returned HTTP ${boundaryResponse.status}.`);
    }
    const boundaryPayload = await boundaryResponse.json();
    if (boundaryPayload?.error) {
      throw new Error(`County boundary source error: ${boundaryPayload.error.message || "ArcGIS query failed"}.`);
    }
    if (boundaryPayload?.exceededTransferLimit) {
      throw new Error("County boundary response exceeded its record limit; refusing incomplete boundary data.");
    }
    const features: CountyFeature[] = Array.isArray(boundaryPayload.features)
      ? boundaryPayload.features as CountyFeature[]
      : [];
    if (features.length < 47) {
      throw new Error(`County boundary source returned only ${features.length} polygon features; expected 47.`);
    }

    const counties = features.map((feature) => ({
      name: countyFromProperties(feature.properties),
      geometry: feature.geometry,
    })).filter((item): item is CountyBoundary => item.name !== null && item.geometry !== null);

    const uniqueCounties = new Set(counties.map((item) => item.name));
    if (uniqueCounties.size !== 47 || counties.length !== 47) {
      throw new Error(`County boundary validation failed: expected exactly 47 named county polygons, received ${uniqueCounties.size} names across ${counties.length} features.`);
    }

    const candidates: AccommodationCandidate[] = [];
    for (let offset = 0; ; offset += 500) {
      const { data, error } = await db.from("independent_accommodations")
        .select("id,latitude,longitude,county")
        .or("county.is.null,county.ilike.Kenya")
        .order("id", { ascending: true })
        .range(offset, offset + 499);
      if (error) throw error;
      candidates.push(...((data || []) as AccommodationCandidate[]));
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
      const matches = counties.filter((county) => pointInGeometry(lon, lat, county.geometry));
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

    return jsonResponse({
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
    return jsonResponse({ success: false, error: error instanceof Error ? error.message : "County enrichment failed." }, 500);
  }
});
