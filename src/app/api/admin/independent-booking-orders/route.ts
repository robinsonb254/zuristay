import { NextRequest,NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
export const dynamic="force-dynamic";
async function adminClient(req:NextRequest){
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL;const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
 const auth=req.headers.get("authorization")||"";
 if(!url||!key||!auth.startsWith("Bearer "))return null;
 const db=createClient(url,key,{auth:{persistSession:false}});
 const {data:{user}}=await db.auth.getUser(auth.slice(7));if(!user)return null;
 const {data:profile}=await db.from("profiles").select("role").eq("id",user.id).maybeSingle();
 return profile?.role==="admin"?{db,user}:null;
}
export async function GET(req:NextRequest){
 const ctx=await adminClient(req);if(!ctx)return NextResponse.json({success:false,error:"Unauthorized"},{status:401});
 const {data,error}=await ctx.db.from("independent_booking_orders").select("*,independent_accommodations(name,city,county)").order("created_at",{ascending:false}).limit(200);
 if(error)return NextResponse.json({success:false,error:"Unable to load reservations."},{status:500});
 return NextResponse.json({success:true,orders:data});
}
export async function PATCH(req:NextRequest){
 const ctx=await adminClient(req);if(!ctx)return NextResponse.json({success:false,error:"Unauthorized"},{status:401});
 const body=await req.json().catch(()=>null);const allowed=["awaiting_admin","contacting_property","property_confirmed","property_paid","confirmed","unavailable","refund_required","refunded","cancelled"];
 if(!body?.id||!allowed.includes(body?.fulfilment_status))return NextResponse.json({success:false,error:"Invalid reservation update."},{status:400});
 const {error}=await ctx.db.from("independent_booking_orders").update({fulfilment_status:body.fulfilment_status,admin_notes:String(body.admin_notes||"").slice(0,3000),admin_assigned_to:ctx.user.id,updated_at:new Date().toISOString()}).eq("id",body.id);
 if(error)return NextResponse.json({success:false,error:"Unable to update reservation."},{status:500});
 await ctx.db.from("independent_booking_events").insert({order_id:body.id,actor_user_id:ctx.user.id,event_type:"admin_updated_reservation",details:{fulfilment_status:body.fulfilment_status}});
 return NextResponse.json({success:true});
}
