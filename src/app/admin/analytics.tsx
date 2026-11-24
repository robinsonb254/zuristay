"use client";

import { useEffect, useMemo, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { BarChart3, BedDouble, CreditCard, Globe2, TrendingUp, Wallet } from "lucide-react";

type Payment = { id: string; amount: number; currency: string; status: string; payment_method: string; created_at: string };
type Commission = { amount: number; currency: string; status: string; created_at: string };
type Unit = { total_units: number | null; active: boolean; property_id: string };
type Property = { id: string; city: string | null; county: string | null; country: string | null; status: string; is_active: boolean };
type Booking = { id: string; created_at: string; booking_status: string; payment_status: string };
type BookingItem = { booking_id: string; property_id: string; quantity: number | null };

const money = (value: number, currency: string) => `${currency} ${value.toLocaleString("en-KE", { maximumFractionDigits: 2 })}`;
const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const sumByCurrency = (rows: { amount: number; currency: string }[]) => {
  const totals = new Map<string, number>();
  rows.forEach((r) => totals.set(r.currency || "KES", (totals.get(r.currency || "KES") || 0) + Number(r.amount || 0)));
  return Array.from(totals.entries()).map(([currency, amount]) => ({ currency, amount }));
};

export default function AdminAnalytics() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [payments, setPayments] = useState<Payment[]>([]);
  const [commissions, setCommissions] = useState<Commission[]>([]);
  const [roomCount, setRoomCount] = useState(0);
  const [regions, setRegions] = useState<{ name: string; bookings: number; rooms: number }[]>([]);
  const [bookingCount, setBookingCount] = useState(0);
  const [pendingPayments, setPendingPayments] = useState(0);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const supabase = createSupabaseBrowserClient();
      const since = new Date();
      since.setDate(since.getDate() - 31);
      const [paymentResult, commissionResult, unitResult, propertyResult, bookingResult, itemResult, pendingResult] = await Promise.all([
        supabase.from("payments").select("id, amount, currency, status, payment_method, created_at").gte("created_at", since.toISOString()).order("created_at", { ascending: false }),
        supabase.from("platform_commissions").select("amount, currency, status, created_at").gte("created_at", since.toISOString()),
        supabase.from("property_units").select("total_units, active, property_id").eq("active", true),
        supabase.from("properties").select("id, city, county, country, status, is_active"),
        supabase.from("bookings").select("id, created_at, booking_status, payment_status").gte("created_at", since.toISOString()),
        supabase.from("booking_items").select("booking_id, property_id, quantity"),
        supabase.from("payments").select("id", { count: "exact", head: true }).in("status", ["pending", "processing", "initiated"]),
      ]);
      const firstError = [paymentResult, commissionResult, unitResult, propertyResult, bookingResult, itemResult, pendingResult].find((r) => r.error);
      if (firstError?.error) throw firstError.error;

      const props = (propertyResult.data || []) as Property[];
      const livePropertyIds = new Set(props.filter((p) => p.status === "approved" && p.is_active).map((p) => p.id));
      const units = (unitResult.data || []) as Unit[];
      setRoomCount(units.filter((u) => livePropertyIds.has(u.property_id)).reduce((n, u) => n + Math.max(0, Number(u.total_units || 0)), 0));

      const paymentRows = (paymentResult.data || []) as Payment[];
      const commissionRows = (commissionResult.data || []) as Commission[];
      setPayments(paymentRows.filter((p) => ["paid", "completed", "succeeded", "verified", "captured"].includes((p.status || "").toLowerCase())));
      setCommissions(commissionRows.filter((c) => ["earned", "transferred"].includes((c.status || "").toLowerCase())));
      setPendingPayments(pendingResult.count || 0);

      const bookingRows = (bookingResult.data || []) as Booking[];
      const items = (itemResult.data || []) as BookingItem[];
      setBookingCount(bookingRows.length);
      const validBookingIds = new Set(bookingRows.filter((b) => ["confirmed", "completed", "checked_in"].includes((b.booking_status || "").toLowerCase())).map((b) => b.id));
      const grouped = new Map<string, { bookings: Set<string>; rooms: number }>();
      items.filter((i) => validBookingIds.has(i.booking_id)).forEach((item) => {
        const p = props.find((x) => x.id === item.property_id);
        if (!p) return;
        const key = [p.city, p.county, p.country].filter(Boolean).join(", ") || "Location not specified";
        const entry = grouped.get(key) || { bookings: new Set<string>(), rooms: 0 };
        entry.bookings.add(item.booking_id);
        entry.rooms += Number(item.quantity || 0);
        grouped.set(key, entry);
      });
      setRegions(Array.from(grouped.entries()).map(([name, v]) => ({ name, bookings: v.bookings.size, rooms: v.rooms })).sort((a, b) => b.bookings - a.bookings).slice(0, 8));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Analytics could not be loaded.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const now = new Date();
  const today = startOfDay(now);
  const weekStart = new Date(today); weekStart.setDate(today.getDate() - 6);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const dailyPayments = useMemo(() => payments.filter((p) => new Date(p.created_at) >= today), [payments, today.toDateString()]);
  const weeklyPayments = payments.filter((p) => new Date(p.created_at) >= weekStart);
  const monthlyPayments = payments.filter((p) => new Date(p.created_at) >= monthStart);
  const dailyEarnings = commissions.filter((c) => new Date(c.created_at) >= today);
  const weeklyEarnings = commissions.filter((c) => new Date(c.created_at) >= weekStart);
  const monthlyEarnings = commissions.filter((c) => new Date(c.created_at) >= monthStart);
  const dailyTotals = sumByCurrency(dailyPayments);
  const dailyCommissionTotals = sumByCurrency(dailyEarnings);
  const weeklyTotals = sumByCurrency(weeklyPayments);
  const weeklyCommissionTotals = sumByCurrency(weeklyEarnings);
  const monthlyTotals = sumByCurrency(monthlyPayments);
  const monthlyCommissionTotals = sumByCurrency(monthlyEarnings);
  const renderTotals = (items: { currency: string; amount: number }[]) => items.length ? items.map((x) => money(x.amount, x.currency)).join(" · ") : "—";

  return (
    <section className="mt-8 space-y-6" id="business-analytics">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><p className="text-sm font-semibold text-orange-600">BUSINESS INTELLIGENCE</p><h2 className="mt-1 text-2xl font-black text-blue-950">Performance & financial reports</h2><p className="mt-1 text-sm text-slate-500">Live figures from recorded bookings, payments, approved room inventory and platform commissions.</p></div>
        <button onClick={load} disabled={loading} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 disabled:opacity-50">{loading ? "Updating…" : "Refresh reports"}</button>
      </div>
      {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">Analytics issue: {error}</p>}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric icon={<BedDouble size={20}/>} label="Approved rooms" value={loading ? "…" : roomCount.toLocaleString("en-KE")} note="Active room inventory in published properties"/>
        <Metric icon={<CreditCard size={20}/>} label="Payments today" value={loading ? "…" : renderTotals(dailyTotals)} note={`${dailyPayments.length} verified payment(s) today`}/>
        <Metric icon={<Wallet size={20}/>} label="Admin earnings today" value={loading ? "…" : renderTotals(dailyCommissionTotals)} note="Recorded platform commission, not gross booking value"/>
        <Metric icon={<Globe2 size={20}/>} label="Pending payments" value={loading ? "…" : pendingPayments.toLocaleString("en-KE")} note="Payments awaiting confirmation"/>
      </div>
      <div className="grid gap-5 xl:grid-cols-[1.25fr_1fr]">
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-4"><BarChart3 className="text-orange-500" size={20}/><h3 className="font-black text-blue-950">Weekly & monthly report</h3></div>
          <div className="overflow-x-auto"><table className="w-full min-w-[540px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-5 py-3">Period</th><th className="px-5 py-3">Verified payments</th><th className="px-5 py-3">Admin earnings</th><th className="px-5 py-3">Payment count</th></tr></thead><tbody className="divide-y divide-slate-100">
            <tr><td className="px-5 py-4 font-bold text-blue-950">Today</td><td className="px-5 py-4">{renderTotals(dailyTotals)}</td><td className="px-5 py-4 font-semibold text-green-700">{renderTotals(dailyCommissionTotals)}</td><td className="px-5 py-4">{dailyPayments.length}</td></tr>
            <tr><td className="px-5 py-4 font-bold text-blue-950">Last 7 days</td><td className="px-5 py-4">{renderTotals(weeklyTotals)}</td><td className="px-5 py-4 font-semibold text-green-700">{renderTotals(weeklyCommissionTotals)}</td><td className="px-5 py-4">{weeklyPayments.length}</td></tr>
            <tr><td className="px-5 py-4 font-bold text-blue-950">This month</td><td className="px-5 py-4">{renderTotals(monthlyTotals)}</td><td className="px-5 py-4 font-semibold text-green-700">{renderTotals(monthlyCommissionTotals)}</td><td className="px-5 py-4">{monthlyPayments.length}</td></tr>
          </tbody></table></div>
          <p className="px-5 py-3 text-xs text-slate-400">Reports use payment verification records and platform commission entries. Amounts remain separated by currency.</p>
        </div>
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-4"><TrendingUp className="text-orange-500" size={20}/><h3 className="font-black text-blue-950">Most active regions</h3></div>
          {regions.length ? <div className="divide-y divide-slate-100">{regions.map((r) => <div key={r.name} className="flex items-center justify-between gap-3 px-5 py-3"><div><p className="font-semibold text-blue-950">{r.name}</p><p className="text-xs text-slate-500">{r.rooms} room(s) booked</p></div><span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-800">{r.bookings} bookings</span></div>)}</div> : <p className="p-6 text-sm text-slate-500">{loading ? "Loading regional activity…" : "Regional activity will appear when confirmed bookings are recorded."}</p>}
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <Mini label="Bookings created · last 31 days" value={bookingCount.toLocaleString("en-KE")}/>
        <Mini label="Verified payments · last 31 days" value={payments.length.toLocaleString("en-KE")}/>
        <Mini label="Platform commission · last 31 days" value={renderTotals(sumByCurrency(commissions))}/>
      </div>
      <p className="text-xs text-slate-400">Admin earnings reflect recorded platform_commissions only. They are not estimated from gross payments. Region rankings use confirmed/completed reservations in the last 31 days.</p>
    </section>
  );
}

function Metric({ icon, label, value, note }: { icon: React.ReactNode; label: string; value: string; note: string }) {
  return <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center justify-between gap-3"><p className="text-sm font-semibold text-slate-500">{label}</p><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-50 text-orange-600">{icon}</span></div><p className="mt-4 break-words text-2xl font-black text-blue-950">{value}</p><p className="mt-2 text-xs text-slate-500">{note}</p></div>;
}
function Mini({ label, value }: { label: string; value: string }) {
  return <div className="rounded-2xl border border-slate-200 bg-white p-5"><p className="text-xs font-semibold text-slate-500">{label}</p><p className="mt-2 break-words text-xl font-black text-blue-950">{value}</p></div>;
}
