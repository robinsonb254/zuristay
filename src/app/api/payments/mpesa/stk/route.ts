import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  darajaPassword,
  darajaTimestamp,
  getMpesaAccessToken,
  getMpesaConfig,
  normalizeKenyanPhone,
} from "@/lib/payments/mpesa";

export const dynamic = "force-dynamic";

function reply(message: string, status: number) {
  return NextResponse.json({ success: false, error: message }, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    const bookingId = body?.booking_id;
    if (typeof bookingId !== "string" ||
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(bookingId)) {
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
      .select("id, booking_reference, guest_phone, total_amount, currency, booking_status, payment_status")
      .eq("id", bookingId)
      .maybeSingle();

    if (bookingError || !booking) return reply("Booking could not be found.", 404);
    if (booking.booking_status !== "pending" || !["unpaid", "pending"].includes(booking.payment_status)) {
      return reply("This booking is no longer awaiting payment.", 409);
    }
    if (String(booking.currency).toUpperCase() !== "KES") {
      return reply("M-Pesa payments are currently available for Kenyan shilling bookings only.", 400);
    }

    const { data: activeHolds, error: holdError } = await db
      .from("booking_holds")
      .select("expires_at")
      .eq("booking_id", bookingId)
      .eq("status", "active")
      .gt("expires_at", new Date().toISOString())
      .limit(1);
    if (holdError || !activeHolds?.length) return reply("Your room hold has expired. Please create a new booking.", 409);

    const amount = Number(booking.total_amount);
    if (!Number.isSafeInteger(amount) || amount < 1) {
      return reply("This booking total cannot be charged through M-Pesa. Please contact support.", 400);
    }

    const phone = normalizeKenyanPhone(
      typeof body.phone === "string" && body.phone.trim()
        ? body.phone
        : booking.guest_phone
    );

    const config = getMpesaConfig();
    const token = await getMpesaAccessToken(config);
    const timestamp = darajaTimestamp();
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || (
      process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : ""
    );
    if (!siteUrl || !siteUrl.startsWith("https://")) {
      return reply("The secure payment callback URL is not configured.", 500);
    }

    const callbackUrl = `${siteUrl.replace(/\/$/, "")}/api/payments/mpesa/callback/${encodeURIComponent(config.callbackToken)}`;
    const response = await fetch(`${config.baseUrl}/mpesa/stkpush/v1/processrequest`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        BusinessShortCode: config.shortcode,
        Password: darajaPassword(config.shortcode, config.passkey, timestamp),
        Timestamp: timestamp,
        TransactionType: "CustomerPayBillOnline",
        Amount: amount,
        PartyA: phone,
        PartyB: config.shortcode,
        PhoneNumber: phone,
        CallBackURL: callbackUrl,
        AccountReference: booking.booking_reference.slice(0, 12),
        TransactionDesc: `ZuriStay ${booking.booking_reference}`.slice(0, 30),
      }),
      cache: "no-store",
    });

    const result = await response.json();
    if (!response.ok || result.ResponseCode !== "0" || !result.CheckoutRequestID) {
      console.error("Daraja STK initiation failed:", result);
      return reply(result.CustomerMessage || "M-Pesa could not start the payment. Please try again.", 502);
    }

    const { error: paymentError } = await db.from("payments").insert({
      booking_id: bookingId,
      payment_method: "mpesa",
      provider_reference: String(result.CheckoutRequestID),
      amount,
      currency: "KES",
      status: "pending",
    });

    if (paymentError) {
      console.error("Unable to record M-Pesa request:", paymentError);
      return reply("Payment was initiated but could not be recorded. Contact ZuriStay support before retrying.", 500);
    }

    return NextResponse.json({
      success: true,
      message: result.CustomerMessage || "M-Pesa prompt sent. Enter your PIN to complete payment.",
      checkout_request_id: result.CheckoutRequestID,
      booking_reference: booking.booking_reference,
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("M-Pesa STK endpoint error:", error);
    return reply(error instanceof Error ? error.message : "Unable to start M-Pesa payment.", 400);
  }
}
