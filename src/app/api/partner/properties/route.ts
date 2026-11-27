
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

type PartnerPropertySeed = {
  id: string;
  phone: string | null;
  email: string | null;
};

type ApplicationPropertySeed = {
  business_name: string;
  location: string | null;
  property_type: string | null;
  message: string | null;
  phone: string | null;
  email: string | null;
  has_conference_rooms: boolean | null;
};

async function ensureApplicationProperty(
  admin: ReturnType<typeof createClient>,
  partner: PartnerPropertySeed,
  application: ApplicationPropertySeed
) {
  const { data: existing, error: existingError } = await admin
    .from("properties")
    .select("id, name, property_type, city, county, sub_county, country, status, is_active, publication_status, publication_submitted_at, is_archived, has_conference_rooms, created_at")
    .eq("partner_id", partner.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (existingError) throw existingError;
  if (existing) return existing;

  const location = String(application.location || "").trim();
  const parts = location.split(",").map((part: string) => part.trim()).filter(Boolean);
  const city = parts[0] || location || "Location to be confirmed";
  const county = parts.length > 1 ? parts[1].replace(/\s+county$/i, "").trim() : null;
  const rawType = String(application.property_type || "other").trim().toLowerCase();
  const typeMap: Record<string, string> = {
    "bed and breakfast": "bnb", "holiday home": "other", "guesthouse": "guesthouse",
    "hotel": "hotel", "resort": "resort", "apartment": "apartment", "villa": "villa",
    "lodge": "lodge", "hostel": "hostel", "other": "other",
  };
  const propertyType = typeMap[rawType] || "other";
  const { data: destination } = await admin.from("destinations")
    .select("id, city, county, country, country_code")
    .eq("active", true)
    .ilike("city", city)
    .limit(1)
    .maybeSingle();

  const { data: created, error: createError } = await admin.from("properties").insert({
    partner_id: partner.id,
    destination_id: destination?.id || null,
    name: application.business_name,
    property_type: propertyType,
    description: application.message || null,
    address: location || null,
    city: destination?.city || city,
    county: destination?.county || county,
    country: destination?.country || "Kenya",
    country_code: destination?.country_code || "KE",
    currency: destination?.country_code && destination.country_code !== "KE" ? "USD" : "KES",
    contact_phone: application.phone || partner.phone,
    contact_email: application.email || partner.email,
    has_conference_rooms: application.has_conference_rooms === true,
    status: "pending",
    is_active: false,
    publication_status: "draft",
  }).select("id, name, property_type, city, county, sub_county, country, status, is_active, publication_status, publication_submitted_at, is_archived, has_conference_rooms, created_at").single();
  if (createError || !created) throw createError || new Error("Initial property record could not be created.");
  return created;
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
           .select("id, business_name, contact_person, email, phone, property_type, location, message, has_conference_rooms, status, applicant_user_id, created_at")
          .ilike("email", email)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (applicationError) {
          console.error("Partner application status lookup failed:", applicationError);
          return fail("Unable to retrieve your partner application status.", 500);
        }
        application = data;

        // An approved applicant creates their own account from the email link.
        // Claim the approved application only when the authenticated account
        // email matches and the application has not been linked to another user.
        if (application?.status === "approved") {
          const { data: ownedPartner, error: ownedPartnerError } = await context.admin
            .from("property_partners")
            .select("id, owner_user_id, business_name, contact_person, email, phone, status")
            .eq("owner_user_id", context.user.id)
            .maybeSingle();
          const { data: emailPartner, error: emailPartnerError } = ownedPartner
            ? { data: null, error: null }
            : await context.admin
                .from("property_partners")
                .select("id, owner_user_id, business_name, contact_person, email, phone, status")
                .ilike("email", email)
                .limit(1)
                .maybeSingle();
          const existingPartner = ownedPartner || emailPartner;
          const existingPartnerError = ownedPartnerError || emailPartnerError;

          if (existingPartnerError) {
            console.error("Existing partner lookup failed:", existingPartnerError);
            return fail("Unable to verify your partner account.", 500);
          }

          if (existingPartner && existingPartner.owner_user_id !== context.user.id) {
            return fail("This approved application is already linked to another account. Please contact partner support.", 409);
          }

          if (existingPartner) {
            const { error: linkError } = await context.admin
              .from("partner_applications")
              .update({ applicant_user_id: context.user.id })
              .eq("id", application.id)
              .eq("status", "approved")
              .or(`applicant_user_id.is.null,applicant_user_id.eq.${context.user.id}`);
            if (linkError) {
              console.error("Partner application account link failed:", linkError);
              return fail("Unable to link your approved application to this account.", 500);
            }
            const initialProperty = await ensureApplicationProperty(context.admin, existingPartner, application);
            return NextResponse.json({
              success: true,
              partner: existingPartner,
              properties: [initialProperty],
              partnerState: existingPartner.status,
              application,
            }, { headers: { "Cache-Control": "no-store" } });
          }

          const { data: profile } = await context.admin
            .from("profiles")
            .select("role")
            .eq("id", context.user.id)
            .maybeSingle();
          if (profile?.role === "admin") {
            return fail("Administrator accounts cannot be registered as partner accounts.", 403);
          }

          if (application.applicant_user_id && application.applicant_user_id !== context.user.id) {
            return fail("This approved application is already linked to another account.", 409);
          }

          const { data: createdPartner, error: createPartnerError } = await context.admin
            .from("property_partners")
            .insert({
              owner_user_id: context.user.id,
              business_name: application.business_name,
              contact_person: application.contact_person,
              email,
              phone: application.phone,
              status: "approved",
            })
            .select("id, owner_user_id, business_name, contact_person, email, phone, status")
            .single();

          if (createPartnerError || !createdPartner) {
            console.error("Approved partner account creation failed:", createPartnerError);
            return fail("Unable to create your partner account. Please contact support.", 500);
          }

          const [{ error: profileUpdateError }, { data: linkedApplication, error: applicationUpdateError }] = await Promise.all([
            context.admin.from("profiles").update({ role: "partner" }).eq("id", context.user.id).neq("role", "admin"),
            context.admin.from("partner_applications")
              .update({ applicant_user_id: context.user.id })
              .eq("id", application.id)
              .eq("status", "approved")
              .or(`applicant_user_id.is.null,applicant_user_id.eq.${context.user.id}`)
              .select("id")
              .maybeSingle(),
          ]);

          if (profileUpdateError || applicationUpdateError || !linkedApplication) {
            console.error("Partner account linking failed:", profileUpdateError || applicationUpdateError);
            await context.admin.from("property_partners").delete().eq("id", createdPartner.id).eq("owner_user_id", context.user.id);
            return fail("Your account could not be linked to the approved application. Please try again.", 500);
          }

          const initialProperty = await ensureApplicationProperty(context.admin, createdPartner, application);
          return NextResponse.json({
            success: true,
            partner: createdPartner,
            properties: [initialProperty],
            partnerState: "approved",
            application,
          }, { headers: { "Cache-Control": "no-store" } });
        }
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

    // Existing approved partner accounts may predate automatic property seeding.
    // If their approved application has no property record yet, create the draft workspace now.
    const { data: approvedApplication, error: approvedApplicationError } = await context.admin
      .from("partner_applications")
      .select("id, business_name, contact_person, email, phone, property_type, location, message, has_conference_rooms, status, applicant_user_id, created_at")
      .ilike("email", context.partner.email.trim().toLowerCase())
      .eq("status", "approved")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (approvedApplicationError) {
      console.error("Approved partner application lookup failed:", approvedApplicationError);
      return fail("Unable to retrieve your approved property application.", 500);
    }
    if (approvedApplication) {
      try {
        await ensureApplicationProperty(context.admin, context.partner, approvedApplication);
      } catch (seedError) {
        console.error("Initial partner property setup failed:", seedError);
        return fail("Unable to prepare your approved property workspace. Please refresh and try again.", 500);
      }
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
    if (!context.partner) return fail("Your partner account is not approved for property management.", 403);
    const partner = context.partner;

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
        : partner.phone;
    const email =
      typeof input.contactEmail === "string"
        ? input.contactEmail.trim().toLowerCase()
        : partner.email;

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

    if (partner.email) {
      try {
        await sendPartnerPropertyEditAcknowledgement({
          email: partner.email,
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
