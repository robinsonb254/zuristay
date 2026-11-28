import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const KENYAN_COUNTIES = [
  "Baringo", "Bomet", "Bungoma", "Busia", "Elgeyo-Marakwet", "Embu",
  "Garissa", "Homa Bay", "Isiolo", "Kajiado", "Kakamega", "Kericho",
  "Kiambu", "Kilifi", "Kirinyaga", "Kisii", "Kisumu", "Kitui", "Kwale",
  "Laikipia", "Lamu", "Machakos", "Makueni", "Mandera", "Marsabit",
  "Meru", "Migori", "Mombasa", "Murang'a", "Nairobi", "Nakuru", "Nandi",
  "Narok", "Nyamira", "Nyandarua", "Nyeri", "Samburu", "Siaya",
  "Taita Taveta", "Tana River", "Tharaka-Nithi", "Trans Nzoia", "Turkana",
  "Uasin Gishu", "Vihiga", "Wajir", "West Pokot",
];

function countyMatch(value: string) {
  const normalized = value.toLowerCase().replace(/\s+county$/i, "").replace(/[^a-z0-9]+/g, "");
  return KENYAN_COUNTIES.find((county) =>
    county.toLowerCase().replace(/[^a-z0-9]+/g, "") === normalized
  ) || null;
}

export async function GET(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return NextResponse.json({ success: false, error: "Accommodation directory is temporarily unavailable." }, { status: 500 });

  const query = request.nextUrl.searchParams.get("q")?.trim().slice(0, 100) || "";
  const city = request.nextUrl.searchParams.get("city")?.trim().slice(0, 80) || "";
  const type = request.nextUrl.searchParams.get("type")?.trim() || "";
  const accommodationId = request.nextUrl.searchParams.get("id")?.trim() || "";
  const db = createClient(url, key, { auth: { persistSession: false } });

  const selectFields = "id,name,property_type,description,address,city,county,country,currency,published_base_rate,public_website_url,image_urls,booking_enabled,availability_status,last_verified_at";
  const baseQuery = () => {
    let q = db.from("independent_accommodations")
      .select(selectFields)
      .eq("listing_status", "published")
      .order("name", { ascending: true });
    if (type && ["hotel", "resort", "villa", "apartment", "lodge", "guesthouse", "hostel", "camp", "other"].includes(type)) {
      q = q.eq("property_type", type);
    }
    return q;
  };

  let data: any[] | null = null;
  let error: { message: string } | null = null;

  if (accommodationId) {
    const result = await baseQuery().eq("id", accommodationId).limit(1);
    data = result.data;
    error = result.error;
  } else if (query) {
    const cleaned = query.replace(/,?\\s*Kenya$/i, "").replace(/\\s+county$/i, "").trim();
    const county = countyMatch(cleaned);
    const safeTerm = cleaned.replace(/[(),.%_*]/g, " ").trim();
    const pattern = `%${safeTerm}%`;
    // Search each geographic/name field separately, then merge by ID.
    // This avoids fragile PostgREST OR parsing and works consistently for
    // county searches and individual towns in every Kenyan region.
    const searches = county
      ? [
          baseQuery().ilike("county", `%${county}%`).limit(500),
          baseQuery().ilike("city", pattern).limit(500),
        ]
      : [
          baseQuery().ilike("city", pattern).limit(500),
          baseQuery().ilike("county", pattern).limit(500),
          baseQuery().ilike("name", pattern).limit(500),
        ];
    const results = await Promise.all(searches);
    const failed = results.find((result) => result.error);
    if (failed?.error) error = failed.error;
    else {
      const byId = new Map<string, any>();
      for (const result of results) {
        for (const item of result.data || []) byId.set(item.id, item);
      }
      data = Array.from(byId.values()).sort((a, b) => String(a.name).localeCompare(String(b.name))).slice(0, 500);
    }
  } else if (city) {
    const result = await baseQuery().ilike("city", `%${city}%`).limit(500);
    data = result.data;
    error = result.error;
  } else {
    const result = await baseQuery().limit(100);
    data = result.data;
    error = result.error;
  }

  if (error) return NextResponse.json({ success: false, error: "Unable to load accommodations." }, { status: 500 });

  const accommodations = (data || []).map((item) => ({
    ...item,
    guest_rate: item.published_base_rate === null ? null : Math.ceil(Number(item.published_base_rate) * 1.3),
    published_base_rate: undefined,
  }));

  return NextResponse.json(
    { success: true, count: accommodations.length, accommodations },
    { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" } }
  );
}
