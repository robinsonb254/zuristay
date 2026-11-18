
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

  const { data: properties, error: propertiesError } = await supabase
    .from("properties")
    .select(
      "id, name, property_type, description, address, city, county, country, country_code, currency, latitude, longitude"
    )
    .eq("status", "approved")
    .eq("is_active", true)
    .order("created_at", { ascending: false });

  if (propertiesError) {
    return NextResponse.json(
      {
        error: "Unable to retrieve approved properties.",
        details: propertiesError.message,
      },
      { status: 500 }
    );
  }

  const propertyIds = (properties ?? []).map((property) => property.id);

  if (propertyIds.length === 0) {
    return NextResponse.json({
      success: true,
      count: 0,
      markupPercentage: 30,
      properties: [],
    });
  }

  const { data: units, error: unitsError } = await supabase
    .from("property_units")
    .select(
      "id, property_id, name, unit_type, description, capacity, total_units, base_rate, currency"
    )
    .in("property_id", propertyIds)
    .eq("active", true)
    .order("base_rate", { ascending: true });

  if (unitsError) {
    return NextResponse.json(
      {
        error: "Unable to retrieve property units.",
        details: unitsError.message,
      },
      { status: 500 }
    );
  }

  const propertiesWithUnits = (properties ?? []).map((property) => {
    const propertyUnits = (units ?? [])
      .filter((unit) => unit.property_id === property.id)
      .map((unit) => {
        const baseRate = Number(unit.base_rate);
        const customerRate = Number((baseRate * 1.3).toFixed(2));

        return {
          ...unit,
          base_rate: baseRate,
          customer_rate: customerRate,
          markup_percentage: 30,
        };
      });

    const startingRate =
      propertyUnits.length > 0
        ? Math.min(...propertyUnits.map((unit) => unit.customer_rate))
        : null;

    return {
      ...property,
      units: propertyUnits,
      starting_rate: startingRate,
      currency: property.currency,
    };
  });

  return NextResponse.json({
    success: true,
    count: propertiesWithUnits.length,
    markupPercentage: 30,
    properties: propertiesWithUnits,
  });
}
