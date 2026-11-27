"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Search, MapPin, ExternalLink, Building2 } from "lucide-react";

type Accommodation = {
  id: string;
  name: string;
  property_type: string;
  description: string | null;
  city: string;
  county: string | null;
  country: string;
  currency: string;
  guest_rate: number | null;
  public_website_url: string | null;
  image_urls: string[];
  booking_enabled: boolean;
};

export default function AccommodationsPage() {
  const [items, setItems] = useState<Accommodation[]>([]);
  const [query, setQuery] = useState("");
  const [type, setType] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (query.trim()) params.set("q", query.trim());
      if (type) params.set("type", type);
      const response = await fetch("/api/independent-accommodations?" + params.toString(), { cache: "no-store" });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || "Could not load accommodations.");
      setItems(result.accommodations || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load accommodations.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  return (
    <main className="min-h-screen bg-[#f7f8f6] text-slate-800">
      <header className="bg-[#123b31] px-5 py-5 text-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <Link href="/" className="text-2xl font-black">Zuri<span className="text-orange-400">Stay</span></Link>
          <Link href="/" className="text-sm font-semibold text-white/80 hover:text-white">Back to home</Link>
        </div>
      </header>
      <section className="bg-gradient-to-br from-[#123b31] to-[#1c5947] px-5 py-16 text-white">
        <div className="mx-auto max-w-7xl">
          <p className="text-xs font-bold uppercase tracking-[.24em] text-orange-300">Discover more places to stay</p>
          <h1 className="mt-3 max-w-3xl font-serif text-4xl font-bold sm:text-5xl">ZuriStay Worldwide Management Accommodations</h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-white/75">Find hotels, resorts, villas, apartments, lodges and guesthouses across Kenya.</p>
          <div className="mt-8 flex max-w-3xl flex-col gap-3 rounded-2xl bg-white p-3 sm:flex-row">
            <div className="flex flex-1 items-center gap-3 px-3"><Search className="text-slate-400" size={20}/><input value={query} onChange={e=>setQuery(e.target.value)} onKeyDown={e=>e.key==="Enter"&&load()} placeholder="Search property, town or county" className="w-full py-3 text-slate-800 outline-none"/></div>
            <select value={type} onChange={e=>setType(e.target.value)} className="rounded-xl border border-slate-200 px-4 py-3 text-slate-700"><option value="">All accommodation types</option>{["hotel","resort","villa","apartment","lodge","guesthouse","hostel","camp"].map(x=><option key={x} value={x}>{x[0].toUpperCase()+x.slice(1)}</option>)}</select>
            <button onClick={load} className="rounded-xl bg-orange-500 px-6 py-3 font-bold text-white hover:bg-orange-600">Search</button>
          </div>
        </div>
      </section>
      <section className="mx-auto max-w-7xl px-5 py-12">
        <div className="mb-7 flex items-end justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-orange-600">ZuriStay Worldwide</p>
            <h2 className="mt-2 font-serif text-3xl font-bold text-[#173b30]">More places to stay</h2>
          </div>
          <span className="text-sm font-semibold text-slate-500">{items.length} accommodations</span>
        </div>
        {loading ? <div className="rounded-2xl bg-white p-12 text-center text-slate-500">Loading accommodations…</div> : error ? <div className="rounded-2xl bg-white p-10 text-center text-red-700">{error}</div> : items.length===0 ? <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center"><Building2 className="mx-auto text-slate-300" size={36}/><h3 className="mt-4 text-xl font-bold text-slate-800">Explore ZuriStay accommodations</h3><p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-slate-500">Search by property name, town or county to find places to stay across Kenya.</p></div> : <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">{items.map(item=><article key={item.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">{item.image_urls?.[0] ? <img src={item.image_urls[0]} alt={item.name} loading="lazy" decoding="async" className="h-52 w-full object-cover"/> : <div className="flex h-52 items-center justify-center bg-slate-100"><Building2 className="text-slate-300" size={42}/></div>}<div className="p-5"><p className="text-xs font-bold uppercase tracking-wider text-orange-600">{item.property_type}</p><h3 className="mt-2 text-xl font-bold text-[#173b30]">{item.name}</h3><p className="mt-2 flex items-center gap-1 text-sm text-slate-500"><MapPin size={15}/>{[item.city,item.county,item.country].filter(Boolean).join(", ")}</p>{item.description&&<p className="mt-3 line-clamp-3 text-sm leading-6 text-slate-600">{item.description}</p>}{item.guest_rate!==null&&<p className="mt-4 font-bold text-[#173b30]">{item.currency} {Number(item.guest_rate).toLocaleString("en-KE")} <span className="text-xs font-normal text-slate-500">per night</span></p>}<div className="mt-5 flex flex-wrap gap-3">{item.booking_enabled&&<Link href={"/accommodations/"+item.id} className="rounded-xl bg-orange-500 px-4 py-2.5 text-sm font-bold text-white">Reserve with ZuriStay</Link>}{item.public_website_url&&<a href={item.public_website_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm font-semibold text-[#173b30]">Property website <ExternalLink size={14}/></a>}</div></div></article>)}</div>}
      </section>
      <footer className="border-t border-slate-200 bg-white px-5 py-8">
        <div className="mx-auto max-w-7xl text-center text-xs text-slate-400">© {new Date().getFullYear()} ZuriStay Worldwide. Your World. Your Stay. · © OpenStreetMap contributors</div>
      </footer>
    </main>
  );
}
