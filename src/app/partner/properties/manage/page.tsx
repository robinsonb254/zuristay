"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Building2, Hotel, Pencil, Plus, RefreshCw } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type Property = {
  id: string; name: string; property_type: string; city: string;
  county: string | null; status: string; is_archived?: boolean;
  publication_status?: string; is_active: boolean;
};

export default function ManagePartnerPropertiesPage() {
  const router = useRouter();
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const supabase = createSupabaseBrowserClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.replace("/login?next=%2Fpartner%2Fproperties%2Fmanage"); return; }
      const response = await fetch("/api/partner/properties", {
        headers: { Authorization: `Bearer ${session.access_token}` }, cache: "no-store",
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || "Unable to load your properties.");
      setProperties((result.properties || []).filter((property: Property) => !property.is_archived));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load your properties.");
    } finally { setLoading(false); }
  }, [router]);

  useEffect(() => { load(); }, [load]);

  return (
    <main className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
          <Link href="/" className="text-2xl font-bold text-blue-900">ZuriStay<span className="text-amber-500">.</span></Link>
          <Link href="/partner/dashboard" className="text-sm font-semibold text-blue-800">My property listings</Link>
        </div>
      </header>
      <div className="mx-auto max-w-6xl px-5 py-8">
        <Link href="/partner/dashboard" className="text-sm font-medium text-slate-600 hover:text-blue-800">← Back to partner dashboard</Link>
        <div className="mt-5 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wider text-blue-700">Partner workspace</p>
            <h1 className="mt-2 text-3xl font-bold text-slate-900">Manage properties ({properties.length})</h1>
            <p className="mt-2 text-slate-600">Edit each property and complete its rooms, facilities, photographs and availability. Submit only when everything is ready for final review.</p>
          </div>
          <div className="flex gap-2">
            <button onClick={load} className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700"><RefreshCw size={16}/>Refresh</button>
            <Link href="/partner/properties/new" className="inline-flex items-center gap-2 rounded-xl bg-blue-900 px-4 py-3 text-sm font-semibold text-white"><Plus size={17}/>Add property</Link>
          </div>
        </div>
        {error && <div role="alert" className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</div>}
        {loading ? <div className="mt-8 rounded-2xl bg-white p-10 text-center text-slate-600">Loading your properties…</div> :
          properties.length === 0 ? <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-10 text-center"><Building2 className="mx-auto text-slate-400" size={34}/><h2 className="mt-3 text-lg font-bold text-slate-900">No active properties yet</h2><p className="mt-2 text-sm text-slate-500">Your approved partner application will appear here as your first property workspace.</p></div> :
          <div className="mt-8 grid gap-5 md:grid-cols-2">{properties.map((property) => <article key={property.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-start gap-3"><div className="rounded-xl bg-blue-50 p-3 text-blue-900"><Building2 size={22}/></div><div className="min-w-0 flex-1"><h2 className="font-bold text-slate-900">{property.name}</h2><p className="mt-1 text-sm capitalize text-slate-500">{property.property_type.replaceAll("_"," ")} · {[property.city,property.county].filter(Boolean).join(", ")}</p><p className="mt-2 text-xs capitalize text-slate-500">Property review: {property.status.replaceAll("_"," ")} · {property.publication_status?.replaceAll("_"," ") || "setup in progress"}</p></div></div>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <Link href={`/partner/properties/${property.id}/edit`} className="inline-flex items-center justify-center gap-2 rounded-xl border border-blue-200 px-3 py-3 text-sm font-semibold text-blue-900 hover:bg-blue-50"><Pencil size={16}/>Edit property</Link>
              <Link href={`/partner/properties/${property.id}/rooms`} className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-900 px-3 py-3 text-sm font-semibold text-white hover:bg-blue-800"><Hotel size={16}/>Add rooms / setup</Link>
            </div>
          </article>)}</div>}
      </div>
    </main>
  );
}
