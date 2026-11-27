import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
const BUCKET = "property-images";
const MAX_FILE_SIZE = 8 * 1024 * 1024;
const MAX_PHOTOS = 15;

async function adminContext(req: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const authorization = req.headers.get("authorization") || "";
  if (!url || !serviceKey || !authorization.startsWith("Bearer ")) return null;
  const token = authorization.slice(7).trim();
  if (!token) return null;
  const db = createClient(url, serviceKey, { auth: { persistSession: false } });
  const { data: { user }, error } = await db.auth.getUser(token);
  if (error || !user) return null;
  const { data: profile } = await db.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (profile?.role !== "admin") return null;
  return { db, user };
}

export async function GET(req: NextRequest) {
  const ctx = await adminContext(req);
  if (!ctx) return NextResponse.json({ success: false, error: "Administrator access required." }, { status: 401 });
  const q = (req.nextUrl.searchParams.get("q") || "").trim().slice(0, 100);
  let query = ctx.db.from("independent_accommodations")
    .select("id,name,property_type,city,county,booking_enabled,image_urls,listing_status")
    .eq("listing_status", "published")
    .order("name", { ascending: true })
    .limit(100);
  if (q) {
    const safe = q.replace(/[(),.%_*]/g, " ").trim();
    if (safe) query = query.or(`name.ilike.%${safe}%,city.ilike.%${safe}%,county.ilike.%${safe}%`);
  }
  const { data, error } = await query;
  if (error) return NextResponse.json({ success: false, error: "Unable to load accommodation records." }, { status: 500 });
  return NextResponse.json({ success: true, accommodations: data || [] });
}

export async function PATCH(req: NextRequest) {
  const ctx = await adminContext(req);
  if (!ctx) return NextResponse.json({ success: false, error: "Administrator access required." }, { status: 401 });
  const body = await req.json().catch(() => null);
  if (!body || typeof body.id !== "string" || typeof body.booking_enabled !== "boolean") {
    return NextResponse.json({ success: false, error: "Choose a valid accommodation and booking setting." }, { status: 400 });
  }
  const { data, error } = await ctx.db.from("independent_accommodations")
    .update({ booking_enabled: body.booking_enabled, updated_at: new Date().toISOString() })
    .eq("id", body.id).eq("listing_status", "published").select("id,booking_enabled").maybeSingle();
  if (error) return NextResponse.json({ success: false, error: "Unable to update guest booking." }, { status: 500 });
  if (!data) return NextResponse.json({ success: false, error: "Accommodation not found." }, { status: 404 });
  return NextResponse.json({ success: true, accommodation: data });
}

export async function POST(req: NextRequest) {
  const ctx = await adminContext(req);
  if (!ctx) return NextResponse.json({ success: false, error: "Administrator access required." }, { status: 401 });
  const body = await req.json().catch(() => null);
  const id = typeof body?.id === "string" ? body.id : "";
  const files = Array.isArray(body?.files) ? body.files : [];
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id) || files.length < 1 || files.length > MAX_PHOTOS) {
    return NextResponse.json({ success: false, error: "Select an accommodation and up to 15 photos." }, { status: 400 });
  }
  const { data: stay, error: stayError } = await ctx.db.from("independent_accommodations")
    .select("id,image_urls").eq("id", id).eq("listing_status", "published").maybeSingle();
  if (stayError || !stay) return NextResponse.json({ success: false, error: "Accommodation not found." }, { status: 404 });
  const current = Array.isArray(stay.image_urls) ? stay.image_urls.filter((value: unknown): value is string => typeof value === "string") : [];
  if (current.length + files.length > MAX_PHOTOS) {
    return NextResponse.json({ success: false, error: `This accommodation can have up to ${MAX_PHOTOS} photos.` }, { status: 400 });
  }

  const uploads: { path: string; token: string; publicUrl: string }[] = [];
  for (const file of files) {
    const contentType = typeof file?.contentType === "string" ? file.contentType : "";
    const size = Number(file?.size);
    if (!["image/jpeg", "image/png", "image/webp"].includes(contentType) || !Number.isFinite(size) || size <= 0 || size > MAX_FILE_SIZE) {
      if (uploads.length) await ctx.db.storage.from(BUCKET).remove(uploads.map(item => item.path));
      return NextResponse.json({ success: false, error: "Use JPG, PNG or WebP photos, maximum 8 MB each." }, { status: 400 });
    }
    const extension = contentType === "image/png" ? "png" : contentType === "image/webp" ? "webp" : "jpg";
    const storagePath = `management-accommodations/${id}/${randomUUID()}.${extension}`;
    const { data, error } = await ctx.db.storage.from(BUCKET).createSignedUploadUrl(storagePath);
    if (error || !data?.token) {
      if (uploads.length) await ctx.db.storage.from(BUCKET).remove(uploads.map(item => item.path));
      return NextResponse.json({ success: false, error: "Unable to prepare a secure photo upload." }, { status: 500 });
    }
    uploads.push({
      path: storagePath,
      token: data.token,
      publicUrl: ctx.db.storage.from(BUCKET).getPublicUrl(storagePath).data.publicUrl,
    });
  }
  return NextResponse.json({ success: true, uploads });
}

export async function PUT(req: NextRequest) {
  const ctx = await adminContext(req);
  if (!ctx) return NextResponse.json({ success: false, error: "Administrator access required." }, { status: 401 });
  const body = await req.json().catch(() => null);
  const id = typeof body?.id === "string" ? body.id : "";
  const paths = Array.isArray(body?.paths) ? body.paths.filter((value: unknown): value is string => typeof value === "string") : [];
  const prefix = `management-accommodations/${id}/`;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id) || paths.length < 1 || paths.length > MAX_PHOTOS || paths.some((path: string) => !path.startsWith(prefix) || path.slice(prefix.length).includes("/"))) {
    return NextResponse.json({ success: false, error: "Invalid photo upload confirmation." }, { status: 400 });
  }
  const { data: stay, error: stayError } = await ctx.db.from("independent_accommodations")
    .select("id,image_urls").eq("id", id).eq("listing_status", "published").maybeSingle();
  if (stayError || !stay) return NextResponse.json({ success: false, error: "Accommodation not found." }, { status: 404 });
  const current = Array.isArray(stay.image_urls) ? stay.image_urls.filter((value: unknown): value is string => typeof value === "string") : [];
  if (current.length + paths.length > MAX_PHOTOS) {
    return NextResponse.json({ success: false, error: `This accommodation can have up to ${MAX_PHOTOS} photos.` }, { status: 400 });
  }
  const { data: stored, error: listError } = await ctx.db.storage.from(BUCKET).list(`management-accommodations/${id}`, { limit: 100 });
  if (listError) return NextResponse.json({ success: false, error: "Unable to verify uploaded photos." }, { status: 500 });
  const storedNames = new Set((stored || []).map(item => item.name));
  if (paths.some((path: string) => !storedNames.has(path.slice(prefix.length)))) {
    return NextResponse.json({ success: false, error: "One or more photos have not finished uploading." }, { status: 409 });
  }
  const urls = paths.map((path: string) => ctx.db.storage.from(BUCKET).getPublicUrl(path).data.publicUrl);
  const { data: updated, error: updateError } = await ctx.db.from("independent_accommodations")
    .update({ image_urls: [...current, ...urls], updated_at: new Date().toISOString() })
    .eq("id", id).select("id,image_urls").single();
  if (updateError) return NextResponse.json({ success: false, error: "Photos uploaded but could not be attached to the accommodation." }, { status: 500 });
  return NextResponse.json({ success: true, image_urls: updated.image_urls });
}

export async function DELETE(req: NextRequest) {
  const ctx = await adminContext(req);
  if (!ctx) return NextResponse.json({ success: false, error: "Administrator access required." }, { status: 401 });
  const body = await req.json().catch(() => null);
  const id = typeof body?.id === "string" ? body.id : "";
  const paths = Array.isArray(body?.paths) ? body.paths.filter((value: unknown): value is string => typeof value === "string") : [];
  const prefix = `management-accommodations/${id}/`;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id) || paths.length > MAX_PHOTOS || paths.some((path: string) => !path.startsWith(prefix) || path.slice(prefix.length).includes("/"))) {
    return NextResponse.json({ success: false, error: "Invalid photo cleanup request." }, { status: 400 });
  }
  if (paths.length) {
    const { data: stay, error: stayError } = await ctx.db.from("independent_accommodations")
      .select("image_urls").eq("id", id).maybeSingle();
    if (stayError || !stay) return NextResponse.json({ success: false, error: "Accommodation not found." }, { status: 404 });
    const attached = new Set(Array.isArray(stay.image_urls) ? stay.image_urls : []);
    const orphanPaths = paths.filter((path: string) => !attached.has(ctx.db.storage.from(BUCKET).getPublicUrl(path).data.publicUrl));
    if (orphanPaths.length) {
      const { error } = await ctx.db.storage.from(BUCKET).remove(orphanPaths);
      if (error) return NextResponse.json({ success: false, error: "Unable to clean up incomplete photo uploads." }, { status: 500 });
    }
  }
  return NextResponse.json({ success: true });
}
