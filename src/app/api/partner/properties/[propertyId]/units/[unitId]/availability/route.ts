import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendPartnerPropertyEditAcknowledgement } from "@/lib/email";

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
    .select("id, email, contact_person, business_name")
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


export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ propertyId: string; unitId: string }> }
) {
  try {
    const context = await authenticatePartner(_request);
    if ("error" in context) return context.error;
    const { propertyId, unitId } = await params;
    if (!uuidPattern.test(propertyId) || !uuidPattern.test(unitId)) {
      return fail("Invalid property or room category ID.", 400);
    }

    const { data: property, error: propertyError } = await context.admin
      .from("properties").select("id, name")
      .eq("id", propertyId).eq("partner_id", context.partner.id).maybeSingle();
    if (propertyError) {
      console.error("Partner property lookup failed:", propertyError);
      return fail("Unable to verify this property.", 500);
    }
    if (!property) return fail("Property not found in your partner account.", 404);

    const { data: unit, error: unitError } = await context.admin
      .from("property_units")
      .select("id, total_units, base_rate, currency")
      .eq("id", unitId).eq("property_id", propertyId).maybeSingle();
    if (unitError) return fail("Unable to verify this room category.", 500);
    if (!unit) return fail("Room category not found for this property.", 404);

    return NextResponse.json({ success: true, unit }, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error("Partner room defaults lookup error:", error);
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
      .select("id, name, status")
      .eq("id", propertyId)
      .eq("partner_id", context.partner.id)
      .maybeSingle();

    if (propertyError) {
      console.error("Partner property lookup failed:", propertyError);
      return fail("Unable to verify this property.", 500);
    }
    if (!property) return fail("Property not found in your partner account.", 404);

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
    const availableUnits = Number(input.availableUnits);
    const partnerBaseRate = Number(input.partnerBaseRate);

    if (!Number.isInteger(availableUnits) || availableUnits < 1 || availableUnits > 500) {
      return fail("Rooms available must be a whole number between 1 and 500.", 400);
    }
    if (!Number.isFinite(partnerBaseRate) || partnerBaseRate <= 0 || partnerBaseRate > 100000000) {
      return fail("Enter a valid positive 24-hour room rate.", 400);
    }

    // The database updates the room category defaults and safely preserves
    // all active holds and confirmed reservations across existing stay dates.
    const { data: updatedDates, error: availabilityError } = await context.admin.rpc(
      "partner_update_unit_defaults",
      {
        p_partner_id: context.partner.id,
        p_unit_id: unitId,
        p_total_units: availableUnits,
        p_partner_base_rate: Number(partnerBaseRate.toFixed(2)),
      }
    );

    if (availabilityError) {
      console.error("Availability update failed:", availabilityError);
      const message = availabilityError.message || "";
      const isInventoryConflict = /reserved|booked|hold|inventory|room count/i.test(message);
      const isInputError = /available rooms|24-hour rate|nightly rate|room count|negative/i.test(message);
      const safeMessage = isInventoryConflict || isInputError
        ? message.replace(/[<>]/g, "").slice(0, 220)
        : "Unable to save availability. Please try again.";
      return fail(safeMessage, isInventoryConflict ? 409 : isInputError ? 400 : 500);
    }

    const { error: publicationResetError } = await context.admin.from("properties")
      .update({ publication_status: "draft", publication_submitted_at: null, publication_reviewed_at: null, publication_reviewed_by: null, is_active: false })
      .eq("id", propertyId).eq("partner_id", context.partner.id).eq("status", "approved");
    if (publicationResetError) {
      console.error("Availability saved but publication review reset failed:", publicationResetError);
      return fail("Availability was saved, but the listing review status could not be updated. Please contact support before accepting bookings.", 500);
    }

    if (context.partner.email) {
      try {
        await sendPartnerPropertyEditAcknowledgement({
          email: context.partner.email,
          contactPerson: context.partner.contact_person,
          businessName: context.partner.business_name,
          propertyName: property.name,
          changeType: "room availability and rates",
        });
      } catch (mailError) {
        console.error("Partner availability acknowledgement failed:", mailError);
      }
    }

    return NextResponse.json(
      {
        success: true,
        message: `Room count and 24-hour rate saved. Your room category remains available by default for all dates; guest bookings automatically deduct inventory. A confirmation email will be sent to your registered partner address.`,
        updatedDates: typeof updatedDates === "number" ? updatedDates : 0,
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("Partner availability error:", error);
    return fail("An unexpected error occurred.", 500);
  }
}
