
import Link from "next/link";
import {
  ArrowLeft,
  MapPin,
  Star,
  CheckCircle,
  ShieldCheck,
} from "lucide-react";

const properties = [
  {
    id: "1",
    name: "Ocean View Resort",
    location: "Diani Beach, Kwale",
    type: "Resort",
    price: 12500,
    rating: 4.9,
    reviews: 128,
    facilities: ["Swimming pool", "Free Wi-Fi", "Beach access"],
    description:
      "Enjoy a relaxing coastal escape at Ocean View Resort. Experience beautiful surroundings, comfortable accommodation and convenient access to the beach.",
    image:
      "https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=1400",
    gallery: [
      "https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=1000",
      "https://images.unsplash.com/photo-1566073771259-6a8506099945?w=1000",
      "https://images.unsplash.com/photo-1575429198097-0414ec08e8cd?w=1000",
    ],
  },
  {
    id: "2",
    name: "The City Garden Hotel",
    location: "Nairobi, Kenya",
    type: "Hotel",
    price: 8500,
    rating: 4.8,
    reviews: 96,
    facilities: ["Restaurant", "Free Wi-Fi", "Parking"],
    description:
      "Discover comfortable city accommodation at The City Garden Hotel. Conveniently positioned for guests visiting Nairobi for business, leisure or family trips.",
    image:
      "https://images.unsplash.com/photo-1566073771259-6a8506099945?w=1400",
    gallery: [
      "https://images.unsplash.com/photo-1566073771259-6a8506099945?w=1000",
      "https://images.unsplash.com/photo-1564501049412-61c2a3083791?w=1000",
      "https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?w=1000",
    ],
  },
  {
    id: "3",
    name: "Palm Breeze Villas",
    location: "Watamu, Kilifi",
    type: "Villa",
    price: 18000,
    rating: 4.9,
    reviews: 74,
    facilities: ["Private pool", "Kitchen", "Free Wi-Fi"],
    description:
      "Relax in the comfort of Palm Breeze Villas in Watamu. Enjoy a private villa experience with convenient facilities and a peaceful coastal atmosphere.",
    image:
      "https://images.unsplash.com/photo-1613490493576-7fde63acd811?w=1400",
    gallery: [
      "https://images.unsplash.com/photo-1613490493576-7fde63acd811?w=1000",
      "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=1000",
      "https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?w=1000",
    ],
  },
];

const money = (amount: number) =>
  `KSh ${amount.toLocaleString("en-KE")}`;

export default async function PropertyDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const property = properties.find((item) => item.id === id);

  if (!property) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 px-5">
        <div className="max-w-md text-center">
          <h1 className="text-3xl font-black text-blue-950">
            Property not found
          </h1>
          <p className="mt-3 text-slate-500">
            We could not find the accommodation you are looking for.
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
              {property.type}
            </span>
            <h1 className="mt-4 text-3xl font-black text-blue-950 md:text-4xl">
              {property.name}
            </h1>
            <div className="mt-3 flex flex-wrap items-center gap-4 text-sm text-slate-500">
              <span className="flex items-center gap-1">
                <MapPin size={16} className="text-orange-500" />
                {property.location}
              </span>
              <span className="flex items-center gap-1">
                <Star size={16} className="fill-yellow-400 text-yellow-400" />
                <strong className="text-slate-800">{property.rating}</strong>
                ({property.reviews} reviews)
              </span>
            </div>
          </div>
        </div>

        <div className="mt-7 grid gap-3 overflow-hidden rounded-2xl md:grid-cols-2">
          <div
            className="h-72 bg-cover bg-center md:h-[440px]"
            style={{ backgroundImage: `url("${property.image}")` }}
            role="img"
            aria-label={property.name}
          />
          <div className="grid grid-cols-2 gap-3">
            {property.gallery.map((image, index) => (
              <div
                key={index}
                className="min-h-36 bg-cover bg-center md:min-h-0"
                style={{ backgroundImage: `url("${image}")` }}
                role="img"
                aria-label={`${property.name} photo ${index + 1}`}
              />
            ))}
          </div>
        </div>

        <div className="mt-10 grid gap-10 lg:grid-cols-[1fr_370px]">
          <section>
            <h2 className="text-2xl font-black text-blue-950">
              About this accommodation
            </h2>
            <p className="mt-4 max-w-3xl leading-8 text-slate-600">
              {property.description}
            </p>

            <div className="my-9 border-t border-slate-200" />

            <h2 className="text-2xl font-black text-blue-950">
              Facilities and services
            </h2>

            <div className="mt-6 grid gap-5 sm:grid-cols-2">
              {property.facilities.map((facility) => (
                <div key={facility} className="flex items-center gap-3">
                  <CheckCircle size={19} className="text-green-600" />
                  <span className="text-sm font-medium text-slate-700">
                    {facility}
                  </span>
                </div>
              ))}
              <div className="flex items-center gap-3">
                <ShieldCheck size={19} className="text-green-600" />
                <span className="text-sm font-medium text-slate-700">
                  Secure booking experience
                </span>
              </div>
            </div>

            <div className="my-9 border-t border-slate-200" />

            <h2 className="text-2xl font-black text-blue-950">
              Location
            </h2>
            <p className="mt-3 flex items-center gap-2 text-slate-600">
              <MapPin size={18} className="text-orange-500" />
              {property.location}
            </p>
          </section>

          <aside>
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm lg:sticky lg:top-6">
              <p className="text-sm text-slate-500">Starting from</p>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-3xl font-black text-blue-950">
                  {money(property.price)}
                </span>
                <span className="text-sm text-slate-500">/ night</span>
              </div>

              <div className="my-6 border-t border-slate-200" />

              <h3 className="font-bold text-blue-950">
                Your reservation
              </h3>

              <p className="mt-3 text-sm leading-6 text-slate-500">
                Choose your travel dates and guest details to continue with your reservation.
              </p>

              <Link
                href={`/booking?propertyId=${property.id}`}
                className="mt-6 block w-full rounded-xl bg-orange-500 px-5 py-4 text-center font-bold text-white transition hover:bg-orange-600"
              >
                Check booking options
              </Link>

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
