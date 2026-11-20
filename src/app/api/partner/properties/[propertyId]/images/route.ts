import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const MIME_EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function fail(message: string, status: number) {
  return NextResponse.json(
    { success: false, error: message },
    { status, headers: { "Cache-Control": "no-store" } }
  );
}


export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ propertyId: string }> }
) {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    const secretKey = process.env.SUPABASE_SECRET_KEY;
    if (!url || !publishableKey || !secretKey) return fail("Property image service is not configured.", 500);
    const authorization = request.headers.get("authorization");
    if (!authorization?.startsWith("Bearer ")) return fail("Please sign in to continue.", 401);
    const authClient = createClient(url, publishableKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
    const { data: { user }, error: authError } = await authClient.auth.getUser(authorization.slice(7).trim());
    if (authError || !user) return fail("Your session has expired. Please sign in again.", 401);
    const admin = createClient(url, secretKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
    const { data: partner, error: partnerError } = await admin
      .from("property_partners").select("id")
      .eq("owner_user_id", user.id).eq("status", "approved").maybeSingle();
    if (partnerError) return fail("Unable to verify your partner account.", 500);
    if (!partner) return fail("An approved partner account is required.", 403);
    const { propertyId } = await params;
    if (!UUID_PATTERN.test(propertyId)) return fail("Invalid property ID.", 400);
    const { data: property } = await admin.from("properties").select("id")
      .eq("id", propertyId).eq("partner_id", partner.id).maybeSingle();
    if (!property) return fail("Property not found in your partner account.", 404);
    const { data: images, error } = await admin.from("property_images")
      .select("id, image_url, caption, is_cover, display_order")
      .eq("property_id", propertyId).order("display_order", { ascending: true });
    if (error) {
      console.error("Property image list failed:", error);
      return fail("Unable to load property photos.", 500);
    }
    return NextResponse.json({ success: true, images: images ?? [] }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Property image list error:", error);
    return fail("An unexpected error occurred.", 500);
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ propertyId: string }> }
) {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    const secretKey = process.env.SUPABASE_SECRET_KEY;
    if (!url || !publishableKey || !secretKey) {
      return fail("Property image service is not configured.", 500);
    }

    const authorization = request.headers.get("authorization");
    if (!authorization?.startsWith("Bearer ")) {
      return fail("Please sign in to continue.", 401);
    }

    const token = authorization.slice(7).trim();
    if (!token) return fail("Invalid authentication token.", 401);

    const authClient = createClient(url, publishableKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
    const { data: { user }, error: authError } = await authClient.auth.getUser(token);
    if (authError || !user) return fail("Your session has expired. Please sign in again.", 401);

    const admin = createClient(url, secretKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });

    const { data: partner, error: partnerError } = await admin
      .from("property_partners")
      .select("id")
      .eq("owner_user_id", user.id)
      .eq("status", "approved")
      .maybeSingle();
    if (partnerError) {
      console.error("Partner image authorization failed:", partnerError);
      return fail("Unable to verify your partner account.", 500);
    }
    if (!partner) return fail("An approved partner account is required.", 403);

    const { propertyId } = await params;
    if (!UUID_PATTERN.test(propertyId)) return fail("Invalid property ID.", 400);

    const { data: property, error: propertyError } = await admin
      .from("properties")
      .select("id, status, currency")
      .eq("id", propertyId)
      .eq("partner_id", partner.id)
      .maybeSingle();
    if (propertyError) {
      console.error("Partner image property lookup failed:", propertyError);
      return fail("Unable to verify this property.", 500);
    }
    if (!property) return fail("Property not found in your partner account.", 404);
    if (property.status !== "approved") {
      return fail("Photos can be added after the property is approved.", 409);
    }

    const form = await request.formData();
    const file = form.get("image");
    const captionValue = form.get("caption");
    const caption = typeof captionValue === "string" ? captionValue.trim() : "";
    if (!(file instanceof File)) return fail("Choose an image to upload.", 400);
    if (!Object.prototype.hasOwnProperty.call(MIME_EXTENSIONS, file.type)) {
      return fail("Use a JPG, PNG or WebP image.", 400);
    }
    if (file.size < 1 || file.size > MAX_IMAGE_BYTES) {
      return fail("Each image must be smaller than 8 MB.", 400);
    }
    if (caption.length > 160) return fail("Image caption must be 160 characters or fewer.", 400);

    const { count, error: countError } = await admin
      .from("property_images")
      .select("id", { count: "exact", head: true })
      .eq("property_id", propertyId);
    if (countError) {
      console.error("Property image count failed:", countError);
      return fail("Unable to prepare the image upload.", 500);
    }
    if ((count ?? 0) >= 30) return fail("A property can have up to 30 photos.", 409);

    const extension = MIME_EXTENSIONS[file.type];
    const storagePath = propertyId + "/" + randomUUID() + "." + extension;
    const { error: uploadError } = await admin.storage
      .from("property-images")
      .upload(storagePath, file, {
        contentType: file.type,
        cacheControl: "31536000",
        upsert: false,
      });
    if (uploadError) {
      console.error("Property image upload failed:", uploadError);
      return fail("Unable to upload this image. Please try again.", 500);
    }

    const { data: existingCover, error: coverLookupError } = await admin
      .from("property_images")
      .select("id")
      .eq("property_id", propertyId)
      .eq("is_cover", true)
      .limit(1)
      .maybeSingle();
    if (coverLookupError) {
      await admin.storage.from("property-images").remove([storagePath]);
      console.error("Property cover lookup failed:", coverLookupError);
      return fail("Unable to save this property photo.", 500);
    }

    const { data: publicUrl } = admin.storage
      .from("property-images")
      .getPublicUrl(storagePath);

    const { data: image, error: insertError } = await admin
      .from("property_images")
      .insert({
        property_id: propertyId,
        image_url: publicUrl.publicUrl,
        caption: caption || null,
        is_cover: !existingCover,
        display_order: count ?? 0,
      })
      .select("id, image_url, caption, is_cover, display_order")
      .single();

    if (insertError || !image) {
      await admin.storage.from("property-images").remove([storagePath]);
      console.error("Property image record creation failed:", insertError);
      return fail("Unable to save this property photo.", 500);
    }

    return NextResponse.json(
      { success: true, message: "Photo uploaded successfully.", image },
      { status: 201, headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("Partner property image API error:", error);
    return fail("An unexpected error occurred.", 500);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ propertyId: string }> }
) {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    const secretKey = process.env.SUPABASE_SECRET_KEY;
    if (!url || !publishableKey || !secretKey) return fail("Property image service is not configured.", 500);

    const authorization = request.headers.get("authorization");
    if (!authorization?.startsWith("Bearer ")) return fail("Please sign in to continue.", 401);

    const authClient = createClient(url, publishableKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
    const { data: { user }, error: authError } = await authClient.auth.getUser(authorization.slice(7).trim());
    if (authError || !user) return fail("Your session has expired. Please sign in again.", 401);

    const admin = createClient(url, secretKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
    const { data: partner, error: partnerError } = await admin
      .from("property_partners")
      .select("id")
      .eq("owner_user_id", user.id)
      .eq("status", "approved")
      .maybeSingle();
    if (partnerError) return fail("Unable to verify your partner account.", 500);
    if (!partner) return fail("An approved partner account is required.", 403);

    const { propertyId } = await params;
    if (!UUID_PATTERN.test(propertyId)) return fail("Invalid property ID.", 400);

    const body = await request.json().catch(() => null) as { imageId?: unknown } | null;
    if (!body || typeof body.imageId !== "string" || !UUID_PATTERN.test(body.imageId)) {
      return fail("Invalid image selection.", 400);
    }

    const { data: property } = await admin
      .from("properties")
      .select("id")
      .eq("id", propertyId)
      .eq("partner_id", partner.id)
      .eq("status", "approved")
      .maybeSingle();
    if (!property) return fail("Approved property not found in your partner account.", 404);

    const { data: image, error: imageError } = await admin
      .from("property_images")
      .select("id, image_url, is_cover")
      .eq("id", body.imageId)
      .eq("property_id", propertyId)
      .maybeSingle();
    if (imageError) return fail("Unable to find this property photo.", 500);
    if (!image) return fail("Photo not found.", 404);

    const marker = "/storage/v1/object/public/property-images/";
    const markerIndex = image.image_url.indexOf(marker);
    if (markerIndex < 0) return fail("This photo cannot be removed automatically. Contact support.", 409);
    const storagePath = decodeURIComponent(image.image_url.slice(markerIndex + marker.length).split("?")[0]);

    const { error: deleteRecordError } = await admin
      .from("property_images")
      .delete()
      .eq("id", image.id)
      .eq("property_id", propertyId);
    if (deleteRecordError) {
      console.error("Property image record deletion failed:", deleteRecordError);
      return fail("Unable to remove this photo.", 500);
    }

    const { error: storageDeleteError } = await admin.storage
      .from("property-images")
      .remove([storagePath]);
    if (storageDeleteError) {
      console.error("Property image storage cleanup failed:", storageDeleteError);
    }

    if (image.is_cover) {
      const { data: remaining } = await admin
        .from("property_images")
        .select("id")
        .eq("property_id", propertyId)
        .order("display_order", { ascending: true })
        .limit(1)
        .maybeSingle();

      if (remaining) {
        await admin.from("property_images").update({ is_cover: true }).eq("id", remaining.id);
      }
    }

    return NextResponse.json(
      { success: true, message: "Photo removed." },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("Partner property image deletion error:", error);
    return fail("An unexpected error occurred.", 500);
  }
}
