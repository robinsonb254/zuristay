import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { verifyBookingAccessToken } from "@/lib/bookings/access";
import { getUsdPerKes, money, paypalAccessToken, paypalBaseUrl } from "@/lib/payments/paypal";

export const dynamic = "force-dynamic";

function fail(message: string, status: number) {
  return NextResponse.json({ success: false, error: message }, {
    status, headers: { "Cache-Control": "no-store" },
  });
}

export async function POST(request: NextRequest) {
  let db: ReturnType<typeof createClient> | null = null;
  let attemptId: string | null = null;
  try {
    const body = await request.json().catch(() => null);
    const bookingId = body?.booking_id;
    if (typeof bookingId !== "string" ||
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(bookingId)) {
      return fail("Invalid booking reference.", 400);
    }
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const secretKey = process.env.SUPABASE_SECRET_KEY;
    if (!supabaseUrl || !secretKey) return fail("Payment service configuration is incomplete.", 500);
    db = createClient(supabaseUrl, secretKey, { auth: { persistSession: false, autoRefreshToken: false } });

    const { data: bookingData, error } = await db.from("bookings")
      .select("id, booking_reference, total_amount, currency, booking_status, payment_status, guest_access_token_hash")
      .eq("id", bookingId).maybeSingle();
    const booking = bookingData as {
      id: string;
      booking_reference: string;
      total_amount: number | string;
      currency: string;
      booking_status: string;
      payment_status: string;
      guest_access_token_hash: string;
    } | null;
    if (error || !booking) return fail("Booking could not be found.", 404);
    if (!verifyBookingAccessToken(request.headers.get("x-booking-access-token"), booking.guest_access_token_hash)) {
      return fail("Secure booking access is required before payment can be started.", 401);
    }
    if (booking.booking_status !== "pending" || !["unpaid", "pending"].includes(booking.payment_status)) {
      return fail("This booking is no longer awaiting payment.", 409);
    }
    if (String(booking.currency).toUpperCase() !== "KES") {
      return fail("PayPal checkout is currently enabled for KES-priced bookings only.", 400);
    }
    const { data: holds, error: holdError } = await db.from("booking_holds")
      .select("id").eq("booking_id", bookingId).eq("status", "active")
      .gt("expires_at", new Date().toISOString()).limit(1);
    if (holdError || !holds?.length) return fail("Your room hold has expired. Please create a new booking.", 409);

    const kesAmount = Number(booking.total_amount);
    if (!Number.isFinite(kesAmount) || kesAmount <= 0) return fail("The booking total is invalid.", 400);
    const fx = await getUsdPerKes();
    const usdAmount = Number((kesAmount * fx.rate).toFixed(2));
    if (!Number.isFinite(usdAmount) || usdAmount < 0.01) return fail("The PayPal amount is below the minimum supported value.", 400);

    const attemptReference = `INIT-PAYPAL-${randomUUID()}`;
    // The repository's generated Supabase table typings currently omit the
    // payments insert shape. Keep the runtime payload explicit while narrowing
    // this single insert at the boundary until database types are regenerated.
    const paymentAttempt = {
      booking_id: bookingId, payment_method: "paypal", provider_reference: attemptReference,
      amount: kesAmount, currency: "KES", status: "pending",
    };
    const { data: attemptData, error: attemptError } = await db.from("payments")
      .insert(paymentAttempt as never).select("id").single();
    // The insert cast above works around stale generated table typings; restore
    // the known selected row shape at this boundary for TypeScript.
    const attempt = attemptData as unknown as { id: string } | null;
    if (attemptError || !attempt) {
      if (attemptError?.code === "23505") return fail("A PayPal checkout is already pending for this booking. Return to the existing checkout or contact support.", 409);
      console.error("Unable to reserve PayPal payment attempt:", attemptError);
      return fail("Unable to reserve this payment attempt. Please try again shortly.", 500);
    }
    attemptId = attempt.id;

    const token = await paypalAccessToken();
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ||
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "");
    if (!siteUrl.startsWith("https://")) throw new Error("Secure checkout return URL is not configured.");
    const response = await fetch(`${paypalBaseUrl()}/v2/checkout/orders`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "PayPal-Request-Id": randomUUID(),
      },
      body: JSON.stringify({
        intent: "CAPTURE",
        purchase_units: [{
          reference_id: booking.booking_reference,
          custom_id: bookingId,
          invoice_id: attemptReference,
          description: `ZuriStay reservation ${booking.booking_reference}`,
          amount: { currency_code: "USD", value: money(usdAmount) },
        }],
        payment_source: {
          paypal: { experience_context: {
            brand_name: "ZuriStay",
            user_action: "PAY_NOW",
            shipping_preference: "NO_SHIPPING",
            return_url: `${siteUrl}/booking/paypal-return`,
            cancel_url: `${siteUrl}/booking/paypal-return?cancelled=1`,
          }},
        },
      }),
      cache: "no-store",
    });
    const order = await response.json();
    if (!response.ok || typeof order.id !== "string") {
      console.error("PayPal order creation failed:", order);
      await db.from("payments").update({ status: "failed" }).eq("id", attemptId).eq("status", "pending");
      return fail("PayPal could not create the checkout. Please try again.", 502);
    }
    const approvalUrl = Array.isArray(order.links)
      ? order.links.find((link: { rel?: string; href?: string }) => link.rel === "approve" || link.rel === "payer-action")?.href
      : null;
    if (typeof approvalUrl !== "string" || !approvalUrl.startsWith("https://")) {
      console.error("PayPal response did not include an approval link.");
      await db.from("payments").update({ status: "failed" }).eq("id", attemptId).eq("status", "pending");
      return fail("PayPal did not return a secure approval link.", 502);
    }
    const { error: paymentUpdateError } = await db.from("payments")
      .update({ provider_reference: order.id })
      .eq("id", attemptId).eq("status", "pending");
    if (paymentUpdateError) {
      console.error("Unable to persist PayPal order reference:", paymentUpdateError);
      return fail("Checkout was created but could not be safely linked. Contact support before retrying.", 503);
    }
    const { error: sessionError } = await db.from("paypal_checkout_sessions").insert({
      booking_id: bookingId,
      order_id: order.id,
      guest_access_token_hash: booking.guest_access_token_hash,
      booking_amount_kes: kesAmount,
      paypal_amount_usd: usdAmount,
      usd_per_kes: fx.rate,
      exchange_rate_source: fx.source,
      status: "created",
      expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
    });
    if (sessionError) {
      console.error("Unable to persist PayPal checkout quote:", sessionError);
      await db.from("payments").update({ status: "failed" }).eq("id", attemptId).eq("status", "pending");
      return fail("PayPal checkout could not be safely recorded. Please contact support.", 503);
    }
    return NextResponse.json({
      success: true, approval_url: approvalUrl,
      quote: { booking_amount_kes: kesAmount, paypal_amount_usd: money(usdAmount), usd_per_kes: fx.rate, rate_updated_at: fx.updatedAt },
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("PayPal order creation error:", error);
    if (db && attemptId) {
      await db.from("payments").update({ status: "failed" }).eq("id", attemptId).eq("status", "pending");
    }
    return fail(error instanceof Error ? error.message : "PayPal checkout is temporarily unavailable.", 503);
  }
}
