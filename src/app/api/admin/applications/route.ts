
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

    let matchingUser:
      | {
          id: string;
          email?: string;
          email_confirmed_at?: string;
        }
      | undefined;

    // Prefer the account explicitly linked to the application. This avoids
    // paging through the entire Auth user directory for normal applications.
    if (application.applicant_user_id) {
      const { data, error: applicantLookupError } =
        await admin.auth.admin.getUserById(application.applicant_user_id);

      if (applicantLookupError) {
        console.error("Linked applicant lookup error:", applicantLookupError);
        return respond(
          false,
          "Unable to verify the account linked to this application.",
          500
        );
      }

      matchingUser = data.user
        ? {
            id: data.user.id,
            email: data.user.email,
            email_confirmed_at: data.user.email_confirmed_at,
          }
        : undefined;

      if (!matchingUser) {
        return respond(
          false,
          "The account linked to this application no longer exists. Ask the applicant to submit a new application after registering.",
          409
        );
      }

      if (matchingUser.email?.trim().toLowerCase() !== email) {
        return respond(
          false,
          "The application email does not match the linked ZuriStay account. Ask the applicant to correct and resubmit the application.",
          409
        );
      }
    } else {
      // Legacy or guest-submitted applications may not have an account ID.
      // Retain email matching for these records until they are resubmitted.
      for (let page = 1; page <= 20; page++) {
        const { data, error: usersError } =
          await admin.auth.admin.listUsers({
            page,
            perPage: 1000,
          });

        if (usersError) {
          console.error("Applicant lookup error:", usersError);
          return respond(
            false,
            "Unable to verify the applicant's registered account.",
            500
          );
        }

        matchingUser = data.users.find(
          (candidate) => candidate.email?.trim().toLowerCase() === email
        );

        if (matchingUser) break;
        if (data.users.length < 1000) break;
      }
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

    const { data: approvalResult, error: approvalError } =
      await admin.rpc("approve_partner_application", {
        p_application_id: applicationId,
        p_owner_user_id: matchingUser.id,
        p_admin_user_id: user.id,
      });

    if (approvalError) {
      console.error(
        "Partner approval transaction failed:",
        approvalError
      );

      return respond(
        false,
        "Approval could not be completed. Check the applicant's account, email verification and existing partner records.",
        409
      );
    }

    return respond(
      true,
      "Application approved and partner account created successfully.",
      200,
      { result: approvalResult }
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
