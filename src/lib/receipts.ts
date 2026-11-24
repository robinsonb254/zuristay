import { createHmac, timingSafeEqual } from "node:crypto";
import { createReceiptPdf, sendZuriStayEmail } from "@/lib/email";

type Database = ReturnType<typeof import("@supabase/supabase-js").createClient>;

function receiptSignature(receiptId: string, expires: string) {
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!secret) throw new Error("Receipt signing is not configured.");
  return createHmac("sha256", secret).update(`${receiptId}:${expires}`).digest("hex");
}

export function createReceiptLink(receiptId: string) {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "");
  if (!siteUrl.startsWith("https://")) throw new Error("Secure receipt download URL is not configured.");
  const expires = String(Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 90);
  const url = new URL(`/api/receipts/${receiptId}`, siteUrl);
  url.searchParams.set("expires", expires);
  url.searchParams.set("signature", receiptSignature(receiptId, expires));
  return url.toString();
}

export function verifyReceiptLink(receiptId: string, expires: string, signature: string) {
  if (!/^\d{10}$/.test(expires) || Number(expires) <= Math.floor(Date.now() / 1000) || !/^[a-f0-9]{64}$/i.test(signature)) return false;
  const expected = Buffer.from(receiptSignature(receiptId, expires), "hex");
  const supplied = Buffer.from(signature, "hex");
  return expected.length === supplied.length && timingSafeEqual(expected, supplied);
}

export async function deliverBookingReceipt(db: Database, bookingId: string, paymentId: string) {
  try {
    const { data: payment, error: paymentError } = await db.from("payments")
      .select("id, payment_method, provider_reference, amount, currency, status, verified_at")
      .eq("id", paymentId).eq("booking_id", bookingId).eq("status", "successful").maybeSingle();
    if (paymentError || !payment) throw new Error("Verified payment record could not be loaded.");

    const { data: booking, error: bookingError } = await db.from("bookings")
      .select("id, booking_reference, guest_name, guest_email, guest_phone, check_in, check_out, guests, rooms, currency, subtotal, total_amount, booking_status, payment_status")
      .eq("id", bookingId).maybeSingle();
    if (bookingError || !booking || booking.payment_status !== "paid" || booking.booking_status !== "confirmed") {
      throw new Error("Paid and confirmed booking details could not be verified.");
    }

    const { data: items, error: itemsError } = await db.from("booking_items")
      .select("quantity, properties(name, city, county, country)")
      .eq("booking_id", bookingId);
    if (itemsError || !items?.length) throw new Error("Booking accommodation details could not be loaded.");
    const firstItem = items[0] as unknown as { quantity?: number; properties?: { name?: string; city?: string; county?: string; country?: string } | { name?: string; city?: string; county?: string; country?: string }[] };
    const property = Array.isArray(firstItem.properties) ? firstItem.properties[0] : firstItem.properties;
    const nights = Math.max(0, Math.round((new Date(`${booking.check_out}T00:00:00Z`).getTime() - new Date(`${booking.check_in}T00:00:00Z`).getTime()) / 86400000));
    const receiptNumber = `ZS-${new Date(payment.verified_at || payment.created_at || Date.now()).toISOString().slice(0,10).replace(/-/g,"")}-${payment.id.slice(0,8).toUpperCase()}`;
    const snapshot = {
      receipt_number: receiptNumber,
      booking_reference: booking.booking_reference,
      guest_name: booking.guest_name,
      guest_email: booking.guest_email,
      guest_phone: booking.guest_phone,
      check_in: booking.check_in,
      check_out: booking.check_out,
      guests: booking.guests,
      rooms: booking.rooms,
      nights,
      property_name: property?.name || "Accommodation",
      city: property?.city || "",
      county: property?.county || "",
      country: property?.country || "",
      subtotal: booking.subtotal,
      total_amount: payment.amount,
      currency: payment.currency,
      payment_method: payment.payment_method === "mpesa" ? "M-Pesa" : "PayPal",
      provider_reference: payment.provider_reference,
      payment_date: payment.verified_at || new Date().toISOString(),
    };

    const { error: insertError } = await db.from("booking_receipts").upsert({
      booking_id: bookingId,
      payment_id: paymentId,
      receipt_number: receiptNumber,
      receipt_snapshot: snapshot,
      email_status: "pending",
    }, { onConflict: "payment_id", ignoreDuplicates: true });
    if (insertError) throw insertError;

    const { data: receipt, error: receiptError } = await db.from("booking_receipts")
      .select("id, receipt_number, receipt_snapshot, email_status")
      .eq("payment_id", paymentId).maybeSingle();
    if (receiptError || !receipt) throw new Error("Receipt record could not be loaded.");
    if (receipt.email_status === "sent" || receipt.email_status === "sending") return;

    const { data: claimed, error: claimError } = await db.from("booking_receipts")
      .update({ email_status: "sending", email_attempts: 1, last_email_error: null })
      .eq("id", receipt.id).in("email_status", ["pending", "failed"])
      .select("id").maybeSingle();
    if (claimError || !claimed) return;

    try {
      const pdf = await createReceiptPdf(receipt.receipt_snapshot as Record<string, unknown>);
      const downloadUrl = createReceiptLink(receipt.id);
      const guestName = String(snapshot.guest_name || "Guest");
      await sendZuriStayEmail({
        to: String(snapshot.guest_email),
        subject: `Your ZuriStay booking receipt — ${snapshot.booking_reference}`,
        text: `Hello ${guestName},\n\nYour payment has been verified and your ZuriStay Worldwide booking is confirmed. Your PDF receipt is attached.\n\nSecure receipt download: ${downloadUrl}\n\nBooking reference: ${snapshot.booking_reference}\nTotal paid: ${snapshot.currency} ${Number(snapshot.total_amount).toLocaleString("en-KE", { minimumFractionDigits: 2 })}\n\nFor assistance, contact ${process.env.BUSINESS_EMAIL || "robinsonbarasa6@gmail.com"}.\n\nZuriStay Worldwide`,
        html: `<p>Hello ${guestName.replace(/[&<>"]/g, "")},</p><p>Your payment has been verified and your ZuriStay Worldwide booking is confirmed. Your PDF receipt is attached.</p><p><a href="${downloadUrl}">Download your secure PDF receipt</a></p><p><strong>Booking reference:</strong> ${String(snapshot.booking_reference)}<br><strong>Total paid:</strong> ${String(snapshot.currency)} ${Number(snapshot.total_amount).toLocaleString("en-KE", { minimumFractionDigits: 2 })}</p><p>For assistance, contact ${process.env.BUSINESS_EMAIL || "robinsonbarasa6@gmail.com"}.</p><p>ZuriStay Worldwide</p>`,
        attachments: [{ filename: `ZuriStay-Receipt-${receipt.receipt_number}.pdf`, content: pdf, contentType: "application/pdf" }],
      });
      await db.from("booking_receipts").update({ email_status: "sent", emailed_at: new Date().toISOString(), last_email_error: null }).eq("id", receipt.id);
    } catch (emailError) {
      const message = emailError instanceof Error ? emailError.message : "Email delivery failed.";
      console.error("Booking receipt email failed:", message);
      await db.from("booking_receipts").update({ email_status: "failed", last_email_error: message.slice(0, 1000) }).eq("id", receipt.id);
    }
  } catch (error) {
    console.error("Booking receipt preparation failed:", error);
  }
}
