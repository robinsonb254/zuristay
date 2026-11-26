
"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  CheckCircle2,
  MapPin,
  ShieldCheck,
} from "lucide-react";

const propertyTypes = [
  "Hotel",
  "Resort",
  "Apartment",
  "Villa",
  "Lodge",
  "Guesthouse",
  "Bed and Breakfast",
  "Holiday home",
  "Other",
];

export default function PartnerRegistrationPage() {
  const [form, setForm] = useState({
    businessName: "",
    contactPerson: "",
    email: "",
    phone: "",
    propertyType: "",
    location: "",
    message: "",
    website: "",
    hasConferenceRooms: false,
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);

  function updateField(field: keyof typeof form, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
    setError("");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (form.website.trim()) {
      setSubmitted(true);
      return;
    }

    if (loading) return;

    setLoading(true);

    try {
      const response = await fetch("/api/partner/applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessName: form.businessName.trim(),
          contactPerson: form.contactPerson.trim(),
          email: form.email.trim().toLowerCase(),
          phone: form.phone.trim(),
          propertyType: form.propertyType,
          location: form.location.trim(),
          message: form.message.trim(),
          hasConferenceRooms: form.hasConferenceRooms,
          website: form.website,
        }),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok || !result?.success) {
        throw new Error(result?.error || "We could not submit your application.");
      }
      setSubmitted(true);
    } catch (err) {
      console.error("Partner application error:", err);
      setError(
        "We could not submit your application right now. Please check your details and try again."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#faf9f6] text-[#173b30]">
      <header className="border-b border-gray-100 bg-white">
        <div className="container flex h-20 items-center justify-between">
          <Link href="/" className="text-3xl font-bold tracking-tight">
            Zuri<span className="text-[#c49a52]">Stay</span>
          </Link>

          <Link
            href="/"
            className="flex items-center gap-2 text-sm font-semibold text-gray-600 hover:text-[#c49a52]"
          >
            <ArrowLeft size={17} />
            Back to home
          </Link>
        </div>
      </header>

      <section className="container grid gap-12 py-12 lg:grid-cols-[0.85fr_1.15fr] lg:py-20">
        <div className="lg:sticky lg:top-12 lg:self-start">
          <span className="inline-flex items-center gap-2 rounded-full bg-[#f1eadc] px-4 py-2 text-xs font-bold tracking-widest text-[#9a7437]">
            <Building2 size={15} />
            PARTNER WITH ZURISTAY WORLDWIDE
          </span>

          <h1 className="mt-7 text-4xl font-bold leading-tight md:text-5xl">
            Bring your property to a world of travellers.
          </h1>

          <p className="mt-6 max-w-lg leading-8 text-gray-600">
            Join ZuriStay Worldwide and make your hotel, apartment, villa,
            resort or guesthouse discoverable by travellers
            searching for their next stay.
          </p>

          <div className="mt-10 space-y-6">
            <div className="flex gap-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#f1eadc] text-[#a77e3e]">
                <CheckCircle2 size={22} />
              </div>
              <div>
                <h2 className="font-bold">Submit your application</h2>
                <p className="mt-1 text-sm leading-6 text-gray-500">
                  Tell us about your property and how to reach you.
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#f1eadc] text-[#a77e3e]">
                <ShieldCheck size={22} />
              </div>
              <div>
                <h2 className="font-bold">Application review</h2>
                <p className="mt-1 text-sm leading-6 text-gray-500">
                  Our team reviews applications before approving
                  properties for the marketplace.
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#f1eadc] text-[#a77e3e]">
                <MapPin size={22} />
              </div>
              <div>
                <h2 className="font-bold">Prepare to reach more guests</h2>
                <p className="mt-1 text-sm leading-6 text-gray-500">
                  Approved partners can proceed to property
                  onboarding.
                </p>
              </div>
            </div>
          </div>

          <p className="mt-10 text-sm text-gray-500">
            Already exploring ZuriStay Worldwide?{" "}
            <Link href="/" className="font-bold text-[#a77e3e]">
              Discover stays
            </Link>
          </p>
        </div>

        <div className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm md:p-10">
          {submitted ? (
            <div className="flex min-h-[480px] flex-col items-center justify-center text-center">
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-green-50 text-green-700">
                <CheckCircle2 size={42} />
              </div>

              <h2 className="mt-7 text-3xl font-bold">
                Application received!
              </h2>

              <p className="mt-4 max-w-md leading-7 text-gray-600">
                Thank you for your interest in partnering with
                ZuriStay Worldwide. Your application has been submitted for
                review. Our team will contact you using the details
                you provided.
              </p>

              <p className="mt-5 rounded-xl bg-[#f7f5ef] px-5 py-3 text-sm font-semibold text-[#8a6b37]">
                Application status: Pending review
              </p>

              <Link
                href="/"
                className="mt-8 inline-flex items-center gap-2 rounded-full bg-[#173b30] px-7 py-4 font-bold text-white hover:bg-[#245545]"
              >
                Return to ZuriStay Worldwide
                <ArrowRight size={18} />
              </Link>
            </div>
          ) : (
            <>
              <div className="mb-8">
                <p className="text-xs font-bold tracking-[0.2em] text-[#c49a52]">
                  PARTNER REGISTRATION
                </p>
                <h2 className="mt-3 text-2xl font-bold md:text-3xl">
                  Tell us about your property
                </h2>
                <p className="mt-3 text-sm leading-6 text-gray-500">
                  Complete the details below. Fields marked with *
                  are required.
                </p>
                <p className="mt-3 rounded-xl bg-[#f7f5ef] px-4 py-3 text-sm leading-6 text-[#765c31]">
                  You do not need to create a ZuriStay account before applying. If approved, we will create a partner account for you or link your existing ZuriStay account. New accounts receive a secure activation link to set a password; existing account holders keep their current password.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label
                    htmlFor="businessName"
                    className="mb-2 block text-sm font-semibold"
                  >
                    Business or property name *
                  </label>
                  <input
                    id="businessName"
                    required
                    maxLength={150}
                    value={form.businessName}
                    onChange={(e) =>
                      updateField("businessName", e.target.value)
                    }
                    placeholder="e.g. Ocean View Hotel"
                    className="w-full rounded-xl border border-gray-200 px-4 py-3.5 text-sm outline-none transition focus:border-[#c49a52] focus:ring-2 focus:ring-[#c49a52]/15"
                  />
                </div>

                <div>
                  <label
                    htmlFor="contactPerson"
                    className="mb-2 block text-sm font-semibold"
                  >
                    Contact person&apos;s full name *
                  </label>
                  <input
                    id="contactPerson"
                    required
                    maxLength={120}
                    value={form.contactPerson}
                    onChange={(e) =>
                      updateField("contactPerson", e.target.value)
                    }
                    placeholder="Your full name"
                    className="w-full rounded-xl border border-gray-200 px-4 py-3.5 text-sm outline-none transition focus:border-[#c49a52] focus:ring-2 focus:ring-[#c49a52]/15"
                  />
                </div>

                <div className="grid gap-5 md:grid-cols-2">
                  <div>
                    <label
                      htmlFor="email"
                      className="mb-2 block text-sm font-semibold"
                    >
                      Email address *
                    </label>
                    <input
                      id="email"
                      type="email"
                      required
                      maxLength={254}
                      value={form.email}
                      onChange={(e) =>
                        updateField("email", e.target.value)
                      }
                      placeholder="you@example.com"
                      className="w-full rounded-xl border border-gray-200 px-4 py-3.5 text-sm outline-none transition focus:border-[#c49a52] focus:ring-2 focus:ring-[#c49a52]/15"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="phone"
                      className="mb-2 block text-sm font-semibold"
                    >
                      Phone number *
                    </label>
                    <input
                      id="phone"
                      type="tel"
                      required
                      maxLength={30}
                      value={form.phone}
                      onChange={(e) =>
                        updateField("phone", e.target.value)
                      }
                      placeholder="+254 7XX XXX XXX"
                      className="w-full rounded-xl border border-gray-200 px-4 py-3.5 text-sm outline-none transition focus:border-[#c49a52] focus:ring-2 focus:ring-[#c49a52]/15"
                    />
                  </div>
                </div>

                <div className="grid gap-5 md:grid-cols-2">
                  <div>
                    <label
                      htmlFor="propertyType"
                      className="mb-2 block text-sm font-semibold"
                    >
                      Property type *
                    </label>
                    <select
                      id="propertyType"
                      required
                      value={form.propertyType}
                      onChange={(e) =>
                        updateField("propertyType", e.target.value)
                      }
                      className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3.5 text-sm outline-none focus:border-[#c49a52] focus:ring-2 focus:ring-[#c49a52]/15"
                    >
                      <option value="">Select property type</option>
                      {propertyTypes.map((type) => (
                        <option key={type} value={type}>
                          {type}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label
                      htmlFor="location"
                      className="mb-2 block text-sm font-semibold"
                    >
                      Property location *
                    </label>
                    <input
                      id="location"
                      required
                      maxLength={200}
                      value={form.location}
                      onChange={(e) =>
                        updateField("location", e.target.value)
                      }
                      placeholder="e.g. Malindi, Kilifi County"
                      className="w-full rounded-xl border border-gray-200 px-4 py-3.5 text-sm outline-none focus:border-[#c49a52] focus:ring-2 focus:ring-[#c49a52]/15"
                    />
                  </div>
                </div>

                <div className="rounded-xl border border-gray-200 bg-[#faf9f6] p-4">
                  <label className="flex items-start gap-3 text-sm font-semibold">
                    <input type="checkbox" checked={form.hasConferenceRooms} onChange={(e) => setForm((current) => ({ ...current, hasConferenceRooms: e.target.checked }))} className="mt-1 h-4 w-4 accent-[#173b30]" />
                    <span>Does this property have conference rooms?</span>
                  </label>
                </div>
                <div>
                  <label
                    htmlFor="message"
                    className="mb-2 block text-sm font-semibold"
                  >
                    Tell us more about your property
                  </label>
                  <textarea
                    id="message"
                    rows={5}
                    maxLength={1500}
                    value={form.message}
                    onChange={(e) =>
                      updateField("message", e.target.value)
                    }
                    placeholder="Describe your property, facilities, number of rooms or anything else we should know."
                    className="w-full resize-y rounded-xl border border-gray-200 px-4 py-3.5 text-sm outline-none focus:border-[#c49a52] focus:ring-2 focus:ring-[#c49a52]/15"
                  />
                </div>

                <div
                  className="absolute -left-[9999px]"
                  aria-hidden="true"
                >
                  <label htmlFor="website">Website</label>
                  <input
                    id="website"
                    type="text"
                    tabIndex={-1}
                    autoComplete="off"
                    value={form.website}
                    onChange={(e) =>
                      updateField("website", e.target.value)
                    }
                  />
                </div>

                {error && (
                  <p
                    role="alert"
                    className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700"
                  >
                    {error}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="flex w-full items-center justify-center gap-3 rounded-full bg-[#173b30] px-7 py-4 font-bold text-white transition hover:bg-[#245545] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loading ? "Submitting application..." : "Submit application"}
                  {!loading && <ArrowRight size={18} />}
                </button>

                <p className="text-center text-xs leading-6 text-gray-500">
                  By submitting, you confirm that the information
                  provided is accurate. Submission does not mean
                  automatic approval or publication.
                </p>
              </form>
            </>
          )}
        </div>
      </section>

      <footer className="bg-[#102c24] py-8 text-center text-sm text-white/60">
        © {new Date().getFullYear()} ZuriStay Worldwide. Your world. Your stay.
      </footer>
    </main>
  );
}
