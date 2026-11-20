import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { verifyBookingAccessToken } from "@/lib/bookings/access";
import { getCardPaymentProvider } from "@/lib/payments/card-gateway";

export const dynamic = "force-dynamic";

function reply(message: string, status: number) {
  return NextResponse.json(
    { success: false, error: message },
    { status, headers: { "Cache-Control": "no-store" } }
  );
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    const bookingId = body?.booking_id;
    if (
      typeof bookingId !== "string" ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(bookingId)
    ) {
      return reply("Invalid booking reference.", 400);
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const secretKey = process.env.SUPABASE_SECRET_KEY;
    if (!supabaseUrl || !secretKey) return reply("Payment service configuration is incomplete.", 500);

    const db = createClient(supabaseUrl, secretKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: booking, error: bookingError } = await db
      .from("bookings")
      .select("id, booking_reference, guest_name, guest_email, total_amount, currency, booking_status, payment_status, guest_access_token_hash")
      .eq("id", bookingId)
      .maybeSingle();

    if (bookingError || !booking) return reply("Booking could not be found.", 404);
    if (!verifyBookingAccessToken(request.headers.get("x-booking-access-token"), booking.guest_access_token_hash)) {
      return reply("Secure booking access is required before payment can be started.", 401);
    }
    if (booking.booking_status !== "pending" || !["unpaid", "pending"].includes(booking.payment_status)) {
      return reply("This booking is no longer awaiting payment.", 409);
    }

    const { data: activeHolds, error: holdError } = await db
      .from("booking_holds")
      .select("expires_at")
      .eq("booking_id", bookingId)
      .eq("status", "active")
      .gt("expires_at", new Date().toISOString())
      .limit(1);

    if (holdError || !activeHolds?.length) {
      return reply("Your room hold has expired. Please create a new booking.", 409);
    }

    const amount = Number(booking.total_amount);
    const currency = String(booking.currency || "").toUpperCase();
    if (!Number.isFinite(amount) || amount <= 0 || !/^[A-Z]{3}$/.test(currency)) {
      return reply("This booking total cannot be processed. Please contact support.", 400);
    }

    // No provider is registered until ZuriStay completes merchant onboarding.
    // This guard prevents creating a fake or uncollectable payment attempt.
    const provider = getCardPaymentProvider();
    if (!provider) {
      return reply("Card checkout is being prepared. Please use M-Pesa until card payments are activated.", 503);
    }

    const attemptReference = `CARD-INIT-${randomUUID()}`;
    const { data: payment, error: paymentError } = await db
      .from("payments")
      .insert({
        booking_id: bookingId,
        payment_method: "card",
        provider_reference: attemptReference,
        amount,
        currency,
        status: "pending",
      })
      .select("id")
      .single();

    if (paymentError || !payment) {
      if (paymentError?.code === "23505") {
        return reply("A card payment session is already pending for this booking. Check its status before trying again.", 409);
      }
      console.error("Unable to reserve card payment attempt:", paymentError);
      return reply("Unable to safely reserve this card payment. Please try again shortly.", 500);
    }

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || (
      process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : ""
    );
    if (!siteUrl.startsWith("https://")) {
      await db.from("payments").update({ status: "failed" }).eq("id", payment.id).eq("status", "pending");
      return reply("The secure checkout return URL is not configured.", 500);
    }

    try {
      const session = await provider.createCheckoutSession({
        amount,
        currency,
        bookingReference: booking.booking_reference,
        customerName: booking.guest_name,
        customerEmail: booking.guest_email,
        idempotencyKey: payment.id,
        returnUrl: `${siteUrl.replace(/\/$/, "")}/booking/payment/return?reference=${encodeURIComponent(booking.booking_reference)}`,
      });

      const { error: sessionError } = await db.from("card_payment_sessions").insert({
        payment_id: payment.id,
        provider: provider.name,
        provider_session_id: session.providerSessionId,
        checkout_url: session.checkoutUrl,
        status: "created",
        expires_at: session.expiresAt ?? null,
        metadata: session.metadata ?? {},
      });

      if (sessionError) {
        console.error("Card provider created a session but it could not be recorded:", sessionError);
        return reply("The secure checkout session could not be recorded. Contact ZuriStay support before retrying.", 503);
      }

      return NextResponse.json({
        success: true,
        checkout_url: session.checkoutUrl,
        expires_at: session.expiresAt ?? null,
        booking_reference: booking.booking_reference,
      }, { headers: { "Cache-Control": "no-store" } });
    } catch (providerError) {
      console.error("Card checkout session creation failed:", providerError);
      await db.from("payments").update({ status: "failed" }).eq("id", payment.id).eq("status", "pending");
      return reply("The card provider could not start checkout. Please try again or use M-Pesa.", 502);
    }
  } catch (error) {
    console.error("Card checkout endpoint error:", error);
    return reply("Card checkout is temporarily unavailable.", 503);
  }
}
