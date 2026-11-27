import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "crypto";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return NextResponse.json({ success:false, error:"Reservations are temporarily unavailable." }, { status:503 });
  const body = await request.json().catch(() => null);
  const name = String(body?.guest_name || "").trim().slice(0,120);
  const email = String(body?.guest_email || "").trim().slice(0,180);
  const phone = String(body?.guest_phone || "").trim().slice(0,40);
  const checkIn = String(body?.check_in || "");
  const checkOut = String(body?.check_out || "");
  const guests = Number(body?.guests || 1);
  const rooms = Number(body?.rooms || 1);
  const accommodationId = String(body?.accommodation_id || "");
  if (!name || !/^\S+@\S+\.\S+$/.test(email) || !phone || !accommodationId || !/^\d{4}-\d{2}-\d{2}$/.test(checkIn) || !/^\d{4}-\d{2}-\d{2}$/.test(checkOut) || !Number.isInteger(guests) || guests<1 || guests>30 || !Number.isInteger(rooms) || rooms<1 || rooms>10 || checkOut<=checkIn) {
    return NextResponse.json({ success:false, error:"Please complete the reservation details." }, { status:400 });
  }
  const db=createClient(url,serviceKey,{auth:{persistSession:false}});
  const {data:stay,error:stayError}=await db.from("independent_accommodations").select("id,name,city,county,currency,published_base_rate,booking_enabled,listing_status").eq("id",accommodationId).eq("listing_status","published").maybeSingle();
  if(stayError || !stay) return NextResponse.json({success:false,error:"This accommodation is not available."},{status:404});
  if(!stay.booking_enabled) return NextResponse.json({success:false,error:"Reservations are not open for this accommodation."},{status:409});
  const nights=Math.max(1,Math.round((Date.parse(checkOut+"T00:00:00Z")-Date.parse(checkIn+"T00:00:00Z"))/86400000));
  const base=stay.published_base_rate===null?0:Number(stay.published_base_rate)*nights*rooms;
  const markup=Math.ceil(base*0.15);
  const reference="ZSI-"+randomUUID().replaceAll("-","").slice(0,10).toUpperCase();
  const {data:order,error}=await db.from("independent_booking_orders").insert({
    order_reference:reference,accommodation_id:stay.id,guest_name:name,guest_email:email,guest_phone:phone,
    check_in:checkIn,check_out:checkOut,guests,rooms,currency:stay.currency||"KES",
    property_base_amount:base,markup_rate:0.15,markup_amount:markup,guest_total:base+markup,
    payment_status:"unpaid",fulfilment_status:"awaiting_admin",
    property_contact_snapshot:null
  }).select("id,order_reference").single();
  if(error) return NextResponse.json({success:false,error:"Your reservation could not be submitted. Please try again."},{status:500});
  await db.from("independent_booking_events").insert({order_id:order.id,event_type:"reservation_requested",details:{property_name:stay.name,city:stay.city,county:stay.county,nights,rooms,guests,rate_pending:stay.published_base_rate===null}});
  return NextResponse.json({success:true,reference:order.order_reference,price_pending:stay.published_base_rate===null});
}
