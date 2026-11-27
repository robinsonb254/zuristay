import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { hashPartnerAccessToken } from "@/lib/partner-access";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SECRET_KEY;
    if (!url || !key) return NextResponse.json({ success: false, message: "Partner access is temporarily unavailable." }, { status: 500 });
    const body = await request.json();
    const action = body?.action;
    const token = typeof body?.token === "string" ? body.token : "";
    const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
    if (!token || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ success: false, message: "Use the approved email address and the link supplied in your approval email." }, { status: 400 });
    }
    const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
    const tokenHash = hashPartnerAccessToken(token);
    if (action === "redeem") {
      const now = new Date();
      const recoveryExpiry = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      const { data, error } = await admin.from("partner_access_links")
        .update({ first_redeemed_at: now.toISOString(), recovery_expires_at: recoveryExpiry.toISOString() })
        .eq("first_token_hash", tokenHash).eq("email", email)
        .is("first_redeemed_at", null).gt("first_expires_at", now.toISOString())
        .select("id, application_id").maybeSingle();
      if (error) throw error;
      if (!data) return NextResponse.json({ success: false, message: "This Create account link is invalid, expired or has already been used. If you previously opened it, use the recovery link at the bottom of your approval email." }, { status: 403 });
      const { data: application, error: appError } = await admin.from("partner_applications").select("id").eq("id", data.application_id).eq("email", email).eq("status", "approved").maybeSingle();
      if (appError || !application) return NextResponse.json({ success: false, message: "The approved application could not be verified for this email." }, { status: 403 });
      return NextResponse.json({ success: true, state: "registration", email }, { headers: { "Cache-Control": "no-store" } });
    }
    if (action === "recover") {
      const now = new Date().toISOString();
      const { data: link, error } = await admin.from("partner_access_links")
        .select("id, application_id, email, first_redeemed_at, recovery_expires_at, user_id, registration_completed_at")
        .eq("recovery_token_hash", tokenHash).eq("email", email)
        .not("first_redeemed_at", "is", null).gt("recovery_expires_at", now).maybeSingle();
      if (error) throw error;
      if (!link) return NextResponse.json({ success: false, message: "This recovery link is not active, is expired, or does not belong to this approved email address." }, { status: 403 });
      const { data: application, error: appError } = await admin.from("partner_applications").select("id").eq("id", link.application_id).eq("email", email).eq("status", "approved").maybeSingle();
      if (appError || !application) return NextResponse.json({ success: false, message: "The approved application could not be verified." }, { status: 403 });
      return NextResponse.json({ success: true, state: link.user_id ? "signin" : "registration", email }, { headers: { "Cache-Control": "no-store" } });
    }
    return NextResponse.json({ success: false, message: "Unsupported partner access action." }, { status: 400 });
  } catch (error) {
    console.error("Partner access validation error:", error);
    return NextResponse.json({ success: false, message: "We could not validate this partner link. Please try again or contact ZuriStay support." }, { status: 500 });
  }
}
