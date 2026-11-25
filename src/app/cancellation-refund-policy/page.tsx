"use client";

import Link from "next/link";

export default function CancellationRefundPolicyPage() {
  return (
    <main className="min-h-screen bg-[#fbfaf7] text-[#173b30]">
      <header className="border-b border-[#e9e3d8] bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-5">
          <Link href="/" className="text-xl font-black tracking-tight text-[#173b30]">ZuriStay Worldwide</Link>
          <Link href="/contact" className="text-sm font-bold text-[#173b30] transition hover:text-[#a77e3e]">Contact</Link>
        </div>
      </header>
      <article className="mx-auto max-w-4xl px-5 py-14">
        <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-[#a77e3e]">Guest policy</p>
        <h1 className="mt-3 text-3xl font-black tracking-tight text-[#173b30] sm:text-4xl">Cancellation &amp; Refund Policy</h1>
        <p className="mt-4 leading-7 text-[#52665d]">One standard policy applies to every accommodation reservation made through ZuriStay Worldwide.</p>
        <section className="mt-8 rounded-2xl border border-[#e8dfcf] bg-[#f4eee2] p-6">
          <h2 className="font-extrabold text-[#173b30]">Standard check-in time</h2>
          <p className="mt-2 leading-7 text-[#39574d]">The standard check-in time at all ZuriStay Worldwide properties is <strong className="font-extrabold text-[#173b30]">2:00 PM East Africa Time (EAT)</strong>. The 48-hour cancellation period is measured against this standard check-in time on the scheduled arrival date.</p>
        </section>
        <section className="mt-6 space-y-7 rounded-2xl border border-[#e9e3d8] bg-white p-6 shadow-sm sm:p-8">
          <div><h2 className="text-lg font-extrabold text-[#173b30]">1. Cancellation 48 hours or more before check-in</h2><p className="mt-2 leading-7 text-[#52665d]">If you cancel at least 48 hours before your scheduled check-in time, you are eligible for a <strong className="font-extrabold text-[#173b30]">full refund</strong> of the amount paid for the booking.</p></div>
          <div><h2 className="text-lg font-extrabold text-[#173b30]">2. Cancellation less than 48 hours before check-in</h2><p className="mt-2 leading-7 text-[#52665d]">If you cancel less than 48 hours before your scheduled check-in time, the <strong className="font-extrabold text-[#173b30]">first night&apos;s charge is retained</strong>. The amount paid for the remaining nights is refundable.</p></div>
          <div><h2 className="text-lg font-extrabold text-[#173b30]">3. No-show</h2><p className="mt-2 leading-7 text-[#52665d]">If you do not arrive for your reservation and have not cancelled it, the <strong className="font-extrabold text-[#173b30]">first night&apos;s charge is retained</strong>. The amount paid for the remaining nights is refundable.</p></div>
          <div><h2 className="text-lg font-extrabold text-[#173b30]">4. Early departure</h2><p className="mt-2 leading-7 text-[#52665d]">If you check out earlier than the confirmed departure date, <strong className="font-extrabold text-[#173b30]">unused nights are not refundable</strong>.</p></div>
          <div><h2 className="text-lg font-extrabold text-[#173b30]">5. Refund processing</h2><p className="mt-2 leading-7 text-[#52665d]">Once a refund is approved, ZuriStay Worldwide will initiate or arrange processing within <strong className="font-extrabold text-[#173b30]">7–14 business days</strong>. The time for funds to appear may depend on the payment provider and receiving institution.</p></div>
          <div><h2 className="text-lg font-extrabold text-[#173b30]">6. One standard policy across all properties</h2><p className="mt-2 leading-7 text-[#52665d]">These cancellation and refund rules apply uniformly to every property on ZuriStay Worldwide. Property partners do not set separate cancellation rules or non-refundable rates for platform bookings.</p></div>
        </section>
        <section className="mt-6 rounded-2xl border border-[#e8dfcf] bg-[#f4eee2] p-6">
          <h2 className="font-extrabold text-[#173b30]">Request a cancellation</h2>
          <p className="mt-2 leading-7 text-[#52665d]">Email the bookings team with your booking reference, the email address used for the reservation and your cancellation request.</p>
          <a href="mailto:bookings@zuristayworldwide.com?subject=Booking%20cancellation%20request" className="mt-4 inline-flex rounded-full bg-[#173b30] px-6 py-3 text-sm font-extrabold text-white transition hover:bg-[#245545]">Email the bookings team</a>
        </section>
        <div className="mt-8 flex flex-wrap gap-5 text-sm font-bold text-[#173b30]">
          <Link href="/terms-and-conditions" className="transition hover:text-[#a77e3e]">Terms &amp; Conditions</Link>
          <Link href="/contact" className="transition hover:text-[#a77e3e]">Contact ZuriStay Worldwide</Link>
        </div>
      </article>
      <footer className="border-t border-[#e9e3d8] bg-white px-5 py-7 text-center text-xs font-semibold text-[#66766e]">© {new Date().getFullYear()} ZuriStay Worldwide. All rights reserved.</footer>
    </main>
  );
}
