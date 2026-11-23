import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

function fail(message: string, status: number) {
  return NextResponse.json({ success: false, error: message }, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

async function getAdmin(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  if (!url || !publishableKey || !secretKey) {
    return { response: fail("Administrator service configuration is incomplete.", 500) };
  }

  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) {
    return { response: fail("Please sign in to continue.", 401) };
  }

  const auth = createClient(url, publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const { data: { user }, error: authError } = await auth.auth.getUser(authorization.slice(7).trim());
  if (authError || !user) return { response: fail("Your session has expired. Please sign in again.", 401) };

  const admin = createClient(url, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const { data: profile, error } = await admin
    .from("profiles")
    .select("id, role")
    .eq("id", user.id)
    .maybeSingle();

  if (error || profile?.role !== "admin") {
    return { response: fail("Administrator permission is required.", 403) };
  }
  return { admin, user };
}

export async function GET(request: NextRequest) {
  try {
    const context = await getAdmin(request);
    if ("response" in context) return context.response;

    const { data, error } = await context.admin
      .from("partner_settlement_disputes")
      .select(`
        id, settlement_id, booking_id, partner_id, reason,
        check_in_deadline_at, status, created_at,
        bookings!inner(booking_reference, guest_name, guest_email, guest_phone, check_in),
        property_partners!inner(business_name),
        partner_settlements!inner(amount_due, currency, status)
      `)
      .eq("status", "open")
      .order("check_in_deadline_at", { ascending: true });

    if (error) {
      console.error("Settlement dispute list failed:", error);
      return fail("Unable to load settlement disputes.", 500);
    }
    return NextResponse.json({ success: true, disputes: data || [] }, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error("Settlement dispute GET failed:", error);
    return fail("An unexpected error occurred.", 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const context = await getAdmin(request);
    if ("response" in context) return context.response;

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return fail("Provide a valid dispute resolution.", 400);
    }

    const disputeId = typeof body.disputeId === "string" ? body.disputeId : "";
    const resolution = body.resolution;
    const notes = typeof body.notes === "string" ? body.notes.trim() : "";
    const externalReference = typeof body.externalReference === "string" ? body.externalReference.trim() : "";
    const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

    if (!uuid.test(disputeId)) return fail("Invalid dispute reference.", 400);
    if (!["partner_paid", "guest_refunded"].includes(resolution)) {
      return fail("Choose partner paid or guest refunded.", 400);
    }
    if (notes.length < 10 || notes.length > 4000) {
      return fail("Enter investigation notes between 10 and 4,000 characters.", 400);
    }
    if (externalReference.length < 3 || externalReference.length > 160) {
      return fail("Enter the external payment or refund reference.", 400);
    }

    const { data, error } = await context.admin.rpc("resolve_partner_settlement_dispute", {
      p_dispute_id: disputeId,
      p_admin_user_id: context.user.id,
      p_resolution: resolution,
      p_notes: notes,
      p_external_reference: externalReference,
    });

    if (error) {
      console.error("Settlement dispute resolution failed:", error);
      return fail(error.message || "Unable to record the dispute resolution.", 409);
    }

    return NextResponse.json({ success: true, result: data }, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error("Settlement dispute POST failed:", error);
    return fail("An unexpected error occurred.", 500);
  }
}
