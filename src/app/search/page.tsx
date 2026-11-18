
import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import {
  Search,
  MapPin,
  CalendarDays,
  Users,
  SlidersHorizontal,
  Star,
  Wifi,
  Waves,
  Car,
  Utensils,
  ArrowUpDown,
  Image as ImageIcon,
  CheckCircle,
} from "lucide-react";

type SearchParams = {
  destination?: string;
  checkIn?: string;
  checkOut?: string;
  guests?: string;
  rooms?: string;
  budget?: string;
};

type PropertyCard = {
  id: string;
  name: string;
  location: string;
  type: string;
  price: number;
  currency: string;
  rating?: number;
  reviews?: number;
  facilities: string[];
  image?: string;
  isLive: boolean;
};

const featuredProperties: PropertyCard[] = [
  {
    id: "1",
    name: "Ocean View Resort",
    location: "Diani Beach, Kwale",
    type: "Resort",
    price: 12500,
    currency: "KES",
    rating: 4.9,
    reviews: 128,
    facilities: ["Pool", "Wi-Fi", "Beach access"],
    image:
      "https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=1000",
    isLive: false,
  },
  {
    id: "2",
    name: "The City Garden Hotel",
    location: "Nairobi, Kenya",
    type: "Hotel",
    price: 8500,
    currency: "KES",
    rating: 4.8,
    reviews: 96,
    facilities: ["Restaurant", "Wi-Fi", "Parking"],
    image:
      "https://images.unsplash.com/photo-1566073771259-6a8506099945?w=1000",
    isLive: false,
  },
  {
    id: "3",
    name: "Palm Breeze Villas",
    location: "Watamu, Kilifi",
    type: "Villa",
    price: 18000,
    currency: "KES",
    rating: 4.9,
    reviews: 74,
    facilities: ["Private pool", "Kitchen", "Wi-Fi"],
    image:
      "https://images.unsplash.com/photo-1613490493576-7fde63acd811?w=1000",
    isLive: false,
  },
];

const money = (amount: number, currency = "KES") => {
  try {
    return new Intl.NumberFormat("en-KE", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toLocaleString("en-KE")}`;
  }
};

async function getLiveProperties(
  guests: number,
  rooms: number
): Promise<PropertyCard[]> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error("Supabase environment variables are missing.");
    return [];
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  const { data: properties, error: propertiesError } = await supabase
    .from("properties")
    .select(
      "id, name, property_type, description, address, city, county, country, country_code, currency"
    )
    .eq("status", "approved")
    .eq("is_active", true)
    .order("created_at", { ascending: false });

  if (propertiesError) {
    console.error("Unable to retrieve properties:", propertiesError.message);
    return [];
  }

  if (!properties || properties.length === 0) {
    return [];
  }

  const propertyIds = properties.map((property) => property.id);

  const [unitsResult, imagesResult, amenitiesResult] = await Promise.all([
    supabase
      .from("property_units")
      .select(
        "id, property_id, name, unit_type, capacity, total_units, base_rate, currency"
      )
      .in("property_id", propertyIds)
      .eq("active", true),

    supabase
      .from("property_images")
      .select("property_id, image_url, caption, is_cover, display_order")
      .in("property_id", propertyIds)
      .order("is_cover", { ascending: false })
      .order("display_order", { ascending: true }),

    supabase
      .from("property_amenities")
      .select("property_id, amenities(name)")
      .in("property_id", propertyIds),
  ]);

  if (unitsResult.error) {
    console.error("Unable to retrieve property units:", unitsResult.error.message);
    return [];
  }

  if (imagesResult.error) {
    console.error("Unable to retrieve property images:", imagesResult.error.message);
  }

  if (amenitiesResult.error) {
    console.error("Unable to retrieve property amenities:", amenitiesResult.error.message);
  }

  return properties
    .map((property) => {
      const propertyUnits = (unitsResult.data ?? []).filter(
        (unit) =>
          unit.property_id === property.id &&
          Number(unit.capacity) >= guests &&
          Number(unit.total_units) >= rooms
      );

      if (propertyUnits.length === 0) {
        return null;
      }

      const startingRate = Math.min(
        ...propertyUnits.map(
          (unit) => Number((Number(unit.base_rate) * 1.3).toFixed(2))
        )
      );

      const propertyImages = (imagesResult.data ?? []).filter(
        (image) => image.property_id === property.id
      );

      const coverImage =
        propertyImages.find((image) => image.is_cover) ??
        propertyImages[0];

      const propertyAmenities = (amenitiesResult.data ?? [])
        .filter((item) => item.property_id === property.id)
        .map((item) => {
          const amenity = item.amenities as unknown as
            | { name: string }
            | { name: string }[]
            | null;

          if (Array.isArray(amenity)) {
            return amenity[0]?.name;
          }

          return amenity?.name;
        })
        .filter((name): name is string => Boolean(name));

      const locationParts = [
        property.city,
        property.county,
        property.country,
      ].filter(Boolean);

      return {
        id: property.id,
        name: property.name,
        location: locationParts.join(", "),
        type: property.property_type,
        price: startingRate,
        currency: property.currency || "KES",
        facilities: [...new Set(propertyAmenities)],
        image: coverImage?.image_url || undefined,
        isLive: true,
      };
    })
    .filter((property): property is PropertyCard => property !== null);
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;

  const destination = params.destination?.trim() || "";
  const checkIn = params.checkIn || "";
  const checkOut = params.checkOut || "";
  const guests = params.guests || "2";
  const rooms = params.rooms || "1";
  const budget = params.budget || "any";

  const guestCount = Math.max(1, Number(guests) || 1);
  const roomCount = Math.max(1, Number(rooms) || 1);

  const budgetLimit =
    budget === "any" ? Infinity : Number(budget);

  const liveProperties = await getLiveProperties(
    guestCount,
    roomCount
  );

  const allProperties = [
    ...featuredProperties,
    ...liveProperties,
  ];

  const filteredProperties = allProperties.filter((property) => {
    const matchesDestination =
      !destination ||
      property.location.toLowerCase().includes(destination.toLowerCase()) ||
      property.name.toLowerCase().includes(destination.toLowerCase());

    const matchesBudget =
      property.currency === "KES"
        ? property.price <= budgetLimit
        : budgetLimit === Infinity;

    return matchesDestination && matchesBudget;
  });

  const hasSearch = Boolean(destination || checkIn || checkOut);

  return (
    <main className="min-h-screen bg-[#f8fafc] text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-5 lg:px-8">
          <Link
            href="/"
            className="text-2xl font-black tracking-tight text-blue-950"
          >
            Zuri<span className="text-orange-500">Stay</span>
          </Link>

          <nav className="hidden items-center gap-8 text-sm font-semibold text-slate-600 md:flex">
            <Link href="/" className="hover:text-orange-500">
              Home
            </Link>
            <Link href="/login" className="hover:text-orange-500">
              Sign in
            </Link>
            <Link
              href="/partner/register"
              className="rounded-full bg-blue-950 px-5 py-3 text-white transition hover:bg-blue-900"
            >
              List your property
            </Link>
          </nav>

          <Link
            href="/"
            className="text-sm font-semibold text-blue-950 md:hidden"
          >
            Home
          </Link>
        </div>
      </header>

      <section className="bg-blue-950 px-5 py-10 text-white lg:px-8">
        <div className="mx-auto max-w-7xl">
          <p className="mb-2 text-sm font-semibold uppercase tracking-[0.2em] text-orange-400">
            Find your perfect stay
          </p>

          <h1 className="text-3xl font-black md:text-4xl">
            Discover accommodation across Kenya
          </h1>

          <form
            action="/search"
            method="GET"
            className="mt-8 grid gap-3 rounded-2xl bg-white p-4 text-slate-800 shadow-xl md:grid-cols-2 lg:grid-cols-6"
          >
            <label className="flex flex-col gap-2 lg:col-span-2">
              <span className="text-xs font-bold text-slate-500">
                DESTINATION
              </span>
              <span className="flex items-center gap-2">
                <MapPin size={18} className="text-orange-500" />
                <input
                  name="destination"
                  defaultValue={destination}
                  placeholder="Where do you want to stay?"
                  className="w-full bg-transparent text-sm outline-none"
                />
              </span>
            </label>

            <label className="flex flex-col gap-2">
              <span className="text-xs font-bold text-slate-500">
                CHECK-IN
              </span>
              <span className="flex items-center gap-2">
                <CalendarDays size={17} className="text-orange-500" />
                <input
                  type="date"
                  name="checkIn"
                  defaultValue={checkIn}
                  className="w-full min-w-0 bg-transparent text-sm outline-none"
                />
              </span>
            </label>

            <label className="flex flex-col gap-2">
              <span className="text-xs font-bold text-slate-500">
                CHECK-OUT
              </span>
              <span className="flex items-center gap-2">
                <CalendarDays size={17} className="text-orange-500" />
                <input
                  type="date"
                  name="checkOut"
                  defaultValue={checkOut}
                  className="w-full min-w-0 bg-transparent text-sm outline-none"
                />
              </span>
            </label>

            <label className="flex flex-col gap-2">
              <span className="text-xs font-bold text-slate-500">
                GUESTS
              </span>
              <span className="flex items-center gap-2">
                <Users size={17} className="text-orange-500" />
                <input
                  type="number"
                  name="guests"
                  min="1"
                  max="20"
                  defaultValue={guests}
                  className="w-full bg-transparent text-sm outline-none"
                />
              </span>
            </label>

            <button
              type="submit"
              className="flex items-center justify-center gap-2 rounded-xl bg-orange-500 px-5 py-4 font-bold text-white transition hover:bg-orange-600"
            >
              <Search size={18} />
              Search
            </button>

            <input type="hidden" name="rooms" value={rooms} />
            <input type="hidden" name="budget" value={budget} />
          </form>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-10 lg:px-8">
        <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
          <div>
            <p className="text-sm font-semibold text-orange-500">
              ZURISTAY ACCOMMODATION
            </p>

            <h2 className="mt-2 text-2xl font-black md:text-3xl">
              {destination
                ? `Stays in ${destination}`
                : "Explore available stays"}
            </h2>

            <p className="mt-2 text-sm text-slate-500">
              {hasSearch
                ? `${guests} guest(s) · ${rooms} room(s)${checkIn ? ` · Check-in ${checkIn}` : ""}${checkOut ? ` · Check-out ${checkOut}` : ""}`
                : "Explore accommodation options for your next trip."}
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold"
            >
              <SlidersHorizontal size={17} />
              Filters
            </button>

            <button
              type="button"
              className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold"
            >
              <ArrowUpDown size={17} />
              Recommended
            </button>
          </div>
        </div>

        <div className="mt-8 grid gap-7">
          {filteredProperties.length > 0 ? (
            filteredProperties.map((property) => (
              <article
                key={property.id}
                className="grid overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:shadow-lg md:grid-cols-[280px_1fr]"
              >
                <div
                  className="relative min-h-64 bg-slate-100 bg-cover bg-center md:min-h-full"
                  style={
                    property.image
                      ? {
                          backgroundImage: `url("${property.image}")`,
                        }
                      : undefined
                  }
                  role="img"
                  aria-label={property.name}
                >
                  {!property.image && (
                    <div className="flex h-full min-h-64 flex-col items-center justify-center gap-2 text-slate-400">
                      <ImageIcon size={34} />
                      <span className="text-xs font-medium">
                        Photos coming soon
                      </span>
                    </div>
                  )}
                </div>

                <div className="flex flex-col justify-between gap-5 p-5 md:flex-row md:p-7">
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold capitalize text-blue-900">
                        {property.type}
                      </span>

                      {property.isLive && (
                        <span className="flex items-center gap-1 rounded-full bg-green-50 px-3 py-1 text-xs font-semibold text-green-700">
                          <CheckCircle size={12} />
                          Partner listing
                        </span>
                      )}

                      <span className="flex items-center gap-1 text-xs font-semibold text-slate-500">
                        <MapPin size={13} />
                        {property.location}
                      </span>
                    </div>

                    <h3 className="mt-3 text-xl font-black text-blue-950">
                      {property.name}
                    </h3>

                    {property.rating !== undefined ? (
                      <div className="mt-3 flex items-center gap-2">
                        <span className="flex items-center gap-1 rounded-md bg-green-700 px-2 py-1 text-sm font-bold text-white">
                          <Star size={13} fill="currentColor" />
                          {property.rating}
                        </span>

                        <span className="text-sm text-slate-500">
                          {property.reviews} reviews
                        </span>
                      </div>
                    ) : (
                      <p className="mt-3 text-sm text-slate-500">
                        Guest ratings not yet available
                      </p>
                    )}

                    <div className="mt-5 flex flex-wrap gap-4 text-sm text-slate-500">
                      {property.facilities.length > 0 ? (
                        property.facilities.map((facility) => (
                          <span
                            key={facility}
                            className="flex items-center gap-2"
                          >
                            {facility.toLowerCase().includes("pool") ||
                            facility.toLowerCase().includes("beach") ||
                            facility.toLowerCase().includes("swimming") ? (
                              <Waves size={16} />
                            ) : facility.toLowerCase().includes("parking") ? (
                              <Car size={16} />
                            ) : facility.toLowerCase().includes("restaurant") ? (
                              <Utensils size={16} />
                            ) : facility.toLowerCase().includes("wifi") ||
                              facility.toLowerCase().includes("wi-fi") ? (
                              <Wifi size={16} />
                            ) : (
                              <CheckCircle size={16} />
                            )}
                            {facility}
                          </span>
                        ))
                      ) : (
                        <span>Facilities information coming soon</span>
                      )}
                    </div>
                  </div>

                  <div className="flex min-w-40 flex-row items-end justify-between gap-4 border-t border-slate-100 pt-5 md:flex-col md:items-end md:border-l md:border-t-0 md:pl-6 md:pt-0">
                    <div className="text-left md:text-right">
                      <p className="text-xs text-slate-500">
                        Starting from
                      </p>

                      <p className="mt-1 text-2xl font-black text-blue-950">
                        {money(property.price, property.currency)}
                      </p>

                      <p className="text-xs text-slate-500">
                        per night
                      </p>
                    </div>

                    <Link
                      href={`/property/${property.id}`}
                      className="rounded-xl bg-orange-500 px-5 py-3 text-center text-sm font-bold text-white transition hover:bg-orange-600"
                    >
                      View details
                    </Link>
                  </div>
                </div>
              </article>
            ))
          ) : (
            <div className="rounded-2xl border border-slate-200 bg-white px-6 py-16 text-center">
              <MapPin className="mx-auto text-orange-500" size={36} />

              <h3 className="mt-4 text-xl font-bold text-blue-950">
                No matching stays found
              </h3>

              <p className="mx-auto mt-2 max-w-lg text-sm text-slate-500">
                Try another destination or increase your nightly budget to explore more accommodation.
              </p>

              <Link
                href="/search"
                className="mt-6 inline-block rounded-xl bg-blue-950 px-6 py-3 text-sm font-bold text-white"
              >
                Explore all stays
              </Link>
            </div>
          )}
        </div>

        <p className="mt-8 text-center text-xs leading-6 text-slate-400">
          Prices for partner listings include ZuriStay's service markup.
          Dates and room availability are subject to confirmation during
          the booking process.
        </p>
      </section>

      <footer className="mt-12 bg-blue-950 px-5 py-8 text-center text-sm text-blue-100">
        © {new Date().getFullYear()} ZuriStay. Your World. Your Stay.
      </footer>
    </main>
  );
}

