
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const datePattern = /^\d{4}-\d{2}-\d{2}$/;
function isRealDate(value: string) {
  if (!datePattern.test(value)) return false;
  const date = new Date(value + "T00:00:00.000Z");
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const checkIn = params.get("checkIn") || "";
  const checkOut = params.get("checkOut") || "";
  const guests = Number(params.get("guests") || 2);
  const rooms = Number(params.get("rooms") || 1);
  // Availability filtering is applied only when both dates are supplied.
  // A check-in-only search remains valid and returns the current bookable inventory.
  const hasDateFilter = Boolean(checkIn && checkOut);
  if (!Number.isInteger(guests) || guests < 1 || guests > 20 || !Number.isInteger(rooms) || rooms < 1 || rooms > 10) {
    return NextResponse.json({ success: false, error: "Choose a valid number of guests and rooms." }, { status: 400 });
  }
  if (hasDateFilter && (!isRealDate(checkIn) || !isRealDate(checkOut) || checkOut <= checkIn)) {
    return NextResponse.json({ success: false, error: "Choose valid check-in and check-out dates." }, { status: 400 });
  }
  if (hasDateFilter && (new Date(checkOut + "T00:00:00Z").getTime() - new Date(checkIn + "T00:00:00Z").getTime()) / 86400000 > 30) {
    return NextResponse.json({ success: false, error: "Search dates cannot exceed 30 nights." }, { status: 400 });
  }
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
      "id, name, property_type, description, address, city, county, sub_county, country, country_code, currency, check_in_time, latitude, longitude, has_conference_rooms, conference_room_capacity, conference_room_details"
    )
    .eq("status", "approved")
    .eq("is_active", true)
    .eq("is_archived", false)
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
      markupPercentage: 15,
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

  const availableByUnit = new Map<string, { nights: number; totalRate: number }>();
  const nights = hasDateFilter ? (new Date(checkOut + "T00:00:00Z").getTime() - new Date(checkIn + "T00:00:00Z").getTime()) / 86400000 : 0;
  if (hasDateFilter && (unitsResult.data ?? []).length > 0) {
    const unitIds = (unitsResult.data ?? []).map((unit) => unit.id);
    const { data: availabilityRows, error: availabilityError } = await supabase
      .from("unit_availability")
      .select("unit_id, stay_date, available_units, partner_base_rate, currency")
      .in("unit_id", unitIds)
      .gte("stay_date", checkIn)
      .lt("stay_date", checkOut);
    if (availabilityError) {
      return NextResponse.json({ success: false, error: "Unable to verify room availability for these dates." }, { status: 500 });
    }

    const grouped = new Map<string, NonNullable<typeof availabilityRows>>();
    for (const row of availabilityRows ?? []) {
      const current = grouped.get(row.unit_id) ?? [];
      current.push(row);
      grouped.set(row.unit_id, current);
    }

    const stayDates = Array.from({ length: nights }, (_, index) =>
      new Date(Date.parse(checkIn + "T00:00:00Z") + index * 86400000).toISOString().slice(0, 10)
    );

    for (const unit of unitsResult.data ?? []) {
      const savedRows = grouped.get(unit.id) ?? [];
      const byDate = new Map(savedRows.map((row) => [row.stay_date, row]));
      // Missing daily rows inherit the room category's always-on default stock and rate.
      const effectiveRows = stayDates.map((stayDate) => byDate.get(stayDate) ?? {
        unit_id: unit.id,
        stay_date: stayDate,
        available_units: unit.total_units,
        partner_base_rate: unit.base_rate,
        currency: unit.currency,
      });
      if (
        effectiveRows.length === nights &&
        effectiveRows.every((row) =>
          Number(row.available_units) >= rooms && row.currency === unit.currency
        )
      ) {
        availableByUnit.set(unit.id, {
          nights: effectiveRows.length,
          totalRate: effectiveRows.reduce((sum, row) => sum + Number(row.partner_base_rate), 0),
        });
      }
    }
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
      .filter((unit) => {
        if (unit.property_id !== property.id || Number(unit.capacity) * rooms < guests) return false;
        return !hasDateFilter || availableByUnit.has(unit.id);
      })
      .map((unit) => {
        const baseRate = Number(unit.base_rate);
        const quote = availableByUnit.get(unit.id);
        const baseStayTotal = quote ? quote.totalRate * rooms : 0;
        // Match the booking-hold RPC exactly: KES partner subtotal and 15%
        // markup are rounded separately to whole shillings before summing.
        const roundedBaseTotal = quote
          ? property.currency === "KES" ? Math.round(baseStayTotal) : baseStayTotal
          : 0;
        const markupTotal = quote
          ? property.currency === "KES"
            ? Math.round(roundedBaseTotal * 0.15)
            : roundedBaseTotal * 0.15
          : 0;
        const quotedStayTotal = quote ? roundedBaseTotal + markupTotal : null;
        const guestRate = quote && quote.nights > 0
          ? (quotedStayTotal as number) / quote.nights / rooms
          : baseRate * 1.15;
        return {
          ...unit,
          base_rate: baseRate,
          customer_rate: Number(guestRate.toFixed(2)),
          markup_percentage: 15,
          ...(quote ? { quoted_stay_total: Number((quotedStayTotal as number).toFixed(2)) } : {}),
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
    markupPercentage: 15,
    search: { checkIn: checkIn || null, checkOut: checkOut || null, guests, rooms, availabilityChecked: hasDateFilter },
    properties: propertiesWithDetails,
  });
}
