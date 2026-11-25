import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function fail(message: string, status: number) {
  return NextResponse.json({ success: false, error: message }, { status, headers: { "Cache-Control": "no-store" } });
}
async function getAdmin(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!url || !publishableKey || !secret) return { response: fail("Administrator service configuration is incomplete.", 500) };
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) return { response: fail("Please sign in to continue.", 401) };
  const auth = createClient(url, publishableKey, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
  const { data: { user }, error } = await auth.auth.getUser(authorization.slice(7).trim());
  if (error || !user) return { response: fail("Your session has expired. Please sign in again.", 401) };
  const db = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
  const { data: profile, error: profileError } = await db.from("profiles").select("id,role").eq("id", user.id).maybeSingle();
  if (profileError || profile?.role !== "admin") return { response: fail("Administrator permission is required.", 403) };
  return { db, user };
}

export async function GET(request: NextRequest) {
  try {
    const context = await getAdmin(request);
    if ("response" in context) return context.response;
    const { data, error } = await context.db.from("booking_cancellation_requests")
      .select("id,booking_id,reason,status,policy_version,requested_at,reviewed_at,refund_amount,retained_amount,decision_notes,bookings!inner(booking_reference,guest_name,guest_email,guest_phone,check_in,check_out,total_amount,currency,payment_status,booking_status),booking_refund_transactions(id,payment_method,amount,currency,status,provider_reference,created_at,completed_at)")
      .in("status", ["pending_review","approved","refund_pending","refunded","denied"])
      .order("requested_at", { ascending: false });
    if (error) {
      console.error("Cancellation requests list failed:", error);
      return fail("Unable to load cancellation requests.", 500);
    }
    return NextResponse.json({ success: true, requests: data || [] }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Cancellation admin GET failed:", error);
    return fail("An unexpected error occurred.", 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const context = await getAdmin(request);
    if ("response" in context) return context.response;
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object" || Array.isArray(body)) return fail("Provide a valid cancellation action.", 400);
    const action = typeof body.action === "string" ? body.action : "";
    const notes = typeof body.notes === "string" ? body.notes.trim() : "";

    if (action === "review") {
      const requestId = typeof body.requestId === "string" ? body.requestId : "";
      const decision = body.decision;
      const refundAmount = body.refundAmount;
      if (!UUID.test(requestId)) return fail("Invalid cancellation request reference.", 400);
      if (!["approve","deny"].includes(decision)) return fail("Choose approve or deny.", 400);
      if (notes.length < 10 || notes.length > 4000) return fail("Enter decision notes (10–4,000 characters).", 400);
      if (decision === "approve" && (typeof refundAmount !== "number" || !Number.isFinite(refundAmount) || refundAmount < 0)) {
        return fail("Enter a valid refund amount.", 400);
      }
      const { data, error } = await context.db.rpc("admin_review_booking_cancellation", {
        p_request_id: requestId,
        p_admin_user_id: context.user.id,
        p_action: decision,
        p_refund_amount: decision === "approve" ? refundAmount : null,
        p_notes: notes,
      });
      if (error) {
        console.error("Cancellation review failed:", error);
        return fail(error.message || "Unable to process cancellation review.", 409);
      }
      return NextResponse.json({ success: true, result: data }, { headers: { "Cache-Control": "no-store" } });
    }

    if (action === "record_refund") {
      const refundId = typeof body.refundId === "string" ? body.refundId : "";
      const result = body.result;
      const providerReference = typeof body.providerReference === "string" ? body.providerReference.trim() : "";
      if (!UUID.test(refundId)) return fail("Invalid refund transaction reference.", 400);
      if (!["succeeded","failed"].includes(result)) return fail("Choose a valid refund result.", 400);
      if (notes.length < 10 || notes.length > 4000) return fail("Enter reconciliation notes (10–4,000 characters).", 400);
      if (result === "succeeded" && (providerReference.length < 3 || providerReference.length > 160)) {
        return fail("Enter the actual M-Pesa or PayPal refund reference.", 400);
      }
      const { data, error } = await context.db.rpc("record_booking_refund_result", {
        p_refund_transaction_id: refundId,
        p_admin_user_id: context.user.id,
        p_result: result,
        p_provider_reference: providerReference,
        p_notes: notes,
      });
      if (error) {
        console.error("Refund reconciliation failed:", error);
        return fail(error.message || "Unable to record refund result.", 409);
      }
      return NextResponse.json({ success: true, result: data }, { headers: { "Cache-Control": "no-store" } });
    }
    return fail("Unsupported cancellation action.", 400);
  } catch (error) {
    console.error("Cancellation admin POST failed:", error);
    return fail("An unexpected error occurred.", 500);
  }
}
