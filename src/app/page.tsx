
"use client";

import { useEffect, useState, type FormEvent } from "react";
import {
  Search,
  MapPin,
  CalendarDays,
  Users,
  ArrowRight,
  Menu,
  Globe2,
  ShieldCheck,
  Headphones,
  Star,
  BedDouble,
  SlidersHorizontal,
  X,
} from "lucide-react";

type DatabaseDestination = {
  id: string;
  name: string;
  city: string;
  county: string | null;
  country: string;
  country_code: string;
  active: boolean;
};

const destinationHighlights = [
  {
    name: "Mombasa",
    description: "Coastal escapes and ocean views",
    image:
      "https://images.unsplash.com/photo-1519046904884-53103b34b206?w=900",
  },
  {
    name: "Diani Beach",
    description: "White sands and tropical luxury",
    image:
      "https://images.unsplash.com/photo-1500375592092-40eb2168fd21?w=900",
  },
  {
    name: "Nairobi",
    description: "City stays and urban experiences",
    image:
      "https://images.unsplash.com/photo-1516026672322-bc52d61a55d5?w=900",
  },
  {
    name: "Watamu",
    description: "Beautiful beaches and relaxation",
    image:
      "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=900",
  },
  {
    name: "Malindi",
    description: "Discover Kenya's beautiful coast",
    image:
      "https://images.unsplash.com/photo-1500375592092-40eb2168fd21?w=900",
  },
  {
    name: "Naivasha",
    description: "Nature, lakes and peaceful retreats",
    image:
      "https://images.unsplash.com/photo-1470770841072-f978cf4d019e?w=900",
  },
  {
    name: "Kisumu",
    description: "Lakeside stays and western Kenya experiences",
    image:
      "https://images.unsplash.com/photo-1500375592092-40eb2168fd21?w=900",
  },
  {
    name: "Bungoma",
    description: "Discover stays in western Kenya",
    image:
      "https://images.unsplash.com/photo-1470770841072-f978cf4d019e?w=900",
  },
  {
    name: "Eldoret",
    description: "City comfort and highland escapes",
    image:
      "https://images.unsplash.com/photo-1516026672322-bc52d61a55d5?w=900",
  },
];

const stays = [
  {
    name: "Ocean View Resort",
    location: "Diani Beach, Kenya",
    type: "Resort",
    price: 12500,
    rating: 4.9,
    image:
      "https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=900",
    facilities: "Pool · Wi-Fi · Beach access",
  },
  {
    name: "The City Garden Hotel",
    location: "Nairobi, Kenya",
    type: "Hotel",
    price: 8500,
    rating: 4.8,
    image:
      "https://images.unsplash.com/photo-1566073771259-6a8506099945?w=900",
    facilities: "Restaurant · Wi-Fi · Parking",
  },
  {
    name: "Palm Breeze Villas",
    location: "Watamu, Kenya",
    type: "Villa",
    price: 18000,
    rating: 4.9,
    image:
      "https://images.unsplash.com/photo-1613490493576-7fde63acd811?w=900",
    facilities: "Private pool · Kitchen · Wi-Fi",
  },
];

export default function Home() {
  const [destination, setDestination] = useState("");
  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");
  const [guests, setGuests] = useState("2");
  const [rooms, setRooms] = useState("1");
  const [budget, setBudget] = useState("any");
  const [searchMessage, setSearchMessage] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);

  const [databaseDestinations, setDatabaseDestinations] = useState<
    DatabaseDestination[]
  >([]);

  useEffect(() => {
    let isMounted = true;

    async function loadDestinations() {
      try {
        const response = await fetch("/api/destinations");

        if (!response.ok) {
          throw new Error("Unable to load destinations.");
        }

        const result = await response.json();

        if (result.success && Array.isArray(result.destinations)) {
          if (isMounted) {
            setDatabaseDestinations(result.destinations);
          }
        }
      } catch (error) {
        console.error("Destination loading error:", error);
      }
    }

    loadDestinations();

    return () => {
      isMounted = false;
    };
  }, []);

  const currentDate = new Date();
  const today = [
    currentDate.getFullYear(),
    String(currentDate.getMonth() + 1).padStart(2, "0"),
    String(currentDate.getDate()).padStart(2, "0"),
  ].join("-");

  function handleSearch(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!destination.trim()) {
      setSearchMessage("Please enter your destination.");
      return;
    }

    if (checkIn && checkIn < today) {
      setSearchMessage("Check-in cannot be in the past.");
      return;
    }

    if ((checkIn && !checkOut) || (!checkIn && checkOut)) {
      setSearchMessage("Please select both check-in and check-out dates.");
      return;
    }

    if (checkIn && checkOut && checkOut <= checkIn) {
      setSearchMessage("Check-out must be after check-in.");
      return;
    }

    const params = new URLSearchParams({
      destination: destination.trim(),
      checkIn,
      checkOut,
      guests,
      rooms,
      budget,
    });

    window.location.href = `/search?${params.toString()}`;
  }

  const money = (amount: number) =>
    `KSh ${amount.toLocaleString("en-KE")}`;

  const destinationSuggestions =
    databaseDestinations.length > 0
      ? databaseDestinations
      : destinationHighlights.map((item, index) => ({
          id: `fallback-${index}`,
          name: item.name,
          city: item.name,
          county: null,
          country: "Kenya",
          country_code: "KE",
          active: true,
        }));

  return (
    <main className="min-h-screen bg-[#faf9f6] text-[#173b30]">
      <header className="sticky top-0 z-50 border-b border-gray-100 bg-white/95 backdrop-blur">
        <div className="container flex h-20 items-center justify-between">
          <a href="/" className="text-3xl font-bold tracking-tight">
            Zuri<span className="text-[#c49a52]">Stay</span>
          </a>

          <nav className="hidden items-center gap-8 text-sm font-medium md:flex">
            <a href="#destinations" className="hover:text-[#c49a52]">
              Explore
            </a>
            <a href="#featured" className="hover:text-[#c49a52]">
              Featured stays
            </a>
            <a href="#benefits" className="hover:text-[#c49a52]">
              Why ZuriStay
            </a>
            <a href="#partners" className="hover:text-[#c49a52]">
              List your property
            </a>
          </nav>

          <div className="hidden items-center gap-3 md:flex">
            <a
              href="/login"
              className="rounded-full px-5 py-3 text-sm font-semibold hover:bg-gray-100"
            >
              Sign in
            </a>
            <a
              href="/register"
              className="rounded-full bg-[#173b30] px-6 py-3 text-sm font-semibold text-white hover:bg-[#245545]"
            >
              Register
            </a>
          </div>

          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="rounded-lg p-2 md:hidden"
            aria-label="Toggle menu"
            aria-expanded={menuOpen}
          >
            {menuOpen ? <X size={25} /> : <Menu size={25} />}
          </button>
        </div>

        {menuOpen && (
          <nav className="flex flex-col gap-4 border-t bg-white p-5 text-sm md:hidden">
            <a href="#destinations" onClick={() => setMenuOpen(false)}>
              Explore
            </a>
            <a href="#featured" onClick={() => setMenuOpen(false)}>
              Featured stays
            </a>
            <a href="#benefits" onClick={() => setMenuOpen(false)}>
              Why ZuriStay
            </a>
            <a href="#partners" onClick={() => setMenuOpen(false)}>
              List your property
            </a>
            <a href="/login">Sign in</a>
            <a href="/register">Register</a>
          </nav>
        )}
      </header>

      <section className="relative flex min-h-[650px] items-center overflow-hidden bg-[#173b30]">
        <div
          className="absolute inset-0 bg-cover bg-center opacity-40"
          style={{
            backgroundImage:
              "url('https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=1800')",
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-r from-[#102c24] via-[#173b30]/80 to-transparent" />

        <div className="container relative z-10 py-20">
          <div className="max-w-3xl text-white">
            <span className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/30 bg-white/10 px-4 py-2 text-xs font-semibold tracking-widest">
              <Globe2 size={15} /> YOUR WORLD. YOUR STAY.
            </span>

            <h1 className="text-5xl font-bold leading-tight md:text-7xl">
              Discover places.
              <br />
              Create memories.
            </h1>

            <p className="mt-6 max-w-xl text-lg leading-8 text-white/80">
              From beautiful coastal escapes to city hotels and private villas,
              find the perfect stay for every journey.
            </p>
          </div>

          <form
            onSubmit={handleSearch}
            className="mt-12 grid gap-3 rounded-2xl bg-white p-4 shadow-2xl md:grid-cols-3 lg:grid-cols-6 md:rounded-3xl"
          >
            <div className="flex items-center gap-3 rounded-xl px-3 py-2 lg:col-span-2">
              <MapPin className="shrink-0 text-[#c49a52]" />
              <div className="w-full">
                <label className="text-xs font-bold text-gray-800">
                  Destination
                </label>
                <input
                  value={destination}
                  onChange={(e) => {
                    setDestination(e.target.value);
                    setSearchMessage("");
                  }}
                  placeholder="Where are you going?"
                  list="destinations-list"
                  className="w-full bg-transparent text-sm text-gray-600 outline-none"
                />
                <datalist id="destinations-list">
                  {destinationSuggestions.map((item) => (
                    <option key={item.id} value={item.name} />
                  ))}
                </datalist>
              </div>
            </div>

            <div className="flex items-center gap-3 rounded-xl px-3 py-2 md:border-l">
              <CalendarDays className="shrink-0 text-[#c49a52]" />
              <div className="w-full">
                <label className="text-xs font-bold text-gray-800">
                  Check-in
                </label>
                <input
                  type="date"
                  min={today}
                  value={checkIn}
                  onChange={(e) => {
                    setCheckIn(e.target.value);
                    setSearchMessage("");
                  }}
                  className="w-full bg-transparent text-xs text-gray-600 outline-none"
                />
              </div>
            </div>

            <div className="flex items-center gap-3 rounded-xl px-3 py-2 md:border-l">
              <CalendarDays className="shrink-0 text-[#c49a52]" />
              <div className="w-full">
                <label className="text-xs font-bold text-gray-800">
                  Check-out
                </label>
                <input
                  type="date"
                  min={checkIn || today}
                  value={checkOut}
                  onChange={(e) => {
                    setCheckOut(e.target.value);
                    setSearchMessage("");
                  }}
                  className="w-full bg-transparent text-xs text-gray-600 outline-none"
                />
              </div>
            </div>

            <div className="flex items-center gap-3 rounded-xl px-3 py-2 md:border-l">
              <Users className="shrink-0 text-[#c49a52]" />
              <div className="w-full">
                <label className="text-xs font-bold text-gray-800">
                  Guests
                </label>
                <select
                  value={guests}
                  onChange={(e) => setGuests(e.target.value)}
                  className="w-full bg-transparent text-sm text-gray-600 outline-none"
                >
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                    <option key={n} value={n}>
                      {n} {n === 1 ? "guest" : "guests"}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex items-center gap-3 rounded-xl px-3 py-2 md:border-l">
              <BedDouble className="shrink-0 text-[#c49a52]" />
              <div className="w-full">
                <label className="text-xs font-bold text-gray-800">
                  Rooms
                </label>
                <select
                  value={rooms}
                  onChange={(e) => setRooms(e.target.value)}
                  className="w-full bg-transparent text-sm text-gray-600 outline-none"
                >
                  {[1, 2, 3, 4, 5].map((n) => (
                    <option key={n} value={n}>
                      {n} {n === 1 ? "room" : "rooms"}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex items-center gap-3 rounded-xl px-3 py-2 md:border-t lg:col-span-2">
              <SlidersHorizontal className="shrink-0 text-[#c49a52]" />
              <div className="w-full">
                <label className="text-xs font-bold text-gray-800">
                  Nightly budget
                </label>
                <select
                  value={budget}
                  onChange={(e) => setBudget(e.target.value)}
                  className="w-full bg-transparent text-sm text-gray-600 outline-none"
                >
                  <option value="any">Any budget</option>
                  <option value="5000">Up to KSh 5,000</option>
                  <option value="10000">Up to KSh 10,000</option>
                  <option value="20000">Up to KSh 20,000</option>
                  <option value="50000">Up to KSh 50,000</option>
                </select>
              </div>
            </div>

            <button
              type="submit"
              className="flex items-center justify-center gap-2 rounded-full bg-[#c49a52] px-6 py-4 font-bold text-white hover:bg-[#ae8540] md:col-span-3 lg:col-span-4"
            >
              <Search size={19} /> Search stays
            </button>
          </form>

          {searchMessage && (
            <p
              role="alert"
              className="mt-3 rounded-lg bg-white px-4 py-3 text-sm font-semibold text-red-700"
            >
              {searchMessage}
            </p>
          )}

          <p className="mt-5 text-sm text-white/70">
            Discover stays across Kenya and beyond.
          </p>
        </div>
      </section>

      <section id="destinations" className="container py-24">
        <div className="mb-10 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="mb-3 text-xs font-bold tracking-[0.2em] text-[#c49a52]">
              EXPLORE THE WORLD
            </p>
            <h2 className="text-3xl font-bold md:text-4xl">
              Popular destinations
            </h2>
            <p className="mt-3 text-gray-500">
              Find inspiration for your next getaway.
            </p>
          </div>
          <a href="#featured" className="flex items-center gap-2 text-sm font-bold">
            Explore stays <ArrowRight size={17} />
          </a>
        </div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {destinationHighlights.map((item) => (
            <button
              type="button"
              key={item.name}
              onClick={() => {
                setDestination(item.name);
                setSearchMessage("");
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
              className="group overflow-hidden rounded-2xl bg-white text-left shadow-sm transition hover:-translate-y-1 hover:shadow-xl"
            >
              <div className="h-64 overflow-hidden">
                <img
                  src={item.image}
                  alt={item.name}
                  className="h-full w-full object-cover transition duration-500 group-hover:scale-110"
                />
              </div>
              <div className="p-5">
                <p className="text-xs font-semibold uppercase tracking-widest text-[#c49a52]">
                  KENYA
                </p>
                <h3 className="mt-2 text-xl font-bold">{item.name}</h3>
                <p className="mt-2 text-sm text-gray-500">
                  {item.description}
                </p>
              </div>
            </button>
          ))}
        </div>
      </section>

      <section id="featured" className="bg-white py-24">
        <div className="container">
          <div className="mb-10">
            <p className="mb-3 text-xs font-bold tracking-[0.2em] text-[#c49a52]">
              HANDPICKED FOR YOU
            </p>
            <h2 className="text-3xl font-bold md:text-4xl">
              Featured stays
            </h2>
            <p className="mt-3 text-gray-500">
              Explore some of our featured accommodation.
            </p>
          </div>

          <div className="grid gap-7 md:grid-cols-2 lg:grid-cols-3">
            {stays.map((stay) => (
              <article
                key={stay.name}
                className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm"
              >
                <div className="relative h-60">
                  <img
                    src={stay.image}
                    alt={stay.name}
                    className="h-full w-full object-cover"
                  />
                  <span className="absolute right-4 top-4 rounded-full bg-white px-3 py-2 text-sm font-bold">
                    <Star
                      size={14}
                      className="mr-1 inline fill-[#c49a52] text-[#c49a52]"
                    />
                    {stay.rating}
                  </span>
                </div>

                <div className="p-5">
                  <p className="text-xs font-semibold uppercase tracking-widest text-[#c49a52]">
                    {stay.type}
                  </p>
                  <h3 className="mt-2 text-xl font-bold">{stay.name}</h3>
                  <p className="mt-2 flex items-center gap-1 text-sm text-gray-500">
                    <MapPin size={15} /> {stay.location}
                  </p>
                  <p className="mt-3 text-xs text-gray-500">
                    {stay.facilities}
                  </p>

                  <div className="mt-5 flex items-center justify-between border-t pt-4">
                    <div>
                      <p className="text-xs text-gray-500">Starting from</p>
                      <p className="text-lg font-bold">
                        {money(stay.price)}{" "}
                        <span className="text-xs font-normal text-gray-500">
                          / night
                        </span>
                      </p>
                    </div>
                    <span className="text-xs font-semibold text-[#173b30]">
                      Featured
                    </span>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="benefits" className="py-24">
        <div className="container">
          <div className="mx-auto mb-14 max-w-2xl text-center">
            <p className="mb-3 text-xs font-bold tracking-[0.2em] text-[#c49a52]">
              THE ZURISTAY EXPERIENCE
            </p>
            <h2 className="text-3xl font-bold md:text-4xl">
              A better way to find your stay
            </h2>
            <p className="mt-4 text-gray-500">
              More choice, transparent pricing and a smoother booking
              experience.
            </p>
          </div>

          <div className="grid gap-10 md:grid-cols-3">
            <div className="text-center">
              <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#f4eee2] text-[#b88c45]">
                <Search size={29} />
              </div>
              <h3 className="text-xl font-bold">Find your perfect match</h3>
              <p className="mt-3 text-sm leading-7 text-gray-500">
                Discover accommodation that matches your destination, budget
                and preferences.
              </p>
            </div>

            <div className="text-center">
              <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#f4eee2] text-[#b88c45]">
                <ShieldCheck size={29} />
              </div>
              <h3 className="text-xl font-bold">Book with confidence</h3>
              <p className="mt-3 text-sm leading-7 text-gray-500">
                Our property approval process is designed to build trust and
                transparency.
              </p>
            </div>

            <div className="text-center">
              <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#f4eee2] text-[#b88c45]">
                <Headphones size={29} />
              </div>
              <h3 className="text-xl font-bold">Support when you need it</h3>
              <p className="mt-3 text-sm leading-7 text-gray-500">
                Enjoy a booking experience designed around your travel needs.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section id="partners" className="container py-20">
        <div className="overflow-hidden rounded-3xl bg-[#173b30] px-8 py-16 text-center text-white md:px-20">
          <p className="mb-4 text-xs font-bold tracking-[0.2em] text-[#d8b879]">
            PARTNER WITH ZURISTAY
          </p>
          <h2 className="text-3xl font-bold md:text-5xl">
            Have a property?
            <br />
            Let the world discover it.
          </h2>
          <p className="mx-auto mt-5 max-w-xl leading-7 text-white/70">
            Bring your hotel, apartment, villa or guesthouse to a growing
            community of travellers.
          </p>
          <a
            href="/partner/register"
            className="mt-8 inline-flex rounded-full bg-[#c49a52] px-8 py-4 font-bold text-white hover:bg-[#ae8540]"
          >
            Become a ZuriStay partner
          </a>
        </div>
      </section>

      <footer className="bg-[#102c24] py-12 text-white">
        <div className="container flex flex-col justify-between gap-8 md:flex-row">
          <div>
            <h2 className="text-3xl font-bold">
              Zuri<span className="text-[#c49a52]">Stay</span>
            </h2>
            <p className="mt-3 text-sm text-white/60">
              Your world. Your stay.
            </p>
          </div>
          <div className="text-sm text-white/60">
            <p>Explore stays. Discover experiences.</p>
            <p className="mt-3">
              © {new Date().getFullYear()} ZuriStay. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </main>
  );
}

