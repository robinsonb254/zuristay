import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Contact ZuriStay Worldwide",
  description: "Contact ZuriStay Worldwide for reservations, general enquiries, customer support and accommodation partnerships.",
  alternates: { canonical: "/contact" },
};

const contacts = [
  { title: "Reservations & bookings", email: "bookings@zuristayworldwide.com", description: "Booking enquiries, reservation changes and cancellation requests." },
  { title: "General enquiries", email: "info@zuristayworldwide.com", description: "General questions about ZuriStay Worldwide and the platform." },
  { title: "Customer support", email: "support@zuristayworldwide.com", description: "Help with your account, booking experience or customer service questions." },
  { title: "Accommodation partners", email: "partners@zuristayworldwide.com", description: "Property onboarding, partner enquiries and accommodation listings." },
];

export default function ContactPage() {
  return (
    <main className="min-h-screen bg-[#fbfaf7] text-[#173b30]">
      <header className="border-b border-[#e9e3d8] bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5">
          <Link href="/" className="text-xl font-black tracking-tight text-[#173b30]">ZuriStay Worldwide</Link>
          <Link href="/destinations" className="text-sm font-bold text-[#173b30] transition hover:text-[#a77e3e]">Explore destinations</Link>
        </div>
      </header>
      <section className="mx-auto max-w-6xl px-5 py-16 sm:py-20">
        <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-[#a77e3e]">We&apos;re here to help</p>
        <h1 className="mt-3 text-4xl font-black tracking-tight text-[#173b30] sm:text-5xl">Contact ZuriStay Worldwide</h1>
        <p className="mt-5 max-w-2xl leading-8 text-[#52665d]">Choose the team that best matches your enquiry. Our official contact addresses are listed below.</p>
        <div className="mt-10 grid gap-5 sm:grid-cols-2">
          {contacts.map((item) => (
            <section key={item.email} className="rounded-2xl border border-[#e9e3d8] bg-white p-6 shadow-sm">
              <h2 className="text-lg font-extrabold text-[#173b30]">{item.title}</h2>
              <p className="mt-2 min-h-12 text-sm leading-6 text-[#52665d]">{item.description}</p>
              <a href={`mailto:${item.email}`} className="mt-4 inline-flex break-all text-sm font-extrabold text-[#173b30] transition hover:text-[#a77e3e]">{item.email}</a>
            </section>
          ))}
        </div>
        <section className="mt-8 rounded-2xl border border-[#e8dfcf] bg-[#f4eee2] p-6">
          <h2 className="font-extrabold text-[#173b30]">Booking cancellations and refunds</h2>
          <p className="mt-2 leading-7 text-[#52665d]">For a cancellation request, contact the bookings team and include your booking reference and the email address used for the reservation.</p>
          <Link href="/cancellation-refund-policy" className="mt-4 inline-flex rounded-full bg-[#173b30] px-6 py-3 text-sm font-extrabold text-white transition hover:bg-[#245545]">Read the Cancellation &amp; Refund Policy</Link>
        </section>
        <div className="mt-8 flex flex-wrap gap-5 text-sm font-bold text-[#173b30]">
          <Link href="/terms-and-conditions" className="transition hover:text-[#a77e3e]">Terms &amp; Conditions</Link>
          <Link href="/" className="transition hover:text-[#a77e3e]">Return to homepage</Link>
        </div>
      </section>
      <footer className="border-t border-[#e9e3d8] bg-white px-5 py-7 text-center text-xs font-semibold text-[#66766e]">© {new Date().getFullYear()} ZuriStay Worldwide. All rights reserved.</footer>
    </main>
  );
}
