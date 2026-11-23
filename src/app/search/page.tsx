
import Link from "next/link";
import LivePropertyResults from "./LivePropertyResults";
import LocationPhoto from "@/app/components/LocationPhoto";
import {
  Search,
  MapPin,
  CalendarDays,
  Users,
} from "lucide-react";



type SearchParams = {
  destination?: string;
  checkIn?: string;
  checkOut?: string;
  guests?: string;
  rooms?: string;
  budget?: string;
};

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
                  required
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
              ZURISTAY WORLDWIDE ACCOMMODATION
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

        </div>

        {destination && (
          <div className="mb-8 grid overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm md:grid-cols-[minmax(0,360px)_1fr]">
            <LocationPhoto location={`${destination}, Kenya`} className="h-56 w-full md:h-full" />
            <div className="flex flex-col justify-center p-6">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-orange-500">Your selected destination</p>
              <h2 className="mt-2 text-2xl font-black text-blue-950">{destination}</h2>
              <p className="mt-2 text-sm text-slate-600">Explore this location before choosing your accommodation.</p>
            </div>
          </div>
        )}

        <LivePropertyResults
          destination={destination}
          budget={budget}
          checkIn={checkIn}
          checkOut={checkOut}
          guests={guests}
          rooms={rooms}
        />

      </section>

      <footer className="mt-12 bg-blue-950 px-5 py-8 text-center text-sm text-blue-100">
        © {new Date().getFullYear()} ZuriStay Worldwide. Your World. Your Stay.
      </footer>
    </main>
  );
}
