import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  getMpesaAccessToken,
  getMpesaConfig,
  normalizeKenyanPhone,
  queryMpesaStk,
  safeTokenMatch,
} from "@/lib/payments/mpesa";

export const dynamic = "force-dynamic";

type CallbackItem = { Name?: string; Value?: string | number };

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ token: string }> }
) {
  try {
    const { token: providedToken } = await context.params;
    const config = getMpesaConfig();
    if (!safeTokenMatch(providedToken, config.callbackToken)) {
      return NextResponse.json({ ResultCode: 1, ResultDesc: "Rejected" }, { status: 404 });
    }

    const payload = await request.json();
    const callback = payload?.Body?.stkCallback;
    const checkoutId = callback?.CheckoutRequestID;
    if (typeof checkoutId !== "string" || !checkoutId) {
      return NextResponse.json({ ResultCode: 0, ResultDesc: "Accepted" });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const secretKey = process.env.SUPABASE_SECRET_KEY;
    if (!supabaseUrl || !secretKey) throw new Error("Payment service configuration is incomplete.");

    const db = createClient(supabaseUrl, secretKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // Persist every valid provider callback before processing it. If a later
    // database/provider step fails, the original event remains available for
    // reconciliation instead of being lost after acknowledging Safaricom.
    const { error: eventInsertError } = await db
      .from("mpesa_callback_events")
      .upsert({
        checkout_request_id: checkoutId,
        callback_payload: payload,
      }, { onConflict: "checkout_request_id", ignoreDuplicates: true });

    if (eventInsertError) {
      console.error("Unable to persist M-Pesa callback event:", eventInsertError);
      return NextResponse.json(
        { ResultCode: 1, ResultDesc: "Callback could not be safely recorded" },
        { status: 500 }
      );
    }

    const { data: callbackEvent, error: eventLookupError } = await db
      .from("mpesa_callback_events")
      .select("id, processing_status, processing_attempts")
      .eq("checkout_request_id", checkoutId)
      .maybeSingle();

    if (eventLookupError || !callbackEvent) {
      console.error("Unable to load persisted M-Pesa callback event:", eventLookupError);
      return NextResponse.json({ ResultCode: 1, ResultDesc: "Callback event unavailable" }, { status: 500 });
    }

    // Atomically claim the event. Concurrent Safaricom retries cannot
    // process the same checkout simultaneously; stale claims can be recovered.
    const { data: claimed, error: claimError } = await db.rpc(
      "claim_mpesa_callback_event",
      { p_event_id: callbackEvent.id }
    );

    if (claimError) {
      console.error("Unable to claim M-Pesa callback event:", claimError);
      return NextResponse.json(
        { ResultCode: 1, ResultDesc: "Callback processing is temporarily unavailable" },
        { status: 500 }
      );
    }

    if (claimed !== true) {
      return NextResponse.json({
        ResultCode: 0,
        ResultDesc: callbackEvent.processing_status === "processed"
          ? "Already processed"
          : "Callback is already being processed",
      });
    }

    const markForReview = async (reason: string) => {
      await db.from("mpesa_callback_events").update({
        processing_status: "needs_review",
        last_error: reason.slice(0, 1000),
      }).eq("id", callbackEvent.id);
    };

    const { data: pendingPayment, error: paymentLookupError } = await db
      .from("payments")
      .select("id, booking_id, amount, currency, status")
      .eq("payment_method", "mpesa")
      .eq("provider_reference", checkoutId)
      .maybeSingle();

    if (paymentLookupError || !pendingPayment) {
      console.error("Unknown M-Pesa checkout callback:", paymentLookupError);
      await markForReview("No matching pending payment record was found.");
      return NextResponse.json({ ResultCode: 0, ResultDesc: "Accepted for reconciliation" });
    }

    if (pendingPayment.status !== "pending") {
      return NextResponse.json({ ResultCode: 0, ResultDesc: "Already processed" });
    }

    const { data: booking, error: bookingError } = await db
      .from("bookings")
      .select("guest_phone, currency")
      .eq("id", pendingPayment.booking_id)
      .maybeSingle();

    if (bookingError || !booking || String(booking.currency).toUpperCase() !== "KES") {
      console.error("M-Pesa callback booking validation failed:", bookingError);
      await markForReview("Booking could not be validated or currency was not KES.");
      return NextResponse.json({ ResultCode: 0, ResultDesc: "Accepted for review" });
    }

    if (Number(callback.ResultCode) !== 0) {
      await db.from("payments").update({ status: "failed" }).eq("id", pendingPayment.id).eq("status", "pending");
      await db.from("mpesa_callback_events").update({
        processing_status: "processed",
        processed_at: new Date().toISOString(),
        last_error: null,
      }).eq("id", callbackEvent.id);
      return NextResponse.json({ ResultCode: 0, ResultDesc: "Accepted" });
    }

    // Never trust the callback payload alone. Confirm the STK request directly with Daraja.
    const accessToken = await getMpesaAccessToken(config);
    const query = await queryMpesaStk(config, accessToken, checkoutId);
    if (String(query.ResultCode) !== "0") {
      await markForReview("Daraja STK query did not confirm successful payment.");
      return NextResponse.json({ ResultCode: 0, ResultDesc: "Awaiting provider verification" });
    }

    const items: CallbackItem[] = callback.CallbackMetadata?.Item ?? [];
    const read = (name: string) => items.find((item) => item.Name === name)?.Value;
    const receipt = read("MpesaReceiptNumber");
    const amount = Number(read("Amount"));
    const transactionPhone = String(read("PhoneNumber") ?? "");
    const transactionDate = read("TransactionDate");

    if (typeof receipt !== "string" || !receipt ||
        !Number.isFinite(amount) || amount !== Number(pendingPayment.amount) ||
        !transactionPhone || !transactionDate ||
        normalizeKenyanPhone(transactionPhone) !== normalizeKenyanPhone(booking.guest_phone)) {
      console.error("M-Pesa callback details failed validation:", { checkoutId, amount });
      await markForReview("M-Pesa receipt, amount, phone, or transaction date did not pass validation.");
      return NextResponse.json({ ResultCode: 0, ResultDesc: "Accepted for review" });
    }

    const { data: confirmed, error: confirmError } = await db.rpc("confirm_booking_payment", {
      p_booking_id: pendingPayment.booking_id,
      p_payment_method: "mpesa",
      p_provider_reference: receipt,
      p_amount: amount,
      p_currency: "KES",
    });

    if (confirmError || !confirmed?.success) {
      console.error("M-Pesa booking confirmation failed:", confirmError);
      await markForReview("Verified provider payment could not be applied to the booking.");
      return NextResponse.json({ ResultCode: 0, ResultDesc: "Accepted for reconciliation" });
    }

    // confirm_booking_payment records the verified receipt as the successful
    // payment row. Remove the temporary CheckoutRequestID row to avoid
    // counting the same transaction twice.
    const { error: cleanupError } = await db
      .from("payments")
      .delete()
      .eq("id", pendingPayment.id)
      .eq("status", "pending");

    if (cleanupError) {
      console.error("Verified M-Pesa payment recorded, but temporary row cleanup failed:", cleanupError);
    }

    await db.from("mpesa_callback_events").update({
      processing_status: "processed",
      processed_at: new Date().toISOString(),
      last_error: null,
    }).eq("id", callbackEvent.id);

    return NextResponse.json({ ResultCode: 0, ResultDesc: "Accepted" });
  } catch (error) {
    console.error("M-Pesa callback error:", error);
    // A persisted event remains available for retry/reconciliation.
    return NextResponse.json({ ResultCode: 1, ResultDesc: "Callback processing failed" }, { status: 500 });
  }
}
