
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendPartnerPropertyEditAcknowledgement } from "@/lib/email";

export const dynamic = "force-dynamic";

const PROPERTY_TYPES = [
  "hotel",
  "resort",
  "apartment",
  "villa",
  "bnb",
  "lodge",
  "guesthouse",
  "hostel",
  "lounge",
  "venue",
  "other",
] as const;

function normalizeCountyName(value: string) {
  return value.toLowerCase().replace(/\s+city$/i, "").trim();
}

function destinationBelongsToCounty(destinationCounty: string | null, countyName: string) {
  if (!destinationCounty) return false;
  const target = normalizeCountyName(countyName);
  return normalizeCountyName(destinationCounty) === target ||
    destinationCounty.split(/[\/,]/).some((part) => normalizeCountyName(part) === target);
}

function fail(message: string, status: number) {
  return NextResponse.json(
    { success: false, error: message },
    {
      status,
      headers: { "Cache-Control": "no-store" },
    }
  );
}

async function authenticatePartner(request: NextRequest, requireApproved = true) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const secretKey = process.env.SUPABASE_SECRET_KEY;

  if (!url || !publishableKey || !secretKey) {
    return { error: fail("Partner service configuration is incomplete.", 500) };
  }

  const authorization = request.headers.get("authorization");

  if (!authorization?.startsWith("Bearer ")) {
    return { error: fail("Please sign in to continue.", 401) };
  }

  const token = authorization.slice(7).trim();

  const authClient = createClient(url, publishableKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });

  const {
    data: { user },
    error: authError,
  } = await authClient.auth.getUser(token);

  if (authError || !user) {
    return { error: fail("Your session has expired. Please sign in again.", 401) };
  }

  const admin = createClient(url, secretKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });

  let partnerQuery = admin
    .from("property_partners")
    .select("id, owner_user_id, business_name, contact_person, email, phone, status")
    .eq("owner_user_id", user.id);
  if (requireApproved) partnerQuery = partnerQuery.eq("status", "approved");
  const { data: partner, error: partnerError } = await partnerQuery.maybeSingle();

  if (partnerError) {
    console.error("Partner lookup failed:", partnerError);
    return { error: fail("Unable to verify your partner account.", 500) };
  }

  if (!partner && requireApproved) {
    return {
      error: fail("Your partner account is not yet approved for property management.", 403),
    };
  }

  return { admin, partner, user };
}

export async function GET(request: NextRequest) {
  try {
    const context = await authenticatePartner(request, false);

    if ("error" in context) return context.error;

    if (!context.partner) {
      const email = context.user.email?.trim().toLowerCase();
      let application = null;
      if (email) {
        const { data, error: applicationError } = await context.admin
          .from("partner_applications")
          .select("id, business_name, contact_person, email, status, created_at")
          .ilike("email", email)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (applicationError) {
          console.error("Partner application status lookup failed:", applicationError);
          return fail("Unable to retrieve your partner application status.", 500);
        }
        application = data;
      }
      return NextResponse.json({
        success: true,
        partner: null,
        properties: [],
        partnerState: application?.status === "pending" ? "pending" :
          application?.status === "rejected" ? "rejected" : "not_applied",
        application,
      }, { headers: { "Cache-Control": "no-store" } });
    }

    if (context.partner.status !== "approved") {
      return NextResponse.json({
        success: true,
        partner: context.partner,
        properties: [],
        partnerState: context.partner.status,
        application: null,
      }, { headers: { "Cache-Control": "no-store" } });
    }

    const { data: properties, error } = await context.admin
      .from("properties")
      .select(
        "id, name, property_type, city, county, sub_county, country, status, is_active, publication_status, publication_submitted_at, is_archived, has_conference_rooms, created_at"
      )
      .eq("partner_id", context.partner.id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Partner properties lookup failed:", error);
      return fail("Unable to load your property listings.", 500);
    }

    return NextResponse.json(
      {
        success: true,
        partner: context.partner,
        properties: properties ?? [],
      },
      {
        headers: { "Cache-Control": "no-store" },
      }
    );
  } catch (error) {
    console.error("Partner dashboard error:", error);
    return fail("An unexpected error occurred.", 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const context = await authenticatePartner(request);

    if ("error" in context) return context.error;

    let body: unknown;

    try {
      body = await request.json();
    } catch {
      return fail("Please provide valid property details.", 400);
    }

    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return fail("Invalid property details.", 400);
    }

    const input = body as Record<string, unknown>;

    const name = typeof input.name === "string" ? input.name.trim() : "";
    const type =
      typeof input.propertyType === "string"
        ? input.propertyType.trim().toLowerCase()
        : "";
    const destinationId =
      typeof input.destinationId === "string" ? input.destinationId.trim() : "";
    const countyCode = Number(input.countyCode);
    const subCountyCode =
      typeof input.subCountyCode === "string" ? input.subCountyCode.trim() : "";
    const address =
      typeof input.address === "string" ? input.address.trim() : "";
    const description =
      typeof input.description === "string" ? input.description.trim() : "";
    const currency =
      typeof input.currency === "string"
        ? input.currency.trim().toUpperCase()
        : "KES";
    const phone =
      typeof input.contactPhone === "string"
        ? input.contactPhone.trim()
        : context.partner.phone;
    const email =
      typeof input.contactEmail === "string"
        ? input.contactEmail.trim().toLowerCase()
        : context.partner.email;

    const uuidPattern =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

    if (name.length < 2 || name.length > 150) {
      return fail("Property name must be between 2 and 150 characters.", 400);
    }

    if (!PROPERTY_TYPES.includes(type as (typeof PROPERTY_TYPES)[number])) {
      return fail("Choose a valid property type.", 400);
    }

    if (!uuidPattern.test(destinationId)) {
      return fail("Choose a valid destination.", 400);
    }
    if (!Number.isInteger(countyCode) || countyCode < 1 || countyCode > 47 || !subCountyCode) {
      return fail("Choose a county and sub-county for this property.", 400);
    }

    if (address.length < 4 || address.length > 250) {
      return fail("Enter a valid property address.", 400);
    }

    if (description.length > 5000) {
      return fail("The property description is too long.", 400);
    }

    if (!/^[A-Z]{3}$/.test(currency)) {
      return fail("Enter a valid three-letter currency code.", 400);
    }

    if (phone.length < 5 || phone.length > 30) {
      return fail("Enter a valid contact phone number.", 400);
    }

    if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return fail("Enter a valid contact email address.", 400);
    }

    const { data: destination, error: destinationError } =
      await context.admin
        .from("destinations")
        .select("id, city, county, country, country_code")
        .eq("id", destinationId)
        .eq("active", true)
        .maybeSingle();

    if (destinationError) {
      console.error("Destination lookup failed:", destinationError);
      return fail("Unable to verify the selected destination.", 500);
    }

    if (!destination) {
      return fail("The selected destination is unavailable.", 400);
    }

    const [{ data: county, error: countyError }, { data: subCounty, error: subCountyError }] =
      await Promise.all([
        context.admin.from("kenya_counties").select("county_code,name").eq("county_code", countyCode).maybeSingle(),
        context.admin.from("kenya_subcounties").select("subcounty_code,county_code,name").eq("subcounty_code", subCountyCode).maybeSingle(),
      ]);

    if (countyError || subCountyError) {
      console.error("Kenya location lookup failed:", countyError || subCountyError);
      return fail("Unable to verify the selected county and sub-county.", 500);
    }
    if (!county || !subCounty || subCounty.county_code !== county.county_code) {
      return fail("The selected sub-county does not belong to the selected county.", 400);
    }
    if (!destinationBelongsToCounty(destination.county, county.name)) {
      return fail("Choose a town or urban centre within the selected county.", 400);
    }

    const { data: property, error: insertError } = await context.admin
      .from("properties")
      .insert({
        partner_id: context.partner.id,
        destination_id: destination.id,
        name,
        property_type: type,
        description: description || null,
        address,
        city: destination.city,
        county: county.name,
        sub_county: subCounty.name,
        country: destination.country,
        country_code: destination.country_code,
        currency,
        has_conference_rooms: input.hasConferenceRooms === true,
        contact_phone: phone,
        contact_email: email,
        status: "pending",
        is_active: false,
      })
      .select(
        "id, name, property_type, city, county, sub_county, country, status, is_active, has_conference_rooms, created_at"
      )
      .single();

    if (insertError || !property) {
      console.error("Property creation failed:", insertError);
      return fail("Unable to save this property. Please check the details.", 500);
    }

    if (context.partner.email) {
      try {
        await sendPartnerPropertyEditAcknowledgement({
          email: context.partner.email,
          contactPerson: context.partner.contact_person,
          businessName: context.partner.business_name,
          propertyName: property.name,
          changeType: "new property submission",
        });
      } catch (mailError) {
        console.error("Partner property submission acknowledgement failed:", mailError);
      }
    }

    return NextResponse.json(
      {
        success: true,
        message:
          "Property submitted successfully. It will remain unpublished until ZuriStay reviews it.",
        property,
      },
      {
        status: 201,
        headers: { "Cache-Control": "no-store" },
      }
    );
  } catch (error) {
    console.error("Partner property API error:", error);
    return fail("An unexpected error occurred.", 500);
  }
}
