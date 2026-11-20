import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

function fail(message: string, status: number) {
  return NextResponse.json(
    { success: false, error: message },
    { status, headers: { "Cache-Control": "no-store" } }
  );
}

async function authenticatePartner(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const secretKey = process.env.SUPABASE_SECRET_KEY;

  if (!url || !publishableKey || !secretKey) {
    return { error: fail("Partner service configuration is incomplete.", 500) };
  }

  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) {
    return { error: fail("Please sign in to continue.", 401) };
  }

  const token = authorization.slice(7).trim();
  if (!token) return { error: fail("Invalid authentication token.", 401) };

  const authClient = createClient(url, publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const { data: { user }, error: authError } = await authClient.auth.getUser(token);
  if (authError || !user) {
    return { error: fail("Your session has expired. Please sign in again.", 401) };
  }

  const admin = createClient(url, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const { data: partner, error: partnerError } = await admin
    .from("property_partners")
    .select("id")
    .eq("owner_user_id", user.id)
    .eq("status", "approved")
    .maybeSingle();

  if (partnerError) {
    console.error("Partner verification failed:", partnerError);
    return { error: fail("Unable to verify your partner account.", 500) };
  }
  if (!partner) return { error: fail("An approved partner account is required.", 403) };

  return { admin, partner };
}

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const datePattern = /^\d{4}-\d{2}-\d{2}$/;

function getKenyaDate() {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Nairobi", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(new Date());
  const part = (type: string) => parts.find((item) => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

function isRealDate(value: string) {
  if (!datePattern.test(value)) return false;
  const date = new Date(value + "T00:00:00.000Z");
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}


export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ propertyId: string; unitId: string }> }
) {
  try {
    const context = await authenticatePartner(request);
    if ("error" in context) return context.error;
    const { propertyId, unitId } = await params;
    if (!uuidPattern.test(propertyId) || !uuidPattern.test(unitId)) {
      return fail("Invalid property or room category ID.", 400);
    }
    const { data: property, error: propertyError } = await context.admin
      .from("properties").select("id, status")
      .eq("id", propertyId).eq("partner_id", context.partner.id).maybeSingle();
    if (propertyError) {
      console.error("Partner property lookup failed:", propertyError);
      return fail("Unable to verify this property.", 500);
    }
    if (!property) return fail("Property not found in your partner account.", 404);
    if (property.status !== "approved") return fail("Availability can only be viewed after property approval.", 409);

    const { data: unit, error: unitError } = await context.admin
      .from("property_units").select("id")
      .eq("id", unitId).eq("property_id", propertyId).maybeSingle();
    if (unitError) return fail("Unable to verify this room category.", 500);
    if (!unit) return fail("Room category not found for this property.", 404);

    const today = getKenyaDate();
    const query = request.nextUrl.searchParams;
    const startDate = query.get("startDate") || today;
    const defaultEnd = new Date(Date.now() + 29 * 86400000).toISOString().slice(0, 10);
    const endDate = query.get("endDate") || defaultEnd;
    if (!isRealDate(startDate) || !isRealDate(endDate) || endDate < startDate) {
      return fail("Choose a valid date range.", 400);
    }
    const dayCount = Math.round((new Date(endDate + "T00:00:00Z").getTime() - new Date(startDate + "T00:00:00Z").getTime()) / 86400000) + 1;
    if (dayCount > 366) return fail("Please request no more than 366 days at a time.", 400);

    const { data: availability, error } = await context.admin
      .from("unit_availability")
      .select("id, stay_date, available_units, partner_base_rate, currency")
      .eq("unit_id", unitId)
      .gte("stay_date", startDate)
      .lte("stay_date", endDate)
      .order("stay_date", { ascending: true });
    if (error) {
      console.error("Partner availability calendar query failed:", error);
      return fail("Unable to load room availability.", 500);
    }
    return NextResponse.json({ success: true, startDate, endDate, availability: availability ?? [] }, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error("Partner availability calendar error:", error);
    return fail("An unexpected error occurred.", 500);
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ propertyId: string; unitId: string }> }
) {
  try {
    const context = await authenticatePartner(request);
    if ("error" in context) return context.error;

    const { propertyId, unitId } = await params;
    if (!uuidPattern.test(propertyId) || !uuidPattern.test(unitId)) {
      return fail("Invalid property or room category ID.", 400);
    }

    const { data: property, error: propertyError } = await context.admin
      .from("properties")
      .select("id, status")
      .eq("id", propertyId)
      .eq("partner_id", context.partner.id)
      .maybeSingle();

    if (propertyError) {
      console.error("Partner property lookup failed:", propertyError);
      return fail("Unable to verify this property.", 500);
    }
    if (!property) return fail("Property not found in your partner account.", 404);
    if (property.status !== "approved") {
      return fail("Availability can only be managed after property approval.", 409);
    }

    const { data: unit, error: unitError } = await context.admin
      .from("property_units")
      .select("id, total_units, base_rate, currency")
      .eq("id", unitId)
      .eq("property_id", propertyId)
      .maybeSingle();

    if (unitError) {
      console.error("Room category lookup failed:", unitError);
      return fail("Unable to verify this room category.", 500);
    }
    if (!unit) return fail("Room category not found for this property.", 404);

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return fail("Please provide valid availability details.", 400);
    }
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return fail("Invalid availability details.", 400);
    }

    const input = body as Record<string, unknown>;
    const startDate = typeof input.startDate === "string" ? input.startDate : "";
    const endDate = typeof input.endDate === "string" ? input.endDate : "";
    const availableUnits = Number(input.availableUnits);
    const rateInput = input.partnerBaseRate;
    const partnerBaseRate =
      rateInput === "" || rateInput === null || rateInput === undefined
        ? Number(unit.base_rate)
        : Number(rateInput);

    if (!isRealDate(startDate) || !isRealDate(endDate) || endDate < startDate) {
      return fail("Choose a valid date range.", 400);
    }

    const today = getKenyaDate();
    if (startDate < today) return fail("Availability dates cannot be in the past.", 400);

    const start = new Date(startDate + "T00:00:00.000Z");
    const end = new Date(endDate + "T00:00:00.000Z");
    const dayCount = Math.round((end.getTime() - start.getTime()) / 86400000) + 1;
    if (dayCount > 366) return fail("Please update no more than 366 days at a time.", 400);

    if (!Number.isInteger(availableUnits) || availableUnits < 0 || availableUnits > unit.total_units) {
      return fail("Available rooms must be between 0 and the total number of rooms in this category.", 400);
    }
    if (!Number.isFinite(partnerBaseRate) || partnerBaseRate <= 0 || partnerBaseRate > 100000000) {
      return fail("Enter a valid positive nightly rate.", 400);
    }

    // Update each date under a database row lock. The RPC caps sellable
    // inventory at total rooms minus active holds and confirmed reservations.
    const { data: updatedDates, error: availabilityError } = await context.admin.rpc(
      "partner_set_unit_availability",
      {
        p_partner_id: context.partner.id,
        p_unit_id: unitId,
        p_start_date: startDate,
        p_end_date: endDate,
        p_available_units: availableUnits,
        p_partner_base_rate: Number(partnerBaseRate.toFixed(2)),
      }
    );

    if (availabilityError) {
      console.error("Availability update failed:", availabilityError);
      const message = availabilityError.message || "";
      const isInventoryConflict = /reserved|booked|hold|inventory/i.test(message);
      const isInputError = /valid date|date range|available rooms|nightly rate|room count|negative/i.test(message);
      const safeMessage = isInventoryConflict || isInputError
        ? message.replace(/[<>]/g, "").slice(0, 220)
        : "Unable to save availability. Please try again.";
      return fail(safeMessage, isInventoryConflict ? 409 : isInputError ? 400 : 500);
    }

    return NextResponse.json(
      {
        success: true,
        message: availableUnits === 0
          ? `Room availability blocked for ${dayCount} date(s).`
          : `Availability saved for ${dayCount} date(s).`,
        updatedDates: typeof updatedDates === "number" ? updatedDates : dayCount,
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("Partner availability error:", error);
    return fail("An unexpected error occurred.", 500);
  }
}
