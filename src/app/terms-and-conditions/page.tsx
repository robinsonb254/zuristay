import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms & Conditions",
  description: "Read the ZuriStay Worldwide terms and conditions for guests, reservations, payments and accommodation partners.",
  alternates: { canonical: "/terms-and-conditions" },
};

const heading = "text-lg font-extrabold text-[#173b30]";
const body = "mt-2 leading-7 text-[#52665d]";

export default function TermsAndConditionsPage() {
  return (
    <main className="min-h-screen bg-[#fbfaf7] text-[#173b30]">
      <header className="border-b border-[#e9e3d8] bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-5">
          <Link href="/" className="text-xl font-black tracking-tight text-[#173b30]">ZuriStay Worldwide</Link>
          <Link href="/contact" className="text-sm font-bold text-[#173b30] transition hover:text-[#a77e3e]">Contact</Link>
        </div>
      </header>
      <article className="mx-auto max-w-4xl px-5 py-14">
        <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-[#a77e3e]">Guest &amp; partner information</p>
        <h1 className="mt-3 text-3xl font-black tracking-tight text-[#173b30] sm:text-4xl">Terms &amp; Conditions</h1>
        <p className="mt-4 leading-7 text-[#52665d]">These terms govern access to and use of the ZuriStay Worldwide website and booking platform. By using the platform, creating an account, submitting a reservation or registering a property, you agree to the terms that apply to your activity.</p>

        <section className="mt-8 space-y-7 rounded-2xl border border-[#e9e3d8] bg-white p-6 shadow-sm sm:p-8">
          <div><h2 className={heading}>1. About ZuriStay Worldwide</h2><p className={body}>ZuriStay Worldwide is an accommodation discovery and booking platform connecting guests with participating accommodation providers. The platform displays property information, room options, availability and prices supplied or confirmed for participating listings.</p></div>
          <div><h2 className={heading}>2. Guest accounts and accurate information</h2><p className={body}>You are responsible for providing accurate, current contact and reservation information and for keeping your account sign-in details secure. Use your own account and notify the relevant ZuriStay team if you believe your account has been accessed without permission.</p></div>
          <div><h2 className={heading}>3. Reservations and availability</h2><p className={body}>A reservation request is subject to the selected accommodation's live room inventory and the details shown during checkout. A room may be held temporarily while payment is completed. The current booking flow provides a 15-minute room hold. <strong className="font-extrabold text-[#173b30]">A reservation is not confirmed until the required payment has been successfully verified and the booking confirmation is issued.</strong> If a room hold expires before payment is verified, the requested inventory may no longer be available.</p></div>
          <div><h2 className={heading}>4. Prices and payment</h2><p className={body}>The total displayed during checkout is the amount presented for the selected stay and room quantity. Payment methods currently offered through the platform are <strong className="font-extrabold text-[#173b30]">M-Pesa and PayPal</strong>, subject to availability at checkout. Follow the payment instructions shown for your reservation. A payment is treated as successful only after the platform receives and verifies the payment provider's confirmation.</p></div>
          <div><h2 className={heading}>5. Check-in and check-out</h2><p className={body}>The standard check-in time across ZuriStay Worldwide properties is <strong className="font-extrabold text-[#173b30]">2:00 PM East Africa Time (EAT)</strong>. Your selected property's confirmed booking details provide the stay dates and check-out date. Contact the bookings team if you need assistance with arrival arrangements.</p></div>
          <div><h2 className={heading}>6. Cancellations and refunds</h2><p className={body}>All platform reservations are subject to one uniform cancellation and refund policy across every property. Cancellations made 48 hours or more before the standard check-in time qualify for a full refund. For cancellations made less than 48 hours before check-in, or a no-show, the first night's charge is retained and the remaining nights are refundable. Early departure does not qualify for a refund of unused nights. Approved refunds are processed within 7–14 business days. The full policy is available on the <Link href="/cancellation-refund-policy" className="font-extrabold text-[#173b30] transition hover:text-[#a77e3e]">Cancellation &amp; Refund Policy</Link> page.</p></div>
          <div><h2 className={heading}>7. Guest responsibilities</h2><p className={body}>Guests are responsible for checking the property description, room details, occupancy limits, dates and total price before completing a reservation. Guests must provide accurate guest details and comply with the accommodation provider's reasonable property rules during their stay.</p></div>
          <div><h2 className={heading}>8. Property partner information</h2><p className={body}>Property partners are responsible for providing accurate property descriptions, photographs, room details, rates, availability and material information needed by guests. Partners must keep their listings current and honour confirmed reservations in accordance with the booking details and the uniform ZuriStay Worldwide cancellation and refund policy.</p></div>
          <div><h2 className={heading}>9. Platform use</h2><p className={body}>You must not misuse the platform, interfere with its operation, submit false information, attempt unauthorised access or use the service for unlawful activity. ZuriStay Worldwide may restrict access where necessary to protect guests, partners, listings or the operation of the platform.</p></div>
          <div><h2 className={heading}>10. Changes to these terms</h2><p className={body}>ZuriStay Worldwide may update these terms as the platform and its services develop. The version published on this page is the current version. Material changes will be reflected on this page.</p></div>
          <div><h2 className={heading}>11. Contact</h2><p className={body}>For reservations, cancellations and booking questions, contact <a href="mailto:bookings@zuristayworldwide.com" className="font-extrabold text-[#173b30] transition hover:text-[#a77e3e]">bookings@zuristayworldwide.com</a>. For general enquiries, contact <a href="mailto:info@zuristayworldwide.com" className="font-extrabold text-[#173b30] transition hover:text-[#a77e3e]">info@zuristayworldwide.com</a>. For customer assistance, contact <a href="mailto:support@zuristayworldwide.com" className="font-extrabold text-[#173b30] transition hover:text-[#a77e3e]">support@zuristayworldwide.com</a>. Property partners can contact <a href="mailto:partners@zuristayworldwide.com" className="font-extrabold text-[#173b30] transition hover:text-[#a77e3e]">partners@zuristayworldwide.com</a>.</p></div>
        </section>
        <div className="mt-8 flex flex-wrap gap-5 text-sm font-bold text-[#173b30]">
          <Link href="/cancellation-refund-policy" className="transition hover:text-[#a77e3e]">Cancellation &amp; Refund Policy</Link>
          <Link href="/contact" className="transition hover:text-[#a77e3e]">Contact ZuriStay Worldwide</Link>
        </div>
      </article>
      <footer className="border-t border-[#e9e3d8] bg-white px-5 py-7 text-center text-xs font-semibold text-[#66766e]">© {new Date().getFullYear()} ZuriStay Worldwide. All rights reserved.</footer>
    </main>
  );
}
