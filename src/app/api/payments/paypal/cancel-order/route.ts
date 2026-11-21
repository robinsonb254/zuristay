import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { verifyGuestToken, paypalAccessToken, paypalBaseUrl } from "@/lib/payments/paypal";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    const orderId = body?.order_id;
    if (typeof orderId !== "string" || !/^[A-Z0-9-]{8,80}$/i.test(orderId)) {
      return NextResponse.json({ success: false }, { status: 400 });
    }
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SECRET_KEY;
    if (!url || !key) return NextResponse.json({ success: false }, { status: 500 });
    const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: session, error: sessionError } = await db.from("paypal_checkout_sessions")
      .select("id, booking_id, guest_access_token_hash, status")
      .eq("order_id", orderId).maybeSingle();
    if (sessionError) {
      console.error("PayPal cancellation session lookup failed:", sessionError);
      return NextResponse.json({ success: false }, { status: 503 });
    }
    if (!session || !verifyGuestToken(request.headers.get("x-booking-access-token"), session.guest_access_token_hash)) {
      return NextResponse.json({ success: false }, { status: 404 });
    }
    const accessToken = await paypalAccessToken();
    const response = await fetch(`${paypalBaseUrl()}/v2/checkout/orders/${encodeURIComponent(orderId)}`, {
      headers: { Authorization: `Bearer ${accessToken}` }, cache: "no-store",
    });
    const order = await response.json();
    if (!response.ok) return NextResponse.json({ success: false }, { status: 503 });
    if (order.status === "CREATED" || order.status === "VOIDED") {
      const { error: sessionUpdateError } = await db.from("paypal_checkout_sessions")
        .update({ status: "cancelled" }).eq("id", session.id)
        .neq("status", "captured");
      if (sessionUpdateError) {
        console.error("Unable to record PayPal cancellation:", sessionUpdateError);
        return NextResponse.json({ success: false, error: "Cancellation needs reconciliation." }, { status: 503 });
      }
      const { error: paymentUpdateError } = await db.from("payments").update({ status: "failed" })
        .eq("booking_id", session.booking_id).eq("payment_method", "paypal")
        .eq("provider_reference", orderId).eq("status", "pending");
      if (paymentUpdateError) {
        console.error("Unable to close cancelled PayPal payment attempt:", paymentUpdateError);
        return NextResponse.json({ success: false, error: "Cancellation was verified but its payment record needs reconciliation." }, { status: 503 });
      }
      return NextResponse.json({ success: true, cancelled: true });
    }
    // An approved or completed order must remain reserved for capture/reconciliation.
    return NextResponse.json({ success: true, cancelled: false, status: order.status });
  } catch (error) {
    console.error("PayPal cancellation reconciliation failed:", error);
    return NextResponse.json({ success: false }, { status: 503 });
  }
}
