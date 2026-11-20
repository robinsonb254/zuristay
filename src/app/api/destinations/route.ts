
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json(
      { error: "Database configuration is missing." },
      { status: 500 }
    );
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  const { data, error } = await supabase
    .from("destinations")
    .select("id, name, city, county, country, country_code, active, destination_type, population_2019, sort_order")
    .eq("active", true)
    .order("sort_order", { ascending: true, nullsFirst: false })
    .order("city", { ascending: true });

  if (error) {
    return NextResponse.json(
      {
        error: "Unable to retrieve destinations.",
        details: error.message,
      },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    count: data.length,
    destinations: data,
  });
}
