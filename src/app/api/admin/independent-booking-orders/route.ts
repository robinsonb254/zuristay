import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

async function adminClient(req: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const auth = req.headers.get("authorization") || "";
  if (!url || !key || !auth.startsWith("Bearer ")) return null;

  const token = auth.slice(7).trim();
  if (!token) return null;
  const db = createClient(url, key, { auth: { persistSession: false } });
  const { data: { user }, error: authError } = await db.auth.getUser(token);
  if (authError || !user) return null;

  const { data: profile, error: profileError } = await db
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (profileError || profile?.role !== "admin") return null;
  return { db, user };
}

export async function GET(req: NextRequest) {
  const ctx = await adminClient(req);
  if (!ctx) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  const { data, error } = await ctx.db
    .from("independent_booking_orders")
    .select("*,independent_accommodations(name,city,county)")
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) return NextResponse.json({ success: false, error: "Unable to load reservations." }, { status: 500 });
  return NextResponse.json({ success: true, orders: data });
}

export async function PATCH(req: NextRequest) {
  const ctx = await adminClient(req);
  if (!ctx) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const allowed = [
    "awaiting_admin", "contacting_property", "property_confirmed", "property_paid",
    "confirmed", "unavailable", "refund_required", "refunded", "cancelled",
  ];
  if (
    !body ||
    typeof body !== "object" ||
    Array.isArray(body) ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(body.id || "")) ||
    !allowed.includes(body.fulfilment_status)
  ) {
    return NextResponse.json({ success: false, error: "Invalid reservation update." }, { status: 400 });
  }

  const update: Record<string, unknown> = {
    fulfilment_status: body.fulfilment_status,
    admin_assigned_to: ctx.user.id,
    updated_at: new Date().toISOString(),
  };
  if (typeof body.admin_notes === "string") update.admin_notes = body.admin_notes.slice(0, 3000);

  const { data: order, error } = await ctx.db
    .from("independent_booking_orders")
    .update(update)
    .eq("id", body.id)
    .select("id")
    .maybeSingle();
  if (error) return NextResponse.json({ success: false, error: "Unable to update reservation." }, { status: 500 });
  if (!order) return NextResponse.json({ success: false, error: "Reservation not found." }, { status: 404 });

  const { error: eventError } = await ctx.db.from("independent_booking_events").insert({
    order_id: order.id,
    actor_user_id: ctx.user.id,
    event_type: "admin_updated_reservation",
    details: { fulfilment_status: body.fulfilment_status },
  });
  if (eventError) console.error("Unable to record reservation status event", eventError);

  return NextResponse.json({ success: true });
}
