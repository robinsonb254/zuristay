
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json(
      { error: "Database configuration is missing." },
      { status: 500 }
    );
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  const { data: property, error: propertyError } = await supabase
    .from("properties")
    .select(
      "id, name, property_type, description, address, city, county, country, country_code, currency, latitude, longitude, has_conference_rooms, conference_room_capacity, conference_room_details"
    )
    .eq("id", id)
    .eq("status", "approved")
    .eq("is_active", true)
    .eq("is_archived", false)
    .maybeSingle();

  if (propertyError) {
    return NextResponse.json(
      { error: "Unable to retrieve property.", details: propertyError.message },
      { status: 500 }
    );
  }

  if (!property) {
    return NextResponse.json(
      { error: "Property not found." },
      { status: 404 }
    );
  }

  const [unitsResult, imagesResult, propertyAmenitiesResult] =
    await Promise.all([
      supabase
        .from("property_units")
        .select(
          "id, name, unit_type, description, capacity, total_units, base_rate, currency"
        )
        .eq("property_id", id)
        .eq("active", true)
        .order("base_rate", { ascending: true }),

      supabase
        .from("property_images")
        .select("id, image_url, caption, is_cover, display_order")
        .eq("property_id", id)
        .order("display_order", { ascending: true }),

      supabase
        .from("property_amenities")
        .select("amenity_id")
        .eq("property_id", id),
    ]);

  if (
    unitsResult.error ||
    imagesResult.error ||
    propertyAmenitiesResult.error
  ) {
    return NextResponse.json(
      {
        error: "Unable to retrieve property details.",
        details:
          unitsResult.error?.message ||
          imagesResult.error?.message ||
          propertyAmenitiesResult.error?.message,
      },
      { status: 500 }
    );
  }

  const amenityIds = [
    ...new Set(
      (propertyAmenitiesResult.data ?? []).map((item) => item.amenity_id)
    ),
  ];

  let amenities: { id: string; name: string; category: string | null }[] = [];

  if (amenityIds.length > 0) {
    const { data, error } = await supabase
      .from("amenities")
      .select("id, name, category")
      .in("id", amenityIds);

    if (error) {
      return NextResponse.json(
        { error: "Unable to retrieve amenities.", details: error.message },
        { status: 500 }
      );
    }

    amenities = data ?? [];
  }

  const units = (unitsResult.data ?? []).map((unit) => {
    const baseRate = Number(unit.base_rate);

    return {
      ...unit,
      base_rate: baseRate,
      customer_rate: Number((baseRate * 1.15).toFixed(2)),
      markup_percentage: 15,
    };
  });

  const images = (imagesResult.data ?? []).sort((a, b) => {
    if (a.is_cover !== b.is_cover) {
      return a.is_cover ? -1 : 1;
    }

    return a.display_order - b.display_order;
  });

  return NextResponse.json({
    success: true,
    property: {
      ...property,
      units,
      images,
      amenities,
      markup_percentage: 30,
    },
  });
}
