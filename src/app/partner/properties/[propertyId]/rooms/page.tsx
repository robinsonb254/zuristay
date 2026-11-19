"use client";

import { useCallback, useEffect, useState, FormEvent } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, BedDouble, Loader2, Plus, RefreshCw, Users } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type Unit = {
  id: string;
  name: string;
  unit_type: string | null;
  description: string | null;
  capacity: number;
  total_units: number;
  base_rate: number;
  currency: string;
  active: boolean;
};

type Property = {
  id: string;
  name: string;
  currency: string;
  status: string;
  is_active: boolean;
};

function RoomAvailabilityForm({
  propertyId,
  unit,
}: {
  propertyId: string;
  unit: Unit;
}) {
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [availableUnits, setAvailableUnits] = useState(String(unit.total_units));
  const [partnerBaseRate, setPartnerBaseRate] = useState(String(unit.base_rate));
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const today = new Date();
  const minDate = [
    today.getFullYear(),
    String(today.getMonth() + 1).padStart(2, "0"),
    String(today.getDate()).padStart(2, "0"),
  ].join("-");

  async function saveAvailability(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");

    try {
      const supabase = createSupabaseBrowserClient();
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session) {
        window.location.href = "/login?next=" + encodeURIComponent("/partner/properties/" + propertyId + "/rooms");
        return;
      }

      const response = await fetch(
        "/api/partner/properties/" + propertyId + "/units/" + unit.id + "/availability",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer " + session.access_token,
          },
          body: JSON.stringify({
            startDate,
            endDate,
            availableUnits: Number(availableUnits),
            partnerBaseRate,
          }),
        }
      );
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.error || "Unable to save availability.");
      }
      setMessage(result.message || "Availability saved.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save availability.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={saveAvailability} className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
      <h4 className="font-semibold text-slate-900">Set availability and nightly rate</h4>
      <p className="mt-1 text-xs text-slate-500">
        Apply these settings to every date in the selected range. Set available rooms to zero to block the dates.
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="text-xs font-semibold text-slate-600">
          From
          <input type="date" min={minDate} required value={startDate} onChange={(event) => setStartDate(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-normal text-slate-900" />
        </label>
        <label className="text-xs font-semibold text-slate-600">
          To
          <input type="date" min={startDate || minDate} required value={endDate} onChange={(event) => setEndDate(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-normal text-slate-900" />
        </label>
        <label className="text-xs font-semibold text-slate-600">
          Available rooms
          <input type="number" min="0" max={unit.total_units} step="1" required value={availableUnits} onChange={(event) => setAvailableUnits(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-normal text-slate-900" />
        </label>
        <label className="text-xs font-semibold text-slate-600">
          Partner nightly rate ({unit.currency})
          <input type="number" min="0" max="100000000" step="0.01" required value={partnerBaseRate} onChange={(event) => setPartnerBaseRate(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-normal text-slate-900" />
        </label>
      </div>
      {error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
      {message && <p role="status" className="mt-3 text-sm text-green-700">{message}</p>}
      <button type="submit" disabled={saving} className="mt-4 inline-flex items-center justify-center gap-2 rounded-lg bg-blue-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-50">
        {saving ? <Loader2 size={16} className="animate-spin" /> : null}
        {saving ? "Saving dates..." : "Save availability"}
      </button>
    </form>
  );
}

export default function PartnerPropertyRoomsPage() {
  const params = useParams<{ propertyId: string }>();
  const propertyId = params.propertyId;
  const router = useRouter();

  const [property, setProperty] = useState<Property | null>(null);
  const [units, setUnits] = useState<Unit[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [name, setName] = useState("");
  const [unitType, setUnitType] = useState("Standard room");
  const [description, setDescription] = useState("");
  const [capacity, setCapacity] = useState("2");
  const [totalUnits, setTotalUnits] = useState("1");
  const [baseRate, setBaseRate] = useState("");

  const loadRooms = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const supabase = createSupabaseBrowserClient();
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session) {
        router.replace("/login?next=" + encodeURIComponent("/partner/properties/" + propertyId + "/rooms"));
        return;
      }

      const response = await fetch("/api/partner/properties/" + propertyId + "/units", {
        headers: { Authorization: "Bearer " + session.access_token },
        cache: "no-store",
      });
      const result = await response.json();
      if (response.status === 401) {
        router.replace("/login?next=" + encodeURIComponent("/partner/properties/" + propertyId + "/rooms"));
        return;
      }
      if (!response.ok || !result.success) throw new Error(result.error || "Unable to load room categories.");
      setProperty(result.property);
      setUnits(result.units || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load room management.");
    } finally {
      setLoading(false);
    }
  }, [propertyId, router]);

  useEffect(() => {
    loadRooms();
  }, [loadRooms]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");
    setSaving(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session) {
        router.replace("/login?next=" + encodeURIComponent("/partner/properties/" + propertyId + "/rooms"));
        return;
      }
      const response = await fetch("/api/partner/properties/" + propertyId + "/units", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + session.access_token,
        },
        body: JSON.stringify({
          name,
          unitType,
          description,
          capacity: Number(capacity),
          totalUnits: Number(totalUnits),
          baseRate: Number(baseRate),
        }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || "Unable to save this room category.");

      setSuccess(result.message || "Room category saved.");
      setName("");
      setDescription("");
      setCapacity("2");
      setTotalUnits("1");
      setBaseRate("");
      await loadRooms();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save this room category.");
    } finally {
      setSaving(false);
    }
  }

  const fieldClass = "w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none focus:border-blue-700 focus:ring-2 focus:ring-blue-100";
  const labelClass = "mb-2 block text-sm font-semibold text-slate-700";

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="text-center"><Loader2 className="mx-auto mb-3 animate-spin text-blue-800" size={30} /><p className="text-slate-600">Loading room management...</p></div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
          <Link href="/" className="text-2xl font-bold text-blue-900">ZuriStay<span className="text-amber-500">.</span></Link>
          <Link href="/partner/dashboard" className="text-sm font-medium text-slate-600 hover:text-blue-800">Partner dashboard</Link>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-5 py-8">
        <Link href="/partner/dashboard" className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-blue-800"><ArrowLeft size={17} />Back to dashboard</Link>
        <div className="mb-7">
          <p className="text-sm font-semibold uppercase tracking-wider text-blue-700">Property setup</p>
          <h1 className="mt-2 text-3xl font-bold text-slate-900">Rooms and rates</h1>
          <p className="mt-2 text-slate-600">{property?.name || "Your property"} · Add room categories and their nightly rates.</p>
        </div>

        {property && (
          <div className="mb-6 rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-900">
            Property review: <strong className="capitalize">{property.status}</strong>. {property.is_active ? "This property is active." : "This property is not public yet. Room setup alone will not publish it."}
          </div>
        )}
        {error && <div className="mb-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</div>}
        {success && <div className="mb-5 rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-800">{success}</div>}

        <div className="grid gap-7 lg:grid-cols-[1.1fr_0.9fr]">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
            <div className="mb-5 flex items-center gap-3"><div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-900"><Plus size={22} /></div><div><h2 className="text-xl font-bold text-slate-900">Add a room category</h2><p className="text-sm text-slate-500">For example, Deluxe Double or Family Villa.</p></div></div>
            <form onSubmit={handleSubmit} className="space-y-5">
              <div><label htmlFor="roomName" className={labelClass}>Room category name *</label><input id="roomName" className={fieldClass} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Deluxe Double Room" minLength={2} maxLength={100} required /></div>
              <div><label htmlFor="roomType" className={labelClass}>Room type</label><select id="roomType" className={fieldClass} value={unitType} onChange={(e) => setUnitType(e.target.value)}><option>Standard room</option><option>Single room</option><option>Double room</option><option>Twin room</option><option>Deluxe room</option><option>Suite</option><option>Family room</option><option>Studio apartment</option><option>One-bedroom apartment</option><option>Two-bedroom apartment</option><option>Villa</option><option>Bed in shared dormitory</option><option>Other</option></select></div>
              <div><label htmlFor="roomDescription" className={labelClass}>Description</label><textarea id="roomDescription" className={fieldClass} rows={3} maxLength={1500} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Describe beds, views, bathroom, included facilities..." /></div>
              <div className="grid gap-5 sm:grid-cols-2">
                <div><label htmlFor="capacity" className={labelClass}>Maximum guests per room *</label><input id="capacity" type="number" className={fieldClass} min="1" max="20" step="1" value={capacity} onChange={(e) => setCapacity(e.target.value)} required /></div>
                <div><label htmlFor="totalUnits" className={labelClass}>Number of rooms *</label><input id="totalUnits" type="number" className={fieldClass} min="1" max="500" step="1" value={totalUnits} onChange={(e) => setTotalUnits(e.target.value)} required /></div>
              </div>
              <div><label htmlFor="baseRate" className={labelClass}>Partner nightly rate ({property?.currency || "KES"}) *</label><input id="baseRate" type="number" className={fieldClass} min="1" max="100000000" step="0.01" value={baseRate} onChange={(e) => setBaseRate(e.target.value)} placeholder="e.g. 6500" required /><p className="mt-2 text-xs text-slate-500">Enter the amount you charge ZuriStay before the platform's guest-facing markup.</p></div>
              <button type="submit" disabled={saving || property?.status !== "approved"} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-blue-900 px-5 py-3 font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50">{saving ? <Loader2 size={18} className="animate-spin" /> : <Plus size={18} />}{saving ? "Saving room category..." : "Save room category"}</button>
              {property?.status !== "approved" && <p className="text-sm text-amber-700">Room setup is available after admin approval.</p>}
            </form>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-200 p-5"><div><h2 className="text-xl font-bold text-slate-900">Room categories</h2><p className="mt-1 text-sm text-slate-500">{units.length} saved</p></div><button onClick={loadRooms} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"><RefreshCw size={15} />Refresh</button></div>
            {units.length === 0 ? <div className="px-6 py-12 text-center"><BedDouble className="mx-auto mb-3 text-slate-400" size={34} /><h3 className="font-semibold text-slate-900">No room categories yet</h3><p className="mt-2 text-sm text-slate-500">Add your first room category using the form.</p></div> : <div className="divide-y divide-slate-100">{units.map((unit) => <article key={unit.id} className="p-5"><div className="flex items-start justify-between gap-3"><div><h3 className="font-bold text-slate-900">{unit.name}</h3><p className="mt-1 text-sm text-slate-500">{unit.unit_type || "Room"} · {unit.total_units} room(s)</p></div><span className={unit.active ? "rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-800" : "rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600"}>{unit.active ? "Active" : "Inactive"}</span></div><div className="mt-3 flex flex-wrap gap-4 text-sm text-slate-600"><span className="inline-flex items-center gap-1"><Users size={15} />Up to {unit.capacity} guests</span><span className="font-semibold text-slate-900">{unit.currency} {Number(unit.base_rate).toLocaleString()} / night</span></div>{unit.description && <p className="mt-3 text-sm leading-6 text-slate-600">{unit.description}</p>}<RoomAvailabilityForm propertyId={propertyId} unit={unit} /></article>)}</div>}
          </section>
        </div>
        <p className="mt-8 text-center text-xs text-slate-400">ZuriStay Partner Portal · Your World. Your Stay.</p>
      </div>
    </main>
  );
}
