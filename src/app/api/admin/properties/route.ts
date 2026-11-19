import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

function fail(message: string, status: number) {
  return NextResponse.json(
    { success: false, error: message },
    { status, headers: { "Cache-Control": "no-store" } }
  );
}

async function authenticateAdmin(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const secretKey = process.env.SUPABASE_SECRET_KEY;

  if (!url || !publishableKey || !secretKey) {
    return { error: fail("Administrator service configuration is incomplete.", 500) };
  }

  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) {
    return { error: fail("Please sign in first.", 401) };
  }

  const token = authorization.slice(7).trim();
  if (!token) return { error: fail("Invalid authentication token.", 401) };

  const authClient = createClient(url, publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

  const { data: { user }, error: authError } = await authClient.auth.getUser(token);
  if (authError || !user) {
    return { error: fail("Your session is invalid or expired. Please sign in again.", 401) };
  }

  const admin = createClient(url, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("id, role")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError || !profile || profile.role !== "admin") {
    return { error: fail("Administrator permission is required.", 403) };
  }

  return { admin, user };
}

export async function GET(request: NextRequest) {
  try {
    const context = await authenticateAdmin(request);
    if ("error" in context) return context.error;

    const requestedStatus = request.nextUrl.searchParams.get("status");
    const allowedStatuses = ["pending", "approved", "rejected", "suspended"];
    if (requestedStatus && !allowedStatuses.includes(requestedStatus)) {
      return fail("Invalid property status filter.", 400);
    }

    let query = context.admin
      .from("properties")
      .select(
        "id, partner_id, destination_id, name, property_type, description, address, city, county, country, currency, contact_phone, contact_email, status, is_active, created_at, partner:property_partners(business_name, contact_person, email, phone)"
      )
      .order("created_at", { ascending: false })
      .limit(200);

    if (requestedStatus) query = query.eq("status", requestedStatus);

    const { data: properties, error } = await query;
    if (error) {
      console.error("Admin property list error:", error);
      return fail("Unable to retrieve property submissions.", 500);
    }

    return NextResponse.json(
      { success: true, count: properties?.length || 0, properties: properties || [] },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("Admin property list API error:", error);
    return fail("An unexpected error occurred.", 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const context = await authenticateAdmin(request);
    if ("error" in context) return context.error;

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return fail("Invalid request body.", 400);
    }

    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return fail("Invalid property review request.", 400);
    }

    const input = body as Record<string, unknown>;
    const propertyId = input.propertyId;
    const action = input.action;
    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

    if (typeof propertyId !== "string" || !uuidPattern.test(propertyId)) {
      return fail("Invalid property ID.", 400);
    }
    if (action !== "approve" && action !== "reject") {
      return fail("Choose either approve or reject.", 400);
    }

    const { data: property, error: updateError } = await context.admin
      .from("properties")
      .update(
        action === "approve"
          ? { status: "approved", is_active: false }
          : { status: "rejected", is_active: false }
      )
      .eq("id", propertyId)
      .eq("status", "pending")
      .select("id, name, status, is_active")
      .maybeSingle();

    if (updateError) {
      console.error("Property review update failed:", updateError);
      return fail("Unable to update this property. Please try again.", 500);
    }
    if (!property) {
      return fail("This property was already reviewed or no longer exists. Refresh the list.", 409);
    }

    return NextResponse.json(
      {
        success: true,
        message:
          action === "approve"
            ? "Property approved. It remains unpublished until its rooms, rates and availability are configured."
            : "Property submission rejected successfully.",
        property,
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("Admin property review API error:", error);
    return fail("An unexpected error occurred while reviewing this property.", 500);
  }
}
