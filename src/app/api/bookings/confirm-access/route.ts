import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { verifyBookingAccessToken } from "@/lib/bookings/access";

export const dynamic = "force-dynamic";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(request: NextRequest) {
  const { booking_id } = await request.json().catch(() => ({}));
  if (typeof booking_id !== "string" || !UUID.test(booking_id)) {
    return NextResponse.json({ success: false, error: "Invalid booking reference." }, { status: 400 });
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!url || !secret) return NextResponse.json({ success: false, error: "Booking confirmation is unavailable." }, { status: 500 });
  const db = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: booking, error } = await db.from("bookings")
    .select("id, payment_status, booking_status, guest_access_token_hash")
    .eq("id", booking_id).maybeSingle();
  if (error || !booking) return NextResponse.json({ success: false, error: "Booking not found." }, { status: 404 });
  if (!verifyBookingAccessToken(request.headers.get("x-booking-access-token"), booking.guest_access_token_hash)) {
    return NextResponse.json({ success: false, error: "Secure booking access is required." }, { status: 401 });
  }
  if (booking.payment_status !== "paid" || booking.booking_status !== "confirmed") {
    return NextResponse.json({ success: false, error: "The booking must be paid and confirmed first." }, { status: 409 });
  }
  const { data: items, error: itemsError } = await db.from("booking_items")
    .select("id, partner_room_secured_at, partner_guest_arrived_at, guest_room_access_confirmed_at")
    .eq("booking_id", booking_id);
  if (itemsError || !items?.length) return NextResponse.json({ success: false, error: "Booking accommodation details could not be verified." }, { status: 500 });
  if (items.some((item) => !item.partner_room_secured_at || !item.partner_guest_arrived_at)) {
    return NextResponse.json({ success: false, error: "The partner must confirm the room is secured and that you have arrived before you can confirm access." }, { status: 409 });
  }
  const { error: updateError } = await db.from("booking_items")
    .update({ guest_room_access_confirmed_at: new Date().toISOString() })
    .eq("booking_id", booking_id)
    .is("guest_room_access_confirmed_at", null);
  if (updateError) return NextResponse.json({ success: false, error: "Your room access confirmation could not be saved." }, { status: 500 });
  const { error: releaseError } = await db.rpc("release_eligible_partner_settlements");
  if (releaseError) {
    console.error("Settlement eligibility update failed:", releaseError);
    return NextResponse.json({ success: true, message: "Room access confirmed. Settlement eligibility is being updated." });
  }
  return NextResponse.json({ success: true, message: "Room access confirmed successfully." }, { headers: { "Cache-Control": "no-store" } });
}
