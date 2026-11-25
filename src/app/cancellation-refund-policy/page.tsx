"use client";

import Link from "next/link";

export default function CancellationRefundPolicyPage() {
  return (
    <main className="min-h-screen bg-slate-50 text-slate-800">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-5 py-5">
          <Link href="/" className="text-2xl font-black tracking-tight text-blue-950">
            ZuriStay<span className="text-orange-500">.</span>
          </Link>
          <Link href="/booking" className="text-sm font-bold text-orange-600 hover:text-orange-700">
            Return to booking
          </Link>
        </div>
      </header>

      <article className="mx-auto max-w-4xl px-5 py-12">
        <p className="text-sm font-bold uppercase tracking-[0.18em] text-orange-600">Guest policy</p>
        <h1 className="mt-3 text-3xl font-black tracking-tight text-blue-950 sm:text-4xl">
          Cancellation and Refund Policy
        </h1>
        <p className="mt-4 text-sm leading-7 text-slate-600">
          This is the standard ZuriStay Worldwide policy and applies consistently to every accommodation booked through the platform.
        </p>

        <section className="mt-8 space-y-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <div>
            <h2 className="text-lg font-black text-blue-950">1. Cancellation 48 hours or more before check-in</h2>
            <p className="mt-2 leading-7 text-slate-600">If you cancel at least 48 hours before your scheduled check-in time, you are eligible for a full refund of the amount paid for the booking.</p>
          </div>
          <div>
            <h2 className="text-lg font-black text-blue-950">2. Cancellation less than 48 hours before check-in</h2>
            <p className="mt-2 leading-7 text-slate-600">If you cancel less than 48 hours before your scheduled check-in time, the charge for the first night is retained. The amount paid for the remaining nights is refundable.</p>
          </div>
          <div>
            <h2 className="text-lg font-black text-blue-950">3. No-show</h2>
            <p className="mt-2 leading-7 text-slate-600">If you do not arrive for your reservation and have not cancelled it, the charge for the first night is retained. The amount paid for the remaining nights is refundable.</p>
          </div>
          <div>
            <h2 className="text-lg font-black text-blue-950">4. Early departure</h2>
            <p className="mt-2 leading-7 text-slate-600">If you check out earlier than the confirmed departure date, unused nights are not refundable.</p>
          </div>
          <div>
            <h2 className="text-lg font-black text-blue-950">5. Refund processing</h2>
            <p className="mt-2 leading-7 text-slate-600">Once a refund is approved, ZuriStay Worldwide will initiate or arrange processing within 7–14 business days. The time taken for the funds to appear in your account may depend on the payment provider and receiving institution.</p>
          </div>
          <div>
            <h2 className="text-lg font-black text-blue-950">6. One standard policy</h2>
            <p className="mt-2 leading-7 text-slate-600">The same cancellation and refund rules apply across all properties on ZuriStay Worldwide. Property partners do not set separate cancellation rules for bookings made through the platform.</p>
          </div>
        </section>

        <section className="mt-6 rounded-2xl border border-blue-200 bg-blue-50 p-6">
          <h2 className="font-black text-blue-950">How to request a cancellation</h2>
          <p className="mt-2 text-sm leading-6 text-slate-700">Email the bookings team with your booking reference, the email address used for the reservation, and your cancellation request. Include your preferred contact details if you need assistance.</p>
          <a href="mailto:bookings@zuristayworldwide.com?subject=Booking%20cancellation%20request" className="mt-4 inline-flex rounded-xl bg-blue-950 px-5 py-3 text-sm font-bold text-white hover:bg-blue-900">
            Email bookings team
          </a>
        </section>

        <p className="mt-8 text-xs leading-6 text-slate-500">
          This policy describes ZuriStay Worldwide’s standard booking rules. Refund eligibility is assessed against the booking details and the timing of the cancellation request. Applicable consumer rights under Kenyan law remain unaffected.
        </p>
      </article>
      <footer className="border-t border-slate-200 bg-white px-5 py-7 text-center text-xs text-slate-500">
        © {new Date().getFullYear()} ZuriStay Worldwide. Your World. Your Stay.
      </footer>
    </main>
  );
}
