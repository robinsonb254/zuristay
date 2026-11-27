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
  const configured = process.env.EMAIL_FROM?.trim();
  const configuredAddress = configured?.match(/<([^<>]+)>/)?.[1] || configured;
  const address = configuredAddress || "bookings@zuristayworldwide.com";
  return `ZuriStay Worldwide <${address}>`;
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
    replyTo: "bookings@zuristayworldwide.com",
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
  document.moveDown(0.4).font("Helvetica").fontSize(9).fillColor("#666666").text(`For assistance, contact ${"bookings@zuristayworldwide.com"}.`);
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
    text: `Hello ${input.contactPerson},\n\nThank you for applying to partner with ZuriStay Worldwide on behalf of ${input.businessName}. We have received your application and it is pending review. Our team will contact you using the details you supplied if further information is needed.\n\nThis email confirms receipt only; it is not an approval or a confirmation that your property is published.\n\nFor assistance, reply to this email or contact ${"bookings@zuristayworldwide.com"}.\n\nZuriStay Worldwide`,
    html: `<p>Hello ${name},</p><p>Thank you for applying to partner with <strong>ZuriStay Worldwide</strong> on behalf of <strong>${business}</strong>.</p><p>We have received your application and it is <strong>pending review</strong>. Our team will contact you using the details you supplied if further information is needed.</p><p>This email confirms receipt only; it is not an approval or confirmation that your property is published.</p><p>For assistance, reply to this email or contact ${safeHtml("bookings@zuristayworldwide.com")}.</p><p>ZuriStay Worldwide</p>`,
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
    text: `Hello ${input.contactPerson || "Partner"},\n\nWe have successfully saved your ${action} update for ${input.propertyName} (${input.businessName || "your partner account"}). The update is recorded in your partner dashboard. If the change affects listing content, the property may temporarily be hidden while its publication review status is refreshed. Please check your dashboard for the current status.\n\nThis is an automatic confirmation that your update was saved, not a publication or approval notice.\n\nFor assistance, contact ${"bookings@zuristayworldwide.com"}.\n\nZuriStay Worldwide`,
    html: `<p>Hello ${contact},</p><p>We have successfully saved your <strong>${safeHtml(action)}</strong> update for <strong>${property}</strong> (${business}). The update is recorded in your partner dashboard.</p><p>If the change affects listing content, the property may temporarily be hidden while its publication review status is refreshed. Please check your dashboard for the current status.</p><p>This is an automatic confirmation that your update was saved, not a publication or approval notice.</p><p>For assistance, contact ${safeHtml("bookings@zuristayworldwide.com")}.</p><p>ZuriStay Worldwide</p>`,
  });
}

export async function sendPartnerApplicationDecision(input: {
  email: string;
  contactPerson: string;
  businessName: string;
  approved: boolean;
  partnerAccessUrl?: string;
  partnerRecoveryUrl?: string;
}) {
  const name = safeHtml(input.contactPerson);
  const business = safeHtml(input.businessName);
  const status = input.approved ? "approved" : "not approved";
  const createUrl = input.partnerAccessUrl || "https://www.zuristayworldwide.com/register?mode=partner";
  const recoveryUrl = input.partnerRecoveryUrl || "https://www.zuristayworldwide.com/register?mode=partner";
  const signInUrl = "https://www.zuristayworldwide.com/login?mode=partner&next=%2Fpartner%2Fdashboard";
  const approvedText = [
    "Your partner application has been approved.",
    "FIRST — CREATE ACCOUNT: Open the Create account link below. It is valid for 7 days if it has not been opened. When you intentionally continue into the registration form, this first link is used and cannot be used again.",
    "After creating your account, use the Sign in option shown on the same page. Sign in with the email address on this approved application and the password you created. You will be taken to your partner dashboard.",
    "SECOND — RECOVERY LINK: If you open the first link and then accidentally close the page or go back before completing registration, use the separate Recovery link at the end of this email. It becomes active only after the first link has been intentionally used, and remains valid for 7 days from that moment.",
    "The recovery link is restricted to this approved application and email address. If you already completed account creation, it takes you to partner sign-in; it does not reset your password, change your credentials, or create another account. If you had not finished creating the account, it lets you resume registration using the same approved email address. Do not share either link.",
    "CREATE ACCOUNT: " + createUrl,
    "PARTNER SIGN IN: " + signInUrl,
    "RECOVERY LINK (use only if you need to resume after opening the first link): " + recoveryUrl
  ].join("\n\n");
  const onboarding = "Once signed in, open your partner dashboard to complete or edit your property details, add and manage rooms, upload property photos, set room rates and availability, and keep your listing information up to date. Save your changes in the dashboard. A property is not made publicly bookable until it has completed ZuriStay's separate listing review.";
  const recoveryText = "RECOVERY LINK (save this for later; use only after opening the first link): " + recoveryUrl;
  const nextStep = input.approved
    ? approvedText.replace("\n\nRECOVERY LINK (use only if you need to resume after opening the first link): " + recoveryUrl, "") + "\n\n" + onboarding + "\n\n" + recoveryText
    : "If you would like clarification or wish to discuss a future application, please contact our team.";
  const assistanceHtml = '<p>For assistance, reply to this email or email <a href="mailto:bookings@zuristayworldwide.com">bookings@zuristayworldwide.com</a>.</p>';
  const activationHtml = '<p>Your partner application has been approved. Follow these steps carefully:</p><h3>1. Create your account</h3><p>The first link is valid for <strong>7 days if unopened</strong>. When you intentionally continue into the registration form, the first link is consumed and cannot be reused.</p><p style="margin:20px 0;text-align:center"><a href="' + safeHtml(createUrl) + '" style="display:inline-block;padding:14px 24px;background:#173b30;color:#ffffff;text-decoration:none;border-radius:999px;font-weight:700">CREATE ACCOUNT</a></p><p>After registration, use the <strong>Sign in</strong> option on that same page. Sign in with the approved application email and the password you created. You will be directed to your partner dashboard.</p><h3>2. If you accidentally close the page</h3><p>If you have opened the first link but accidentally closed the page or gone back before finishing, use the separate recovery link at the <strong>end of this email</strong>. It becomes active only after the first link has been intentionally used and expires 7 days after that.</p><p>The recovery link is restricted to this approved application and email. If your account already exists, it opens partner sign-in only and requires your original email and password. It does not reset your password or create a duplicate account. If registration was interrupted before account creation, it lets you resume using the same approved email.</p><p><a href="' + safeHtml(signInUrl) + '" style="color:#173b30;font-weight:700">Partner sign in</a></p><p>Once signed in, open your partner dashboard to complete or edit your property details, add and manage rooms, upload property photos, set room rates and availability, and keep your listing information up to date. A property is not made publicly bookable until it has completed ZuriStay\'s separate listing review.</p><p><strong>Keep both links private. Do not forward them to anyone.</strong></p>';
  await sendZuriStayEmail({
    to: input.email,
    subject: "ZuriStay Worldwide partner application update — " + (input.approved ? "Approved" : "Review update"),
    text: "Hello " + input.contactPerson + ",\n\nYour partner application for " + input.businessName + " has been reviewed. Its current status is: " + status.toUpperCase() + ".\n\n" + nextStep + "\n\nFor assistance, reply to this email or email bookings@zuristayworldwide.com.\n\nZuriStay Worldwide",
    html: input.approved
      ? "<p>Hello " + name + ",</p><p>Your partner application for <strong>" + business + "</strong> has been reviewed. Its current status is: <strong>APPROVED</strong>.</p>" + activationHtml + assistanceHtml + "<p>ZuriStay Worldwide</p>" + recoveryHtml
      : "<p>Hello " + name + ",</p><p>Your partner application for <strong>" + business + "</strong> has been reviewed. Its current status is: <strong>" + status.toUpperCase() + "</strong>.</p><p>" + safeHtml(nextStep) + "</p>" + assistanceHtml + "<p>ZuriStay Worldwide</p>",
  });
}
