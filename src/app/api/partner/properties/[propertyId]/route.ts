import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const PROPERTY_TYPES = ["hotel", "resort", "apartment", "villa", "bnb", "lodge", "guesthouse", "hostel", "lounge", "venue", "other"] as const;
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

  const authClient = createClient(url, publishableKey, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
  const { data: { user }, error: authError } = await authClient.auth.getUser(token);
  if (authError || !user) return { error: fail("Your session has expired. Please sign in again.", 401) };

  const admin = createClient(url, secretKey, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
  const { data: partner, error: partnerError } = await admin.from("property_partners")
    .select("id").eq("owner_user_id", user.id).eq("status", "approved").maybeSingle();
  if (partnerError) {
    console.error("Partner verification failed:", partnerError);
    return { error: fail("Unable to verify your partner account.", 500) };
  }
  if (!partner) return { error: fail("An approved partner account is required.", 403) };
  return { admin, partner };
}

async function ownedProperty(request: NextRequest, propertyId: string) {
  const context = await authenticatePartner(request);
  if ("error" in context) return context;
  if (!uuidPattern.test(propertyId)) return { error: fail("Invalid property ID.", 400) };
  const { data: property, error } = await context.admin.from("properties")
    .select("id, partner_id, destination_id, name, property_type, description, address, city, county, country, country_code, currency, contact_phone, contact_email, status, is_active")
    .eq("id", propertyId).eq("partner_id", context.partner.id).maybeSingle();
  if (error) {
    console.error("Property lookup failed:", error);
    return { error: fail("Unable to load this property.", 500) };
  }
  if (!property) return { error: fail("Property not found in your partner account.", 404) };
  return { admin: context.admin, partner: context.partner, property };
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ propertyId: string }> }) {
  try {
    const { propertyId } = await params;
    const context = await ownedProperty(request, propertyId);
    if ("error" in context) return context.error;
    const { data: destinations, error } = await context.admin.from("destinations")
      .select("id, name, city, county, country, country_code").eq("active", true).order("name");
    if (error) {
      console.error("Destination list failed:", error);
      return fail("Unable to load destinations.", 500);
    }
    return NextResponse.json({ success: true, property: context.property, destinations: destinations || [] }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Partner property details error:", error);
    return fail("An unexpected error occurred.", 500);
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ propertyId: string }> }) {
  try {
    const { propertyId } = await params;
    const context = await ownedProperty(request, propertyId);
    if ("error" in context) return context.error;

    let body: unknown;
    try { body = await request.json(); } catch { return fail("Please provide valid property details.", 400); }
    if (!body || typeof body !== "object" || Array.isArray(body)) return fail("Invalid property details.", 400);
    const input = body as Record<string, unknown>;
    const name = typeof input.name === "string" ? input.name.trim() : "";
    const propertyType = typeof input.propertyType === "string" ? input.propertyType.trim().toLowerCase() : "";
    const destinationId = typeof input.destinationId === "string" ? input.destinationId.trim() : "";
    const address = typeof input.address === "string" ? input.address.trim() : "";
    const description = typeof input.description === "string" ? input.description.trim() : "";
    const currency = typeof input.currency === "string" ? input.currency.trim().toUpperCase() : "";
    const contactPhone = typeof input.contactPhone === "string" ? input.contactPhone.trim() : "";
    const contactEmail = typeof input.contactEmail === "string" ? input.contactEmail.trim().toLowerCase() : "";

    if (name.length < 2 || name.length > 150) return fail("Property name must be between 2 and 150 characters.", 400);
    if (!PROPERTY_TYPES.includes(propertyType as (typeof PROPERTY_TYPES)[number])) return fail("Choose a valid property type.", 400);
    if (!uuidPattern.test(destinationId)) return fail("Choose a valid destination.", 400);
    if (address.length < 4 || address.length > 250) return fail("Enter a valid property address.", 400);
    if (description.length > 5000) return fail("The property description is too long.", 400);
    if (!/^[A-Z]{3}$/.test(currency)) return fail("Enter a valid three-letter currency code.", 400);
    if (contactPhone.length < 5 || contactPhone.length > 30) return fail("Enter a valid contact phone number.", 400);
    if (contactEmail.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) return fail("Enter a valid contact email address.", 400);

    const { data: destination, error: destinationError } = await context.admin.from("destinations")
      .select("id, city, county, country, country_code").eq("id", destinationId).eq("active", true).maybeSingle();
    if (destinationError) {
      console.error("Destination verification failed:", destinationError);
      return fail("Unable to verify the selected destination.", 500);
    }
    if (!destination) return fail("The selected destination is unavailable.", 400);

    const { data: updated, error: updateError } = await context.admin.from("properties").update({
      destination_id: destination.id, name, property_type: propertyType, description: description || null,
      address, city: destination.city, county: destination.county, country: destination.country,
      country_code: destination.country_code, currency, contact_phone: contactPhone, contact_email: contactEmail,
    }).eq("id", propertyId).eq("partner_id", context.partner.id)
      .select("id, name, property_type, description, address, destination_id, city, county, country, currency, contact_phone, contact_email, status, is_active").single();

    if (updateError || !updated) {
      console.error("Property update failed:", updateError);
      return fail("Unable to update this property. Please check the details.", 500);
    }
    return NextResponse.json({ success: true, message: "Property details updated.", property: updated }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Partner property update error:", error);
    return fail("An unexpected error occurred.", 500);
  }
}
