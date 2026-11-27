import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendPartnerPropertyEditAcknowledgement } from "@/lib/email";

export const dynamic = "force-dynamic";
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function fail(message: string, status: number) {
  return NextResponse.json({ success: false, error: message }, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

async function authorize(request: NextRequest, propertyId: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  if (!url || !publishableKey || !secretKey) {
    return { error: fail("Property facilities service is not configured.", 500) };
  }
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) {
    return { error: fail("Please sign in to continue.", 401) };
  }
  const authClient = createClient(url, publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const { data: { user }, error: authError } = await authClient.auth.getUser(authorization.slice(7).trim());
  if (authError || !user) return { error: fail("Your session has expired. Please sign in again.", 401) };

  const admin = createClient(url, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const { data: partner, error: partnerError } = await admin.from("property_partners")
    .select("id, email, contact_person, business_name").eq("owner_user_id", user.id).eq("status", "approved").maybeSingle();
  if (partnerError) {
    console.error("Partner facilities authorization failed:", partnerError);
    return { error: fail("Unable to verify your partner account.", 500) };
  }
  if (!partner) return { error: fail("An approved partner account is required.", 403) };
  if (!UUID_PATTERN.test(propertyId)) return { error: fail("Invalid property ID.", 400) };

  const { data: property, error: propertyError } = await admin.from("properties")
    .select("id, name, status").eq("id", propertyId).eq("partner_id", partner.id).maybeSingle();
  if (propertyError) {
    console.error("Partner facilities property lookup failed:", propertyError);
    return { error: fail("Unable to verify this property.", 500) };
  }
  if (!property) return { error: fail("Property not found in your partner account.", 404) };
  return { admin, property, partner };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ propertyId: string }> }
) {
  try {
    const { propertyId } = await params;
    const auth = await authorize(request, propertyId);
    if ("error" in auth) return auth.error;

    const [{ data: amenities, error: amenitiesError }, { data: selected, error: selectedError }] = await Promise.all([
      auth.admin.from("amenities").select("id, name, category").order("category").order("name"),
      auth.admin.from("property_amenities").select("amenity_id").eq("property_id", propertyId),
    ]);
    if (amenitiesError || selectedError) {
      console.error("Property facilities query failed:", amenitiesError || selectedError);
      return fail("Unable to load property facilities.", 500);
    }
    return NextResponse.json({
      success: true,
      amenities: amenities ?? [],
      selectedIds: (selected ?? []).map((item) => item.amenity_id),
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Property facilities GET error:", error);
    return fail("An unexpected error occurred.", 500);
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ propertyId: string }> }
) {
  try {
    const { propertyId } = await params;
    const auth = await authorize(request, propertyId);
    if ("error" in auth) return auth.error;

    const body = await request.json().catch(() => null) as { amenityIds?: unknown } | null;
    if (!body || !Array.isArray(body.amenityIds) || body.amenityIds.length > 60 ||
        body.amenityIds.some((id) => typeof id !== "string" || !UUID_PATTERN.test(id))) {
      return fail("Choose valid property facilities.", 400);
    }
    const amenityIds = [...new Set(body.amenityIds as string[])];
    if (amenityIds.length > 0) {
      const { data: validAmenities, error: validationError } = await auth.admin
        .from("amenities").select("id").in("id", amenityIds);
      if (validationError) {
        console.error("Facility validation failed:", validationError);
        return fail("Unable to validate selected facilities.", 500);
      }
      if ((validAmenities ?? []).length !== amenityIds.length) {
        return fail("One or more selected facilities are unavailable.", 400);
      }
    }

    const { error: deleteError } = await auth.admin.from("property_amenities")
      .delete().eq("property_id", propertyId);
    if (deleteError) {
      console.error("Existing property facilities could not be cleared:", deleteError);
      return fail("Unable to update property facilities.", 500);
    }

    if (amenityIds.length > 0) {
      const { error: insertError } = await auth.admin.from("property_amenities")
        .insert(amenityIds.map((amenityId) => ({ property_id: propertyId, amenity_id: amenityId })));
      if (insertError) {
        console.error("Property facilities save failed:", insertError);
        return fail("Unable to save selected facilities.", 500);
      }
    }
    if (auth.partner.email) {
      try {
        await sendPartnerPropertyEditAcknowledgement({
          email: auth.partner.email,
          contactPerson: auth.partner.contact_person,
          businessName: auth.partner.business_name,
          propertyName: auth.property.name,
          changeType: "property facilities",
        });
      } catch (mailError) {
        console.error("Partner facilities acknowledgement failed:", mailError);
      }
    }
    return NextResponse.json({ success: true, message: "Property facilities saved. A confirmation email will be sent to your registered partner address.", selectedIds: amenityIds }, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error("Property facilities PUT error:", error);
    return fail("An unexpected error occurred.", 500);
  }
}
