
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
      "id, name, property_type, description, address, city, county, sub_county, country, country_code, currency, latitude, longitude"
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

  const [unitsResult, imagesResult, propertyAmenitiesResult] =
    await Promise.all([
      supabase
        .from("property_units")
        .select(
          "id, property_id, name, unit_type, description, capacity, total_units, base_rate, currency"
        )
        .in("property_id", propertyIds)
        .eq("active", true)
        .order("base_rate", { ascending: true }),

      supabase
        .from("property_images")
        .select(
          "id, property_id, image_url, caption, is_cover, display_order"
        )
        .in("property_id", propertyIds)
        .order("display_order", { ascending: true }),

      supabase
        .from("property_amenities")
        .select("property_id, amenity_id")
        .in("property_id", propertyIds),
    ]);

  if (unitsResult.error || imagesResult.error || propertyAmenitiesResult.error) {
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
        {
          error: "Unable to retrieve property amenities.",
          details: error.message,
        },
        { status: 500 }
      );
    }

    amenities = data ?? [];
  }

  const propertiesWithDetails = (properties ?? []).map((property) => {
    const propertyUnits = (unitsResult.data ?? [])
      .filter((unit) => unit.property_id === property.id)
      .map((unit) => {
        const baseRate = Number(unit.base_rate);

        return {
          ...unit,
          base_rate: baseRate,
          customer_rate: Number((baseRate * 1.3).toFixed(2)),
          markup_percentage: 30,
        };
      });

    const propertyImages = (imagesResult.data ?? [])
      .filter((image) => image.property_id === property.id)
      .sort((a, b) => {
        if (a.is_cover !== b.is_cover) {
          return a.is_cover ? -1 : 1;
        }

        return a.display_order - b.display_order;
      });

    const propertyAmenityIds = (propertyAmenitiesResult.data ?? [])
      .filter((item) => item.property_id === property.id)
      .map((item) => item.amenity_id);

    const propertyFacilities = amenities.filter((amenity) =>
      propertyAmenityIds.includes(amenity.id)
    );

    const startingRate =
      propertyUnits.length > 0
        ? Math.min(...propertyUnits.map((unit) => unit.customer_rate))
        : null;

    return {
      ...property,
      units: propertyUnits,
      images: propertyImages,
      amenities: propertyFacilities,
      starting_rate: startingRate,
    };
  });

  return NextResponse.json({
    success: true,
    count: propertiesWithDetails.length,
    markupPercentage: 30,
    properties: propertiesWithDetails,
  });
}
