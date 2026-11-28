
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { MapPin, Wifi, Waves, Car, Utensils, BedDouble } from "lucide-react";

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

type IndependentStay = { id:string; name:string; property_type:string; city:string; county:string|null; country:string; currency:string; guest_rate:number|null; public_website_url:string|null; image_urls:string[]; description:string|null; booking_enabled:boolean; };

type IndependentApiResponse = { success:boolean; accommodations:IndependentStay[]; error?:string; };

type ApiResponse = {
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


type AreaPhotoData = { title: string; imageUrl: string; sourceUrl: string; credit: string; license: string; licenseUrl: string };
const areaPhotoRequests = new Map<string, Promise<AreaPhotoData[]>>();

function IndependentAreaPhoto({ location, propertyId }: { location: string; propertyId: string }) {
  const [photos, setPhotos] = useState<AreaPhotoData[]>([]);
  const [photoIndex, setPhotoIndex] = useState(0);
  const [finished, setFinished] = useState(false);

  useEffect(() => {
    let active = true;
    const key = location.trim().toLowerCase();
    let request = areaPhotoRequests.get(key);
    if (!request) {
      request = fetch(`/api/location-photos?location=${encodeURIComponent(location)}`, { cache: "force-cache" })
        .then(async (response) => {
          if (!response.ok) throw new Error("Area image lookup failed");
          const result = await response.json();
          return Array.isArray(result.photos) ? result.photos as AreaPhotoData[] : [];
        })
        .catch(() => []);
      areaPhotoRequests.set(key, request);
    }
    request.then((photos) => {
      if (!active) return;
      setPhotos(photos);
      // Different properties in the same town use different images from the location gallery.
      const hash = Array.from(propertyId).reduce((value, char) => (value * 31 + char.charCodeAt(0)) >>> 0, 7);
      setPhotoIndex(photos.length ? hash % photos.length : 0);
      setFinished(true);
    });
    return () => { active = false; };
  }, [location]);

  const photo = photos[photoIndex] || null;

  return (
    <div className="relative h-56 w-full overflow-hidden bg-gradient-to-br from-slate-200 to-slate-300 md:h-full md:min-h-56">
      {photo ? (
        <>
          <img key={photo.imageUrl} src={photo.imageUrl} alt={`${location} area photograph: ${photo.title}`} loading="lazy" decoding="async" onError={() => setPhotoIndex((current) => current + 1 < photos.length ? current + 1 : current)} className="h-full w-full object-cover" />
          <div className="absolute inset-x-0 bottom-0 flex flex-wrap items-center justify-between gap-1 bg-slate-950/65 px-3 py-2 text-[10px] text-white">
            <span className="font-semibold">Area photo · {photo.credit}</span>
            <a href={photo.sourceUrl} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">Image source · {photo.license}</a>
          </div>
        </>
      ) : (
        <div className="flex h-full min-h-56 flex-col items-center justify-center gap-2 p-4 text-center text-slate-500">
          <BedDouble size={38} />
          <span className="text-sm font-semibold">{finished ? "Area photo unavailable" : "Loading area photo…"}</span>
          <span className="text-xs">Photos of {location}</span>
        </div>
      )}
    </div>
  );
}

export default function LivePropertyResults({
  destination,
  budget,
  checkIn,
  checkOut,
  guests,
  rooms,
}: Props) {
  const [properties, setProperties] = useState<LiveProperty[]>([]);
  const [independentStays, setIndependentStays] = useState<IndependentStay[]>([]);
  const [independentLoading, setIndependentLoading] = useState(true);
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
          Submit a reservation request through ZuriStay. Our administration team will coordinate directly with the accommodation.
        </p>
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

      <section className="mb-8 space-y-6">
        <header className="rounded-2xl border border-[#e8dfcf] bg-gradient-to-r from-[#f8f5ee] via-white to-[#f4eee2] px-5 py-7 shadow-sm sm:px-8 sm:py-9">
          <p className="mb-3 text-xs font-extrabold uppercase tracking-[0.2em] text-[#a77b36]">ZuriStay Worldwide</p>
          <h2 className="max-w-4xl text-2xl font-black leading-tight tracking-tight text-[#173b30] sm:text-3xl lg:text-4xl">
            ZURISTAY WORLDWIDE MANAGEMENT ACCOMMODATIONS
          </h2>
          <p className="mt-4 max-w-3xl text-sm leading-6 text-slate-600 sm:text-base">
            Discover more hotels, villas, apartments, lodges and guesthouses across Kenya.
          </p>
        </header>
        <div>
          <h3 className="text-xl font-black text-blue-950 sm:text-2xl">{destination ? `More places to stay in ${destination}` : "More places to stay across Kenya"}</h3>
        </div>
        {independentLoading ? <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-500">Finding more places to stay…</div> : independentStays.length === 0 ? <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500">{destination ? "No additional stays are currently listed for this destination." : "More accommodation listings will appear here as they are added."}</div> : <div className="grid gap-5">{independentStays.map((stay) => {
          const photos = Array.isArray(stay.image_urls) ? stay.image_urls.filter((url) => typeof url === "string" && /^https?:\/\//i.test(url)) : [];
          const areaLocation = [stay.city && !/^unspecified locality$/i.test(stay.city) ? stay.city : null, stay.county && stay.county.toLowerCase() !== stay.city.toLowerCase() ? stay.county : null, stay.country].filter(Boolean).join(", ");
          return <article key={stay.id} className="grid overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm md:grid-cols-[280px_1fr]">
            <div className="min-h-56 bg-slate-100 md:min-h-full">
              {photos.length > 0 ? (
                <div className={`grid h-56 gap-1 md:h-full md:min-h-56 ${photos.length > 1 ? "grid-cols-2 grid-rows-2" : "grid-cols-1"}`}>
                  {photos.slice(0, 3).map((photo, index) => <div key={photo} className={`relative min-h-28 overflow-hidden bg-slate-200 ${photos.length > 1 && index === 0 ? "row-span-2" : ""}`}>
                    <img src={photo} alt={`${stay.name} property photo ${index + 1}`} loading="lazy" decoding="async" onError={(event) => { event.currentTarget.style.display = "none"; }} className="absolute inset-0 h-full w-full object-cover transition duration-300 hover:scale-105" />
                  </div>)}
                </div>
              ) : (
                <IndependentAreaPhoto location={areaLocation || "Kenya"} propertyId={stay.id} />
              )}
            </div>
            <div className="flex flex-col justify-between gap-4 p-5 md:flex-row md:items-center">
              <div className="min-w-0 flex-1"><span className="rounded-full bg-orange-50 px-3 py-1 text-xs font-bold capitalize text-orange-700">{stay.property_type}</span><h3 className="mt-3 text-xl font-black text-blue-950">{stay.name}</h3><p className="mt-2 flex items-center gap-1 text-sm text-slate-500"><MapPin size={14}/>{[stay.city && !/^unspecified locality$/i.test(stay.city) ? stay.city : null,stay.county,stay.country].filter(Boolean).join(", ")}</p>{stay.description&&<p className="mt-2 line-clamp-2 text-sm text-slate-500">{stay.description}</p>}</div>
              <div className="flex min-w-40 flex-row items-end justify-between gap-3 border-t border-slate-100 pt-4 md:flex-col md:items-end md:border-l md:border-t-0 md:pl-5 md:pt-0">{stay.guest_rate!==null&&<div className="md:text-right"><p className="text-xs text-slate-500">From</p><p className="text-2xl font-black text-blue-950">{formatMoney(stay.guest_rate,stay.currency)}</p><p className="text-xs text-slate-500">per night</p></div>}<div className="flex flex-wrap gap-3">{stay.booking_enabled && <Link href={`/accommodations/${stay.id}`} className="rounded-xl bg-orange-500 px-5 py-3 text-center text-sm font-bold text-white transition hover:bg-orange-600">Reserve with ZuriStay</Link>}</div></div>
            </div>
          </article>;
        })}</div>}
      </section>
    </section>
  );
}
