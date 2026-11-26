"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Loader2, Save } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type Destination = { id: string; name: string; city: string; county: string | null; country: string };
type Property = {
  name: string; property_type: string; destination_id: string; address: string;
  description: string | null; currency: string; contact_phone: string; contact_email: string;
  status: string; is_active: boolean; has_conference_rooms: boolean;
};

const types = [
  ["hotel", "Hotel"], ["resort", "Resort"], ["apartment", "Apartment"], ["villa", "Villa"],
  ["bnb", "Bed and Breakfast"], ["lodge", "Lodge"], ["guesthouse", "Guesthouse"],
  ["hostel", "Hostel"], ["lounge", "Lounge"], ["venue", "Venue"], ["other", "Other"],
];
const currencies = [["KES", "Kenyan Shilling (KES)"], ["USD", "US Dollar (USD)"], ["EUR", "Euro (EUR)"], ["GBP", "British Pound (GBP)"], ["TZS", "Tanzanian Shilling (TZS)"], ["UGX", "Ugandan Shilling (UGX)"]];
const field = "w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-blue-700 focus:ring-2 focus:ring-blue-100";

export default function EditPartnerPropertyPage() {
  const params = useParams<{ propertyId: string }>();
  const router = useRouter();
  const propertyId = params.propertyId;
  const [property, setProperty] = useState<Property | null>(null);
  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const supabase = createSupabaseBrowserClient();
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) { router.replace("/login?next=" + encodeURIComponent("/partner/properties/" + propertyId + "/edit")); return; }
        const response = await fetch("/api/partner/properties/" + propertyId, {
          headers: { Authorization: "Bearer " + session.access_token }, cache: "no-store",
        });
        const result = await response.json();
        if (!response.ok || !result.success) throw new Error(result.error || "Unable to load property details.");
        setProperty({ ...result.property, description: result.property.description || "" });
        setDestinations(result.destinations || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unable to load property details.");
      } finally { setLoading(false); }
    }
    load();
  }, [propertyId, router]);

  function update<K extends keyof Property>(key: K, value: Property[K]) {
    setProperty((current) => current ? { ...current, [key]: value } : current);
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!property) return;
    setSaving(true); setError(""); setMessage("");
    try {
      const supabase = createSupabaseBrowserClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Please sign in again.");
      const response = await fetch("/api/partner/properties/" + propertyId, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + session.access_token },
        body: JSON.stringify({
          name: property.name, propertyType: property.property_type, destinationId: property.destination_id,
          address: property.address, description: property.description || "", currency: property.currency,
          contactPhone: property.contact_phone, contactEmail: property.contact_email,
          hasConferenceRooms: property.has_conference_rooms,
        }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || "Unable to save property details.");
      setProperty({ ...property, ...result.property });
      setMessage(result.message || "Property details updated.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save property details.");
    } finally { setSaving(false); }
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-5 py-4">
          <Link href="/" className="text-2xl font-bold text-blue-900">ZuriStay<span className="text-amber-500">.</span></Link>
          <Link href="/" className="text-sm font-medium text-slate-600 hover:text-blue-800">Visit homepage</Link>
        </div>
      </header>
      <div className="mx-auto max-w-3xl px-5 py-8">
        <Link href="/" className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-blue-800"><ArrowLeft size={17} />Back to homepage</Link>
        <h1 className="text-3xl font-bold text-slate-900">Edit property details</h1>
        <p className="mt-2 text-sm text-slate-600">Keep your property information accurate for travellers.</p>
        {loading ? <div className="mt-8 rounded-2xl bg-white p-10 text-center"><Loader2 className="mx-auto animate-spin text-blue-800" /><p className="mt-3 text-sm text-slate-500">Loading property...</p></div> :
          property ? <form onSubmit={save} className="mt-7 space-y-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
            <label className="block text-sm font-semibold text-slate-700">Property name
              <input className={field + " mt-2"} required minLength={2} maxLength={150} value={property.name} onChange={(e) => update("name", e.target.value)} />
            </label>
            <label className="block text-sm font-semibold text-slate-700">Property type
              <select className={field + " mt-2"} value={property.property_type} onChange={(e) => update("property_type", e.target.value)}>{types.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
            </label>
            <label className="block text-sm font-semibold text-slate-700">Destination
              <select className={field + " mt-2"} required value={property.destination_id} onChange={(e) => update("destination_id", e.target.value)}>{destinations.map((d) => <option key={d.id} value={d.id}>{d.name}{d.county ? " — " + d.county : ""}, {d.country}</option>)}</select>
            </label>
            <label className="block text-sm font-semibold text-slate-700">Physical address or location
              <input className={field + " mt-2"} required minLength={4} maxLength={250} value={property.address} onChange={(e) => update("address", e.target.value)} />
            </label>
            <label className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm font-semibold text-slate-700"><input type="checkbox" checked={Boolean(property.has_conference_rooms)} onChange={(e) => update("has_conference_rooms", e.target.checked)} className="h-4 w-4 accent-blue-900" />This property has conference rooms</label>
            <label className="block text-sm font-semibold text-slate-700">Property description
              <textarea className={field + " mt-2"} rows={5} maxLength={5000} value={property.description || ""} onChange={(e) => update("description", e.target.value)} />
            </label>
            <label className="block text-sm font-semibold text-slate-700">Listing currency
              <select className={field + " mt-2"} value={property.currency} onChange={(e) => update("currency", e.target.value)}>{currencies.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
            </label>
            <div className="grid gap-5 sm:grid-cols-2">
              <label className="block text-sm font-semibold text-slate-700">Contact phone
                <input className={field + " mt-2"} type="tel" required minLength={5} maxLength={30} value={property.contact_phone || ""} onChange={(e) => update("contact_phone", e.target.value)} />
              </label>
              <label className="block text-sm font-semibold text-slate-700">Contact email
                <input className={field + " mt-2"} type="email" required maxLength={254} value={property.contact_email || ""} onChange={(e) => update("contact_email", e.target.value)} />
              </label>
            </div>
            <div className="rounded-xl bg-blue-50 p-4 text-sm text-blue-900">Listing status: <strong className="capitalize">{property.status}</strong>{property.is_active ? " · Published" : " · Not currently published"}. Editing details does not change your approval or publication status.</div>
            {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
            {message && <p role="status" className="text-sm text-green-700">{message}</p>}
            <button type="submit" disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-blue-900 px-5 py-3 font-semibold text-white hover:bg-blue-800 disabled:opacity-50">{saving ? <Loader2 size={17} className="animate-spin" /> : <Save size={17} />}{saving ? "Saving changes..." : "Save property details"}</button>
          </form> : <div className="mt-7 rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-800">{error || "Property not found."}</div>}
      </div>
    </main>
  );
}
