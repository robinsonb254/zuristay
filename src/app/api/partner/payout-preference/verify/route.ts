import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

function fail(message: string, status: number) {
  return NextResponse.json({ success: false, error: message }, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export async function POST(request: NextRequest) {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    const secretKey = process.env.SUPABASE_SECRET_KEY;
    const intasendKey = process.env.INTASEND_SECRET_KEY;
    if (!url || !publishableKey || !secretKey) return fail("Partner service configuration is incomplete.", 500);
    if (!intasendKey) return fail("Payout verification is not configured yet. ZuriStay will enable it once the payout provider is connected.", 503);

    const authorization = request.headers.get("authorization");
    if (!authorization?.startsWith("Bearer ")) return fail("Please sign in to continue.", 401);
    const auth = createClient(url, publishableKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: { user }, error: authError } = await auth.auth.getUser(authorization.slice(7).trim());
    if (authError || !user) return fail("Your session has expired. Please sign in again.", 401);

    const db = createClient(url, secretKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: partner, error: partnerError } = await db.from("property_partners")
      .select("id").eq("owner_user_id", user.id).eq("status", "approved").maybeSingle();
    if (partnerError || !partner) return fail("An approved partner account is required.", partnerError ? 500 : 403);

    const { data: payout, error: payoutError } = await db.from("partner_payout_accounts")
      .select("payout_method, account_holder_name, mpesa_phone, merchant_type, merchant_number, bank_code, bank_account_number")
      .eq("partner_id", partner.id).maybeSingle();
    if (payoutError || !payout) return fail("Save your payout preference before verifying it.", 400);

    let provider = "";
    const body: Record<string, string> = {};
    if (payout.payout_method === "mpesa") {
      provider = "MPESA-B2C";
      body.account = payout.mpesa_phone;
    } else if (payout.payout_method === "till_paybill") {
      provider = "MPESA-B2B";
      body.account = payout.merchant_number;
      body.account_type = payout.merchant_type === "paybill" ? "PayBill" : "TillNumber";
    } else if (payout.payout_method === "bank") {
      provider = "PESALINK";
      body.account = payout.bank_account_number;
      body.bank_code = payout.bank_code;
    } else {
      return fail("Unsupported payout method.", 400);
    }

    const response = await fetch("https://api.intasend.com/api/v1/send-money/validate-accounts/", {
      method: "POST",
      headers: { Authorization: `Bearer ${intasendKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ provider, ...body }),
      cache: "no-store",
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      console.error("IntaSend payout account validation failed:", result);
      return fail("The payout provider could not verify these details. Check them and try again.", 502);
    }

    const providerName = typeof result.name === "string" ? result.name.trim() : "";
    const normalized = (value: string) => value.toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (!providerName) return fail("The payout provider did not return a registered account name. Please contact support.", 422);
    if (normalized(providerName) !== normalized(payout.account_holder_name)) {
      await db.from("partner_payout_accounts").update({
        verification_status: "pending",
        provider_account_name: providerName,
        verified_at: null,
      }).eq("partner_id", partner.id);
      return NextResponse.json({
        success: false,
        error: "The registered account name does not match the account holder name you entered. Update the name to match the provider's record.",
        provider_account_name: providerName,
      }, { status: 409, headers: { "Cache-Control": "no-store" } });
    }

    const { data: updated, error: updateError } = await db.from("partner_payout_accounts").update({
      verification_status: "verified",
      provider_account_name: providerName,
      verified_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq("partner_id", partner.id).select("payout_method, verification_status, provider_account_name, verified_at").single();

    if (updateError || !updated) {
      console.error("Payout verification status update failed:", updateError);
      return fail("The account was checked but its verification status could not be saved. Please retry.", 500);
    }

    return NextResponse.json({ success: true, message: "Your payout destination has been verified.", payout: updated }, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error("Partner payout verification failed:", error);
    return fail("An unexpected error occurred while verifying the payout destination.", 500);
  }
}
