import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { hashPartnerAccessToken } from "@/lib/partner-access";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SECRET_KEY;
    if (!url || !key) return NextResponse.json({ success: false, message: "Partner registration is temporarily unavailable." }, { status: 500 });
    const body = await request.json();
    const fullName = typeof body.fullName === "string" ? body.fullName.trim() : "";
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const phone = typeof body.phone === "string" ? body.phone.trim() : "";
    const password = typeof body.password === "string" ? body.password : "";
    const token = typeof body.invitation === "string" ? body.invitation : "";
    if (!fullName || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || password.length < 8 || !token) {
      return NextResponse.json({ success: false, message: "Enter your name, approved email, password and valid invitation." }, { status: 400 });
    }
    const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: link, error: linkError } = await admin.from("partner_access_links")
      .select("id, application_id, email, first_redeemed_at, recovery_expires_at, user_id, registration_completed_at")
      .eq("first_token_hash", hashPartnerAccessToken(token)).eq("email", email)
      .not("first_redeemed_at", "is", null).maybeSingle();
    if (linkError) throw linkError;
    if (!link || link.recovery_expires_at && new Date(link.recovery_expires_at).getTime() < Date.now()) {
      return NextResponse.json({ success: false, message: "Your registration session is invalid or expired. Use the recovery link from your approval email." }, { status: 403 });
    }
    const { data: application, error: applicationError } = await admin.from("partner_applications")
      .select("id, email, status").eq("id", link.application_id).eq("email", email).eq("status", "approved").maybeSingle();
    if (applicationError || !application) return NextResponse.json({ success: false, message: "No approved partner application was found for this email address." }, { status: 403 });
    const { data: listedUsers, error: listError } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (listError) throw listError;
    const existing = listedUsers.users.find((user) => user.email?.toLowerCase() === email);
    if (existing) {
      const { error: linkUpdateError } = await admin.from("partner_access_links").update({ user_id: existing.id }).eq("id", link.id);
      if (linkUpdateError) throw linkUpdateError;
      return NextResponse.json({ success: false, existingAccount: true, message: "A ZuriStay account already exists for this email. Sign in with your existing password. Your password has not been changed." }, { status: 409 },);
    }
    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email, password, email_confirm: true,
      user_metadata: { full_name: fullName, phone },
    });
    if (createError) throw createError;
    const { error: linkUpdateError } = await admin.from("partner_access_links").update({
      user_id: created.user.id, registration_completed_at: new Date().toISOString(),
    }).eq("id", link.id).is("user_id", null);
    if (linkUpdateError) throw linkUpdateError;
    return NextResponse.json({ success: true, message: "Partner account created. You can now sign in." }, { status: 200, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Partner registration error:", error);
    return NextResponse.json({ success: false, message: error instanceof Error ? error.message : "Partner registration failed. Please try again." }, { status: 500 });
  }
}
