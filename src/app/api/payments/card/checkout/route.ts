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

    const now = Date.now();
    const { data: pendingAttempts, error: pendingAttemptError } = await db
      .from("payments")
      .select("id")
      .eq("booking_id", bookingId)
      .eq("payment_method", "card")
      .eq("status", "pending");

    if (pendingAttemptError) {
      console.error("Unable to inspect pending card attempts:", pendingAttemptError);
      return reply("Unable to check the previous card checkout. Please try again shortly.", 500);
    }

    const pendingPaymentIds = (pendingAttempts ?? []).map((attempt) => attempt.id);
    const { data: pendingSessions, error: pendingSessionError } = pendingPaymentIds.length
      ? await db
          .from("card_payment_sessions")
          .select("id, payment_id, expires_at")
          .in("payment_id", pendingPaymentIds)
      : { data: [], error: null };

    if (pendingSessionError) {
      console.error("Unable to inspect pending card sessions:", pendingSessionError);
      return reply("Unable to check the previous card checkout. Please try again shortly.", 500);
    }

    const { data: activeHolds, error: holdError } = await db
      .from("booking_holds")
      .select("expires_at")
      .eq("booking_id", bookingId)
      .eq("status", "active")
      .limit(1);

    if (holdError) {
      console.error("Unable to inspect booking hold:", holdError);
      return reply("Unable to verify your room hold. Please try again shortly.", 500);
    }

    const holdExpiry = activeHolds?.[0]?.expires_at
      ? new Date(activeHolds[0].expires_at).getTime()
      : Number.NaN;
    const holdIsExpired = !Number.isFinite(holdExpiry) || holdExpiry <= now;
    const expiredSessions = (pendingSessions ?? []).filter((session) =>
      holdIsExpired || (session.expires_at && new Date(session.expires_at).getTime() <= now)
    );

    if (expiredSessions.length) {
      const expiredSessionIds = expiredSessions.map((session) => session.id);
      const expiredPaymentIds = expiredSessions.map((session) => session.payment_id);
      const [{ error: expirePaymentError }, { error: expireSessionError }] = await Promise.all([
        db.from("payments").update({ status: "failed" }).in("id", expiredPaymentIds).eq("status", "pending"),
        db.from("card_payment_sessions").update({ status: "expired" }).in("id", expiredSessionIds).neq("status", "completed"),
      ]);
      if (expirePaymentError || expireSessionError) {
        console.error("Unable to release expired card checkout attempts:", { expirePaymentError, expireSessionError });
        return reply("An expired card checkout needs reconciliation. Please try again shortly.", 500);
      }
    }

    if (holdIsExpired) {
      // A booking without a live inventory hold cannot be paid. Release any
      // pending initiation rows, including attempts whose provider session
      // could not be recorded, so they do not leave a stale uniqueness lock.
      if (pendingPaymentIds.length) {
        const { error: releaseError } = await db
          .from("payments")
          .update({ status: "failed" })
          .in("id", pendingPaymentIds)
          .eq("status", "pending");
        if (releaseError) {
          console.error("Unable to release card attempts after hold expiry:", releaseError);
          return reply("The expired card checkout needs reconciliation. Please try again shortly.", 500);
        }
      }
      return reply("Your room hold has expired. Please create a new booking.", 409);
    }

    // Never create a provider checkout that can outlive the inventory hold.
    // Flutterwave accepts a duration in minutes, so round down and reject a
    // hold with less than one full minute remaining.
    const remainingHoldSeconds = Math.floor((holdExpiry - now) / 1000);
    if (remainingHoldSeconds < 60) {
      return reply("Your room hold is almost over. Please create a new booking before paying.", 409);
    }
    const sessionDurationMinutes = Math.min(30, Math.floor(remainingHoldSeconds / 60));

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
        returnUrl: `${siteUrl.replace(/\/$/, "")}/booking/payment/return?booking_id=${encodeURIComponent(booking.id)}&reference=${encodeURIComponent(booking.booking_reference)}`,
        sessionDurationMinutes,
      });

      if (
        typeof session.providerSessionId !== "string" ||
        !session.providerSessionId.trim() ||
        typeof session.checkoutUrl !== "string" ||
        !session.checkoutUrl.startsWith("https://")
      ) {
        throw new Error("Card provider returned an invalid hosted checkout session.");
      }

      const { error: sessionError } = await db.from("card_payment_sessions").insert({
        payment_id: payment.id,
        provider: provider.name,
        provider_session_id: session.providerSessionId,
        checkout_url: session.checkoutUrl,
        status: "created",
        // Keep a durable expiry even if the provider omits one. The value
        // is capped at the inventory hold so a stale attempt can be released.
        expires_at: session.expiresAt
          ? new Date(Math.min(new Date(session.expiresAt).getTime(), holdExpiry)).toISOString()
          : new Date(Math.min(Date.now() + sessionDurationMinutes * 60_000, holdExpiry)).toISOString(),
        metadata: session.metadata ?? {},
      });

      if (sessionError) {
        console.error("Card provider created a session but it could not be recorded:", sessionError);
        // The checkout URL is not returned to the browser unless its session
        // reference is durable. Release the pending-attempt constraint so the
        // guest is not permanently blocked by an unreachable provider session.
        const { error: releaseError } = await db
          .from("payments")
          .update({ status: "failed" })
          .eq("id", payment.id)
          .eq("status", "pending");
        if (releaseError) {
          console.error("Unable to release unrecorded card payment attempt:", releaseError);
        }
        return reply("The secure checkout session could not be recorded. Please try again or use M-Pesa.", 503);
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
