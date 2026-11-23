
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

function fail(message: string, status: number) {
  return NextResponse.json(
    { success: false, error: message },
    {
      status,
      headers: { "Cache-Control": "no-store" },
    }
  );
}

export async function GET(request: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const publishableKey =
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    const secretKey = process.env.SUPABASE_SECRET_KEY;

    if (!supabaseUrl || !publishableKey || !secretKey) {
      return fail("Application service configuration is incomplete.", 500);
    }

    const authorization = request.headers.get("authorization");

    if (!authorization?.startsWith("Bearer ")) {
      return fail("Please sign in first.", 401);
    }

    const accessToken = authorization.slice(7).trim();

    if (!accessToken) {
      return fail("Invalid authentication token.", 401);
    }

    const authClient = createClient(supabaseUrl, publishableKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });

    const {
      data: { user },
      error: authError,
    } = await authClient.auth.getUser(accessToken);

    if (authError || !user) {
      return fail("Your session is invalid or expired.", 401);
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
      return fail("Administrator permission is required.", 403);
    }

    const requestedStatus = request.nextUrl.searchParams.get("status");
    const allowedStatuses = ["pending", "approved", "rejected"];

    if (
      requestedStatus &&
      !allowedStatuses.includes(requestedStatus)
    ) {
      return fail("Invalid application status filter.", 400);
    }

    let query = admin
      .from("partner_applications")
      .select(
        "id, business_name, contact_person, email, phone, property_type, location, message, has_conference_rooms, status, applicant_user_id, created_at"
      )
      .order("created_at", { ascending: false })
      .limit(100);

    if (requestedStatus) {
      query = query.eq("status", requestedStatus);
    }

    const { data: applications, error: applicationsError } =
      await query;

    if (applicationsError) {
      console.error(
        "Admin application list error:",
        applicationsError
      );

      return fail("Unable to retrieve partner applications.", 500);
    }

    return NextResponse.json(
      {
        success: true,
        count: applications?.length || 0,
        applications: applications || [],
      },
      {
        status: 200,
        headers: { "Cache-Control": "no-store" },
      }
    );
  } catch (error) {
    console.error("Admin application list API error:", error);
    return fail("An unexpected error occurred.", 500);
  }
}
