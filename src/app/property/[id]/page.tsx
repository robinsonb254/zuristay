
import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import {
  ArrowLeft,
  MapPin,
  Star,
  CheckCircle,
  ShieldCheck,
} from "lucide-react";

export const dynamic = "force-dynamic";

const money = (amount: number, currency = "KSh") =>
  `${currency} ${amount.toLocaleString("en-KE")}`;

export default async function PropertyDetailsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ checkIn?: string; checkOut?: string; guests?: string; rooms?: string }>;
}) {
  const [{ id }, query] = await Promise.all([params, searchParams]);

  let liveProperty: any = null;
  let loadingError = false;

  {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

    if (supabaseUrl && supabaseKey) {
      const supabase = createClient(supabaseUrl, supabaseKey);

      const { data: property, error: propertyError } = await supabase
        .from("properties")
        .select(
          "id, name, property_type, description, address, city, sub_county, county, country, currency"
        )
        .eq("id", id)
        .eq("status", "approved")
        .eq("is_active", true)
        .maybeSingle();

      if (propertyError) {
        loadingError = true;
      } else if (property) {
        const [unitsResult, imagesResult, propertyAmenitiesResult] =
          await Promise.all([
            supabase
              .from("property_units")
              .select(
                "id, name, unit_type, description, capacity, total_units, base_rate, currency"
              )
              .eq("property_id", id)
              .eq("active", true)
              .order("base_rate", { ascending: true }),

            supabase
              .from("property_images")
              .select(
                "id, image_url, caption, is_cover, display_order"
              )
              .eq("property_id", id)
              .order("display_order", { ascending: true }),

            supabase
              .from("property_amenities")
              .select("amenity_id")
              .eq("property_id", id),
          ]);

        if (
          unitsResult.error ||
          imagesResult.error ||
          propertyAmenitiesResult.error
        ) {
          loadingError = true;
        } else {
          const amenityIds = [
            ...new Set(
              (propertyAmenitiesResult.data ?? []).map(
                (item) => item.amenity_id
              )
            ),
          ];

          let amenities: {
            id: string;
            name: string;
            category: string | null;
          }[] = [];

          if (amenityIds.length > 0) {
            const { data, error } = await supabase
              .from("amenities")
              .select("id, name, category")
              .in("id", amenityIds);

            if (error) {
              loadingError = true;
            } else {
              amenities = data ?? [];
            }
          }

          if (!loadingError) {
            const units = (unitsResult.data ?? []).map((unit) => {
              const baseRate = Number(unit.base_rate);

              return {
                ...unit,
                base_rate: baseRate,
                customer_rate: Number(
                  (baseRate * 1.3).toFixed(2)
                ),
              };
            });

            const images = [...(imagesResult.data ?? [])].sort(
              (a, b) => {
                if (a.is_cover !== b.is_cover) {
                  return a.is_cover ? -1 : 1;
                }

                return a.display_order - b.display_order;
              }
            );

            liveProperty = {
              ...property,
              units,
              images,
              amenities,
            };
          }
        }
      }
    } else {
      loadingError = true;
    }
  }

  const property = liveProperty;

  if (!property || loadingError) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 px-5">
        <div className="max-w-md text-center">
          <h1 className="text-3xl font-black text-blue-950">
            {loadingError ? "Unable to load property" : "Property not found"}
          </h1>

          <p className="mt-3 text-slate-500">
            {loadingError
              ? "We could not retrieve this accommodation at the moment. Please try again."
              : "We could not find the accommodation you are looking for."}
          </p>

          <Link
            href="/search"
            className="mt-6 inline-block rounded-xl bg-orange-500 px-6 py-3 font-bold text-white"
          >
            Explore accommodation
          </Link>
        </div>
      </main>
    );
  }

  const isLiveProperty = Boolean(liveProperty);
  const bookingQuery = new URLSearchParams();
  if (query.checkIn) bookingQuery.set("checkIn", query.checkIn);
  if (query.checkOut) bookingQuery.set("checkOut", query.checkOut);
  if (query.guests) bookingQuery.set("guests", query.guests);
  if (query.rooms) bookingQuery.set("rooms", query.rooms);
  const bookingQueryString = bookingQuery.toString();
  const bookingHref = `/booking?propertyId=${property.id}${bookingQueryString ? `&${bookingQueryString}` : ""}`;

  const location = isLiveProperty
    ? [
        property.address,
        property.city,
        property.sub_county,
        property.county,
        property.country,
      ]
        .filter(Boolean)
        .join(", ")
    : property.location;

  const facilities = isLiveProperty
    ? property.amenities.map((item: any) => item.name)
    : property.facilities;

  const gallery = isLiveProperty
    ? property.images.map((item: any) => item.image_url)
    : property.gallery;

  const coverImage = isLiveProperty
    ? property.images.find((item: any) => item.is_cover)?.image_url ||
      property.images[0]?.image_url ||
      ""
    : property.image;

  const currency = isLiveProperty
    ? property.currency
    : "KSh";

  const startingRate = isLiveProperty
    ? property.units.length > 0
      ? Math.min(
          ...property.units.map((unit: any) => unit.customer_rate)
        )
      : null
    : property.price;

  return (
    <main className="min-h-screen bg-[#f8fafc] text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-5 lg:px-8">
          <Link href="/" className="text-2xl font-black text-blue-950">
            Zuri<span className="text-orange-500">Stay</span>
          </Link>

          <Link
            href="/search"
            className="text-sm font-semibold text-blue-950 hover:text-orange-500"
          >
            Explore stays
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-5 py-8 lg:px-8">
        <Link
          href="/search"
          className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-orange-500"
        >
          <ArrowLeft size={17} />
          Back to search results
        </Link>

        <div className="mt-7 flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-900">
              {isLiveProperty
                ? property.property_type
                : property.type}
            </span>

            <h1 className="mt-4 text-3xl font-black text-blue-950 md:text-4xl">
              {property.name}
            </h1>

            <div className="mt-3 flex flex-wrap items-center gap-4 text-sm text-slate-500">
              <span className="flex items-center gap-1">
                <MapPin size={16} className="text-orange-500" />
                {location}
              </span>

              {!isLiveProperty && (
                <span className="flex items-center gap-1">
                  <Star
                    size={16}
                    className="fill-yellow-400 text-yellow-400"
                  />
                  <strong className="text-slate-800">
                    {property.rating}
                  </strong>
                  ({property.reviews} reviews)
                </span>
              )}
            </div>
          </div>
        </div>

        {coverImage ? (
          <div className="mt-7 grid gap-3 overflow-hidden rounded-2xl md:grid-cols-2">
            <div
              className="h-72 bg-cover bg-center md:h-[440px]"
              style={{ backgroundImage: `url("${coverImage}")` }}
              role="img"
              aria-label={property.name}
            />

            <div className="grid grid-cols-2 gap-3">
              {gallery
                .filter((image: string) => image !== coverImage)
                .slice(0, 4)
                .map((image: string, index: number) => (
                  <div
                    key={`${image}-${index}`}
                    className="min-h-36 bg-cover bg-center md:min-h-0"
                    style={{ backgroundImage: `url("${image}")` }}
                    role="img"
                    aria-label={`${property.name} photo ${index + 1}`}
                  />
                ))}
            </div>
          </div>
        ) : (
          <div className="mt-7 flex h-64 items-center justify-center rounded-2xl bg-slate-200 text-slate-500">
            Property photos will be added soon.
          </div>
        )}

        <div className="mt-10 grid gap-10 lg:grid-cols-[1fr_370px]">
          <section>
            <h2 className="text-2xl font-black text-blue-950">
              About this accommodation
            </h2>

            <p className="mt-4 max-w-3xl leading-8 text-slate-600">
              {property.description ||
                "Discover this accommodation and its facilities on ZuriStay."}
            </p>

            <div className="my-9 border-t border-slate-200" />

            <h2 className="text-2xl font-black text-blue-950">
              Facilities and services
            </h2>

            <div className="mt-6 grid gap-5 sm:grid-cols-2">
              {facilities.length > 0 ? (
                facilities.map((facility: string) => (
                  <div
                    key={facility}
                    className="flex items-center gap-3"
                  >
                    <CheckCircle
                      size={19}
                      className="text-green-600"
                    />
                    <span className="text-sm font-medium text-slate-700">
                      {facility}
                    </span>
                  </div>
                ))
              ) : (
                <p className="text-sm text-slate-500">
                  Facilities information will be updated soon.
                </p>
              )}

              <div className="flex items-center gap-3">
                <ShieldCheck
                  size={19}
                  className="text-green-600"
                />
                <span className="text-sm font-medium text-slate-700">
                  Secure booking experience
                </span>
              </div>
            </div>

            {isLiveProperty && (
              <>
                <div className="my-9 border-t border-slate-200" />

                <h2 className="text-2xl font-black text-blue-950">
                  Accommodation options
                </h2>

                <div className="mt-5 space-y-4">
                  {property.units.length > 0 ? (
                    property.units.map((unit: any) => (
                      <div
                        key={unit.id}
                        className="rounded-2xl border border-slate-200 bg-white p-5"
                      >
                        <h3 className="font-bold text-blue-950">
                          {unit.name}
                        </h3>

                        {unit.description && (
                          <p className="mt-2 text-sm text-slate-500">
                            {unit.description}
                          </p>
                        )}

                        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                          <span className="text-sm text-slate-500">
                            Capacity: {unit.capacity} guest(s)
                          </span>

                          <span className="text-lg font-black text-orange-500">
                            {money(
                              unit.customer_rate,
                              unit.currency || currency
                            )}{" "}
                            / night
                          </span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-slate-500">
                      Room and accommodation options are being updated.
                    </p>
                  )}
                </div>
              </>
            )}

            <div className="my-9 border-t border-slate-200" />

            <h2 className="text-2xl font-black text-blue-950">
              Location
            </h2>

            <p className="mt-3 flex items-center gap-2 text-slate-600">
              <MapPin size={18} className="text-orange-500" />
              {location}
            </p>
          </section>

          <aside>
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm lg:sticky lg:top-6">
              <p className="text-sm text-slate-500">Starting from</p>

              <div className="mt-2">
                {startingRate !== null ? (
                  <>
                    <span className="text-3xl font-black text-blue-950">
                      {money(startingRate, currency)}
                    </span>
                    <span className="ml-2 text-sm text-slate-500">
                      / night
                    </span>
                  </>
                ) : (
                  <p className="text-sm font-semibold text-slate-500">
                    Rates being updated
                  </p>
                )}
              </div>

              <div className="my-6 border-t border-slate-200" />

              <h3 className="font-bold text-blue-950">
                Your reservation
              </h3>

              <p className="mt-3 text-sm leading-6 text-slate-500">
                Choose your travel dates and guest details to continue with your reservation.
              </p>

              {isLiveProperty ? (
                property.units.length > 0 ? (
                  <Link
                    href={bookingHref}
                    className="mt-6 block w-full rounded-xl bg-orange-500 px-5 py-4 text-center font-bold text-white transition hover:bg-orange-600"
                  >
                    Check availability and reserve
                  </Link>
                ) : (
                  <div className="mt-6 rounded-xl bg-blue-50 p-4 text-sm leading-6 text-blue-900">
                    Room options are being updated. Please check back shortly.
                  </div>
                )
              ) : (
                <Link
                  href={bookingHref}
                  className="mt-6 block w-full rounded-xl bg-orange-500 px-5 py-4 text-center font-bold text-white transition hover:bg-orange-600"
                >
                  Check booking options
                </Link>
              )}

              <p className="mt-4 text-center text-xs text-slate-400">
                Final price and availability will be confirmed during booking.
              </p>
            </div>
          </aside>
        </div>
      </div>

      <footer className="mt-16 bg-blue-950 px-5 py-8 text-center text-sm text-blue-100">
        © {new Date().getFullYear()} ZuriStay. Your World. Your Stay.
      </footer>
    </main>
  );
}
