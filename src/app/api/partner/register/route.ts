import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { verifyPartnerAccessToken } from "@/lib/partner-access";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SECRET_KEY;
    if (!url || !key) {
      return NextResponse.json({ success: false, message: "Partner registration is temporarily unavailable." }, { status: 500 });
    }

    const body = await request.json();
    const fullName = typeof body.fullName === "string" ? body.fullName.trim() : "";
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const phone = typeof body.phone === "string" ? body.phone.trim() : "";
    const password = typeof body.password === "string" ? body.password : "";
    const token = typeof body.token === "string" ? body.token : "";

    if (!fullName || !/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(email) || password.length < 8) {
      return NextResponse.json({ success: false, message: "Enter your name, a valid email address and a password of at least 8 characters." }, { status: 400 });
    }

    const access = verifyPartnerAccessToken(token, email);
    if (!access) {
      return NextResponse.json({ success: false, message: "This partner access link is invalid or has expired. Please contact ZuriStay for a fresh link." }, { status: 403 });
    }

    const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: application, error: applicationError } = await admin
      .from("partner_applications")
      .select("id, email, status")
      .eq("id", access.applicationId)
      .ilike("email", email)
      .eq("status", "approved")
      .maybeSingle();

    if (applicationError || !application) {
      return NextResponse.json({ success: false, message: "No approved partner application was found for this email address. Please use the email address on your approved application." }, { status: 403 });
    }

    const { data: listedUsers, error: listError } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (listError) throw listError;
    const existing = listedUsers.users.find((user) => user.email?.toLowerCase() === email);

    if (existing) {
      const { error: updateError } = await admin.auth.admin.updateUserById(existing.id, {
        password,
        email_confirm: true,
        user_metadata: { ...existing.user_metadata, full_name: fullName, phone },
      });
      if (updateError) throw updateError;
    } else {
      const { error: createError } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name: fullName, phone },
      });
      if (createError) throw createError;
    }

    return NextResponse.json({ success: true, message: "Partner account created. You can now sign in." }, { status: 200, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Partner registration error:", error);
    return NextResponse.json({ success: false, message: error instanceof Error ? error.message : "Partner registration failed. Please try again." }, { status: 500 });
  }
}
