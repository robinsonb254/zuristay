import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const fail = (error: string, status = 400) => NextResponse.json({ success: false, error }, { status, headers: { "Cache-Control": "no-store" } });

async function context(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publicKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const secret = process.env.SUPABASE_SECRET_KEY;
  const auth = request.headers.get("authorization");
  if (!url || !publicKey || !secret) return { error: fail("Partner service is unavailable.", 500) };
  if (!auth?.startsWith("Bearer ")) return { error: fail("Please sign in to continue.", 401) };
  const authClient = createClient(url, publicKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: { user }, error } = await authClient.auth.getUser(auth.slice(7));
  if (error || !user) return { error: fail("Your session has expired.", 401) };
  const db = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: partner, error: partnerError } = await db.from("property_partners").select("id").eq("owner_user_id", user.id).eq("status", "approved").maybeSingle();
  if (partnerError || !partner) return { error: fail("An approved partner account is required.", 403) };
  return { db, partner };
}

export async function GET(request: NextRequest) {
  const auth = await context(request);
  if ("error" in auth) return auth.error;
  const { data, error } = await auth.db.from("booking_items")
    .select("id, booking_id, partner_room_secured_at, partner_guest_arrived_at, guest_room_access_confirmed_at, bookings!inner(booking_reference, guest_name, guest_email, check_in, check_out, payment_status, booking_status)")
    .eq("partner_id", auth.partner.id)
    .order("created_at", { ascending: false });
  if (error) {
    console.error("Partner confirmation list failed:", error);
    return fail("Unable to load booking confirmations.", 500);
  }
  return NextResponse.json({ success: true, items: (data || []).filter((item: any) => item.bookings?.payment_status === "paid") }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: NextRequest) {
  const auth = await context(request);
  if ("error" in auth) return auth.error;
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object" || !UUID.test(body.booking_item_id || "") || !["room_secured", "guest_arrived"].includes(body.action)) {
    return fail("Choose a valid booking confirmation.");
  }
  const { data: item, error } = await auth.db.from("booking_items")
    .select("id, booking_id, partner_room_secured_at, partner_guest_arrived_at, partner_id, bookings!inner(payment_status, booking_status)")
    .eq("id", body.booking_item_id).eq("partner_id", auth.partner.id).maybeSingle();
  if (error || !item) return fail("This booking was not found in your partner account.", 404);
  const booking = Array.isArray(item.bookings) ? item.bookings[0] : item.bookings;
  if (booking?.payment_status !== "paid" || booking?.booking_status !== "confirmed") return fail("Only paid and confirmed bookings can be acknowledged.", 409);
  const column = body.action === "room_secured" ? "partner_room_secured_at" : "partner_guest_arrived_at";
  if (body.action === "guest_arrived" && !item.partner_room_secured_at) return fail("Confirm that the room is secured before confirming guest arrival.", 409);
  const { error: updateError } = await auth.db.from("booking_items").update({ [column]: new Date().toISOString() }).eq("id", item.id).eq("partner_id", auth.partner.id);
  if (updateError) return fail("The confirmation could not be saved.", 500);
  return NextResponse.json({ success: true, message: body.action === "room_secured" ? "Room readiness confirmed." : "Guest arrival confirmed." }, { headers: { "Cache-Control": "no-store" } });
}
