import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

function fail(message: string, status: number) {
  return NextResponse.json({ success: false, error: message }, { status, headers: { "Cache-Control": "no-store" } });
}

async function getAdmin(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  if (!url || !publishableKey || !secretKey) return { response: fail("Administrator service configuration is incomplete.", 500) };

  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) return { response: fail("Please sign in to continue.", 401) };

  const auth = createClient(url, publishableKey, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
  const { data: { user }, error: authError } = await auth.auth.getUser(authorization.slice(7).trim());
  if (authError || !user) return { response: fail("Your session has expired. Please sign in again.", 401) };

  const admin = createClient(url, secretKey, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
  const { data: profile, error } = await admin.from("profiles").select("id, role").eq("id", user.id).maybeSingle();
  if (error || profile?.role !== "admin") return { response: fail("Administrator permission is required.", 403) };
  return { admin, user };
}

export async function GET(request: NextRequest) {
  try {
    const context = await getAdmin(request);
    if ("response" in context) return context.response;

    const { data, error } = await context.admin
      .from("partner_settlement_disputes")
      .select(`
        id, settlement_id, booking_id, partner_id, reason, check_in_deadline_at,
        status, resolution, resolution_notes, external_reference, created_at,
        personal_destination_type, personal_destination_masked,
        personal_release_requested_by, personal_release_approved_by, personal_release_approved_at,
        bookings!inner(booking_reference, guest_name, guest_email, guest_phone, check_in),
        property_partners!inner(business_name),
        partner_settlements!inner(amount_due, currency, status)
      `)
      .in("status", ["open", "awaiting_second_approval", "approved_for_payment"])
      .order("check_in_deadline_at", { ascending: true });

    if (error) {
      console.error("Settlement dispute list failed:", error);
      return fail("Unable to load settlement disputes.", 500);
    }
    return NextResponse.json({ success: true, disputes: data || [] }, { headers: { "Cache-Control": "no-store" } });
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
    if (!body || typeof body !== "object" || Array.isArray(body)) return fail("Provide a valid dispute action.", 400);

    const disputeId = typeof body.disputeId === "string" ? body.disputeId : "";
    const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuid.test(disputeId)) return fail("Invalid dispute reference.", 400);

    const action = typeof body.action === "string" ? body.action : "resolve";
    const notes = typeof body.notes === "string" ? body.notes.trim() : "";
    const externalReference = typeof body.externalReference === "string" ? body.externalReference.trim() : "";

    let rpcName: string;
    let rpcArgs: Record<string, unknown>;

    if (action === "request_admin_personal_release") {
      const destinationType = body.destinationType;
      const destinationMasked = typeof body.destinationMasked === "string" ? body.destinationMasked.trim() : "";
      if (!["mpesa", "bank", "paypal"].includes(destinationType)) return fail("Choose M-Pesa, bank or PayPal.", 400);
      if (destinationMasked.length < 4 || destinationMasked.length > 100) return fail("Enter a masked destination identifier.", 400);
      if (notes.length < 20 || notes.length > 4000) return fail("Explain why these funds are payable to the administrator (20–4,000 characters).", 400);
      rpcName = "request_admin_personal_settlement_release";
      rpcArgs = { p_dispute_id: disputeId, p_admin_user_id: context.user.id, p_destination_type: destinationType, p_destination_masked: destinationMasked, p_notes: notes };
    } else if (action === "approve_admin_personal_release") {
      if (notes.length < 20 || notes.length > 4000) return fail("Enter independent approval notes (20–4,000 characters).", 400);
      rpcName = "approve_admin_personal_settlement_release";
      rpcArgs = { p_dispute_id: disputeId, p_approver_user_id: context.user.id, p_approval_notes: notes };
    } else if (action === "complete_admin_personal_release") {
      if (externalReference.length < 3 || externalReference.length > 160) return fail("Enter the completed transfer reference.", 400);
      if (notes.length < 10 || notes.length > 4000) return fail("Enter completion notes (10–4,000 characters).", 400);
      rpcName = "complete_admin_personal_settlement_release";
      rpcArgs = { p_dispute_id: disputeId, p_admin_user_id: context.user.id, p_external_reference: externalReference, p_completion_notes: notes };
    } else {
      const resolution = body.resolution;
      if (!["partner_paid", "guest_refunded"].includes(resolution)) return fail("Choose partner paid or guest refunded.", 400);
      if (notes.length < 10 || notes.length > 4000) return fail("Enter investigation notes (10–4,000 characters).", 400);
      if (externalReference.length < 3 || externalReference.length > 160) return fail("Enter the completed payment or refund reference.", 400);
      rpcName = "resolve_partner_settlement_dispute";
      rpcArgs = { p_dispute_id: disputeId, p_admin_user_id: context.user.id, p_resolution: resolution, p_notes: notes, p_external_reference: externalReference };
    }

    const { data, error } = await context.admin.rpc(rpcName, rpcArgs);
    if (error) {
      console.error("Settlement dispute action failed:", error);
      return fail(error.message || "Unable to process this action.", 409);
    }
    return NextResponse.json({ success: true, result: data }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Settlement dispute POST failed:", error);
    return fail("An unexpected error occurred.", 500);
  }
}
