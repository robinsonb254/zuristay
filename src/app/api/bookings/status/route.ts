import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function response(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store, max-age=0" },
  });
}

export async function GET(request: NextRequest) {
  const bookingId = request.nextUrl.searchParams.get("booking_id");
  if (!bookingId || !UUID_PATTERN.test(bookingId)) {
    return response({ success: false, error: "Invalid booking reference." }, 400);
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  if (!supabaseUrl || !secretKey) {
    return response({ success: false, error: "Booking status is temporarily unavailable." }, 500);
  }

  try {
    const db = createClient(supabaseUrl, secretKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: booking, error } = await db
      .from("bookings")
      .select("id, booking_reference, booking_status, payment_status, total_amount, currency")
      .eq("id", bookingId)
      .maybeSingle();

    if (error || !booking) {
      console.error("Booking status lookup failed:", error);
      return response({ success: false, error: "Booking could not be found." }, 404);
    }

    const { data: holds, error: holdError } = await db
      .from("booking_holds")
      .select("id")
      .eq("booking_id", bookingId)
      .eq("status", "active")
      .gt("expires_at", new Date().toISOString())
      .limit(1);

    if (holdError) {
      console.error("Booking hold status lookup failed:", holdError);
      return response({ success: false, error: "Booking status is temporarily unavailable." }, 500);
    }

    return response({
      success: true,
      booking_reference: booking.booking_reference,
      booking_status: booking.booking_status,
      payment_status: booking.payment_status,
      total_amount: booking.total_amount,
      currency: booking.currency,
      hold_active: Boolean(holds?.length),
    });
  } catch (error) {
    console.error("Booking status API error:", error);
    return response({ success: false, error: "Booking status is temporarily unavailable." }, 500);
  }
}
