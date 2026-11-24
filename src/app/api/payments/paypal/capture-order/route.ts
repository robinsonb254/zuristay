import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { verifyGuestToken, paypalAccessToken, paypalBaseUrl } from "@/lib/payments/paypal";
import { deliverBookingReceipt } from "@/lib/receipts";

export const dynamic = "force-dynamic";

function fail(message: string, status: number) {
  return NextResponse.json({ success: false, error: message }, {
    status, headers: { "Cache-Control": "no-store" },
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    const orderId = body?.order_id;
    if (typeof orderId !== "string" || !/^[A-Z0-9-]{8,80}$/i.test(orderId)) {
      return fail("Invalid PayPal order reference.", 400);
    }
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const secretKey = process.env.SUPABASE_SECRET_KEY;
    if (!supabaseUrl || !secretKey) return fail("Payment service configuration is incomplete.", 500);
    const db = createClient(supabaseUrl, secretKey, { auth: { persistSession: false, autoRefreshToken: false } });

    const { data: session, error: sessionError } = await db.from("paypal_checkout_sessions")
      .select("id, booking_id, guest_access_token_hash, booking_amount_kes, paypal_amount_usd, status, expires_at, capture_id")
      .eq("order_id", orderId).maybeSingle();
    if (sessionError || !session) return fail("PayPal checkout session could not be found.", 404);
    if (!verifyGuestToken(request.headers.get("x-booking-access-token"), session.guest_access_token_hash)) {
      return fail("Secure booking access is required to complete payment.", 401);
    }
    const checkoutExpired = new Date(session.expires_at).getTime() <= Date.now() && session.status !== "captured";

    const accessToken = await paypalAccessToken();
    const orderResponse = await fetch(`${paypalBaseUrl()}/v2/checkout/orders/${encodeURIComponent(orderId)}`, {
      headers: { Authorization: `Bearer ${accessToken}` }, cache: "no-store",
    });
    let order = await orderResponse.json();
    if (!orderResponse.ok) {
      console.error("PayPal order lookup failed:", order);
      return fail("PayPal could not verify this order yet.", 502);
    }
    if (checkoutExpired && order.status === "COMPLETED") {
      const completedCapture = order.purchase_units?.[0]?.payments?.captures?.[0];
      await db.from("paypal_checkout_sessions").update({
        status: "needs_review",
        capture_id: typeof completedCapture?.id === "string" ? completedCapture.id : null,
      }).eq("id", session.id);
      return fail("PayPal reports a completed payment, but the room hold has expired. Do not pay again; contact ZuriStay support for reconciliation.", 409);
    }
    if (checkoutExpired) {
      const { error: expireAttemptError } = await db.from("payments")
        .update({ status: "failed" })
        .eq("booking_id", session.booking_id)
        .eq("payment_method", "paypal")
        .eq("provider_reference", orderId)
        .eq("status", "pending");
      if (expireAttemptError) {
        console.error("Unable to close expired PayPal payment attempt:", expireAttemptError);
        await db.from("paypal_checkout_sessions").update({ status: "needs_review" }).eq("id", session.id);
        return fail("This checkout expired but its payment record needs reconciliation. Do not pay again; contact support.", 503);
      }
      await db.from("paypal_checkout_sessions").update({ status: "expired" }).eq("id", session.id);
      return fail("This PayPal checkout has expired. Please create a new booking.", 409);
    }

    if (order.status === "APPROVED") {
      const captureResponse = await fetch(`${paypalBaseUrl()}/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
          "PayPal-Request-Id": `zuristay-capture-${orderId}`,
        },
        body: "{}",
        cache: "no-store",
      });
      order = await captureResponse.json();
      if (!captureResponse.ok) {
        console.error("PayPal capture request failed:", order);
        return fail("PayPal has not confirmed the capture. Do not pay again; contact support if the amount was debited.", 503);
      }
    }

    const purchase = order.purchase_units?.[0];
    const capture = purchase?.payments?.captures?.[0];
    const capturedAmount = Number(capture?.amount?.value);
    const expectedAmount = Number(session.paypal_amount_usd);
    if (order.status !== "COMPLETED" || purchase?.custom_id !== session.booking_id ||
        capture?.status !== "COMPLETED" || capture?.amount?.currency_code !== "USD" ||
        !Number.isFinite(capturedAmount) || capturedAmount !== expectedAmount ||
        typeof capture?.id !== "string" || !capture.id) {
      console.error("PayPal capture did not match the stored quote:", { orderId, orderStatus: order.status, captureStatus: capture?.status });
      await db.from("paypal_checkout_sessions").update({ status: "needs_review" }).eq("id", session.id);
      return fail("PayPal payment is awaiting verification. Do not retry or make another payment.", 409);
    }

    // Retain the original attempt as an audit record. The confirmation RPC
    // inserts a separate successful row keyed by the actual capture ID.
    // Marking this order attempt failed releases the one-pending-attempt index
    // without deleting evidence if booking confirmation later needs recovery.
    const { error: pendingUpdateError } = await db.from("payments")
      .update({ status: "failed" })
      .eq("booking_id", session.booking_id)
      .eq("payment_method", "paypal")
      .eq("provider_reference", orderId)
      .eq("status", "pending");
    if (pendingUpdateError) {
      console.error("Unable to close pending PayPal payment attempt:", pendingUpdateError);
      await db.from("paypal_checkout_sessions").update({ status: "needs_review", capture_id: capture.id }).eq("id", session.id);
      return fail("Payment was captured but booking confirmation is being reconciled. Do not pay again.", 503);
    }

    const { data: confirmed, error: confirmError } = await db.rpc("confirm_booking_payment", {
      p_booking_id: session.booking_id,
      p_payment_method: "paypal",
      p_provider_reference: capture.id,
      p_amount: session.booking_amount_kes,
      p_currency: "KES",
    });
    if (confirmError || !confirmed?.success) {
      console.error("PayPal booking confirmation failed:", confirmError);
      await db.from("paypal_checkout_sessions").update({ status: "needs_review", capture_id: capture.id }).eq("id", session.id);
      return fail("PayPal captured the payment, but booking confirmation needs reconciliation. Do not pay again.", 503);
    }

    const { error: sessionUpdateError } = await db.from("paypal_checkout_sessions").update({
      status: "captured", capture_id: capture.id, captured_at: new Date().toISOString(),
    }).eq("id", session.id);
    if (sessionUpdateError) {
      console.error("PayPal session audit update failed:", sessionUpdateError);
      return fail("Your payment was confirmed, but its audit record needs reconciliation.", 503);
    }
    if (typeof confirmed.payment_id === "string") {
      await deliverBookingReceipt(db, session.booking_id, confirmed.payment_id);
    }
    return NextResponse.json({
      success: true, booking_id: session.booking_id, payment_status: "paid",
      booking_status: "confirmed", booking_amount_kes: session.booking_amount_kes,
      paypal_amount_usd: session.paypal_amount_usd, capture_id: capture.id,
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("PayPal capture endpoint error:", error);
    return fail("PayPal payment verification is temporarily unavailable. Do not pay again until status is checked.", 503);
  }
}
