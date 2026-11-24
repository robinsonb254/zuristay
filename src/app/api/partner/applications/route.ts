import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendPartnerApplicationAcknowledgement } from "@/lib/email";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function fail(message: string, status: number) {
  return NextResponse.json({ success: false, error: message }, { status, headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object" || Array.isArray(body)) return fail("Please provide valid application details.", 400);
    const input = body as Record<string, unknown>;
    if (typeof input.website === "string" && input.website.trim()) {
      return NextResponse.json({ success: true, message: "Application received." }, { status: 201 });
    }
    const businessName = typeof input.businessName === "string" ? input.businessName.trim() : "";
    const contactPerson = typeof input.contactPerson === "string" ? input.contactPerson.trim() : "";
    const email = typeof input.email === "string" ? input.email.trim().toLowerCase() : "";
    const phone = typeof input.phone === "string" ? input.phone.trim() : "";
    const propertyType = typeof input.propertyType === "string" ? input.propertyType.trim() : "";
    const location = typeof input.location === "string" ? input.location.trim() : "";
    const message = typeof input.message === "string" ? input.message.trim() : "";
    if (businessName.length < 2 || businessName.length > 150) return fail("Enter a valid business or property name.", 400);
    if (contactPerson.length < 2 || contactPerson.length > 120) return fail("Enter a valid contact person's name.", 400);
    if (!EMAIL.test(email) || email.length > 254) return fail("Enter a valid email address.", 400);
    if (phone.length < 5 || phone.length > 30) return fail("Enter a valid phone number.", 400);
    if (!location || location.length > 200) return fail("Enter a valid property location.", 400);
    if (propertyType.length > 80 || message.length > 1500) return fail("Some application details are too long.", 400);

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const secret = process.env.SUPABASE_SECRET_KEY;
    if (!url || !secret) return fail("Partner application service is not configured.", 500);
    const db = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: application, error } = await db.from("partner_applications").insert({
      business_name: businessName,
      contact_person: contactPerson,
      email,
      phone,
      property_type: propertyType || null,
      location,
      message: message || null,
      has_conference_rooms: input.hasConferenceRooms === true,
      status: "pending",
      acknowledgement_status: "pending",
    }).select("id").single();
    if (error || !application) {
      console.error("Partner application insert failed:", error);
      return fail("We could not submit your application right now. Please try again.", 500);
    }

    const { data: claimed } = await db.from("partner_applications")
      .update({ acknowledgement_status: "sending", acknowledgement_attempts: 1, acknowledgement_error: null })
      .eq("id", application.id).eq("acknowledgement_status", "pending").select("id").maybeSingle();
    if (claimed) {
      try {
        await sendPartnerApplicationAcknowledgement({ email, contactPerson, businessName });
        await db.from("partner_applications").update({
          acknowledgement_status: "sent",
          acknowledgement_sent_at: new Date().toISOString(),
          acknowledgement_error: null,
        }).eq("id", application.id);
      } catch (mailError) {
        const reason = mailError instanceof Error ? mailError.message : "Email delivery failed.";
        console.error("Partner application acknowledgement failed:", reason);
        await db.from("partner_applications").update({
          acknowledgement_status: "failed",
          acknowledgement_error: reason.slice(0, 1000),
        }).eq("id", application.id);
      }
    }

    return NextResponse.json({
      success: true,
      message: "Your partner application has been received. An acknowledgement has been sent to your email if delivery is available.",
    }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Partner application API error:", error);
    return fail("We could not submit your application right now. Please try again.", 500);
  }
}
