
"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
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
  BedDouble,
  SlidersHorizontal,
  X,
} from "lucide-react";





const destinationHighlightsBase = [
  { name: "Maasai Mara", searchDestination: "Maasai Mara", description: "Iconic safari country and the Great Migration", image: "https://images.unsplash.com/photo-1516426122078-c23e76319801?w=1000" },
  { name: "Diani Beach", searchDestination: "Diani Beach", description: "White-sand beaches and Indian Ocean escapes", image: "https://images.unsplash.com/photo-1500375592092-40eb2168fd21?w=1000" },
  { name: "Amboseli", searchDestination: "Amboseli", description: "Elephant country beneath Mount Kilimanjaro", image: "https://images.unsplash.com/photo-1534177616072-ef7dc120449d?w=1000" },
  { name: "Mombasa", searchDestination: "Mombasa", description: "Swahili heritage, beaches and coastal city life", image: "https://images.unsplash.com/photo-1519046904884-53103b34b206?w=1000" },
  { name: "Watamu", searchDestination: "Watamu", description: "Marine parks, coral reefs and quiet beaches", image: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1000" },
  { name: "Nairobi", searchDestination: "Nairobi", description: "The city, culture and safari capital", image: "https://images.unsplash.com/photo-1516026672322-bc52d61a55d5?w=1000" },
  { name: "Lake Naivasha", searchDestination: "Lake Naivasha", description: "Lakeside retreats and Great Rift Valley scenery", image: "https://images.unsplash.com/photo-1470770841072-f978cf4d019e?w=1000" },
  { name: "Malindi", searchDestination: "Malindi", description: "Coastal charm, marine life and beach stays", image: "https://images.unsplash.com/photo-1500375592092-40eb2168fd21?w=1000" },
  { name: "Lamu", searchDestination: "Lamu", description: "Historic Swahili town and island life", image: "https://images.unsplash.com/photo-1510414842594-a61c69b5ae57?w=1000" },
  { name: "Tsavo", searchDestination: "Tsavo", description: "Vast wilderness and unforgettable safari stays", image: "https://images.unsplash.com/photo-1511497584788-876760111969?w=1000" },
  { name: "Mount Kenya", searchDestination: "Mount Kenya", description: "Mountain escapes, highlands and adventure", image: "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=1000" },
  { name: "Samburu", searchDestination: "Samburu", description: "Northern landscapes and unique wildlife", image: "https://images.unsplash.com/photo-1516026672322-bc52d61a55d5?w=1000" },
];
const commonsPhoto = (filename: string) => ({
  src: `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(filename)}?width=1200`,
  source: `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(filename.replace(/ /g, "_"))}`,
});

const destinationPhotoFiles: Record<string, string[]> = {
  "Maasai Mara": ["Maasai Mara savanna landscape, Kenya.jpg", "Landscape of northern Maasai Mara Preserve, Kenya.jpg", "Landscape with dirt road in Maasai Mara, Kenya.jpg", "Maasai Mara National Reserve 05.jpg", "Lions Family Portrait Masai Mara.jpg"],
  "Diani Beach": ["Diani Beach Sunrise Kenya.jpg", "Diani Beach overlooking the Indian Ocean.jpg", "Boat at Diani Beach, Kenya.jpg", "Diani Beach 2013 Panorama - panoramio.jpg", "Diani beach white sands.jpg"],
  "Amboseli": ["Amboseli National Park and Mt. Kilimanjaro.jpg", "Amboseli Park - Kilimanjaro elephant.jpg", "Elephants at Amboseli national park against Mount Kilimanjaro.jpg", "Elephants and mt kilimanjaro.jpg", "Elephants in Amboseli Kenya.jpg"],
  "Mombasa": ["Beach view in Mombasa, Kenya.jpg", "Fort Jesus, Mombasa, view of the Indian Ocean and a new hotel construction.jpg", "Mama ngina drive.jpg", "Mombasa Harbour.jpg", "BAMBURI BEACH.MOMBASA - panoramio.jpg"],
  "Watamu": ["Watamu beach view.jpg", "Watamu Marine Park & Mida Creek.jpg", "White-Sand Beach in Watamu.jpg", "Mangroves -Watamu.jpg", "Watamu (DSC02003).jpg"],
  "Nairobi": ["Nairobi National Park 002.jpg", "Rooftop pool, Nairobi (20250808-P1048999).jpg", "ICRAF Road, Nairobi (20250808-P1048951).jpg", "Nairobi National Park banner Baby elephants at the Sheldrick Elephant Orphanage.jpg", "Nairobi banner.jpg"],
  "Lake Naivasha": ["Boat on Lake Naivasha.jpg", "Hippos in Lake Naivasha, Kenya.jpg", "Fishing on Lake Naivasha (7513064018).jpg", "Tourists on boat safari, Lake Naivasha, Kenya.jpg", "African fish eagle flying over Lake Naivasha, Kenya.jpg"],
  "Malindi": ["Beach of malindi - panoramio.jpg", "Boats malindi.jpg", "Colours of the sea.jpg", "Exposed coral reef at low tide in Malindi.jpg", "Fine sand of Malindi.jpg"],
  "Lamu": ["Lamu Island-Kenya.jpg", "Lamu island.jpg", "Lamu old town street.jpg", "Lamu Old Town.jpg", "Lamu Streets.jpg"],
  "Tsavo": ["Elephant at Tsavo West National Park.jpg", "Tsavo West NP. Elephants.jpg", "Chyulu Hills and Shetani Lava Flow in Kenya 01.jpg", "Elephant grid on a dirt road by the Voi Entrance Gate in the Tsavo East National Park, Kenya.jpg", "Gerenuk antelope in Tsavo East.jpeg"],
  "Mount Kenya": ["Mount Kenya Dawn.jpg", "Mount Kenya Peaks.jpg", "Mount Kenya early afternoon view.jpg", "Mount Kenya hike.jpg", "Mt. Kenya alpine zone.jpg"],
  "Samburu": ["Acacia tree with weaver nests next to dirt road in Samburu National Reserve, Kenya.jpg", "African Bush Elephants of Samburu.jpg", "Grevy's zebras in Samburu National Reserve, Kenya.jpg", "Giraffes with mountain and landscape at Samburu National Reserve, Kenya.jpg", "East African sunrise, Samburu National Reserve, Kenya.jpg"],
};

const destinationHighlights = destinationHighlightsBase.map((item) => ({
  ...item,
  images: [ { src: item.image, source: item.image }, ...(destinationPhotoFiles[item.name] || []).map(commonsPhoto) ],
}));


type DestinationHighlight = (typeof destinationHighlights)[number];

function DestinationHighlightCard({
  item,
  index,
  onSelect,
}: {
  item: DestinationHighlight;
  index: number;
  onSelect: () => void;
}) {
  const [photoIndex, setPhotoIndex] = useState(0);
  const [nextPhoto, setNextPhoto] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    let currentIndex = 0;
    let rotationTimer: number | undefined;
    let transitionTimer: number | undefined;

    const scheduleNext = () => {
      rotationTimer = window.setTimeout(() => {
        if (!active) return;
        const nextIndex = (currentIndex + 1) % item.images.length;
        const preload = new Image();
        preload.onload = () => {
          if (!active) return;
          setNextPhoto(item.images[nextIndex].src);
          transitionTimer = window.setTimeout(() => {
            if (!active) return;
            currentIndex = nextIndex;
            setPhotoIndex(nextIndex);
            setNextPhoto(null);
            scheduleNext();
          }, 650);
        };
        preload.onerror = () => {
          if (!active) return;
          // Skip a failed remote image instead of retrying it forever and freezing this card.
          currentIndex = nextIndex;
          scheduleNext();
        };
        preload.src = item.images[nextIndex].src;
      }, 2350);
    };

    scheduleNext();
    return () => {
      active = false;
      if (rotationTimer !== undefined) window.clearTimeout(rotationTimer);
      if (transitionTimer !== undefined) window.clearTimeout(transitionTimer);
    };
  }, [item.images]);

  const photo = item.images[photoIndex];

  return (
    <button
      type="button"
      onClick={onSelect}
      className="group overflow-hidden rounded-[1.4rem] border border-[#eee8dd] bg-white text-left shadow-[0_8px_28px_rgba(23,59,48,0.06)] transition duration-300 hover:-translate-y-1.5 hover:shadow-[0_20px_45px_rgba(23,59,48,0.14)]"
    >
      <div className="relative h-64 overflow-hidden bg-[#e9e3d8]">
        <img
          src={photo.src}
          alt={`${item.name} — ${photoIndex + 1} of ${item.images.length}`}
          loading={index < 3 ? "eager" : "lazy"}
          decoding="async"
          className="absolute inset-0 h-full w-full object-cover transition duration-700 group-hover:scale-110"
        />
        {nextPhoto && (
          <img
            src={nextPhoto}
            alt=""
            aria-hidden="true"
            className="absolute inset-0 h-full w-full animate-[destinationPop_650ms_ease-out] object-cover"
          />
        )}
      </div>
      <div className="p-6">
        <h3 className="mt-2 font-serif text-2xl font-semibold tracking-tight text-[#173b30]">{item.name}</h3>
        <p className="mt-2 text-sm text-gray-500">{item.description}</p>
      </div>
    </button>
  );
}

export default function Home() {
  const [destination, setDestination] = useState("");
  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");
  const [guests, setGuests] = useState("2");
  const [rooms, setRooms] = useState("1");
  const [budget, setBudget] = useState("any");
  const [searchMessage, setSearchMessage] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [destinationSuggestions, setDestinationSuggestions] = useState(
    destinationHighlights.map((item, index) => ({ id: `popular-${index}`, name: item.name }))
  );

  useEffect(() => {
    let active = true;

    async function loadKenyaLocationSuggestions() {
      try {
        const [destinationsResponse, locationsResponse] = await Promise.all([
          fetch("/api/destinations"),
          fetch("/api/kenya-locations"),
        ]);
        const [destinationsData, locationsData] = await Promise.all([
          destinationsResponse.ok ? destinationsResponse.json() : Promise.resolve(null),
          locationsResponse.ok ? locationsResponse.json() : Promise.resolve(null),
        ]);

        if (!active) return;

        const suggestions = new Map<string, string>();
        const addSuggestion = (value: string) => {
          const clean = value.trim();
          if (clean) suggestions.set(clean.toLocaleLowerCase(), clean);
        };

        destinationHighlights.forEach((item) => addSuggestion(item.name));
        (destinationsData?.destinations || []).forEach((item: { city?: string | null; county?: string | null }) => {
          if (item.city) addSuggestion(item.city);
          if (item.city && item.county) addSuggestion(`${item.city}, ${item.county}`);
        });
        (locationsData?.counties || []).forEach((county: { name: string; subcounties?: { name: string }[] }) => {
          addSuggestion(county.name);
          (county.subcounties || []).forEach((subcounty) => addSuggestion(`${subcounty.name}, ${county.name}`));
        });

        setDestinationSuggestions(Array.from(suggestions, ([id, name]) => ({ id, name })));
      } catch (error) {
        console.error("Kenya destination suggestions could not be loaded:", error);
      }
    }

    loadKenyaLocationSuggestions();
    return () => { active = false; };
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

    if (!checkIn) {
      setSearchMessage("Please select your check-in date.");
      return;
    }

    if (checkIn < today) {
      setSearchMessage("Check-in cannot be in the past.");
      return;
    }

    if (checkOut && checkOut <= checkIn) {
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

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#fbfaf7] text-[#173b30] antialiased">
      <header className="sticky top-0 z-50 border-b border-[#e9e3d8] bg-white/95 shadow-[0_4px_24px_rgba(23,59,48,0.05)] backdrop-blur-xl dark:border-white/10 dark:bg-[#030b20]/95">
        <div className="container flex h-20 items-center justify-between gap-5">
          <Link href="/" aria-label="ZuriStay Worldwide home" className="shrink-0">
            <picture>
              <source media="(prefers-color-scheme: dark)" srcSet="/brand/zuristay-dark.svg" />
              <img src="/brand/zuristay-light.svg" alt="ZuriStay Worldwide — Your Next Stay, Anywhere" className="h-[4.4rem] w-[12.5rem] object-contain sm:w-[14rem]" />
            </picture>
          </Link>

          <nav className="ml-5 hidden items-center gap-6 whitespace-nowrap text-[13px] font-semibold tracking-wide text-[#39574d] xl:ml-10 xl:flex xl:gap-7">
            <a href="#destinations" className="rounded-full bg-[#f4eee2] px-4 py-2.5 text-[#8b682f] transition hover:bg-[#eee2cc] hover:text-[#6f5124]">
              Explore
            </a>
            <a href="/destinations" className="hover:text-[#c49a52]">All destinations</a>
            <a href="#featured" className="hover:text-[#c49a52]">
              Featured stays
            </a>
            <a href="#benefits" className="hover:text-[#c49a52]">
              Why ZuriStay Worldwide
            </a>
            <a href="#partners" className="hover:text-[#c49a52]">
              List your property
            </a>
          </nav>

          <div className="hidden shrink-0 items-center gap-2 xl:flex">
            <a
              href="/partner/dashboard"
              className="rounded-full border border-[#173b30]/20 px-4 py-2.5 text-xs font-semibold text-[#173b30] hover:bg-[#f4eee2]"
            >
              Already a partner
            </a>
            <a
              href="/partner/register"
              className="rounded-full bg-[#c49a52] px-4 py-2.5 text-xs font-bold text-white hover:bg-[#ae8540]"
            >
              Become a partner
            </a>
            <a
              href="/login"
              className="rounded-full px-3 py-2.5 text-xs font-semibold hover:bg-gray-100"
            >
              Sign in
            </a>
            <a
              href="/register"
              className="rounded-full bg-[#173b30] px-4 py-2.5 text-xs font-semibold text-white hover:bg-[#245545]"
            >
              Register
            </a>
            <a href="/admin/login" className="rounded-full border border-[#c49a52]/40 px-3 py-2.5 text-xs font-semibold text-[#8b682f] hover:bg-[#f4eee2]">Admin Login</a>
          </div>

          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="flex h-12 w-12 items-center justify-center rounded-xl border-2 border-[#173b30]/35 bg-[#f4eee2] text-[#173b30] shadow-md transition hover:bg-[#eadfc9] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#c49a52] dark:border-[#dba91d] dark:bg-[#14213b] dark:text-white dark:hover:bg-[#1c3156] xl:hidden"
            aria-label="Toggle menu"
            aria-expanded={menuOpen}
          >
            {menuOpen ? <X size={30} strokeWidth={3} /> : <Menu size={30} strokeWidth={3} />}
          </button>
        </div>

        {menuOpen && (
          <nav className="flex flex-col gap-4 border-t bg-white p-5 text-sm xl:hidden">
            <a href="#destinations" onClick={() => setMenuOpen(false)}>
              Explore
            </a>
            <a href="/destinations" onClick={() => setMenuOpen(false)}>All destinations</a>
            <a href="#featured" onClick={() => setMenuOpen(false)}>
              Featured stays
            </a>
            <a href="#benefits" onClick={() => setMenuOpen(false)}>
              Why ZuriStay Worldwide
            </a>
            <a href="#partners" onClick={() => setMenuOpen(false)}>
              List your property
            </a>
            <a href="/partner/dashboard" onClick={() => setMenuOpen(false)}>Already a partner? Partner dashboard</a>
            <a href="/admin/login" onClick={() => setMenuOpen(false)}>Admin Login</a>
            <a href="/partner/register" onClick={() => setMenuOpen(false)} className="font-semibold text-[#a77e3e]">Become a ZuriStay Worldwide partner</a>
            <a href="/login" onClick={() => setMenuOpen(false)}>Sign in</a>
            <a href="/register" onClick={() => setMenuOpen(false)}>Register</a>
          </nav>
        )}
      </header>

      <div className="border-b border-[#e9e3d8] bg-[#f8f5ee] px-4 py-3 xl:hidden">
        <div className="container flex flex-wrap items-center justify-center gap-2">
          <a href="/partner/register" className="inline-flex items-center justify-center rounded-full bg-[#c49a52] px-4 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-[#ae8540]">
            Become a partner
          </a>
          <a href="/partner/dashboard" className="inline-flex items-center justify-center rounded-full border border-[#173b30]/20 bg-white px-4 py-2.5 text-xs font-semibold text-[#173b30] transition hover:bg-[#f1eadc]">
            Partner login
          </a>
          <a href="/login" className="inline-flex items-center justify-center rounded-full border border-[#173b30]/20 bg-white px-4 py-2.5 text-xs font-semibold text-[#173b30] transition hover:bg-[#f1eadc]">
            Guest sign in
          </a>
          <a href="/register" className="inline-flex items-center justify-center rounded-full bg-[#173b30] px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-[#245545]">
            Create account
          </a>
        </div>
      </div>

      <section className="relative flex min-h-[690px] items-center overflow-hidden bg-[#102c24]">
        <div
          className="absolute inset-0 bg-cover bg-center opacity-40"
          style={{
            backgroundImage:
              "url('https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=1800')",
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-r from-[#0b241d]/95 via-[#12382d]/75 to-[#173b30]/20" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#102c24]/65 via-transparent to-[#102c24]/15" />

        <div className="container relative z-10 py-24 md:py-28">
          <div className="max-w-3xl text-white">
            <span className="mb-7 inline-flex items-center gap-2 rounded-full border border-[#e7c98f]/50 bg-white/10 px-5 py-2.5 text-[11px] font-bold tracking-[0.24em] text-[#f2d9a8] shadow-lg backdrop-blur-md">
              <Globe2 size={15} /> YOUR WORLD. YOUR STAY.
            </span>

            <h1 className="font-serif text-5xl font-semibold leading-[1.08] tracking-[-0.045em] drop-shadow-sm md:text-7xl lg:text-[5.4rem]">
              Discover places.
              <br />
              Create memories.
            </h1>

            <p className="mt-7 max-w-xl text-base leading-8 text-white/85 md:text-lg">
              From beautiful coastal escapes to city hotels and private villas,
              find the perfect stay for every journey.
            </p>
          </div>

          <form
            onSubmit={handleSearch}
            className="mt-14 grid gap-3 rounded-[1.75rem] border border-white/70 bg-white p-4 shadow-[0_24px_70px_rgba(5,25,19,0.28)] md:grid-cols-3 md:p-5 lg:grid-cols-6"
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
                  required
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

      <section id="destinations" className="container py-24 md:py-28">
        <div className="mb-10 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="mb-3 text-xs font-bold tracking-[0.2em] text-[#c49a52]">
              EXPLORE KENYA
            </p>
            <h2 className="font-serif text-3xl font-semibold tracking-tight text-[#173b30] md:text-4xl">
              Kenya&apos;s top tourist destinations
            </h2>
            <p className="mt-3 text-gray-500">
              From world-famous safari landscapes to the Indian Ocean coast and highland retreats.
            </p>
          </div>
          <a href="#featured" className="flex items-center gap-2 text-sm font-bold">
            Explore stays <ArrowRight size={17} />
          </a>
        </div>

        <style jsx global>{`@keyframes destinationPop { 0% { opacity: .35; transform: scale(.96); } 100% { opacity: 1; transform: scale(1); } }`}</style>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {destinationHighlights.map((item, index) => (
            <DestinationHighlightCard
              key={item.name}
              item={item}
              index={index}
              onSelect={() => {
                const params = new URLSearchParams({
                  destination: item.searchDestination,
                  checkIn,
                  checkOut,
                  guests,
                  rooms,
                  budget,
                });
                window.location.href = `/search?${params.toString()}`;
              }}
            />
          ))}
        </div>
      </section>

      <section className="container pb-20">
        <div className="rounded-3xl border border-[#e8dfcf] bg-[#f4eee2] px-7 py-10 text-center md:px-14">
          <p className="mb-3 text-xs font-bold tracking-[0.2em] text-[#9a7439]">FIND YOUR PLACE IN KENYA</p>
          <h2 className="text-3xl font-bold md:text-4xl">Looking for somewhere else?</h2>
          <p className="mx-auto mt-3 max-w-2xl text-gray-600">Explore all 47 counties, 334 sub-counties and 148 major urban centres in our nationwide destination directory.</p>
          <a href="/destinations" className="mt-6 inline-flex items-center gap-2 rounded-full bg-[#173b30] px-7 py-3.5 text-sm font-bold text-white transition hover:bg-[#245545]">Browse all Kenya destinations <ArrowRight size={17} /></a>
        </div>
      </section>

      <section id="featured" className="border-y border-[#eee8dd] bg-white py-24 md:py-28">
        <div className="container">
          <div className="mb-10">
            <p className="mb-3 text-xs font-bold tracking-[0.2em] text-[#c49a52]">
              ACCOMMODATION PARTNERS
            </p>
            <h2 className="text-3xl font-bold md:text-4xl">
              Find your next stay with ZuriStay Worldwide
            </h2>
            <p className="mt-3 max-w-2xl text-gray-500">
              We are onboarding accommodation partners across Kenya. New properties will appear here as owners complete their listings, room details, rates and availability.
            </p>
          </div>

          <div className="rounded-[1.5rem] border border-[#e8dfcf] bg-[#f8f5ee] px-7 py-12 text-center md:px-14">
            <h3 className="font-serif text-2xl font-semibold text-[#173b30] md:text-3xl">
              Are you an accommodation owner?
            </h3>
            <p className="mx-auto mt-4 max-w-2xl leading-7 text-gray-600">
              Join ZuriStay Worldwide and submit your hotel, resort, apartment, villa, lodge or guesthouse. You can complete your property profile and make it ready for bookings through your partner dashboard.
            </p>
            <div className="mt-7 flex flex-wrap justify-center gap-3">
              <a href="/partner/register" className="inline-flex items-center gap-2 rounded-full bg-[#c49a52] px-7 py-3.5 text-sm font-bold text-white transition hover:bg-[#ae8540]">
                List your property <ArrowRight size={17} />
              </a>
              <a href="/destinations" className="inline-flex items-center gap-2 rounded-full border border-[#173b30]/20 bg-white px-7 py-3.5 text-sm font-bold text-[#173b30] transition hover:bg-[#f4eee2]">
                Explore destinations
              </a>
            </div>
          </div>
        </div>
      </section>

      <section id="benefits" className="py-24">
        <div className="container">
          <div className="mx-auto mb-14 max-w-2xl text-center">
            <p className="mb-3 text-xs font-bold tracking-[0.2em] text-[#c49a52]">
              THE ZURISTAY WORLDWIDE EXPERIENCE
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
        <div className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-[#102c24] via-[#173b30] to-[#285b49] px-8 py-16 text-center text-white shadow-[0_22px_60px_rgba(23,59,48,0.18)] md:px-20 md:py-20">
          <p className="mb-4 text-xs font-bold tracking-[0.2em] text-[#d8b879]">
            PARTNER WITH ZURISTAY WORLDWIDE
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
            Become a ZuriStay Worldwide partner
          </a>
        </div>
      </section>

      <footer className="border-t border-white/10 bg-[#0c251e] py-14 text-white">
        <div className="container flex flex-col justify-between gap-8 md:flex-row">
          <div>
            <img src="/brand/zuristay-dark.svg" alt="ZuriStay Worldwide — Your Next Stay, Anywhere" className="h-auto w-64 max-w-full rounded-lg" />
            <p className="mt-3 text-sm text-white/70">Your world. Your stay.</p>
          </div>
          <div className="text-sm text-white/60">
            <p>Explore stays. Discover experiences.</p>
            <p className="mt-3">
              © {new Date().getFullYear()} ZuriStay Worldwide. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </main>
  );
}

