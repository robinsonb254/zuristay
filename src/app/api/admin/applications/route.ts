
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

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

    // Verify the administrator's authenticated session.
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

    // The secret-key client bypasses RLS, so verify the admin role
    // explicitly before performing any administrative operation.
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

    // Load the application.
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

    // Rejection does not create a partner account.
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

      return respond(
        true,
        "Application rejected successfully.",
        200,
        { application: rejected }
      );
    }

    // Approval requires an existing registered account matching
    // the applicant's application email.
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

    let matchingUser:
      | {
          id: string;
          email?: string;
          email_confirmed_at?: string;
        }
      | undefined;

    // Search registered Supabase Auth users in pages.
    for (let page = 1; page <= 20; page++) {
      const { data, error: usersError } =
        await admin.auth.admin.listUsers({
          page,
          perPage: 1000,
        });

      if (usersError) {
        return respond(
          false,
          "Unable to verify the applicant's registered account.",
          500
        );
      }

      matchingUser = data.users.find(
        (candidate) =>
          candidate.email?.trim().toLowerCase() === email
      );

      if (matchingUser) break;
      if (data.users.length < 1000) break;
    }

    if (!matchingUser) {
      return respond(
        false,
        "No ZuriStay account matches this email. The applicant must register using the same email before approval.",
        409
      );
    }

    if (!matchingUser.email_confirmed_at) {
      return respond(
        false,
        "The applicant must verify their email address before approval.",
        409
      );
    }

    // Prevent duplicate partner accounts.
    const { data: existingPartner, error: partnerLookupError } =
      await admin
        .from("property_partners")
        .select("id, owner_user_id")
        .ilike("email", email)
        .limit(1)
        .maybeSingle();

    if (partnerLookupError) {
      return respond(
        false,
        "Unable to check existing partner accounts.",
        500
      );
    }

    if (existingPartner) {
      return respond(
        false,
        "A partner account already exists for this email. Please review it before proceeding.",
        409
      );
    }

    // Claim the pending application first. This prevents two
    // simultaneous approval requests from creating duplicate partners.
    const { data: claimedApplication, error: claimError } =
      await admin
        .from("partner_applications")
        .update({
          status: "approved",
          applicant_user_id: matchingUser.id,
        })
        .eq("id", applicationId)
        .eq("status", "pending")
        .select("id, business_name, status, applicant_user_id")
        .maybeSingle();

    if (claimError || !claimedApplication) {
      return respond(
        false,
        "The application could not be approved. It may already have been reviewed.",
        409
      );
    }

    // Create the partner account linked to the applicant's own
    // verified account. The existing administrator role is untouched.
    const { data: partner, error: createPartnerError } = await admin
      .from("property_partners")
      .insert({
        owner_user_id: matchingUser.id,
        business_name: application.business_name,
        contact_person: application.contact_person,
        email,
        phone: application.phone,
        status: "approved",
      })
      .select("id, business_name, owner_user_id, status")
      .single();

    if (createPartnerError || !partner) {
      // Restore the application to pending if partner creation fails.
      await admin
        .from("partner_applications")
        .update({
          status: "pending",
          applicant_user_id: application.applicant_user_id,
        })
        .eq("id", applicationId)
        .eq("status", "approved")
        .eq("applicant_user_id", matchingUser.id);

      return respond(
        false,
        "Partner account creation failed. The application has been returned to pending review.",
        500
      );
    }

    return respond(
      true,
      "Application approved and partner account created successfully.",
      200,
      {
        application: claimedApplication,
        partner,
      }
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
