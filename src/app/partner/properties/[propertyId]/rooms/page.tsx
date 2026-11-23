"use client";

import { useCallback, useEffect, useState, FormEvent } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, BedDouble, CheckCircle2, Circle, Loader2, Plus, RefreshCw, Users } from "lucide-react";
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
  const [availability, setAvailability] = useState<{ id: string; stay_date: string; available_units: number; partner_base_rate: number; currency: string }[]>([]);
  const [calendarLoading, setCalendarLoading] = useState(true);

  const loadCalendar = useCallback(async () => {
    setCalendarLoading(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const response = await fetch(
        "/api/partner/properties/" + propertyId + "/units/" + unit.id + "/availability",
        { headers: { Authorization: "Bearer " + session.access_token }, cache: "no-store" }
      );
      const result = await response.json();
      if (response.ok && result.success) setAvailability(result.availability || []);
    } catch (err) {
      console.error("Unable to refresh room availability:", err);
    } finally {
      setCalendarLoading(false);
    }
  }, [propertyId, unit.id]);

  useEffect(() => { loadCalendar(); }, [loadCalendar]);

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
      await loadCalendar();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save availability.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
    <form onSubmit={saveAvailability}>
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
          <input type="number" min="0.01" max="100000000" step="0.01" required value={partnerBaseRate} onChange={(event) => setPartnerBaseRate(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-normal text-slate-900" />
        </label>
      </div>
      {error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
      {message && <p role="status" className="mt-3 text-sm text-green-700">{message}</p>}
      <button type="submit" disabled={saving} className="mt-4 inline-flex items-center justify-center gap-2 rounded-lg bg-blue-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-50">
        {saving ? <Loader2 size={16} className="animate-spin" /> : null}
        {saving ? "Saving dates..." : "Save availability"}
      </button>
    </form>
      <div className="mt-5 border-t border-slate-200 pt-4">
        <h5 className="text-sm font-semibold text-slate-800">Upcoming availability · next 30 days</h5>
        {calendarLoading ? <p className="mt-2 text-xs text-slate-500">Loading dates...</p> :
          availability.length === 0 ? <p className="mt-2 text-xs text-slate-500">No date-specific settings yet. Add a date range above to set room inventory and rates.</p> :
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[420px] text-left text-xs">
              <thead><tr className="border-b border-slate-200 text-slate-500"><th className="py-2 pr-3">Date</th><th className="py-2 pr-3">Available rooms</th><th className="py-2">Partner rate</th></tr></thead>
              <tbody>{availability.map((day) => (
                <tr key={day.id} className="border-b border-slate-100">
                  <td className="py-2 pr-3 text-slate-700">{new Date(day.stay_date + "T00:00:00").toLocaleDateString()}</td>
                  <td className="py-2 pr-3"><span className={day.available_units === 0 ? "font-semibold text-red-700" : "text-slate-700"}>{day.available_units} / {unit.total_units}</span></td>
                  <td className="py-2 text-slate-700">{day.currency} {Number(day.partner_base_rate).toLocaleString()}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        }
      </div>
    </div>
  );
}



type Amenity = { id: string; name: string; category: string | null };

function PropertyFacilities({ propertyId }: { propertyId: string }) {
  const [amenities, setAmenities] = useState<Amenity[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const endpoint = "/api/partner/properties/" + propertyId + "/amenities";

  const loadFacilities = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const supabase = createSupabaseBrowserClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Please sign in again to manage facilities.");
      const response = await fetch(endpoint, {
        headers: { Authorization: "Bearer " + session.access_token },
        cache: "no-store",
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || "Unable to load facilities.");
      setAmenities(result.amenities || []);
      setSelected(result.selectedIds || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load facilities.");
    } finally {
      setLoading(false);
    }
  }, [endpoint]);

  useEffect(() => { loadFacilities(); }, [loadFacilities]);

  function toggleAmenity(id: string) {
    setSelected((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  }

  async function saveFacilities() {
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const supabase = createSupabaseBrowserClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Please sign in again to save facilities.");
      const response = await fetch(endpoint, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + session.access_token,
        },
        body: JSON.stringify({ amenityIds: selected }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || "Unable to save facilities.");
      setMessage(result.message || "Facilities saved.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save facilities.");
    } finally {
      setSaving(false);
    }
  }

  const groups = amenities.reduce<Record<string, Amenity[]>>((result, amenity) => {
    const category = amenity.category || "Other";
    if (!result[category]) result[category] = [];
    result[category].push(amenity);
    return result;
  }, {});

  return (
    <section id="property-amenities" className="mt-8 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
      <div className="mb-5">
        <h2 className="text-xl font-bold text-slate-900">Property facilities and amenities</h2>
        <p className="mt-1 text-sm text-slate-500">Select the facilities guests can expect at your property.</p>
      </div>
      {loading ? <p className="py-6 text-sm text-slate-500">Loading facilities...</p> :
        amenities.length === 0 ? <p className="rounded-xl bg-amber-50 p-4 text-sm text-amber-800">The facilities catalogue is being prepared. Please check back shortly.</p> :
        <div className="space-y-5">
          {Object.entries(groups).map(([category, items]) => (
            <div key={category}>
              <h3 className="mb-3 text-sm font-semibold capitalize text-slate-800">{category.replaceAll("_", " ")}</h3>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {items.map((amenity) => (
                  <label key={amenity.id} className="flex cursor-pointer items-center gap-3 rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-700 hover:bg-slate-50">
                    <input type="checkbox" checked={selected.includes(amenity.id)} onChange={() => toggleAmenity(amenity.id)} className="h-4 w-4 rounded border-slate-300 text-blue-900 focus:ring-blue-700" />
                    {amenity.name}
                  </label>
                ))}
              </div>
            </div>
          ))}
          <div className="flex flex-wrap items-center gap-3 border-t border-slate-100 pt-4">
            <button type="button" onClick={saveFacilities} disabled={saving}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-50">
              {saving ? <Loader2 size={16} className="animate-spin" /> : null}
              {saving ? "Saving facilities..." : "Save facilities"}
            </button>
            <span className="text-xs text-slate-500">{selected.length} selected</span>
          </div>
        </div>
      }
      {error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
      {message && <p role="status" className="mt-3 text-sm text-green-700">{message}</p>}
    </section>
  );
}

type PropertyImage = {
  id: string;
  image_url: string;
  caption: string | null;
  is_cover: boolean;
  display_order: number;
};

function PropertyPhotos({ propertyId }: { propertyId: string }) {
  const [images, setImages] = useState<PropertyImage[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [caption, setCaption] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const endpoint = "/api/partner/properties/" + propertyId + "/images";

  const loadImages = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const supabase = createSupabaseBrowserClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Please sign in again to manage property photos.");
      const response = await fetch(endpoint, {
        headers: { Authorization: "Bearer " + session.access_token },
        cache: "no-store",
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || "Unable to load photos.");
      setImages(result.images || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load photos.");
    } finally {
      setLoading(false);
    }
  }, [endpoint]);

  useEffect(() => { loadImages(); }, [loadImages]);

  async function uploadPhoto(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file) return;
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const supabase = createSupabaseBrowserClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Please sign in again to upload photos.");
      const form = new FormData();
      form.append("image", file);
      form.append("caption", caption);
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { Authorization: "Bearer " + session.access_token },
        body: form,
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || "Photo upload failed.");
      setMessage(result.message || "Photo uploaded.");
      setFile(null);
      setCaption("");
      const input = document.getElementById("propertyPhotoFile") as HTMLInputElement | null;
      if (input) input.value = "";
      await loadImages();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Photo upload failed.");
    } finally {
      setSaving(false);
    }
  }

  async function removePhoto(imageId: string) {
    if (!window.confirm("Remove this property photo?")) return;
    setError("");
    setMessage("");
    try {
      const supabase = createSupabaseBrowserClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Please sign in again to manage photos.");
      const response = await fetch(endpoint, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + session.access_token,
        },
        body: JSON.stringify({ imageId }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || "Unable to remove photo.");
      setMessage(result.message || "Photo removed.");
      await loadImages();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to remove photo.");
    }
  }

  return (
    <section id="property-photos" className="mt-8 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
      <div className="mb-5">
        <h2 className="text-xl font-bold text-slate-900">Property photographs</h2>
        <p className="mt-1 text-sm text-slate-500">Upload up to 30 clear JPG, PNG or WebP photos. Maximum 8 MB each. Your first photo becomes the cover image.</p>
      </div>
      <form onSubmit={uploadPhoto} className="grid gap-4 rounded-xl bg-slate-50 p-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <label className="text-xs font-semibold text-slate-600">
          Choose photo
          <input id="propertyPhotoFile" type="file" accept="image/jpeg,image/png,image/webp" required
            onChange={(event) => setFile(event.target.files?.[0] || null)}
            className="mt-1 block w-full text-sm font-normal text-slate-700 file:mr-3 file:rounded-lg file:border-0 file:bg-blue-100 file:px-3 file:py-2 file:font-semibold file:text-blue-900" />
        </label>
        <label className="text-xs font-semibold text-slate-600">
          Caption (optional)
          <input value={caption} maxLength={160} onChange={(event) => setCaption(event.target.value)}
            placeholder="e.g. Ocean-view balcony" className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-normal text-slate-900" />
        </label>
        <button type="submit" disabled={!file || saving || images.length >= 30}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-50">
          {saving ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
          {saving ? "Uploading..." : "Upload photo"}
        </button>
      </form>
      {error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
      {message && <p role="status" className="mt-3 text-sm text-green-700">{message}</p>}
      {loading ? <p className="py-8 text-center text-sm text-slate-500">Loading property photos...</p> :
        images.length === 0 ? <p className="py-8 text-center text-sm text-slate-500">No property photos uploaded yet.</p> :
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {images.map((image) => (
            <article key={image.id} className="overflow-hidden rounded-xl border border-slate-200">
              <div className="relative aspect-[4/3] bg-slate-100">
                <img src={image.image_url} alt={image.caption || "Property photograph"} className="h-full w-full object-cover" />
                {image.is_cover && <span className="absolute left-2 top-2 rounded-full bg-blue-950 px-2 py-1 text-[10px] font-bold text-white">COVER</span>}
              </div>
              <div className="p-3">
                <p className="truncate text-xs text-slate-600">{image.caption || "Property photo"}</p>
                <button type="button" onClick={() => removePhoto(image.id)} className="mt-2 text-xs font-semibold text-red-700 hover:text-red-900">Remove photo</button>
              </div>
            </article>
          ))}
        </div>
      }
    </section>
  );
}


function RoomCategoryEditor({ propertyId, unit, onSaved }: { propertyId: string; unit: Unit; onSaved: () => void }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(unit.name);
  const [unitType, setUnitType] = useState(unit.unit_type || "");
  const [description, setDescription] = useState(unit.description || "");
  const [capacity, setCapacity] = useState(String(unit.capacity));
  const [baseRate, setBaseRate] = useState(String(unit.base_rate));
  const [active, setActive] = useState(unit.active);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true); setError(""); setMessage("");
    try {
      const supabase = createSupabaseBrowserClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Please sign in again.");
      const response = await fetch("/api/partner/properties/" + propertyId + "/units/" + unit.id, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + session.access_token },
        body: JSON.stringify({ name, unitType, description, capacity: Number(capacity), baseRate: Number(baseRate), active }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || "Unable to update room category.");
      setMessage(result.message || "Room category updated.");
      setEditing(false);
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update room category.");
    } finally { setSaving(false); }
  }

  return (
    <div className="mt-3">
      {!editing ? <button type="button" onClick={() => { setName(unit.name); setUnitType(unit.unit_type || ""); setDescription(unit.description || ""); setCapacity(String(unit.capacity)); setBaseRate(String(unit.base_rate)); setActive(unit.active); setEditing(true); setError(""); setMessage(""); }} className="text-xs font-semibold text-blue-800 underline underline-offset-2">Edit room details and base rate</button> :
        <form onSubmit={save} className="mt-3 space-y-3 rounded-xl border border-blue-100 bg-blue-50 p-4">
          <h4 className="text-sm font-bold text-slate-900">Edit room category</h4>
          <label className="block text-xs font-semibold text-slate-700">Category name
            <input required minLength={2} maxLength={100} value={name} onChange={(e) => setName(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-normal text-slate-900" />
          </label>
          <label className="block text-xs font-semibold text-slate-700">Room type
            <input maxLength={80} value={unitType} onChange={(e) => setUnitType(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-normal text-slate-900" />
          </label>
          <label className="block text-xs font-semibold text-slate-700">Description
            <textarea rows={2} maxLength={1500} value={description} onChange={(e) => setDescription(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-normal text-slate-900" />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-xs font-semibold text-slate-700">Maximum guests
              <input type="number" min="1" max="20" step="1" required value={capacity} onChange={(e) => setCapacity(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-normal text-slate-900" />
            </label>
            <label className="block text-xs font-semibold text-slate-700">Default partner rate ({unit.currency})
              <input type="number" min="0.01" max="100000000" step="0.01" required value={baseRate} onChange={(e) => setBaseRate(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-normal text-slate-900" />
            </label>
          </div>
          <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 py-3 text-sm font-semibold text-slate-700"><input type="checkbox" checked={active} onChange={(event) => setActive(event.target.checked)} className="h-4 w-4 rounded border-slate-300 text-blue-900 focus:ring-blue-700" />Room category active and eligible for bookings</label>
          <p className="text-xs text-slate-500">Changing the default rate does not overwrite date-specific availability rates already saved. Activating a room does not publish the property.</p>
          {error && <p role="alert" className="text-xs text-red-700">{error}</p>}
          <div className="flex flex-wrap gap-2">
            <button type="submit" disabled={saving} className="rounded-lg bg-blue-900 px-4 py-2 text-xs font-semibold text-white disabled:opacity-50">{saving ? "Saving..." : "Save room changes"}</button>
            <button type="button" onClick={() => { setEditing(false); setError(""); }} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700">Cancel</button>
          </div>
        </form>}
      {message && <p role="status" className="mt-2 text-xs text-green-700">{message}</p>}
    </div>
  );
}


function PropertyReadiness({ propertyId, status, onPublished }: { propertyId: string; status: string; onPublished: () => void }) {
  const [checks, setChecks] = useState<{ key: string; label: string; complete: boolean }[]>([]);
  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const ready = status === "approved" && checks.length > 0 && checks.every((check) => check.complete);
  const setupActions: Record<string, { href: string; label: string }> = {
    property_details: { href: "/partner/properties/" + propertyId + "/edit", label: "Edit details" },
    rooms: { href: "#room-categories", label: "Add rooms" },
    photos: { href: "#property-photos", label: "Upload photos" },
    amenities: { href: "#property-amenities", label: "Choose facilities" },
    availability: { href: "#room-categories", label: "Set dates and rates" },
  };

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const supabase = createSupabaseBrowserClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const response = await fetch("/api/partner/properties/" + propertyId + "/readiness", {
        headers: { Authorization: "Bearer " + session.access_token }, cache: "no-store",
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || "Unable to check setup progress.");
      setChecks(result.checks || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to check setup progress.");
    } finally { setLoading(false); }
  }, [propertyId]);

  useEffect(() => { load(); }, [load]);

  async function publish() {
    setPublishing(true); setError(""); setMessage("");
    try {
      const supabase = createSupabaseBrowserClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Please sign in again.");
      const response = await fetch("/api/partner/properties/" + propertyId + "/readiness", {
        method: "POST", headers: { Authorization: "Bearer " + session.access_token },
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        if (result.checks) setChecks(result.checks);
        throw new Error(result.error || "Unable to publish property.");
      }
      setMessage(result.message || "Property published.");
      await load();
      onPublished();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to publish property.");
    } finally { setPublishing(false); }
  }

  return (
    <section className="mb-7 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div><h2 className="text-lg font-bold text-slate-900">Listing readiness</h2><p className="mt-1 text-sm text-slate-500">Complete these steps before your approved property can go live.</p></div>
        <button type="button" onClick={load} disabled={loading} className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 disabled:opacity-50">{loading ? "Checking..." : "Refresh checklist"}</button>
      </div>
      {status !== "approved" && <p className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">Your property must first be approved by the ZuriStay admin team.</p>}
      {loading ? <p className="mt-4 text-sm text-slate-500">Checking your listing setup...</p> :
        <ul className="mt-4 space-y-3">{checks.map((check) => <li key={check.key} className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">{check.complete ? <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-green-700" /> : <Circle size={18} className="mt-0.5 shrink-0 text-slate-400" />}<span className={check.complete ? "text-slate-700" : "text-slate-600"}>{check.label}</span>{!check.complete && setupActions[check.key] && <Link href={setupActions[check.key].href} className="ml-1 text-xs font-semibold text-blue-800 underline underline-offset-2 hover:text-blue-950">{setupActions[check.key].label}</Link>}</li>)}</ul>}
      {error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
      {message && <p role="status" className="mt-3 text-sm text-green-700">{message}</p>}
      {status === "approved" && <button type="button" onClick={publish} disabled={!ready || publishing || loading} className="mt-5 inline-flex items-center justify-center gap-2 rounded-xl bg-blue-900 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50">{publishing ? <Loader2 size={17} className="animate-spin" /> : <CheckCircle2 size={17} />}{publishing ? "Publishing..." : "Publish my property"}</button>}
      {status === "approved" && !ready && !loading && <p className="mt-2 text-xs text-slate-500">Finish all outstanding checklist items to enable publishing.</p>}
    </section>
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
        {property && <PropertyReadiness propertyId={propertyId} status={property.status} onPublished={loadRooms} />}

        <div className="grid gap-7 lg:grid-cols-[1.1fr_0.9fr]">
          <section id="room-categories" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
            <div className="mb-5 flex items-center gap-3"><div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-900"><Plus size={22} /></div><div><h2 className="text-xl font-bold text-slate-900">Add a room category</h2><p className="text-sm text-slate-500">For example, Deluxe Double or Family Villa.</p></div></div>
            <form onSubmit={handleSubmit} className="space-y-5">
              <div><label htmlFor="roomName" className={labelClass}>Room category name *</label><input id="roomName" className={fieldClass} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Deluxe Double Room" minLength={2} maxLength={100} required /></div>
              <div><label htmlFor="roomType" className={labelClass}>Room type</label><select id="roomType" className={fieldClass} value={unitType} onChange={(e) => setUnitType(e.target.value)}><option>Standard room</option><option>Single room</option><option>Double room</option><option>Twin room</option><option>Deluxe room</option><option>Suite</option><option>Family room</option><option>Studio apartment</option><option>One-bedroom apartment</option><option>Two-bedroom apartment</option><option>Villa</option><option>Bed in shared dormitory</option><option>Other</option></select></div>
              <div><label htmlFor="roomDescription" className={labelClass}>Description</label><textarea id="roomDescription" className={fieldClass} rows={3} maxLength={1500} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Describe beds, views, bathroom, included facilities..." /></div>
              <div className="grid gap-5 sm:grid-cols-2">
                <div><label htmlFor="capacity" className={labelClass}>Maximum guests per room *</label><input id="capacity" type="number" className={fieldClass} min="1" max="20" step="1" value={capacity} onChange={(e) => setCapacity(e.target.value)} required /></div>
                <div><label htmlFor="totalUnits" className={labelClass}>Number of rooms *</label><input id="totalUnits" type="number" className={fieldClass} min="1" max="500" step="1" value={totalUnits} onChange={(e) => setTotalUnits(e.target.value)} required /></div>
              </div>
              <div><label htmlFor="baseRate" className={labelClass}>Partner nightly rate ({property?.currency || "KES"}) *</label><input id="baseRate" type="number" className={fieldClass} min="1" max="100000000" step="0.01" value={baseRate} onChange={(e) => setBaseRate(e.target.value)} placeholder="e.g. 6500" required /><p className="mt-2 text-xs text-slate-500">Enter the amount you charge ZuriStay before the platform&apos;s guest-facing markup.</p></div>
              <button type="submit" disabled={saving || property?.status !== "approved"} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-blue-900 px-5 py-3 font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50">{saving ? <Loader2 size={18} className="animate-spin" /> : <Plus size={18} />}{saving ? "Saving room category..." : "Save room category"}</button>
              {property?.status !== "approved" && <p className="text-sm text-amber-700">Room setup is available after admin approval.</p>}
            </form>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-200 p-5"><div><h2 className="text-xl font-bold text-slate-900">Room categories</h2><p className="mt-1 text-sm text-slate-500">{units.length} saved</p></div><button onClick={loadRooms} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"><RefreshCw size={15} />Refresh</button></div>
            {units.length === 0 ? <div className="px-6 py-12 text-center"><BedDouble className="mx-auto mb-3 text-slate-400" size={34} /><h3 className="font-semibold text-slate-900">No room categories yet</h3><p className="mt-2 text-sm text-slate-500">Add your first room category using the form.</p></div> : <div className="divide-y divide-slate-100">{units.map((unit) => <article key={unit.id} className="p-5"><div className="flex items-start justify-between gap-3"><div><h3 className="font-bold text-slate-900">{unit.name}</h3><p className="mt-1 text-sm text-slate-500">{unit.unit_type || "Room"} · {unit.total_units} room(s)</p></div><span className={unit.active ? "rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-800" : "rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600"}>{unit.active ? "Active" : "Inactive"}</span></div><div className="mt-3 flex flex-wrap gap-4 text-sm text-slate-600"><span className="inline-flex items-center gap-1"><Users size={15} />Up to {unit.capacity} guests</span><span className="font-semibold text-slate-900">{unit.currency} {Number(unit.base_rate).toLocaleString()} / night</span></div>{unit.description && <p className="mt-3 text-sm leading-6 text-slate-600">{unit.description}</p>}<RoomCategoryEditor propertyId={propertyId} unit={unit} onSaved={loadRooms} /><RoomAvailabilityForm propertyId={propertyId} unit={unit} /></article>)}</div>}
          </section>
        </div>
        {property?.status === "approved" && <><PropertyFacilities propertyId={propertyId} /><PropertyPhotos propertyId={propertyId} /></>}\n        <p className="mt-8 text-center text-xs text-slate-400">ZuriStay Partner Portal · Your World. Your Stay.</p>
      </div>
    </main>
  );
}
