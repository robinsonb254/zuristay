import nodemailer from "nodemailer";
import PDFDocument from "pdfkit";

type MailAttachment = { filename: string; content: Buffer; contentType: string };

function mailTransport() {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!host || !user || !pass) throw new Error("Email delivery is not configured.");
  const port = Number(process.env.SMTP_PORT || 465);
  return nodemailer.createTransport({
    host,
    port,
    secure: process.env.SMTP_SECURE ? process.env.SMTP_SECURE.toLowerCase() === "true" : port === 465,
    auth: { user, pass },
  });
}

function sender() {
  return process.env.EMAIL_FROM || `ZuriStay Worldwide <${process.env.SMTP_USER || "robinsonbarasa6@gmail.com"}>`;
}

export async function sendZuriStayEmail(input: {
  to: string;
  subject: string;
  text: string;
  html?: string;
  attachments?: MailAttachment[];
}) {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.to)) throw new Error("Recipient email address is invalid.");
  const transport = mailTransport();
  return transport.sendMail({
    from: sender(),
    to: input.to,
    replyTo: process.env.BUSINESS_EMAIL || process.env.SMTP_USER || "robinsonbarasa6@gmail.com",
    subject: input.subject,
    text: input.text,
    html: input.html,
    attachments: input.attachments?.map((file) => ({
      filename: file.filename,
      content: file.content,
      contentType: file.contentType,
    })),
  });
}

export async function createReceiptPdf(snapshot: Record<string, unknown>) {
  const document = new PDFDocument({ size: "A4", margin: 48, info: { Title: "ZuriStay Worldwide Booking Receipt", Author: "ZuriStay Worldwide" } });
  const chunks: Buffer[] = [];
  const completed = new Promise<Buffer>((resolve, reject) => {
    document.on("data", (chunk: Buffer) => chunks.push(Buffer.from(chunk)));
    document.on("end", () => resolve(Buffer.concat(chunks)));
    document.on("error", reject);
  });

  const text = (value: unknown, fallback = "—") => typeof value === "string" || typeof value === "number" ? String(value) : fallback;
  const money = (value: unknown, currency: unknown) => `${text(currency, "KES")} ${Number(value || 0).toLocaleString("en-KE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  document.fillColor("#173b30").font("Helvetica-Bold").fontSize(22).text("ZuriStay Worldwide");
  document.moveDown(0.25).fillColor("#a77e3e").fontSize(10).text("OFFICIAL BOOKING PAYMENT RECEIPT");
  document.moveDown(1);
  document.fillColor("#173b30").fontSize(11).font("Helvetica-Bold").text("Receipt details");
  document.moveDown(0.4).font("Helvetica").fontSize(10).fillColor("#333333");
  document.text(`Receipt number: ${text(snapshot.receipt_number)}`);
  document.text(`Booking reference: ${text(snapshot.booking_reference)}`);
  document.text(`Payment status: PAID AND CONFIRMED`);
  document.text(`Payment date: ${text(snapshot.payment_date)}`);
  document.text(`Payment method: ${text(snapshot.payment_method)}`);
  document.text(`Provider transaction reference: ${text(snapshot.provider_reference)}`);
  document.moveDown(1).font("Helvetica-Bold").fontSize(11).fillColor("#173b30").text("Guest");
  document.moveDown(0.4).font("Helvetica").fontSize(10).fillColor("#333333");
  document.text(`Name: ${text(snapshot.guest_name)}`);
  document.text(`Email: ${text(snapshot.guest_email)}`);
  document.text(`Phone: ${text(snapshot.guest_phone)}`);
  document.moveDown(1).font("Helvetica-Bold").fontSize(11).fillColor("#173b30").text("Accommodation");
  document.moveDown(0.4).font("Helvetica").fontSize(10).fillColor("#333333");
  document.text(`Property: ${text(snapshot.property_name)}`);
  document.text(`Location: ${[snapshot.city, snapshot.county, snapshot.country].filter(Boolean).map(String).join(", ") || "—"}`);
  document.text(`Check-in: ${text(snapshot.check_in)}`);
  document.text(`Check-out: ${text(snapshot.check_out)}`);
  document.text(`Nights: ${text(snapshot.nights)}    Rooms: ${text(snapshot.rooms)}    Guests: ${text(snapshot.guests)}`);
  document.moveDown(1).font("Helvetica-Bold").fontSize(11).fillColor("#173b30").text("Payment summary");
  document.moveDown(0.4).font("Helvetica").fontSize(10).fillColor("#333333");
  document.text(`Booking subtotal: ${money(snapshot.subtotal, snapshot.currency)}`);
  document.text(`Total paid: ${money(snapshot.total_amount, snapshot.currency)}`, { continued: false });
  document.moveDown(1.5).fillColor("#173b30").font("Helvetica-Bold").fontSize(11).text("Thank you for booking with ZuriStay Worldwide.");
  document.moveDown(0.4).font("Helvetica").fontSize(9).fillColor("#666666").text(`For assistance, contact ${process.env.BUSINESS_EMAIL || "robinsonbarasa6@gmail.com"}.`);
  document.moveDown(0.4).text("This receipt confirms that the payment shown above was verified and applied to the booking.");
  document.end();
  return completed;
}

function safeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[character] || character);
}

export async function sendPartnerApplicationAcknowledgement(input: {
  email: string; contactPerson: string; businessName: string;
}) {
  const name = safeHtml(input.contactPerson);
  const business = safeHtml(input.businessName);
  await sendZuriStayEmail({
    to: input.email,
    subject: "We have received your ZuriStay Worldwide partner application",
    text: `Hello ${input.contactPerson},\n\nThank you for applying to partner with ZuriStay Worldwide on behalf of ${input.businessName}. We have received your application and it is pending review. Our team will contact you using the details you supplied if further information is needed.\n\nThis email confirms receipt only; it is not an approval or a confirmation that your property is published.\n\nFor assistance, reply to this email or contact ${process.env.BUSINESS_EMAIL || "robinsonbarasa6@gmail.com"}.\n\nZuriStay Worldwide`,
    html: `<p>Hello ${name},</p><p>Thank you for applying to partner with <strong>ZuriStay Worldwide</strong> on behalf of <strong>${business}</strong>.</p><p>We have received your application and it is <strong>pending review</strong>. Our team will contact you using the details you supplied if further information is needed.</p><p>This email confirms receipt only; it is not an approval or confirmation that your property is published.</p><p>For assistance, reply to this email or contact ${safeHtml(process.env.BUSINESS_EMAIL || "robinsonbarasa6@gmail.com")}.</p><p>ZuriStay Worldwide</p>`,
  });
}

export async function sendPartnerPropertyEditAcknowledgement(input: {
  email: string; contactPerson?: string | null; businessName?: string | null; propertyName: string; changeType?: string;
}) {
  const contact = input.contactPerson ? safeHtml(input.contactPerson) : "Partner";
  const business = input.businessName ? safeHtml(input.businessName) : "your property";
  const property = safeHtml(input.propertyName);
  const action = input.changeType || "property details";
  await sendZuriStayEmail({
    to: input.email,
    subject: `ZuriStay received your ${action} update — ${input.propertyName}`,
    text: `Hello ${input.contactPerson || "Partner"},\n\nWe have successfully saved your ${action} update for ${input.propertyName} (${input.businessName || "your partner account"}). The update is recorded in your partner dashboard. If the change affects listing content, the property may temporarily be hidden while its publication review status is refreshed. Please check your dashboard for the current status.\n\nThis is an automatic confirmation that your update was saved, not a publication or approval notice.\n\nFor assistance, contact ${process.env.BUSINESS_EMAIL || "robinsonbarasa6@gmail.com"}.\n\nZuriStay Worldwide`,
    html: `<p>Hello ${contact},</p><p>We have successfully saved your <strong>${safeHtml(action)}</strong> update for <strong>${property}</strong> (${business}). The update is recorded in your partner dashboard.</p><p>If the change affects listing content, the property may temporarily be hidden while its publication review status is refreshed. Please check your dashboard for the current status.</p><p>This is an automatic confirmation that your update was saved, not a publication or approval notice.</p><p>For assistance, contact ${safeHtml(process.env.BUSINESS_EMAIL || "robinsonbarasa6@gmail.com")}.</p><p>ZuriStay Worldwide</p>`,
  });
}
