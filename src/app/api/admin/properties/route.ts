import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

function fail(message: string, status: number) {
  return NextResponse.json(
    { success: false, error: message },
    { status, headers: { "Cache-Control": "no-store" } }
  );
}

async function authenticateAdmin(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const secretKey = process.env.SUPABASE_SECRET_KEY;

  if (!url || !publishableKey || !secretKey) {
    return { error: fail("Administrator service configuration is incomplete.", 500) };
  }

  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) {
    return { error: fail("Please sign in first.", 401) };
  }

  const token = authorization.slice(7).trim();
  if (!token) return { error: fail("Invalid authentication token.", 401) };

  const authClient = createClient(url, publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

  const { data: { user }, error: authError } = await authClient.auth.getUser(token);
  if (authError || !user) {
    return { error: fail("Your session is invalid or expired. Please sign in again.", 401) };
  }

  const admin = createClient(url, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("id, role")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError || !profile || profile.role !== "admin") {
    return { error: fail("Administrator permission is required.", 403) };
  }

  return { admin, user };
}

export async function GET(request: NextRequest) {
  try {
    const context = await authenticateAdmin(request);
    if ("error" in context) return context.error;

    const requestedStatus = request.nextUrl.searchParams.get("status");
    const allowedStatuses = ["pending", "approved", "rejected", "suspended"];
    if (requestedStatus && !allowedStatuses.includes(requestedStatus)) {
      return fail("Invalid property status filter.", 400);
    }

    let query = context.admin
      .from("properties")
      .select(
        "id, partner_id, destination_id, name, property_type, description, address, city, sub_county, county, country, currency, contact_phone, contact_email, status, is_active, publication_status, publication_submitted_at, is_archived, created_at, partner:property_partners(business_name, contact_person, email, phone)"
      )
      .order("created_at", { ascending: false })
      .limit(200);

    if (requestedStatus) query = query.eq("status", requestedStatus);

    const { data: properties, error } = await query;
    if (error) {
      console.error("Admin property list error:", error);
      return fail("Unable to retrieve property submissions.", 500);
    }

    return NextResponse.json(
      { success: true, count: properties?.length || 0, properties: properties || [] },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("Admin property list API error:", error);
    return fail("An unexpected error occurred.", 500);
  }
}

async function sendPartnerPropertyApprovalEmail(input: { to: string; contactName: string; propertyName: string }) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;
  if (!apiKey || !from) return false;
  const dashboardUrl = "https://zuristay-worldwide.vercel.app/partner/dashboard";
  const safe = (value: string) => value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char] || char));
  const name = safe(input.contactName || "Partner");
  const property = safe(input.propertyName);
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: "Bearer " + apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({
      from,
      to: [input.to],
      subject: "Your ZuriStay property has been approved — complete your listing",
      html: `<div style="font-family:Arial,sans-serif;line-height:1.65;color:#172554;max-width:640px;margin:auto"><h2 style="color:#173b70">Your property has been approved!</h2><p>Hello ${name},</p><p>Good news: <strong>${property}</strong> has passed its initial ZuriStay review.</p><p>Please sign in to your Partner Portal and complete the remaining listing requirements:</p><ol><li>Add your room categories and room counts.</li><li>Enter your nightly rates and availability dates.</li><li>Upload clear property photographs.</li><li>Select the facilities and amenities available to guests.</li><li>Check that your property description and contact details are complete.</li></ol><p>When every checklist item is complete, the <strong>Publish my property</strong> button will activate automatically. Tap it to submit your listing for <strong>final ZuriStay approval</strong>. It will not become public immediately; once our team completes the final review and approves it, the listing will become visible to guests automatically.</p><p>Your Partner Portal lets you manage this property, add more properties, edit existing listings whenever you make improvements, and manage your accommodation details. After every change—such as editing details, rooms, facilities or photos—submit the property again using the Publish button so our team can verify and release the updated listing.</p><p><a href="${dashboardUrl}" style="display:inline-block;background:#173b70;color:#fff;padding:13px 22px;border-radius:8px;text-decoration:none;font-weight:bold">Open Partner Dashboard</a></p><p>Thank you for partnering with ZuriStay Worldwide.</p></div>`,
    }),
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    console.error("Partner approval email could not be sent:", response.status, detail.slice(0, 500));
    return false;
  }
  return true;
}

export async function POST(request: NextRequest) {
  try {
    const context = await authenticateAdmin(request);
    if ("error" in context) return context.error;

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return fail("Invalid request body.", 400);
    }

    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return fail("Invalid property review request.", 400);
    }

    const input = body as Record<string, unknown>;
    const propertyId = input.propertyId;
    const action = input.action;
    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

    if (typeof propertyId !== "string" || !uuidPattern.test(propertyId)) {
      return fail("Invalid property ID.", 400);
    }
    if (!["approve", "reject", "archive", "publish_approve", "publish_reject"].includes(String(action))) {
      return fail("Choose a valid property review action.", 400);
    }

    if (action === "publish_approve" || action === "publish_reject") {
      const approved = action === "publish_approve";
      const { data: reviewed, error: reviewError } = await context.admin.from("properties")
        .update({
          publication_status: approved ? "published" : "changes_requested",
          is_active: approved,
          publication_reviewed_at: new Date().toISOString(),
          publication_reviewed_by: context.user.id,
        })
        .eq("id", propertyId)
        .eq("status", "approved")
        .eq("publication_status", "pending_review")
        .select("id, name, status, is_active, publication_status")
        .maybeSingle();
      if (reviewError) {
        console.error("Final publication review failed:", reviewError);
        return fail("Unable to complete the final publication review.", 500);
      }
      if (!reviewed) return fail("This listing is no longer awaiting final review. Refresh the submissions.", 409);
      return NextResponse.json({
        success: true,
        message: approved
          ? "Final review approved. The property is now publicly visible on ZuriStay."
          : "Final review returned the property to the partner for changes. It remains hidden from guests.",
        property: reviewed,
      }, { headers: { "Cache-Control": "no-store" } });
    }

    if (action === "archive") {
      const { data: archived, error: archiveError } = await context.admin.from("properties")
        .update({ is_active: false, is_archived: true, archived_at: new Date().toISOString(), archived_by: context.user.id })
        .eq("id", propertyId).eq("is_archived", false)
        .select("id, name, status, is_active, is_archived").maybeSingle();
      if (archiveError) { console.error("Property archive failed:", archiveError); return fail("Unable to archive this property. Please try again.", 500); }
      if (!archived) return fail("This property is already archived or no longer exists.", 409);
      return NextResponse.json({ success: true, message: "Property archived. It is hidden from guests; booking and payment history is retained.", property: archived }, { headers: { "Cache-Control": "no-store" } });
    }

    const { data: propertyForNotice, error: noticeLookupError } = await context.admin
      .from("properties")
      .select("id, name, contact_email, partner:property_partners(email, contact_person)")
      .eq("id", propertyId)
      .maybeSingle();
    if (noticeLookupError) console.error("Property approval email lookup failed:", noticeLookupError);

    const { data: property, error: updateError } = await context.admin
      .from("properties")
      .update(
        action === "approve"
          ? { status: "approved", is_active: false }
          : { status: "rejected", is_active: false }
      )
      .eq("id", propertyId)
      .eq("status", "pending")
      .select("id, name, status, is_active")
      .maybeSingle();

    if (updateError) {
      console.error("Property review update failed:", updateError);
      return fail("Unable to update this property. Please try again.", 500);
    }
    if (!property) {
      return fail("This property was already reviewed or no longer exists. Refresh the list.", 409);
    }

    let emailSent = false;
    if (action === "approve" && propertyForNotice) {
      const partnerValue = Array.isArray(propertyForNotice.partner) ? propertyForNotice.partner[0] : propertyForNotice.partner;
      const recipient = String(propertyForNotice.contact_email || partnerValue?.email || "").trim();
      if (recipient) {
        emailSent = await sendPartnerPropertyApprovalEmail({
          to: recipient,
          contactName: String(partnerValue?.contact_person || "Partner"),
          propertyName: String(propertyForNotice.name || "your property"),
        });
      }
    }

    return NextResponse.json(
      {
        success: true,
        message: action === "approve"
          ? "Property approved. The partner can now complete the listing and submit it for final publication review."
          : "Property submission rejected successfully.",
        emailSent,
        emailNotice: action === "approve" && !emailSent
          ? "The approval is saved, but the automatic email could not be sent. Configure RESEND_API_KEY and RESEND_FROM_EMAIL to enable email delivery."
          : undefined,
        property,
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("Admin property review API error:", error);
    return fail("An unexpected error occurred while reviewing this property.", 500);
  }
}
