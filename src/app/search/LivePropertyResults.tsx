
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
};

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

export default function LivePropertyResults({
  destination,
  budget,
  checkIn,
  checkOut,
  guests,
  rooms,
}: Props) {
  const [properties, setProperties] = useState<LiveProperty[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadProperties() {
      try {
        const response = await fetch("/api/properties", {
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
  }, []);

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
        matchesBudget
      );
    });
  }, [properties, destination, budget]);

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

      {loading && (
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
          Loading live accommodation listings...
        </div>
      )}

      {!loading && error && (
        <div className="rounded-2xl border border-red-200 bg-white p-6 text-sm text-red-700">
          Live listings could not be loaded. Please try again later.
        </div>
      )}

      {!loading && !error && filteredProperties.length === 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center">
          <BedDouble className="mx-auto text-orange-500" size={32} />
          <h3 className="mt-3 font-bold text-blue-950">
            No additional live listings found
          </h3>
          <p className="mx-auto mt-2 max-w-xl text-sm text-slate-500">
            {destination
              ? "There are no approved, bookable properties matching this destination yet. Try another nearby area or explore the full Kenya directory."
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

                    <h3 className="mt-3 text-xl font-black text-blue-950">
                      {property.name}
                    </h3>

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
