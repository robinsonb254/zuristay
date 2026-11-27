
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendPartnerApplicationDecision } from "@/lib/email";
import { createPartnerAccessTokens, hashPartnerAccessToken } from "@/lib/partner-access";

export const dynamic = "force-dynamic";

function respond(
  success: boolean,
  message: string,
  status: number,
  extra: Record<string, unknown> = {}
) {
  return NextResponse.json(
    { success, message, ...extra },
    {
      status,
      headers: { "Cache-Control": "no-store" },
    }
  );
}

export async function POST(request: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const publishableKey =
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    const secretKey = process.env.SUPABASE_SECRET_KEY;

    if (!supabaseUrl || !publishableKey || !secretKey) {
      return respond(
        false,
        "Administrator service configuration is incomplete.",
        500
      );
    }

    const authorization = request.headers.get("authorization");

    if (!authorization?.startsWith("Bearer ")) {
      return respond(false, "Please sign in first.", 401);
    }

    const accessToken = authorization.slice(7).trim();

    if (!accessToken) {
      return respond(false, "Invalid authentication token.", 401);
    }

    const authClient = createClient(
      supabaseUrl,
      publishableKey,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
        },
      }
    );

    const {
      data: { user },
      error: authError,
    } = await authClient.auth.getUser(accessToken);

    if (authError || !user) {
      return respond(
        false,
        "Your session is invalid or expired. Please sign in again.",
        401
      );
    }

    const admin = createClient(supabaseUrl, secretKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });

    const { data: profile, error: profileError } = await admin
      .from("profiles")
      .select("id, role")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError || !profile || profile.role !== "admin") {
      return respond(
        false,
        "Administrator permission is required.",
        403
      );
    }

    let body: unknown;

    try {
      body = await request.json();
    } catch {
      return respond(false, "Invalid request body.", 400);
    }

    if (
      !body ||
      typeof body !== "object" ||
      Array.isArray(body)
    ) {
      return respond(false, "Invalid application request.", 400);
    }

    const input = body as Record<string, unknown>;
    const { applicationId, action } = input;

    const uuidPattern =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

    if (
      typeof applicationId !== "string" ||
      !uuidPattern.test(applicationId)
    ) {
      return respond(false, "Invalid application ID.", 400);
    }

    if (action !== "approve" && action !== "reject") {
      return respond(
        false,
        "Choose either approve or reject.",
        400
      );
    }

    const { data: application, error: applicationError } =
      await admin
        .from("partner_applications")
        .select(
          "id, business_name, contact_person, email, phone, status, applicant_user_id"
        )
        .eq("id", applicationId)
        .maybeSingle();

    if (applicationError) {
      return respond(
        false,
        "Unable to retrieve the application.",
        500
      );
    }

    if (!application) {
      return respond(false, "Application not found.", 404);
    }

    if (application.status !== "pending") {
      return respond(
        false,
        "This application has already been reviewed.",
        409
      );
    }

    if (action === "reject") {
      const { data: rejected, error: rejectError } = await admin
        .from("partner_applications")
        .update({ status: "rejected" })
        .eq("id", applicationId)
        .eq("status", "pending")
        .select("id, business_name, status")
        .maybeSingle();

      if (rejectError) {
        return respond(
          false,
          "Unable to reject this application.",
          500
        );
      }

      if (!rejected) {
        return respond(
          false,
          "The application was already updated. Refresh and try again.",
          409
        );
      }
      try {
        await sendPartnerApplicationDecision({
          email: application.email,
          contactPerson: application.contact_person,
          businessName: application.business_name,
          approved: false,
        });
      } catch (mailError) {
        console.error("Partner rejection notification failed:", mailError);
      }

      return respond(
        true,
        "Application rejected successfully.",
        200,
        { application: rejected }
      );
    }

    const email = String(application.email || "")
      .trim()
      .toLowerCase();

    if (!email) {
      return respond(
        false,
        "The application does not contain a valid email address.",
        400
      );
    }

    const { data: approvedApplication, error: approvalError } = await admin
      .from("partner_applications")
      .update({ status: "approved" })
      .eq("id", applicationId)
      .eq("status", "pending")
      .select("id, business_name, status")
      .maybeSingle();

    if (approvalError || !approvedApplication) {
      console.error("Partner application approval update failed:", approvalError);
      return respond(
        false,
        "Approval could not be completed. The application remains unchanged; please refresh and try again.",
        409
      );
    }

    let notificationSent = true;
    try {
      const { firstToken, recoveryToken } = createPartnerAccessTokens();
      const { error: linkError } = await admin.from("partner_access_links").insert({
        application_id: applicationId,
        email,
        first_token_hash: hashPartnerAccessToken(firstToken),
        recovery_token_hash: hashPartnerAccessToken(recoveryToken),
        first_expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      });
      if (linkError) throw linkError;
      const base = "https://www.zuristayworldwide.com/register?mode=partner";
      await sendPartnerApplicationDecision({
        email: application.email,
        contactPerson: application.contact_person,
        businessName: application.business_name,
        approved: true,
        partnerAccessUrl: base + "&token=" + encodeURIComponent(firstToken) + "&next=%2Fpartner%2Fdashboard",
        partnerRecoveryUrl: base + "&recovery=" + encodeURIComponent(recoveryToken) + "&next=%2Fpartner%2Fdashboard",
      });
    } catch (mailError) {
      notificationSent = false;
      console.error("Partner approval notification failed:", mailError);
    }

    return respond(
      true,
      notificationSent
        ? "Application approved. The applicant can now create or sign in to their ZuriStay account."
        : "Application approved, but the notification email could not be delivered. Please contact the applicant using the application details.",
      200,
      { result: approvedApplication, notificationSent }
    );
  } catch (error) {
    console.error("Admin application API error:", error);

    return respond(
      false,
      "An unexpected error occurred while processing the application.",
      500
    );
  }
}
