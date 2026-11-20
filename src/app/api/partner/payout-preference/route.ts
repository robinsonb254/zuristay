import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

function fail(message: string, status: number) {
  return NextResponse.json({ success: false, error: message }, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

async function getPartner(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  if (!url || !publishableKey || !secretKey) {
    return { response: fail("Partner service configuration is incomplete.", 500) };
  }

  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) {
    return { response: fail("Please sign in to continue.", 401) };
  }

  const auth = createClient(url, publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const { data: { user }, error: authError } = await auth.auth.getUser(authorization.slice(7).trim());
  if (authError || !user) {
    return { response: fail("Your session has expired. Please sign in again.", 401) };
  }

  const admin = createClient(url, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const { data: partner, error } = await admin
    .from("property_partners")
    .select("id")
    .eq("owner_user_id", user.id)
    .eq("status", "approved")
    .maybeSingle();

  if (error) {
    console.error("Payout partner lookup failed:", error);
    return { response: fail("Unable to verify your partner account.", 500) };
  }
  if (!partner) return { response: fail("An approved partner account is required.", 403) };
  return { admin, partner };
}

export async function GET(request: NextRequest) {
  try {
    const context = await getPartner(request);
    if ("response" in context) return context.response;

    const { data, error } = await context.admin
      .from("partner_payout_accounts")
      .select("payout_method, account_holder_name, mpesa_phone, merchant_type, merchant_number, merchant_account_number, bank_name, bank_code, bank_branch, bank_account_name, bank_account_number, provider_account_name, verification_status, verified_at, updated_at")
      .eq("partner_id", context.partner.id)
      .maybeSingle();

    if (error) {
      console.error("Payout preference lookup failed:", error);
      return fail("Unable to load your payout preference.", 500);
    }
    return NextResponse.json({ success: true, payout: data }, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error("Payout preference GET failed:", error);
    return fail("An unexpected error occurred.", 500);
  }
}

export async function PUT(request: NextRequest) {
  try {
    const context = await getPartner(request);
    if ("response" in context) return context.response;

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return fail("Please provide valid payout details.", 400);
    }

    const method = body.payout_method;
    const holder = typeof body.account_holder_name === "string" ? body.account_holder_name.trim() : "";
    if (!["mpesa", "till_paybill", "bank"].includes(method) || holder.length < 2 || holder.length > 120) {
      return fail("Choose a payout method and enter the account holder's full name.", 400);
    }

    const values: Record<string, unknown> = {
      partner_id: context.partner.id,
      payout_method: method,
      account_holder_name: holder,
      mpesa_phone: null,
      merchant_type: null,
      merchant_number: null,
      merchant_account_number: null,
      bank_name: null,
      bank_code: null,
      bank_branch: null,
      bank_account_name: null,
      bank_account_number: null,
      provider_account_name: null,
      verification_status: "pending",
      verified_at: null,
      updated_at: new Date().toISOString(),
    };

    if (method === "mpesa") {
      const raw = typeof body.mpesa_phone === "string" ? body.mpesa_phone.replace(/\s+/g, "") : "";
      const digits = raw.replace(/[^0-9]/g, "");
      const normalized = /^0[17][0-9]{8}$/.test(digits) ? "254" + digits.slice(1)
        : /^254[17][0-9]{8}$/.test(digits) ? digits
        : /^[17][0-9]{8}$/.test(digits) ? "254" + digits : "";
      if (!normalized) return fail("Enter a valid Kenyan M-Pesa phone number.", 400);
      values.mpesa_phone = normalized;
    } else if (method === "till_paybill") {
      const type = body.merchant_type;
      const number = typeof body.merchant_number === "string" ? body.merchant_number.trim() : "";
      const account = typeof body.merchant_account_number === "string" ? body.merchant_account_number.trim() : "";
      if (!["till", "paybill"].includes(type) || !/^\d{5,8}$/.test(number)) {
        return fail("Choose Till or Paybill and enter a valid business number.", 400);
      }
      if (type === "paybill" && (account.length < 1 || account.length > 40)) {
        return fail("Enter the Paybill account number.", 400);
      }
      values.merchant_type = type;
      values.merchant_number = number;
      values.merchant_account_number = type === "paybill" ? account : null;
    } else {
      const bank = typeof body.bank_name === "string" ? body.bank_name.trim() : "";
      const accountName = holder;
      const accountNumber = typeof body.bank_account_number === "string" ? body.bank_account_number.trim().replace(/\s+/g, "") : "";
      const bankCode = typeof body.bank_code === "string" ? body.bank_code.trim() : "";
      const branch = typeof body.bank_branch === "string" ? body.bank_branch.trim() : "";
      if (bank.length < 2 || bank.length > 100 || !/^\\d{1,8}$/.test(bankCode) || accountName.length < 2 || accountName.length > 120 || !/^[A-Za-z0-9-]{4,34}$/.test(accountNumber) || branch.length > 100) {
        return fail("Enter valid bank, account name and account number details.", 400);
      }
      values.bank_name = bank;
      values.bank_code = bankCode;
      values.bank_account_name = accountName;
      values.bank_account_number = accountNumber;
      values.bank_branch = branch || null;
    }

    const { data, error } = await context.admin
      .from("partner_payout_accounts")
      .upsert(values, { onConflict: "partner_id" })
      .select("payout_method, account_holder_name, mpesa_phone, merchant_type, merchant_number, merchant_account_number, bank_name, bank_code, bank_branch, bank_account_name, bank_account_number, provider_account_name, verification_status, verified_at, updated_at")
      .single();

    if (error || !data) {
      console.error("Payout preference save failed:", error);
      return fail("Unable to save your payout details. Please try again.", 500);
    }

    return NextResponse.json({
      success: true,
      message: "Payout preference saved. The destination must be verified before automated transfers can be enabled.",
      payout: data,
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Payout preference PUT failed:", error);
    return fail("An unexpected error occurred.", 500);
  }
}
