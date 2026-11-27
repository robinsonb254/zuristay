
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { MapPin, Wifi, Waves, Car, Utensils, BedDouble, ExternalLink, Building2 } from "lucide-react";

type LiveProperty = {
  id: string;
  name: string;
  property_type: string;
  city: string;
  county: string | null;
  sub_county: string | null;
  country: string;
  currency: string;
  units: {
    id: string;
    name: string;
    capacity: number;
    customer_rate: number;
  }[];
  images: {
    image_url: string;
    caption: string | null;
    is_cover: boolean;
  }[];
  amenities: {
    id: string;
    name: string;
  }[];
  starting_rate: number | null;
  has_conference_rooms: boolean;
};

type IndependentStay = { id:string; name:string; property_type:string; city:string; county:string|null; country:string; currency:string; guest_rate:number|null; public_website_url:string|null; source_listing_url:string; image_urls:string[]; description:string|null; };\n\ntype IndependentApiResponse = { success:boolean; accommodations:IndependentStay[]; error?:string; };\n\ntype ApiResponse = {
  success: boolean;
  properties: LiveProperty[];
  error?: string;
};

type Props = {
  destination: string;
  budget: string;
  checkIn: string;
  checkOut: string;
  guests: string;
  rooms: string;
};

const destinationAliases: Record<string, string[]> = {
  "maasai mara": ["maasai mara", "mara", "narok"],
  "diani beach": ["diani", "ukunda", "kwale"],
  amboseli: ["amboseli", "kimana", "loitoktok", "kajiado"],
  watamu: ["watamu"],
  "lake naivasha": ["naivasha"],
  malindi: ["malindi"],
  lamu: ["lamu"],
  tsavo: ["tsavo", "voi", "taveta"],
  "mount kenya": ["mount kenya", "nanyuki", "nyeri", "meru"],
  samburu: ["samburu", "maralal"],
  mombasa: ["mombasa"],
  nairobi: ["nairobi"],
};

function formatMoney(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat("en-KE", {
      style: "currency",
      currency: currency || "KES",
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${currency || "KES"} ${amount.toLocaleString("en-KE")}`;
  }
}

export default function LivePropertyResults({
  destination,
  budget,
  checkIn,
  checkOut,
  guests,
  rooms,
}: Props) {
  const [properties, setProperties] = useState<LiveProperty[]>([]);\n  const [independentStays, setIndependentStays] = useState<IndependentStay[]>([]);\n  const [independentLoading, setIndependentLoading] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [conferenceFilter, setConferenceFilter] = useState<"any" | "with" | "without">("any");

  useEffect(() => {
    let cancelled = false;

    async function loadProperties() {
      try {
        const query = new URLSearchParams({ guests, rooms });
        if (checkIn && checkOut) {
          query.set("checkIn", checkIn);
          query.set("checkOut", checkOut);
        }
        const response = await fetch("/api/properties?" + query.toString(), {
          cache: "no-store",
        });

        const result: ApiResponse = await response.json();

        if (!response.ok || !result.success) {
          throw new Error(result.error || "Unable to load properties.");
        }

        if (!cancelled) {
          setProperties(result.properties || []);
          setError("");
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : "Unable to load live properties."
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadProperties();

    return () => {
      cancelled = true;
    };
  }, [checkIn, checkOut, guests, rooms]);

  useEffect(() => {
    let cancelled = false;
    async function loadIndependentStays() {
      setIndependentLoading(true);
      try {
        const query = new URLSearchParams();
        if (destination.trim()) query.set("q", destination.trim());
        const response = await fetch("/api/independent-accommodations?" + query.toString(), { cache: "no-store" });
        const result: IndependentApiResponse = await response.json();
        if (!response.ok || !result.success) throw new Error(result.error || "Unable to load independent stays.");
        if (!cancelled) setIndependentStays(result.accommodations || []);
      } catch {
        if (!cancelled) setIndependentStays([]);
      } finally {
        if (!cancelled) setIndependentLoading(false);
      }
    }
    void loadIndependentStays();
    return () => { cancelled = true; };
  }, [destination]);

  const filteredProperties = useMemo(() => {
    const searchTerm = destination.trim().toLowerCase();
    const budgetLimit =
      budget === "any" || !budget ? Infinity : Number(budget);

    return properties.filter((property) => {
      const locationText = [
        property.name,
        property.city,
        property.sub_county || "",
        property.county || "",
        property.country,
      ]
        .join(" ")
        .toLowerCase()
        .replace(/[^\p{L}\p{N}]+/gu, " ")
        .replace(/\s+/g, " ")
        .trim();
      const searchTokens = searchTerm
        .toLowerCase()
        .split(/[,\s]+/)
        .map((token) => token.trim())
        .filter((token) => token && !["beach", "city", "town", "county"].includes(token));
      const aliases = destinationAliases[searchTerm] || [];
      const matchesDestination =
        !searchTerm ||
        aliases.some((alias) => locationText.includes(alias)) ||
        (searchTokens.length > 0 &&
          searchTokens.every((token) => locationText.includes(token)));

      const matchesBudget =
        budget === "any" ||
        !budget ||
        !Number.isFinite(budgetLimit) ||
        (property.starting_rate !== null &&
          property.starting_rate <= budgetLimit);

      return (
        property.units.length > 0 &&
        property.starting_rate !== null &&
        matchesDestination &&
        matchesBudget &&
        (conferenceFilter === "any" || (conferenceFilter === "with" ? property.has_conference_rooms : !property.has_conference_rooms))
      );
    });
  }, [properties, destination, budget, conferenceFilter]);

  return (
    <section className="mt-12">
      <div className="mb-6">
        <p className="text-sm font-semibold text-orange-500">
          LIVE ZURISTAY LISTINGS
        </p>
        <h2 className="mt-2 text-2xl font-black text-blue-950">
          More places to stay
        </h2>
        <p className="mt-2 text-sm text-slate-500">
          Approved accommodation listings supplied by our property partners.
        </p>
      </div>

      <div className="mb-8">
        <div className="mb-5">
          <p className="text-sm font-semibold text-orange-500">INDEPENDENT ACCOMMODATION</p>
          <h2 className="mt-2 text-2xl font-black text-blue-950">More stays across {destination || "Kenya"}</h2>
          <p className="mt-2 text-sm text-slate-500">Explore independently listed hotels, villas, apartments, lodges and guesthouses.</p>
        </div>
        {independentLoading ? <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-500">Finding independent stays…</div> : independentStays.length === 0 ? <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500">{destination ? "No independently listed stays have been verified for this destination yet." : "Independently listed stays will appear here as verified listings are added."}</div> : <div className="grid gap-5">{independentStays.map((stay) => <article key={stay.id} className="grid overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm md:grid-cols-[260px_1fr]">
          <div className="min-h-52 bg-slate-100 bg-cover bg-center" style={stay.image_urls?.[0] ? {backgroundImage:`url("${stay.image_urls[0]}")`} : undefined} role="img" aria-label={stay.name}>{!stay.image_urls?.[0] && <div className="flex h-full min-h-52 items-center justify-center"><Building2 className="text-slate-300" size={42}/></div>}</div>
          <div className="flex flex-col justify-between gap-4 p-5 md:flex-row md:items-center">
            <div className="min-w-0 flex-1"><span className="rounded-full bg-orange-50 px-3 py-1 text-xs font-bold capitalize text-orange-700">{stay.property_type}</span><h3 className="mt-3 text-xl font-black text-blue-950">{stay.name}</h3><p className="mt-2 flex items-center gap-1 text-sm text-slate-500"><MapPin size={14}/>{[stay.city,stay.county,stay.country].filter(Boolean).join(", ")}</p>{stay.description&&<p className="mt-2 line-clamp-2 text-sm text-slate-500">{stay.description}</p>}</div>
            <div className="flex min-w-40 flex-row items-end justify-between gap-3 border-t border-slate-100 pt-4 md:flex-col md:items-end md:border-l md:border-t-0 md:pl-5 md:pt-0">{stay.guest_rate!==null&&<div className="md:text-right"><p className="text-xs text-slate-500">From</p><p className="text-2xl font-black text-blue-950">{formatMoney(stay.guest_rate,stay.currency)}</p><p className="text-xs text-slate-500">per night</p></div>}<div className="flex flex-wrap gap-3">{stay.public_website_url&&<a href={stay.public_website_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm font-semibold text-blue-950">Website <ExternalLink size={13}/></a>}<a href={stay.source_listing_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm font-semibold text-blue-950">Source <ExternalLink size={13}/></a></div></div>
          </div></article>)}</div>}
      </div>

      <div className="mb-5 flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white p-3"><span className="mr-2 text-sm font-semibold text-slate-700">Conference rooms:</span><button type="button" onClick={() => setConferenceFilter("any")} className={`rounded-full px-4 py-2 text-sm font-semibold ${conferenceFilter === "any" ? "bg-blue-950 text-white" : "bg-slate-100 text-slate-700"}`}>Any</button><button type="button" onClick={() => setConferenceFilter("with")} className={`rounded-full px-4 py-2 text-sm font-semibold ${conferenceFilter === "with" ? "bg-blue-950 text-white" : "bg-slate-100 text-slate-700"}`}>With conference rooms</button><button type="button" onClick={() => setConferenceFilter("without")} className={`rounded-full px-4 py-2 text-sm font-semibold ${conferenceFilter === "without" ? "bg-blue-950 text-white" : "bg-slate-100 text-slate-700"}`}>Without conference rooms</button></div>
      {loading && (
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
          Loading live accommodation listings...
        </div>
      )}

      {!loading && error && (
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center">
          <BedDouble className="mx-auto text-orange-500" size={32} />
          <h3 className="mt-3 font-bold text-blue-950">
            No approved rooms could be confirmed for this search
          </h3>
          <p className="mx-auto mt-2 max-w-xl text-sm text-slate-500">
            Try another nearby area or refresh your search. Only approved ZuriStay properties with active rooms and rates appear in live listings.
          </p>
          <Link href="/destinations" className="mt-5 inline-flex items-center gap-2 rounded-xl bg-blue-950 px-5 py-3 text-sm font-bold text-white transition hover:bg-blue-900">
            Browse all destinations
          </Link>
        </div>
      )}

      {!loading && !error && filteredProperties.length === 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center">
          <BedDouble className="mx-auto text-orange-500" size={32} />
          <h3 className="mt-3 font-bold text-blue-950">
            No approved rooms available in this region
          </h3>
          <p className="mx-auto mt-2 max-w-xl text-sm text-slate-500">
            {destination
              ? "There are currently no approved ZuriStay rooms available in this region for your search. Try a nearby town or another destination."
              : "New approved properties will appear here once partners add accommodation units and rates."}
          </p>
          <Link
            href="/destinations"
            className="mt-5 inline-flex items-center gap-2 rounded-xl bg-blue-950 px-5 py-3 text-sm font-bold text-white transition hover:bg-blue-900"
          >
            Browse all destinations
          </Link>
        </div>
      )}

      {!loading && !error && filteredProperties.length > 0 && (
        <div className="grid gap-7">
          {filteredProperties.map((property) => {
            const coverImage =
              property.images.find((image) => image.is_cover) ||
              property.images[0];

            return (
              <article
                key={property.id}
                className="grid overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:shadow-lg md:grid-cols-[280px_1fr]"
              >
                <div
                  className="min-h-64 bg-slate-100 bg-cover bg-center md:min-h-full"
                  style={
                    coverImage
                      ? {
                          backgroundImage: `url("${coverImage.image_url}")`,
                        }
                      : undefined
                  }
                  role="img"
                  aria-label={coverImage?.caption || property.name}
                />

                <div className="flex flex-col justify-between gap-5 p-5 md:flex-row md:p-7">
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-900">
                        {property.property_type}
                      </span>

                      <span className="flex items-center gap-1 text-xs font-semibold text-slate-500">
                        <MapPin size={13} />
                        {[property.city, property.sub_county, property.county, property.country]
                          .filter(Boolean)
                          .join(", ")}
                      </span>
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-2"><h3 className="text-xl font-black text-blue-950">
                      {property.name}
                    </h3><span className={`rounded-full px-3 py-1 text-xs font-bold ${property.has_conference_rooms ? "bg-emerald-50 text-emerald-800" : "bg-slate-100 text-slate-600"}`}>{property.has_conference_rooms ? "Conference rooms available" : "No conference rooms"}</span></div>

                    <div className="mt-4 flex flex-wrap gap-4 text-sm text-slate-500">
                      {property.amenities.slice(0, 6).map((amenity) => {
                        const name = amenity.name.toLowerCase();

                        const FacilityIcon =
                          name.includes("pool") || name.includes("beach")
                            ? Waves
                            : name.includes("parking")
                              ? Car
                              : name.includes("restaurant")
                                ? Utensils
                                : Wifi;

                        return (
                          <span
                            key={amenity.id}
                            className="flex items-center gap-2"
                          >
                            <FacilityIcon size={16} />
                            {amenity.name}
                          </span>
                        );
                      })}
                    </div>

                    <p className="mt-4 text-sm text-slate-500">
                      {property.units.length} accommodation option(s)
                    </p>
                  </div>

                  <div className="flex min-w-40 flex-row items-end justify-between gap-4 border-t border-slate-100 pt-5 md:flex-col md:items-end md:border-l md:border-t-0 md:pl-6 md:pt-0">
                    <div className="text-left md:text-right">
                      <p className="text-xs text-slate-500">
                        Starting from
                      </p>
                      <p className="mt-1 text-2xl font-black text-blue-950">
                        {formatMoney(
                          property.starting_rate || 0,
                          property.currency
                        )}
                      </p>
                      <p className="text-xs text-slate-500">per night</p>
                    </div>

                    <Link
                      href={`/property/${property.id}?checkIn=${encodeURIComponent(checkIn)}&checkOut=${encodeURIComponent(checkOut)}&guests=${encodeURIComponent(guests)}&rooms=${encodeURIComponent(rooms)}`}
                      className="rounded-xl bg-orange-500 px-5 py-3 text-center text-sm font-bold text-white transition hover:bg-orange-600"
                    >
                      View details
                    </Link>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
