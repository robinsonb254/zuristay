import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function fail(message: string, status: number) {
  return NextResponse.json({ success: false, error: message }, { status, headers: { "Cache-Control": "no-store" } });
}

async function authenticatePartner(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  if (!url || !publishableKey || !secretKey) return { error: fail("Partner service configuration is incomplete.", 500) };
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) return { error: fail("Please sign in to continue.", 401) };
  const token = authorization.slice(7).trim();
  if (!token) return { error: fail("Invalid authentication token.", 401) };
  const auth = createClient(url, publishableKey, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
  const { data: { user }, error: authError } = await auth.auth.getUser(token);
  if (authError || !user) return { error: fail("Your session has expired. Please sign in again.", 401) };
  const admin = createClient(url, secretKey, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
  const { data: partner, error } = await admin.from("property_partners").select("id")
    .eq("owner_user_id", user.id).eq("status", "approved").maybeSingle();
  if (error) {
    console.error("Partner verification failed:", error);
    return { error: fail("Unable to verify your partner account.", 500) };
  }
  if (!partner) return { error: fail("An approved partner account is required.", 403) };
  return { admin, partner };
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ propertyId: string; unitId: string }> }) {
  try {
    const context = await authenticatePartner(request);
    if ("error" in context) return context.error;
    const { propertyId, unitId } = await params;
    if (!uuidPattern.test(propertyId) || !uuidPattern.test(unitId)) return fail("Invalid property or room ID.", 400);

    const { data: property, error: propertyError } = await context.admin.from("properties")
      .select("id, status").eq("id", propertyId).eq("partner_id", context.partner.id).maybeSingle();
    if (propertyError) {
      console.error("Property ownership check failed:", propertyError);
      return fail("Unable to verify this property.", 500);
    }
    if (!property) return fail("Property not found in your partner account.", 404);
    if (property.status !== "approved") return fail("Room categories can only be edited after property approval.", 409);

    const { data: existing, error: unitError } = await context.admin.from("property_units")
      .select("id").eq("id", unitId).eq("property_id", propertyId).maybeSingle();
    if (unitError) {
      console.error("Room ownership check failed:", unitError);
      return fail("Unable to verify this room category.", 500);
    }
    if (!existing) return fail("Room category not found for this property.", 404);

    let body: unknown;
    try { body = await request.json(); } catch { return fail("Please provide valid room details.", 400); }
    if (!body || typeof body !== "object" || Array.isArray(body)) return fail("Invalid room details.", 400);
    const input = body as Record<string, unknown>;
    const name = typeof input.name === "string" ? input.name.trim() : "";
    const unitType = typeof input.unitType === "string" ? input.unitType.trim() : "";
    const description = typeof input.description === "string" ? input.description.trim() : "";
    const capacity = Number(input.capacity);
    const baseRate = Number(input.baseRate);
    if (input.active !== undefined && typeof input.active !== "boolean") return fail("Room activation must be true or false.", 400);
    if (name.length < 2 || name.length > 100) return fail("Room category name must be between 2 and 100 characters.", 400);
    if (unitType.length > 80) return fail("Room type is too long.", 400);
    if (description.length > 1500) return fail("Room description is too long.", 400);
    if (!Number.isInteger(capacity) || capacity < 1 || capacity > 20) return fail("Guest capacity must be a whole number between 1 and 20.", 400);
    if (!Number.isFinite(baseRate) || baseRate <= 0 || baseRate > 100000000) return fail("Enter a valid positive nightly rate.", 400);

    const updateFields: Record<string, unknown> = {
      name, unit_type: unitType || null, description: description || null,
      capacity, base_rate: Number(baseRate.toFixed(2)),
    };
    if (typeof input.active === "boolean") updateFields.active = input.active;
    const { data: updated, error: updateError } = await context.admin.from("property_units").update(updateFields)
      .eq("id", unitId).eq("property_id", propertyId)
      .select("id, name, unit_type, description, capacity, total_units, base_rate, currency, active").single();
    if (updateError || !updated) {
      console.error("Room category update failed:", updateError);
      return fail("Unable to update this room category.", 500);
    }
    return NextResponse.json({ success: true, message: "Room category updated.", unit: updated }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Partner room update error:", error);
    return fail("An unexpected error occurred.", 500);
  }
}
