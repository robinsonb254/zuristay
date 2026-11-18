
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function errorResponse(message: string, status: number) {
  return NextResponse.json(
    { success: false, error: message },
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
      return errorResponse(
        "Booking service configuration is incomplete.",
        500
      );
    }

    const authorization = request.headers.get("authorization");

    if (!authorization?.startsWith("Bearer ")) {
      return errorResponse("Please sign in to make a booking.", 401);
    }

    const accessToken = authorization.slice(7).trim();

    if (!accessToken) {
      return errorResponse("Invalid authentication token.", 401);
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
      return errorResponse(
        "Your session is invalid or expired. Please sign in again.",
        401
      );
    }

    let body: unknown;

    try {
      body = await request.json();
    } catch {
      return errorResponse("Invalid request body.", 400);
    }

    if (
      !body ||
      typeof body !== "object" ||
      Array.isArray(body)
    ) {
      return errorResponse("Invalid booking information.", 400);
    }

    const input = body as Record<string, unknown>;

    const {
      unit_id,
      check_in,
      check_out,
      quantity,
      guests,
      guest_name,
      guest_email,
      guest_phone,
      idempotency_key,
      special_requests,
    } = input;

    if (
      typeof unit_id !== "string" ||
      !UUID_PATTERN.test(unit_id) ||
      typeof idempotency_key !== "string" ||
      !UUID_PATTERN.test(idempotency_key)
    ) {
      return errorResponse(
        "Invalid accommodation or booking request identifier.",
        400
      );
    }

    if (
      typeof check_in !== "string" ||
      !DATE_PATTERN.test(check_in) ||
      typeof check_out !== "string" ||
      !DATE_PATTERN.test(check_out)
    ) {
      return errorResponse("Please provide valid travel dates.", 400);
    }

    if (
      !Number.isInteger(quantity) ||
      (quantity as number) < 1 ||
      (quantity as number) > 10 ||
      !Number.isInteger(guests) ||
      (guests as number) < 1 ||
      (guests as number) > 20
    ) {
      return errorResponse(
        "Please provide valid room and guest quantities.",
        400
      );
    }

    if (
      typeof guest_name !== "string" ||
      !guest_name.trim() ||
      guest_name.length > 150 ||
      typeof guest_email !== "string" ||
      !guest_email.trim() ||
      guest_email.length > 254 ||
      typeof guest_phone !== "string" ||
      !guest_phone.trim() ||
      guest_phone.length > 40
    ) {
      return errorResponse(
        "Please provide valid guest contact details.",
        400
      );
    }

    if (
      special_requests !== undefined &&
      special_requests !== null &&
      (typeof special_requests !== "string" ||
        special_requests.length > 2000)
    ) {
      return errorResponse(
        "Special requests cannot exceed 2000 characters.",
        400
      );
    }

    const supabaseAdmin = createClient(
      supabaseUrl,
      secretKey,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
        },
      }
    );

    const { data, error } = await supabaseAdmin.rpc(
      "create_booking_hold",
      {
        p_unit_id: unit_id,
        p_check_in: check_in,
        p_check_out: check_out,
        p_quantity: quantity,
        p_guests: guests,
        p_guest_name: guest_name.trim(),
        p_guest_email: guest_email.trim().toLowerCase(),
        p_guest_phone: guest_phone.trim(),
        p_idempotency_key: idempotency_key,
        p_customer_user_id: user.id,
        p_special_requests:
          typeof special_requests === "string"
            ? special_requests.trim() || null
            : null,
      }
    );

    if (error) {
      return errorResponse(error.message, 400);
    }

    const booking = data as Record<string, unknown> | null;

    if (!booking || booking.success !== true) {
      return errorResponse(
        "The booking could not be created.",
        500
      );
    }

    const replay = booking.idempotent_replay === true;

    return NextResponse.json(
      {
        success: true,
        booking,
      },
      {
        status: replay ? 200 : 201,
        headers: { "Cache-Control": "no-store" },
      }
    );
  } catch (error) {
    console.error("Booking API error:", error);

    return errorResponse(
      "An unexpected error occurred while processing your booking.",
      500
    );
  }
}
