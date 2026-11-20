import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { verifyBookingAccessToken } from "@/lib/bookings/access";
import { getCardPaymentProvider } from "@/lib/payments/card-gateway";

export const dynamic = "force-dynamic";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function reply(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store, max-age=0" },
  });
}

/**
 * Reconcile a customer return independently of webhook delivery. The booking
 * access token is required and Flutterwave is queried server-side by tx_ref.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    const bookingId = body?.booking_id;
    const transactionReference = body?.tx_ref;
    if (typeof bookingId !== "string" || !UUID_PATTERN.test(bookingId)) {
      return reply({ success: false, error: "Invalid booking reference." }, 400);
    }
    if (transactionReference !== undefined &&
      (typeof transactionReference !== "string" || !UUID_PATTERN.test(transactionReference))) {
      return reply({ success: false, error: "Invalid card transaction reference." }, 400);
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const secretKey = process.env.SUPABASE_SECRET_KEY;
    if (!supabaseUrl || !secretKey) {
      return reply({ success: false, error: "Payment service configuration is incomplete." }, 500);
    }

    const db = createClient(supabaseUrl, secretKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: booking, error: bookingError } = await db
      .from("bookings")
      .select("id, booking_status, payment_status, guest_access_token_hash")
      .eq("id", bookingId)
      .maybeSingle();

    if (bookingError || !booking) {
      return reply({ success: false, error: "Booking could not be found." }, 404);
    }

    if (!verifyBookingAccessToken(
      request.headers.get("x-booking-access-token"),
      booking.guest_access_token_hash
    )) {
      return reply({ success: false, error: "Secure booking access is required." }, 401);
    }

    if (booking.payment_status === "paid" && booking.booking_status === "confirmed") {
      return reply({ success: true, status: "succeeded", already_confirmed: true });
    }

    const provider = getCardPaymentProvider();
    if (!provider) {
      return reply({ success: false, error: "Card payment verification is not configured." }, 503);
    }

    let attemptQuery = db
      .from("payments")
      .select("id, amount, currency, status")
      .eq("booking_id", bookingId)
      .eq("payment_method", "card")
      .like("provider_reference", "CARD-INIT-%");

    // Flutterwave returns the merchant tx_ref. Match it to this booking's
    // payment row when present, rather than accidentally verifying a newer
    // checkout if the guest has multiple checkout tabs open.
    if (transactionReference) {
      attemptQuery = attemptQuery.eq("id", transactionReference);
    } else {
      attemptQuery = attemptQuery.order("created_at", { ascending: false }).limit(1);
    }

    const { data: attempt, error: attemptError } = await attemptQuery.maybeSingle();

    if (attemptError || !attempt) {
      return reply({ success: false, error: "Card payment attempt could not be found." }, 404);
    }

    const { data: session, error: sessionError } = await db
      .from("card_payment_sessions")
      .select("id, provider, provider_session_id, status")
      .eq("payment_id", attempt.id)
      .maybeSingle();

    if (sessionError || !session || session.provider !== provider.name || !session.provider_session_id) {
      return reply({ success: false, error: "Card checkout session could not be matched." }, 404);
    }

    if (session.status === "completed") {
      return reply({ success: true, status: "succeeded", already_confirmed: true });
    }

    const event = await provider.verifyTransactionReference(session.provider_session_id);
    if (
      event.providerSessionId !== session.provider_session_id ||
      !Number.isFinite(event.amount) ||
      event.amount <= 0 ||
      !/^[A-Z]{3}$/.test(event.currency) ||
      Number(attempt.amount) !== event.amount ||
      String(attempt.currency).toUpperCase() !== event.currency
    ) {
      return reply({ success: false, error: "Verified payment details did not match this booking." }, 400);
    }

    if (event.status === "pending") {
      return reply({ success: true, status: "pending" });
    }

    if (event.status === "failed") {
      const [{ error: paymentUpdateError }, { error: sessionUpdateError }] = await Promise.all([
        db.from("payments").update({ status: "failed" }).eq("id", attempt.id).eq("status", "pending"),
        db.from("card_payment_sessions").update({ status: "failed" }).eq("id", session.id).neq("status", "completed"),
      ]);
      if (paymentUpdateError || sessionUpdateError) {
        console.error("Unable to record failed card return verification:", { paymentUpdateError, sessionUpdateError });
        return reply({ success: false, error: "Payment result could not be recorded." }, 500);
      }
      return reply({ success: true, status: "failed" });
    }

    if (!event.providerReference) {
      return reply({ success: false, error: "Verified transaction reference is missing." }, 400);
    }

    const { data: confirmed, error: confirmError } = await db.rpc("confirm_booking_payment", {
      p_booking_id: bookingId,
      p_payment_method: "card",
      p_provider_reference: event.providerReference,
      p_amount: event.amount,
      p_currency: event.currency,
    });

    if (confirmError || !confirmed?.success) {
      console.error("Verified card return could not be applied:", confirmError);
      return reply({ success: false, error: "Verified payment is awaiting reconciliation." }, 500);
    }

    const [{ error: attemptUpdateError }, { error: sessionUpdateError }] = await Promise.all([
      db.from("payments").update({ status: "failed" }).eq("id", attempt.id).eq("status", "pending"),
      db.from("card_payment_sessions").update({ status: "completed" }).eq("id", session.id),
    ]);

    if (attemptUpdateError || sessionUpdateError) {
      console.error("Card return payment confirmed but audit update failed:", { attemptUpdateError, sessionUpdateError });
      return reply({ success: false, error: "Payment was verified but its checkout record needs reconciliation." }, 500);
    }

    return reply({ success: true, status: "succeeded", booking_confirmed: true });
  } catch (error) {
    console.error("Card payment return verification error:", error);
    return reply({ success: false, error: "Card payment verification is temporarily unavailable." }, 503);
  }
}
