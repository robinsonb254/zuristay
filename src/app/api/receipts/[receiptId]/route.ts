import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createReceiptPdf } from "@/lib/email";
import { verifyReceiptLink } from "@/lib/receipts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(request: NextRequest, { params }: { params: Promise<{ receiptId: string }> }) {
  const { receiptId } = await params;
  const expires = request.nextUrl.searchParams.get("expires") || "";
  const signature = request.nextUrl.searchParams.get("signature") || "";
  if (!UUID.test(receiptId) || !verifyReceiptLink(receiptId, expires, signature)) {
    return NextResponse.json({ success: false, error: "This secure receipt link is invalid or has expired." }, { status: 403 });
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!url || !secret) return NextResponse.json({ success: false, error: "Receipt service is unavailable." }, { status: 500 });
  const db = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: receipt, error } = await db.from("booking_receipts")
    .select("receipt_number, receipt_snapshot")
    .eq("id", receiptId).in("email_status", ["sent", "sending"]).maybeSingle();
  if (error || !receipt) return NextResponse.json({ success: false, error: "Receipt could not be found." }, { status: 404 });
  const pdf = await createReceiptPdf(receipt.receipt_snapshot as Record<string, unknown>);
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="ZuriStay-Receipt-${receipt.receipt_number}.pdf"`,
      "Cache-Control": "private, no-store, max-age=0",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
