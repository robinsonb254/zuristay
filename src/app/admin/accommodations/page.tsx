"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Building2, ImagePlus, Search, RefreshCw, CheckCircle2 } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type Accommodation = {
  id: string;
  name: string;
  property_type: string;
  city: string;
  county: string | null;
  booking_enabled: boolean;
  image_urls: string[] | null;
};

export default function ManagementAccommodationsAdmin() {
  const [items, setItems] = useState<Accommodation[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function token() {
    const sb = createSupabaseBrowserClient();
    const { data: { session } } = await sb.auth.getSession();
    if (!session) throw new Error("Please sign in to your administrator account.");
    return session.access_token;
  }

  async function load(search = query) {
    setLoading(true);
    setError("");
    try {
      const accessToken = await token();
      const params = new URLSearchParams();
      if (search.trim()) params.set("q", search.trim());
      const response = await fetch("/api/admin/independent-accommodations?" + params.toString(), {
        headers: { authorization: "Bearer " + accessToken },
        cache: "no-store",
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || "Unable to load accommodations.");
      setItems(result.accommodations || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to load accommodations.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(""); }, []);

  async function setBooking(item: Accommodation) {
    setBusy(item.id);
    setError("");
    setNotice("");
    try {
      const accessToken = await token();
      const response = await fetch("/api/admin/independent-accommodations", {
        method: "PATCH",
        headers: { "content-type": "application/json", authorization: "Bearer " + accessToken },
        body: JSON.stringify({ id: item.id, booking_enabled: !item.booking_enabled }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || "Unable to update guest booking.");
      setItems(current => current.map(row => row.id === item.id ? { ...row, booking_enabled: result.accommodation.booking_enabled } : row));
      setNotice(`Guest booking ${result.accommodation.booking_enabled ? "enabled" : "disabled"} for ${item.name}.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to update guest booking.");
    } finally {
      setBusy("");
    }
  }

  async function uploadPhotos(item: Accommodation, selected: FileList | null) {
    if (!selected?.length) return;
    const files = Array.from(selected);
    if (files.length > 15) {
      setError("Select no more than 15 photos at once.");
      return;
    }
    setBusy(item.id);
    setError("");
    setNotice("");
    try {
      const accessToken = await token();
      const form = new FormData();
      form.set("id", item.id);
      files.forEach(file => form.append("files", file));
      const response = await fetch("/api/admin/independent-accommodations", {
        method: "POST",
        headers: { authorization: "Bearer " + accessToken },
        body: form,
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || "Unable to upload photos.");
      setItems(current => current.map(row => row.id === item.id ? { ...row, image_urls: result.image_urls } : row));
      setNotice(`Photos saved for ${item.name}.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to upload photos.");
    } finally {
      setBusy("");
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-800 sm:px-6">
      <div className="mx-auto max-w-6xl">
        <Link href="/admin" className="text-sm font-semibold text-blue-900">← Admin dashboard</Link>
        <div className="mt-5 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-orange-600">ZuriStay Worldwide</p>
            <h1 className="mt-2 text-3xl font-black text-blue-950">Management accommodations</h1>
            <p className="mt-2 text-sm text-slate-500">Manage guest booking access and property photos.</p>
          </div>
          <button type="button" onClick={() => void load()} disabled={loading} className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold disabled:opacity-50">
            <RefreshCw size={16} className={loading ? "animate-spin" : ""}/> Refresh
          </button>
        </div>

        <form onSubmit={event => { event.preventDefault(); void load(query); }} className="mt-6 flex gap-2 rounded-2xl border border-slate-200 bg-white p-3">
          <Search className="mt-3 text-slate-400" size={19}/>
          <input value={query} onChange={event => setQuery(event.target.value)} placeholder="Find an accommodation, town or county" className="min-w-0 flex-1 px-2 py-2 outline-none"/>
          <button className="rounded-xl bg-blue-950 px-5 py-2.5 text-sm font-bold text-white">Search</button>
        </form>

        {error && <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        {notice && <p className="mt-4 flex items-center gap-2 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800"><CheckCircle2 size={16}/>{notice}</p>}

        <div className="mt-6 space-y-4">
          {loading ? <div className="rounded-2xl bg-white p-10 text-center text-slate-500">Loading accommodations…</div> : items.map(item => (
            <article key={item.id} className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-[160px_1fr] sm:p-5">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-1">
                {item.image_urls?.length ? item.image_urls.slice(0, 2).map((url, index) => <img key={url} src={url} alt={item.name + " photo " + (index + 1)} className="h-24 w-full rounded-xl object-cover sm:h-28"/>) : <div className="flex h-28 items-center justify-center rounded-xl bg-slate-100"><Building2 size={34} className="text-slate-300"/></div>}
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-orange-600">{item.property_type}</p>
                    <h2 className="mt-1 text-lg font-bold text-blue-950">{item.name}</h2>
                    <p className="mt-1 text-sm text-slate-500">{[item.city, item.county].filter(Boolean).join(", ") || "Location awaiting county assignment"}</p>
                    <p className="mt-1 text-xs text-slate-400">{item.image_urls?.length || 0} photos saved</p>
                  </div>
                  <button type="button" onClick={() => void setBooking(item)} disabled={busy === item.id} className={`rounded-xl px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50 ${item.booking_enabled ? "bg-emerald-700 hover:bg-emerald-800" : "bg-orange-600 hover:bg-orange-700"}`}>
                    {busy === item.id ? "Saving…" : item.booking_enabled ? "Disable guest booking" : "Enable guest booking"}
                  </button>
                </div>
                <label className="mt-4 inline-flex cursor-pointer items-center gap-2 rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-blue-950 hover:bg-slate-50">
                  <ImagePlus size={17}/> Add property photos
                  <input type="file" accept="image/jpeg,image/png,image/webp" multiple className="hidden" disabled={busy === item.id} onChange={event => { void uploadPhotos(item, event.target.files); event.currentTarget.value = ""; }}/>
                </label>
                <p className="mt-2 text-xs text-slate-400">JPG, PNG or WebP · up to 15 photos · maximum 8 MB each</p>
              </div>
            </article>
          ))}
          {!loading && items.length === 0 && !error && <p className="rounded-2xl bg-white p-10 text-center text-slate-500">No matching accommodations found.</p>}
        </div>
      </div>
    </main>
  );
}
