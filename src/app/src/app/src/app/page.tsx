
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
} from "lucide-react";

const destinations = [
  {
    name: "Mombasa",
    country: "Kenya",
    description: "Coastal escapes and ocean views",
    image:
      "https://images.unsplash.com/photo-1519046904884-53103b34b206?w=900",
  },
  {
    name: "Diani Beach",
    country: "Kenya",
    description: "White sands and tropical luxury",
    image:
      "https://images.unsplash.com/photo-1500375592092-40eb2168fd21?w=900",
  },
  {
    name: "Nairobi",
    country: "Kenya",
    description: "City stays and urban experiences",
    image:
      "https://images.unsplash.com/photo-1516026672322-bc52d61a55d5?w=900",
  },
  {
    name: "Watamu",
    country: "Kenya",
    description: "Beautiful beaches and relaxation",
    image:
      "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=900",
  },
];

export default function Home() {
  return (
    <main className="min-h-screen bg-[#faf9f6] text-[#173b30]">
      <header className="sticky top-0 z-50 border-b border-gray-100 bg-white/95 backdrop-blur">
        <div className="container flex h-20 items-center justify-between">
          <a href="/" className="text-3xl font-bold tracking-tight">
            Zuri<span className="text-[#c49a52]">Stay</span>
            <span className="ml-1 text-xs font-normal text-gray-500">®</span>
          </a>

          <nav className="hidden items-center gap-8 text-sm font-medium md:flex">
            <a href="#destinations" className="hover:text-[#c49a52]">Explore</a>
            <a href="#benefits" className="hover:text-[#c49a52]">Why ZuriStay</a>
            <a href="#partners" className="hover:text-[#c49a52]">List your property</a>
          </nav>

          <div className="hidden items-center gap-3 md:flex">
            <button className="rounded-full px-5 py-3 text-sm font-semibold hover:bg-gray-100">
              Sign in
            </button>
            <button className="rounded-full bg-[#173b30] px-6 py-3 text-sm font-semibold text-white hover:bg-[#245545]">
              Register
            </button>
          </div>

          <button className="rounded-lg p-2 md:hidden" aria-label="Open menu">
            <Menu size={25} />
          </button>
        </div>
      </header>

      <section className="relative flex min-h-[590px] items-center overflow-hidden bg-[#173b30]">
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

          <div className="mt-12 grid gap-3 rounded-2xl bg-white p-4 shadow-2xl md:grid-cols-[1.5fr_1fr_1fr_1fr_auto] md:items-center md:rounded-full md:p-3">
            <div className="flex items-center gap-3 rounded-xl px-4 py-3">
              <MapPin className="text-[#c49a52]" />
              <div className="min-w-0">
                <p className="text-xs font-bold text-gray-800">Destination</p>
                <input
                  placeholder="Where are you going?"
                  className="w-full min-w-0 bg-transparent text-sm text-gray-600 outline-none"
                />
              </div>
            </div>

            <div className="flex items-center gap-3 rounded-xl px-4 py-3 md:border-l">
              <CalendarDays className="text-[#c49a52]" />
              <div>
                <p className="text-xs font-bold text-gray-800">Check-in</p>
                <input type="date" className="w-full bg-transparent text-xs text-gray-500 outline-none" />
              </div>
            </div>

            <div className="flex items-center gap-3 rounded-xl px-4 py-3 md:border-l">
              <CalendarDays className="text-[#c49a52]" />
              <div>
                <p className="text-xs font-bold text-gray-800">Check-out</p>
                <input type="date" className="w-full bg-transparent text-xs text-gray-500 outline-none" />
              </div>
            </div>

            <div className="flex items-center gap-3 rounded-xl px-4 py-3 md:border-l">
              <Users className="text-[#c49a52]" />
              <div>
                <p className="text-xs font-bold text-gray-800">Guests</p>
                <select className="w-full bg-transparent text-sm text-gray-500 outline-none">
                  <option>2 guests</option>
                  <option>1 guest</option>
                  <option>3 guests</option>
                  <option>4 guests</option>
                  <option>5+ guests</option>
                </select>
              </div>
            </div>

            <button className="flex items-center justify-center gap-2 rounded-full bg-[#c49a52] px-8 py-4 font-bold text-white hover:bg-[#ae8540]">
              <Search size={19} /> Search
            </button>
          </div>

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
          <a href="#destinations" className="flex items-center gap-2 text-sm font-bold">
            Explore all <ArrowRight size={17} />
          </a>
        </div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {destinations.map((destination) => (
            <a
              href="#"
              key={destination.name}
              className="group overflow-hidden rounded-2xl bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-xl"
            >
              <div className="h-64 overflow-hidden">
                <img
                  src={destination.image}
                  alt={destination.name}
                  className="h-full w-full object-cover transition duration-500 group-hover:scale-110"
                />
              </div>
              <div className="p-5">
                <p className="text-xs font-semibold uppercase tracking-widest text-[#c49a52]">
                  {destination.country}
                </p>
                <h3 className="mt-2 text-xl font-bold">{destination.name}</h3>
                <p className="mt-2 text-sm text-gray-500">
                  {destination.description}
                </p>
              </div>
            </a>
          ))}
        </div>
      </section>

      <section id="benefits" className="bg-white py-20">
        <div className="container">
          <div className="mx-auto mb-14 max-w-2xl text-center">
            <p className="mb-3 text-xs font-bold tracking-[0.2em] text-[#c49a52]">
              THE ZURISTAY EXPERIENCE
            </p>
            <h2 className="text-3xl font-bold md:text-4xl">
              A better way to find your stay
            </h2>
            <p className="mt-4 text-gray-500">
              More choice, transparent pricing and a smoother booking experience.
            </p>
          </div>

          <div className="grid gap-10 md:grid-cols-3">
            <div className="text-center">
              <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#f4eee2] text-[#b88c45]">
                <Search size={29} />
              </div>
              <h3 className="text-xl font-bold">Find your perfect match</h3>
              <p className="mt-3 text-sm leading-7 text-gray-500">
                Discover accommodation that matches your destination, budget and preferences.
              </p>
            </div>

            <div className="text-center">
              <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#f4eee2] text-[#b88c45]">
                <ShieldCheck size={29} />
              </div>
              <h3 className="text-xl font-bold">Book with confidence</h3>
              <p className="mt-3 text-sm leading-7 text-gray-500">
                Our property approval process is designed to build trust and transparency.
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

      <section id="partners" className="container py-24">
        <div className="overflow-hidden rounded-3xl bg-[#173b30] px-8 py-16 text-center text-white md:px-20">
          <p className="mb-4 text-xs font-bold tracking-[0.2em] text-[#d8b879]">
            PARTNER WITH ZURISTAY
          </p>
          <h2 className="text-3xl font-bold md:text-5xl">
            Have a property?
            <br /> Let the world discover it.
          </h2>
          <p className="mx-auto mt-5 max-w-xl leading-7 text-white/70">
            Bring your hotel, apartment, villa or guesthouse to a growing community
            of travellers.
          </p>
          <button className="mt-8 rounded-full bg-[#c49a52] px-8 py-4 font-bold text-white hover:bg-[#ae8540]">
            Become a ZuriStay partner
          </button>
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
            <p className="mt-3">© {new Date().getFullYear()} ZuriStay. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </main>
  );
}
