import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    return NextResponse.json({ error: "Database configuration is missing." }, { status: 500 });
  }

  const supabase = createClient(url, key);
  const [{ data: counties, error: countiesError }, { data: subcounties, error: subcountiesError }] =
    await Promise.all([
      supabase.from("kenya_counties").select("county_code,name,sort_order").order("sort_order"),
      supabase.from("kenya_subcounties").select("subcounty_code,county_code,name").order("name"),
    ]);

  if (countiesError || subcountiesError) {
    return NextResponse.json(
      { error: "Unable to retrieve Kenya's administrative locations." },
      { status: 500 }
    );
  }

  const grouped = (counties ?? []).map((county) => ({
    ...county,
    subcounties: (subcounties ?? []).filter((item) => item.county_code === county.county_code),
  }));

  return NextResponse.json({
    success: true,
    county_count: grouped.length,
    subcounty_count: (subcounties ?? []).length,
    counties: grouped,
  }, {
    headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" },
  });
}
