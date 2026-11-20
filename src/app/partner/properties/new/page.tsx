
"use client";

import { useEffect, useState, FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Building2,
  Loader2,
  MapPin,
  ShieldCheck,
} from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type KenyaCounty = {
  county_code: number;
  name: string;
  subcounties: { subcounty_code: string; name: string; county_code: number }[];
};

function normalizeCountyName(value: string) {
  return value.toLowerCase().replace(/\\s+city$/, "").trim();
}

function destinationBelongsToCounty(destinationCounty: string | null, countyName: string) {
  if (!destinationCounty) return false;
  const target = normalizeCountyName(countyName);
  return normalizeCountyName(destinationCounty) === target ||
    destinationCounty.split(/[\\/,]/).some((part) => normalizeCountyName(part) === target);
}

type Destination = {
  id: string;
  name: string;
  city: string;
  county: string;
  country: string;
  country_code: string;
};

const propertyTypes = [
  { value: "hotel", label: "Hotel" },
  { value: "resort", label: "Resort" },
  { value: "apartment", label: "Apartment" },
  { value: "villa", label: "Villa" },
  { value: "bnb", label: "Bed and Breakfast (B&B)" },
  { value: "lodge", label: "Lodge" },
  { value: "guesthouse", label: "Guesthouse" },
  { value: "hostel", label: "Hostel" },
  { value: "lounge", label: "Lounge" },
  { value: "venue", label: "Venue" },
  { value: "other", label: "Other" },
];

export default function NewPartnerPropertyPage() {
  const router = useRouter();

  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [counties, setCounties] = useState<KenyaCounty[]>([]);
  const [countyCode, setCountyCode] = useState("");
  const [subCountyCode, setSubCountyCode] = useState("");
  const [loadingDestinations, setLoadingDestinations] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [pageError, setPageError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const [name, setName] = useState("");
  const [propertyType, setPropertyType] = useState("hotel");
  const [destinationId, setDestinationId] = useState("");
  const [address, setAddress] = useState("");
  const [description, setDescription] = useState("");
  const [currency, setCurrency] = useState("KES");
  const [contactPhone, setContactPhone] = useState("");
  const [contactEmail, setContactEmail] = useState("");

  useEffect(() => {
    async function loadPage() {
      try {
        const supabase = createSupabaseBrowserClient();
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session) {
          router.replace("/login");
          return;
        }

        const response = await fetch("/api/destinations", {
          cache: "no-store",
        });

        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error || "Unable to load destinations.");
        }

        const rows: Destination[] = Array.isArray(result)
          ? result
          : result.destinations || result.data || [];

        setDestinations(rows);

        const locationsResponse = await fetch("/api/kenya-locations", { cache: "no-store" });
        const locationsResult = await locationsResponse.json();
        if (!locationsResponse.ok || !locationsResult.success) {
          throw new Error(locationsResult.error || "Unable to load Kenya counties and sub-counties.");
        }
        const countyRows: KenyaCounty[] = locationsResult.counties || [];
        setCounties(countyRows);
        if (countyRows.length > 0) {
          const firstCounty = countyRows[0];
          setCountyCode(String(firstCounty.county_code));
          const firstDestination = rows.find((destination) =>
            (destination.county || "").split(/[\/,]/).some(
              (part) => normalizeCountyName(part) === normalizeCountyName(firstCounty.name)
            )
          );
          if (firstDestination) setDestinationId(firstDestination.id);
        }
      } catch (error) {
        setPageError(
          error instanceof Error
            ? error.message
            : "Unable to load the property form."
        );
      } finally {
        setLoadingDestinations(false);
      }
    }

    loadPage();
  }, [router]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPageError("");
    setSuccessMessage("");

    if (!destinationId) {
      setPageError("Please select a destination.");
      return;
    }

    setSubmitting(true);

    try {
      const supabase = createSupabaseBrowserClient();
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError || !session) {
        router.replace("/login");
        return;
      }

      const response = await fetch("/api/partner/properties", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          name,
          propertyType,
          destinationId,
          countyCode: Number(countyCode),
          subCountyCode,
          address,
          description,
          currency,
          contactPhone,
          contactEmail,
        }),
      });

      const result = await response.json();

      if (response.status === 401) {
        router.replace("/login");
        return;
      }

      if (!response.ok || !result.success) {
        throw new Error(
          result.error || "Unable to submit this property."
        );
      }

      setSuccessMessage(
        result.message ||
          "Your property has been submitted and is awaiting review."
      );

      setTimeout(() => {
        router.push("/partner/dashboard");
      }, 1800);
    } catch (error) {
      setPageError(
        error instanceof Error
          ? error.message
          : "Something went wrong. Please try again."
      );
    } finally {
      setSubmitting(false);
    }
  }

  const selectedCounty = counties.find((county) => String(county.county_code) === countyCode);
  const subcountyOptions = selectedCounty?.subcounties || [];
  const countyDestinations = destinations.filter((destination) =>
    (destination.county || "").split(/[\/,]/).some(
      (part) => normalizeCountyName(part) === normalizeCountyName(selectedCounty?.name || "")
    )
  );

  const fieldClass =
    "w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-blue-700 focus:ring-2 focus:ring-blue-100";

  const labelClass = "mb-2 block text-sm font-semibold text-slate-700";

  return (
    <main className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-4">
          <Link href="/" className="text-2xl font-bold text-blue-900">
            ZuriStay<span className="text-amber-500">.</span>
          </Link>

          <Link
            href="/partner/dashboard"
            className="text-sm font-medium text-slate-600 hover:text-blue-800"
          >
            Partner dashboard
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-5 py-8">
        <Link
          href="/partner/dashboard"
          className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-blue-800"
        >
          <ArrowLeft size={17} />
          Back to dashboard
        </Link>

        <div className="mb-7">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-blue-100 text-blue-900">
            <Building2 size={25} />
          </div>
          <h1 className="text-3xl font-bold text-slate-900">
            Add your property
          </h1>
          <p className="mt-2 text-slate-600">
            Tell travellers about your accommodation. You can add rooms,
            rates and photographs in the next setup stage.
          </p>
        </div>

        <div className="mb-6 flex items-start gap-3 rounded-xl border border-blue-100 bg-blue-50 p-4">
          <ShieldCheck className="mt-0.5 shrink-0 text-blue-800" size={21} />
          <p className="text-sm leading-6 text-blue-900">
            Every new listing is reviewed by ZuriStay before it becomes
            visible to travellers. Submitting this form does not publish
            your property immediately.
          </p>
        </div>

        {pageError && (
          <div className="mb-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            {pageError}
          </div>
        )}

        {successMessage && (
          <div className="mb-5 rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-800">
            {successMessage}
          </div>
        )}

        {loadingDestinations ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center">
            <Loader2 className="mx-auto mb-3 animate-spin text-blue-800" size={30} />
            <p className="text-slate-600">Loading destinations...</p>
          </div>
        ) : (
          <form
            onSubmit={handleSubmit}
            className="space-y-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7"
          >
            <section>
              <h2 className="mb-5 text-lg font-bold text-slate-900">
                Property information
              </h2>

              <div className="space-y-5">
                <div>
                  <label className={labelClass} htmlFor="propertyName">
                    Property name *
                  </label>
                  <input
                    id="propertyName"
                    className={fieldClass}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Coastal Breeze Villas"
                    minLength={2}
                    maxLength={150}
                    required
                  />
                </div>

                <div>
                  <label className={labelClass} htmlFor="propertyType">
                    Property type *
                  </label>
                  <select
                    id="propertyType"
                    className={fieldClass}
                    value={propertyType}
                    onChange={(e) => setPropertyType(e.target.value)}
                    required
                  >
                    {propertyTypes.map((type) => (
                      <option key={type.value} value={type.value}>
                        {type.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className={labelClass} htmlFor="county">
                    County *
                  </label>
                  <select
                    id="county"
                    className={fieldClass}
                    value={countyCode}
                    onChange={(e) => {
                      const nextCode = e.target.value;
                      const nextCounty = counties.find((county) => String(county.county_code) === nextCode);
                      setCountyCode(nextCode);
                      setSubCountyCode("");
                      const firstDestination = destinations.find((destination) =>
                        (destination.county || "").split(/[\/,]/).some(
                          (part) => normalizeCountyName(part) === normalizeCountyName(nextCounty?.name || "")
                        )
                      );
                      setDestinationId(firstDestination?.id || "");
                    }}
                    required
                  >
                    <option value="">Choose a county</option>
                    {counties.map((county) => (
                      <option key={county.county_code} value={county.county_code}>
                        {county.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className={labelClass} htmlFor="subCounty">
                    Sub-county *
                  </label>
                  <select
                    id="subCounty"
                    className={fieldClass}
                    value={subCountyCode}
                    onChange={(e) => setSubCountyCode(e.target.value)}
                    required
                    disabled={!countyCode}
                  >
                    <option value="">Choose a sub-county</option>
                    {subcountyOptions.map((subcounty) => (
                      <option key={subcounty.subcounty_code} value={subcounty.subcounty_code}>
                        {subcounty.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className={labelClass} htmlFor="destination">
                    Destination *
                  </label>
                  <select
                    id="destination"
                    className={fieldClass}
                    value={destinationId}
                    onChange={(e) => setDestinationId(e.target.value)}
                    required
                  >
                    <option value="">Choose a destination</option>
                    {countyDestinations.map((destination) => (
                      <option key={destination.id} value={destination.id}>
                        {destination.name}
                        {destination.county
                          ? ` — ${destination.county}`
                          : ""}
                        {destination.country
                          ? `, ${destination.country}`
                          : ""}
                      </option>
                    ))}
                  </select>
                  {countyDestinations.length === 0 && (
                    <p className="mt-2 text-sm text-red-600">
                      No active destinations were returned. Please try again later.
                    </p>
                  )}
                </div>

                <div>
                  <label className={labelClass} htmlFor="address">
                    Physical address or location details *
                  </label>
                  <div className="relative">
                    <MapPin
                      className="absolute left-3 top-3.5 text-slate-400"
                      size={18}
                    />
                    <input
                      id="address"
                      className={`${fieldClass} pl-10`}
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      placeholder="e.g. Near Malindi beach, along Casuarina Road"
                      minLength={4}
                      maxLength={250}
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className={labelClass} htmlFor="description">
                    Property description
                  </label>
                  <textarea
                    id="description"
                    className={fieldClass}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Describe your accommodation, facilities, location and what makes it special..."
                    rows={5}
                    maxLength={5000}
                  />
                  <p className="mt-1 text-right text-xs text-slate-400">
                    {description.length}/5000 characters
                  </p>
                </div>
              </div>
            </section>

            <div className="border-t border-slate-200" />

            <section>
              <h2 className="mb-5 text-lg font-bold text-slate-900">
                Contact and currency
              </h2>

              <div className="space-y-5">
                <div>
                  <label className={labelClass} htmlFor="currency">
                    Listing currency *
                  </label>
                  <select
                    id="currency"
                    className={fieldClass}
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value)}
                    required
                  >
                    <option value="KES">Kenyan Shilling (KES)</option>
                    <option value="USD">US Dollar (USD)</option>
                    <option value="EUR">Euro (EUR)</option>
                    <option value="GBP">British Pound (GBP)</option>
                    <option value="TZS">Tanzanian Shilling (TZS)</option>
                    <option value="UGX">Ugandan Shilling (UGX)</option>
                  </select>
                </div>

                <div>
                  <label className={labelClass} htmlFor="contactPhone">
                    Property contact phone *
                  </label>
                  <input
                    id="contactPhone"
                    className={fieldClass}
                    type="tel"
                    value={contactPhone}
                    onChange={(e) => setContactPhone(e.target.value)}
                    placeholder="+254 7XX XXX XXX"
                    minLength={5}
                    maxLength={30}
                    required
                  />
                </div>

                <div>
                  <label className={labelClass} htmlFor="contactEmail">
                    Property contact email *
                  </label>
                  <input
                    id="contactEmail"
                    className={fieldClass}
                    type="email"
                    value={contactEmail}
                    onChange={(e) => setContactEmail(e.target.value)}
                    placeholder="reservations@example.com"
                    maxLength={254}
                    required
                  />
                </div>
              </div>
            </section>

            <div className="border-t border-slate-200 pt-5">
              <button
                type="submit"
                disabled={submitting || destinations.length === 0}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-900 px-5 py-3.5 font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting ? (
                  <>
                    <Loader2 size={19} className="animate-spin" />
                    Submitting property...
                  </>
                ) : (
                  "Submit property for review"
                )}
              </button>
              <p className="mt-3 text-center text-xs text-slate-500">
                Your listing will remain unpublished until approved by ZuriStay.
              </p>
            </div>
          </form>
        )}
      </div>
    </main>
  );
}
