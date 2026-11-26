"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Search } from "lucide-react";
import LocationPhoto from "@/app/components/LocationPhoto";

type Subcounty = { subcounty_code: string; name: string };
type County = { county_code: number; name: string; subcounties: Subcounty[] };
type Destination = {
  id: string;
  city: string;
  county: string | null;
  population_2019: number | null;
  sort_order: number | null;
};

export default function DestinationsPage() {
  const [counties, setCounties] = useState<County[]>([]);
  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const [countyResponse, destinationResponse] = await Promise.all([
          fetch("/api/kenya-locations"),
          fetch("/api/destinations"),
        ]);
        const [countyData, destinationData] = await Promise.all([
          countyResponse.json(),
          destinationResponse.json(),
        ]);
        if (!active) return;
        if (countyResponse.ok && countyData.success) setCounties(countyData.counties || []);
        if (destinationResponse.ok && destinationData.success) setDestinations(destinationData.destinations || []);
      } catch (error) {
        console.error("Destination directory loading error:", error);
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => { active = false; };
  }, []);

  const filteredDestinations = useMemo(() => {
    const term = query.trim().toLowerCase();
    return destinations
      
      .filter((item) => !term || item.city.toLowerCase().includes(term) || (item.county || "").toLowerCase().includes(term))
      .sort((a, b) => (a.sort_order ?? 999999) - (b.sort_order ?? 999999));
  }, [destinations, query]);

  const filteredCounties = useMemo(() => {
    const term = query.trim().toLowerCase();
    return counties.filter((county) =>
      !term ||
      county.name.toLowerCase().includes(term) ||
      county.subcounties.some((subcounty) => subcounty.name.toLowerCase().includes(term))
    );
  }, [counties, query]);

  function searchFor(value: string) {
    window.location.href = `/search?destination=${encodeURIComponent(value)}`;
  }

  return (
    <main className="min-h-screen bg-[#faf9f6] text-[#173b30]">
      <header className="border-b border-gray-100 bg-white">
        <div className="container flex h-20 items-center justify-between">
          <Link href="/" className="text-3xl font-bold tracking-tight">Zuri<span className="text-[#c49a52]">Stay</span></Link>
          <Link href="/" className="inline-flex items-center gap-2 text-sm font-semibold hover:text-[#a77e3e]"><ArrowLeft size={17} /> Back to home</Link>
        </div>
      </header>

      <section className="bg-[#173b30] py-16 text-white md:py-20">
        <div className="container">
          <p className="mb-3 text-xs font-bold tracking-[0.2em] text-[#d8b879]">KENYA, FROM COAST TO HIGHLANDS</p>
          <h1 className="max-w-3xl text-4xl font-bold leading-tight md:text-6xl">Explore every corner of Kenya</h1>
          <p className="mt-5 max-w-2xl leading-7 text-white/75">Find accommodation destinations across all 47 counties, from major cities and tourist towns to local communities.</p>
          <div className="mt-8 flex max-w-xl items-center gap-3 rounded-xl bg-white px-4 py-3 text-gray-700 shadow-xl">
            <Search className="shrink-0 text-[#c49a52]" size={20} />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search a town, county or sub-county" className="w-full bg-transparent text-sm outline-none" />
          </div>
        </div>
      </section>

      <section className="container py-14">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="mb-2 text-xs font-bold tracking-[0.2em] text-[#c49a52]">NATIONWIDE DIRECTORY</p>
            <h2 className="text-3xl font-bold">Major Towns &amp; Urban Destinations</h2>
            <p className="mt-2 text-sm text-gray-500">Explore 148 towns, cities and urban centres across Kenya, alongside additional destinations worth discovering.</p>
          </div>
          <span className="text-sm font-semibold text-gray-500">{filteredDestinations.length} places</span>
        </div>
        {loading ? <p className="py-8 text-sm text-gray-500">Loading destinations…</p> : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filteredDestinations.map((item, index) => (
              <div key={item.id} role="button" tabIndex={0} onClick={() => searchFor(item.city)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); searchFor(item.city); } }} className="overflow-hidden rounded-xl border border-gray-100 bg-white text-left transition hover:-translate-y-0.5 hover:border-[#c49a52] hover:shadow-md">
                <LocationPhoto location={`${item.city}, ${item.county || "Kenya"}`} className={`${item.city.toLowerCase() === "diani" ? "h-52 sm:h-60" : "h-32"} w-full`} compact eager={index < 8} />
                <span className="flex items-center justify-between gap-3 px-4 py-3">
                  <span><span className="block text-sm font-semibold">{item.city === "Diani" ? "Diani Beach" : item.city}</span><span className="mt-0.5 block text-xs text-gray-500">{item.county}</span></span>
                  <span className="shrink-0 text-right text-xs tabular-nums text-gray-400">{item.population_2019 !== null ? Number(item.population_2019).toLocaleString("en-KE") : "Tourist destination"}</span>
                </span>
              </div>
            ))}
          </div>
        )}
        {!loading && filteredDestinations.length === 0 && <p className="py-8 text-sm text-gray-500">No matching urban centres found.</p>}
      </section>

      <section className="bg-white py-14">
        <div className="container">
          <div className="mb-8">
            <p className="mb-2 text-xs font-bold tracking-[0.2em] text-[#c49a52]">ALL 47 COUNTIES</p>
            <h2 className="text-3xl font-bold">Browse by county and sub-county</h2>
            <p className="mt-2 text-sm text-gray-500">Select a county or sub-county to search accommodation in that area.</p>
          </div>
          {loading ? <p className="py-8 text-sm text-gray-500">Loading county directory…</p> : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filteredCounties.map((county) => (
                <details key={county.county_code} className="group rounded-2xl border border-gray-200 bg-[#faf9f6] p-5">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-3 font-bold">
                    <span>{county.name}</span>
                    <span className="rounded-full bg-[#f4eee2] px-3 py-1 text-xs font-semibold text-[#8d6a31]">{county.subcounties.length} sub-counties</span>
                  </summary>
                  <div className="mt-4 border-t border-gray-100 pt-4">
                    <div className="mb-3 overflow-hidden rounded-xl">
                      <LocationPhoto location={`${county.name} County, Kenya`} className="h-36 w-full" />
                    </div>
                    <button onClick={() => searchFor(county.name)} className="mb-3 rounded-full bg-[#173b30] px-3 py-1.5 text-xs font-semibold text-white">Search county</button>
                    <div className="grid grid-cols-2 gap-2">
                    {county.subcounties.filter((subcounty) => !query.trim() || subcounty.name.toLowerCase().includes(query.trim().toLowerCase()) || county.name.toLowerCase().includes(query.trim().toLowerCase())).map((subcounty) => (
                      <div key={subcounty.subcounty_code} role="button" tabIndex={0} onClick={() => searchFor(`${subcounty.name}, ${county.name}`)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); searchFor(`${subcounty.name}, ${county.name}`); } }} className="overflow-hidden rounded-lg bg-white text-left text-xs text-gray-700 hover:bg-[#f4eee2]">
                        <LocationPhoto location={`${subcounty.name}, ${county.name}, Kenya`} className="h-20 w-full" compact />
                        <span className="block px-2 py-2">{subcounty.name}</span>
                      </div>
                    ))}
                    </div>
                  </div>
                </details>
              ))}
            </div>
          )}
          {!loading && filteredCounties.length === 0 && <p className="py-8 text-sm text-gray-500">No matching counties or sub-counties found.</p>}
        </div>
      </section>

      <footer className="bg-[#102c24] py-10 text-white">
        <div className="container flex flex-wrap items-center justify-between gap-4">
          <div><p className="text-2xl font-bold">Zuri<span className="text-[#c49a52]">Stay</span></p><p className="mt-2 text-sm text-white/60">Your world. Your stay.</p></div>
          <Link href="/" className="inline-flex items-center gap-2 text-sm font-semibold text-white/80 hover:text-white">Return to homepage <ArrowRight size={16} /></Link>
        </div>
      </footer>
    </main>
  );
}
