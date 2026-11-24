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
    .select("id, business_name, contact_person, email")
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

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ propertyId: string }> }
) {
  try {
    const context = await authenticatePartner(request);
    if ("error" in context) return context.error;

    const { propertyId } = await params;
    if (!uuidPattern.test(propertyId)) return fail("Invalid property ID.", 400);

    const { data: property, error: propertyError } = await context.admin
      .from("properties")
      .select("id, name, currency, status, is_active")
      .eq("id", propertyId)
      .eq("partner_id", context.partner.id)
      .maybeSingle();

    if (propertyError) {
      console.error("Partner property lookup failed:", propertyError);
      return fail("Unable to load this property.", 500);
    }
    if (!property) return fail("Property not found in your partner account.", 404);

    const { data: units, error: unitsError } = await context.admin
      .from("property_units")
      .select("id, name, unit_type, description, capacity, total_units, base_rate, currency, active, created_at")
      .eq("property_id", propertyId)
      .order("created_at", { ascending: false });

    if (unitsError) {
      console.error("Room categories lookup failed:", unitsError);
      return fail("Unable to load room categories.", 500);
    }

    return NextResponse.json(
      { success: true, property, units: units || [] },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("Partner room list error:", error);
    return fail("An unexpected error occurred.", 500);
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ propertyId: string }> }
) {
  try {
    const context = await authenticatePartner(request);
    if ("error" in context) return context.error;

    const { propertyId } = await params;
    if (!uuidPattern.test(propertyId)) return fail("Invalid property ID.", 400);

    const { data: property, error: propertyError } = await context.admin
      .from("properties")
      .select("id, name, currency, status")
      .eq("id", propertyId)
      .eq("partner_id", context.partner.id)
      .maybeSingle();

    if (propertyError) {
      console.error("Partner property lookup failed:", propertyError);
      return fail("Unable to verify this property.", 500);
    }
    if (!property) return fail("Property not found in your partner account.", 404);
    if (property.status !== "approved") {
      return fail("Rooms can only be added after the property is approved.", 409);
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return fail("Please provide valid room details.", 400);
    }
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return fail("Invalid room details.", 400);
    }

    const input = body as Record<string, unknown>;
    const name = typeof input.name === "string" ? input.name.trim() : "";
    const unitType = typeof input.unitType === "string" ? input.unitType.trim() : "";
    const description = typeof input.description === "string" ? input.description.trim() : "";
    const capacity = Number(input.capacity);
    const totalUnits = Number(input.totalUnits);
    const baseRate = Number(input.baseRate);

    if (name.length < 2 || name.length > 100) {
      return fail("Room category name must be between 2 and 100 characters.", 400);
    }
    if (unitType.length > 80) return fail("Room type is too long.", 400);
    if (description.length > 1500) return fail("Room description is too long.", 400);
    if (!Number.isInteger(capacity) || capacity < 1 || capacity > 20) {
      return fail("Guest capacity must be a whole number between 1 and 20.", 400);
    }
    if (!Number.isInteger(totalUnits) || totalUnits < 1 || totalUnits > 500) {
      return fail("Number of rooms must be a whole number between 1 and 500.", 400);
    }
    if (!Number.isFinite(baseRate) || baseRate <= 0 || baseRate > 100000000) {
      return fail("Enter a valid positive nightly rate.", 400);
    }

    const { data: unit, error: insertError } = await context.admin
      .from("property_units")
      .insert({
        property_id: propertyId,
        name,
        unit_type: unitType || null,
        description: description || null,
        capacity,
        total_units: totalUnits,
        base_rate: Number(baseRate.toFixed(2)),
        currency: property.currency || "KES",
        active: true,
      })
      .select("id, name, unit_type, description, capacity, total_units, base_rate, currency, active, created_at")
      .single();

    if (insertError || !unit) {
      console.error("Room category creation failed:", insertError);
      return fail("Unable to save this room category. Please check the details.", 500);
    }

    if (context.partner.email) {
      try {
        await sendPartnerPropertyEditAcknowledgement({
          email: context.partner.email,
          contactPerson: context.partner.contact_person,
          businessName: context.partner.business_name,
          propertyName: property.name,
          changeType: "room category addition",
        });
      } catch (mailError) {
        console.error("Partner room category acknowledgement failed:", mailError);
      }
    }
    return NextResponse.json(
      {
        success: true,
        message: "Room category saved. Set availability dates before accepting bookings. A confirmation email will be sent to your registered partner address.",
        unit,
      },
      { status: 201, headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("Partner room creation error:", error);
    return fail("An unexpected error occurred.", 500);
  }
}
