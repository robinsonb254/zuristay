import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function fail(message: string, status: number) {
  return NextResponse.json({ success: false, error: message }, { status, headers: { "Cache-Control": "no-store" } });
}

async function contextFor(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publicKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  if (!url || !publicKey || !secretKey) return { error: fail("Partner service configuration is incomplete.", 500) };
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) return { error: fail("Please sign in to continue.", 401) };
  const auth = createClient(url, publicKey, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
  const { data: { user }, error: authError } = await auth.auth.getUser(authorization.slice(7).trim());
  if (authError || !user) return { error: fail("Your session has expired. Please sign in again.", 401) };
  const admin = createClient(url, secretKey, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
  const { data: partner, error } = await admin.from("property_partners").select("id")
    .eq("owner_user_id", user.id).eq("status", "approved").maybeSingle();
  if (error) {
    console.error("Partner lookup failed:", error);
    return { error: fail("Unable to verify your partner account.", 500) };
  }
  if (!partner) return { error: fail("An approved partner account is required.", 403) };
  return { admin, partner };
}

async function checkReadiness(admin: ReturnType<typeof createClient>, propertyId: string, partnerId: string) {
  const { data: property, error: propertyError } = await admin.from("properties")
    .select("id, status, is_active, name, description, address, contact_phone, contact_email")
    .eq("id", propertyId).eq("partner_id", partnerId).maybeSingle();
  if (propertyError) throw new Error("Unable to load property details.");
  if (!property) return null;

  const [unitsResult, imagesResult, amenitiesResult, availabilityResult] = await Promise.all([
    admin.from("property_units").select("id, total_units").eq("property_id", propertyId).eq("active", true),
    admin.from("property_images").select("id", { count: "exact", head: true }).eq("property_id", propertyId),
    admin.from("property_amenities").select("amenity_id", { count: "exact", head: true }).eq("property_id", propertyId),
    admin.from("unit_availability").select("id, unit_id, stay_date, available_units")
      .gte("stay_date", new Date().toISOString().slice(0, 10)).gt("available_units", 0).limit(1),
  ]);
  if (unitsResult.error || imagesResult.error || amenitiesResult.error || availabilityResult.error) {
    console.error("Readiness check query failed:", unitsResult.error || imagesResult.error || amenitiesResult.error || availabilityResult.error);
    throw new Error("Unable to check property setup. Please try again.");
  }

  const activeUnitIds = new Set((unitsResult.data || []).map((unit) => unit.id));
  const hasActiveUnitAvailability = (availabilityResult.data || []).some((row) => activeUnitIds.has(row.unit_id));
  const checks = [
    { key: "property_details", label: "Property name, description, address and contact details", complete: Boolean(property.name?.trim() && property.description?.trim() && property.address?.trim() && property.contact_phone?.trim() && property.contact_email?.trim()) },
    { key: "rooms", label: "At least one active room category", complete: activeUnitIds.size > 0 },
    { key: "photos", label: "At least one property photograph", complete: (imagesResult.count || 0) > 0 },
    { key: "amenities", label: "At least one selected facility", complete: (amenitiesResult.count || 0) > 0 },
    { key: "availability", label: "At least one future date with rooms available for an active room category", complete: hasActiveUnitAvailability },
  ];
  return { property, checks, ready: property.status === "approved" && checks.every((check) => check.complete) };
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ propertyId: string }> }) {
  try {
    const context = await contextFor(request);
    if ("error" in context) return context.error;
    const { propertyId } = await params;
    if (!uuidPattern.test(propertyId)) return fail("Invalid property ID.", 400);
    const result = await checkReadiness(context.admin, propertyId, context.partner.id);
    if (!result) return fail("Property not found in your partner account.", 404);
    return NextResponse.json({
      success: true, status: result.property.status, isActive: result.property.is_active,
      ready: result.ready, checks: result.checks,
      approvalRequired: result.property.status !== "approved",
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Property readiness check failed:", error);
    return fail(error instanceof Error ? error.message : "Unable to check property readiness.", 500);
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ propertyId: string }> }) {
  try {
    const context = await contextFor(request);
    if ("error" in context) return context.error;
    const { propertyId } = await params;
    if (!uuidPattern.test(propertyId)) return fail("Invalid property ID.", 400);
    const result = await checkReadiness(context.admin, propertyId, context.partner.id);
    if (!result) return fail("Property not found in your partner account.", 404);
    if (result.property.status !== "approved") return fail("ZuriStay must approve this property before it can be published.", 409);
    const incomplete = result.checks.filter((check) => !check.complete);
    if (incomplete.length) return NextResponse.json({
      success: false, error: "Complete all property setup requirements before publishing.",
      checks: result.checks, incomplete: incomplete.map((check) => check.label),
    }, { status: 409, headers: { "Cache-Control": "no-store" } });
    const { data: updated, error } = await context.admin.from("properties").update({ is_active: true })
      .eq("id", propertyId).eq("partner_id", context.partner.id).eq("status", "approved")
      .select("id, is_active").single();
    if (error || !updated) {
      console.error("Property publication failed:", error);
      return fail("Unable to publish this property. Please try again.", 500);
    }
    return NextResponse.json({ success: true, message: "Your property is now published on ZuriStay.", isActive: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Property publication error:", error);
    return fail("An unexpected error occurred.", 500);
  }
}
