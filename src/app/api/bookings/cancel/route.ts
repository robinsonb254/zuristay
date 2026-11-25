import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { hashBookingAccessToken, verifyBookingAccessToken } from "@/lib/bookings/access";

export const dynamic = "force-dynamic";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    const bookingId = body?.booking_id;
    const reason = typeof body?.reason === "string" ? body.reason.trim() : "";
    if (typeof bookingId !== "string" || !UUID.test(bookingId) || reason.length < 5 || reason.length > 2000) {
      return NextResponse.json({ success: false, error: "Provide a valid booking and cancellation reason." }, { status: 400 });
    }
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const secret = process.env.SUPABASE_SECRET_KEY;
    if (!url || !secret) return NextResponse.json({ success: false, error: "Cancellation service is unavailable." }, { status: 500 });
    const token = request.headers.get("x-booking-access-token");
    if (!token) return NextResponse.json({ success: false, error: "Secure booking access is required." }, { status: 401 });
    const db = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
    const { data: booking, error: lookupError } = await db.from("bookings")
      .select("id, guest_access_token_hash")
      .eq("id", bookingId).maybeSingle();
    if (lookupError || !booking || !verifyBookingAccessToken(token, booking.guest_access_token_hash)) {
      return NextResponse.json({ success: false, error: "Booking not found or secure access is invalid." }, { status: 404 });
    }
    const { data, error } = await db.rpc("submit_booking_cancellation_request", {
      p_booking_id: bookingId,
      p_guest_access_token_hash: hashBookingAccessToken(token),
      p_reason: reason,
    });
    if (error) {
      console.error("Cancellation request failed:", error);
      return NextResponse.json({ success: false, error: error.message || "Unable to submit cancellation request." }, { status: 409 });
    }
    return NextResponse.json({ success: true, result: data }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Cancellation request API error:", error);
    return NextResponse.json({ success: false, error: "An unexpected error occurred." }, { status: 500 });
  }
}
