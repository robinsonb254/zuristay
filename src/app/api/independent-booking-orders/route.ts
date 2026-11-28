import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "crypto";

export const dynamic = "force-dynamic";

function isValidDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function kenyaToday() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Nairobi",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const part = (type: string) => parts.find((item) => item.type === type)?.value || "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export async function POST(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    return NextResponse.json({ success: false, error: "Reservations are temporarily unavailable." }, { status: 503 });
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ success: false, error: "Please complete the reservation details." }, { status: 400 });
  }

  const name = String(body.guest_name || "").trim().slice(0, 120);
  const email = String(body.guest_email || "").trim().toLowerCase().slice(0, 180);
  const phone = String(body.guest_phone || "").trim().slice(0, 40);
  const checkIn = String(body.check_in || "");
  const checkOut = String(body.check_out || "");
  const guests = Number(body.guests ?? 1);
  const rooms = Number(body.rooms ?? 1);
  const accommodationId = String(body.accommodation_id || "");

  if (
    !name ||
    !/^\S+@\S+\.\S+$/.test(email) ||
    !phone ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(accommodationId) ||
    !isValidDate(checkIn) ||
    !isValidDate(checkOut) ||
    checkIn < kenyaToday() ||
    checkOut <= checkIn ||
    !Number.isInteger(guests) || guests < 1 || guests > 30 ||
    !Number.isInteger(rooms) || rooms < 1 || rooms > 10
  ) {
    return NextResponse.json({ success: false, error: "Please enter valid guest details and future check-in/check-out dates." }, { status: 400 });
  }

  const db = createClient(url, serviceKey, { auth: { persistSession: false } });
  const { data: stay, error: stayError } = await db
    .from("independent_accommodations")
    .select("id,name,city,county,currency,published_base_rate,booking_enabled,listing_status")
    .eq("id", accommodationId)
    .eq("listing_status", "published")
    .maybeSingle();

  if (stayError || !stay) {
    return NextResponse.json({ success: false, error: "This accommodation is not available." }, { status: 404 });
  }
  if (!stay.booking_enabled) {
    return NextResponse.json({ success: false, error: "Reservations are not open for this accommodation." }, { status: 409 });
  }

  const nights = Math.round((Date.parse(`${checkOut}T00:00:00.000Z`) - Date.parse(`${checkIn}T00:00:00.000Z`)) / 86_400_000);
  const nightlyRate = stay.published_base_rate === null ? null : Number(stay.published_base_rate);
  if (nightlyRate !== null && (!Number.isFinite(nightlyRate) || nightlyRate < 0)) {
    return NextResponse.json({ success: false, error: "The accommodation rate needs administrator review." }, { status: 409 });
  }
  const base = nightlyRate === null ? 0 : nightlyRate * nights * rooms;
  const markup = Math.ceil(base * 0.15);
  const reference = "ZSI-" + randomUUID().replaceAll("-", "").slice(0, 10).toUpperCase();

  const { data: order, error } = await db.from("independent_booking_orders").insert({
    order_reference: reference,
    accommodation_id: stay.id,
    guest_name: name,
    guest_email: email,
    guest_phone: phone,
    check_in: checkIn,
    check_out: checkOut,
    guests,
    rooms,
    currency: stay.currency || "KES",
    property_base_amount: base,
    markup_rate: 0.15,
    markup_amount: markup,
    guest_total: base + markup,
    payment_status: "unpaid",
    fulfilment_status: "awaiting_admin",
    property_contact_snapshot: null,
  }).select("id,order_reference").single();

  if (error || !order) {
    return NextResponse.json({ success: false, error: "Your reservation could not be submitted. Please try again." }, { status: 500 });
  }

  const { error: eventError } = await db.from("independent_booking_events").insert({
    order_id: order.id,
    event_type: "reservation_requested",
    details: {
      property_name: stay.name,
      city: stay.city,
      county: stay.county,
      nights,
      rooms,
      guests,
      rate_pending: nightlyRate === null,
    },
  });
  if (eventError) {
    console.error("Unable to record independent reservation event", eventError);
  }

  return NextResponse.json({
    success: true,
    reference: order.order_reference,
    price_pending: nightlyRate === null,
  });
}
