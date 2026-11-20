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
    if (!safeTokenMatch(decodeURIComponent(providedToken), config.callbackToken)) {
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

    const { data: pendingPayment, error: paymentLookupError } = await db
      .from("payments")
      .select("id, booking_id, amount, currency, status")
      .eq("payment_method", "mpesa")
      .eq("provider_reference", checkoutId)
      .maybeSingle();

    if (paymentLookupError || !pendingPayment) {
      console.error("Unknown M-Pesa checkout callback:", paymentLookupError);
      return NextResponse.json({ ResultCode: 0, ResultDesc: "Accepted" });
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
      return NextResponse.json({ ResultCode: 0, ResultDesc: "Accepted for review" });
    }

    if (Number(callback.ResultCode) !== 0) {
      await db.from("payments").update({ status: "failed" }).eq("id", pendingPayment.id).eq("status", "pending");
      return NextResponse.json({ ResultCode: 0, ResultDesc: "Accepted" });
    }

    // Never trust the callback payload alone. Confirm the STK request directly with Daraja.
    const accessToken = await getMpesaAccessToken(config);
    const query = await queryMpesaStk(config, accessToken, checkoutId);
    if (String(query.ResultCode) !== "0") {
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
      return NextResponse.json({ ResultCode: 0, ResultDesc: "Accepted for reconciliation" });
    }

    await db.from("payments")
      .update({ status: "successful", verified_at: new Date().toISOString() })
      .eq("id", pendingPayment.id)
      .eq("status", "pending");

    return NextResponse.json({ ResultCode: 0, ResultDesc: "Accepted" });
  } catch (error) {
    console.error("M-Pesa callback error:", error);
    // Acknowledge provider callbacks; unresolved transactions must be reconciled server-side.
    return NextResponse.json({ ResultCode: 0, ResultDesc: "Received" });
  }
}
