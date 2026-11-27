"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type Order = {
  id: string;
  order_reference: string;
  guest_name: string;
  guest_email: string;
  guest_phone: string;
  check_in: string;
  check_out: string;
  guests: number;
  rooms: number;
  currency: string;
  guest_total: number;
  payment_status: string;
  fulfilment_status: string;
  admin_notes: string | null;
  created_at: string;
  independent_accommodations: { name: string; city: string; county: string | null } | null;
};

const statuses = [
  "awaiting_admin", "contacting_property", "property_confirmed", "property_paid",
  "confirmed", "unavailable", "refund_required", "refunded", "cancelled",
];

function formatStatus(value: string) {
  return value.replaceAll("_", " ");
}

export default function IndependentReservationsAdmin() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [notesDrafts, setNotesDrafts] = useState<Record<string, string>>({});

  async function load() {
    try {
      const sb = createSupabaseBrowserClient();
      const { data: { session } } = await sb.auth.getSession();
      if (!session) throw new Error("Please sign in as an administrator.");
      const response = await fetch("/api/admin/independent-booking-orders", {
        headers: { authorization: "Bearer " + session.access_token },
        cache: "no-store",
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Unable to load reservations.");
      setOrders(result.orders || []);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to load reservations.");
    }
  }

  useEffect(() => { void load(); }, []);

  async function update(order: Order, status: string) {
    setBusy(order.id);
    setError("");
    try {
      const sb = createSupabaseBrowserClient();
      const { data: { session } } = await sb.auth.getSession();
      if (!session) throw new Error("Your administrator session has expired. Please sign in again.");

      const notes = notesDrafts[order.id] ?? order.admin_notes ?? "";
      const response = await fetch("/api/admin/independent-booking-orders", {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          authorization: "Bearer " + session.access_token,
        },
        body: JSON.stringify({
          id: order.id,
          fulfilment_status: status,
          admin_notes: notes,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Unable to update reservation.");
      await load();
      setNotesDrafts((current) => {
        const next = { ...current };
        delete next[order.id];
        return next;
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to update reservation.");
    } finally {
      setBusy("");
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 p-5 text-slate-800">
      <div className="mx-auto max-w-6xl">
        <Link href="/admin" className="text-sm font-semibold text-emerald-800">← Admin dashboard</Link>
        <h1 className="mt-4 text-3xl font-bold text-emerald-950">Independent property reservations</h1>
        <p className="mt-2 text-slate-600">Manage guest requests, property confirmation and fulfilment.</p>
        {error && <p className="mt-4 rounded-xl bg-red-50 p-3 text-red-700">{error}</p>}

        <div className="mt-6 space-y-4">
          {orders.map((order) => (
            <article key={order.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap justify-between gap-3">
                <div>
                  <p className="text-xs font-bold text-orange-600">{order.order_reference}</p>
                  <h2 className="mt-1 text-xl font-bold">{order.independent_accommodations?.name || "Independent property"}</h2>
                  <p className="text-sm text-slate-500">
                    {order.independent_accommodations?.city} {order.independent_accommodations?.county || ""}
                  </p>
                </div>
                <p className="font-bold">
                  {Number(order.guest_total) > 0
                    ? `${order.currency} ${Number(order.guest_total).toLocaleString("en-KE")}`
                    : "Rate pending — administrator to quote"}
                </p>
              </div>

              <div className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
                <p><b>Guest:</b> {order.guest_name}</p>
                <p><b>Email:</b> {order.guest_email}</p>
                <p><b>Phone:</b> {order.guest_phone}</p>
                <p><b>Dates:</b> {order.check_in} – {order.check_out}</p>
                <p><b>Guests / rooms:</b> {order.guests} / {order.rooms}</p>
                <p><b>Payment:</b> {order.payment_status}</p>
              </div>

              <label className="mt-4 block text-sm font-semibold">
                Administrator notes
                <textarea
                  value={notesDrafts[order.id] ?? order.admin_notes ?? ""}
                  onChange={(event) => setNotesDrafts((current) => ({ ...current, [order.id]: event.target.value }))}
                  maxLength={3000}
                  rows={2}
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 font-normal"
                  placeholder="Record property contact, quoted rate or follow-up details"
                />
              </label>

              <div className="mt-4 flex flex-wrap items-center gap-3">
                <select
                  value={order.fulfilment_status}
                  onChange={(event) => void update(order, event.target.value)}
                  disabled={busy === order.id}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                >
                  {statuses.map((status) => <option key={status} value={status}>{formatStatus(status)}</option>)}
                </select>
                <a href={`mailto:${order.guest_email}?subject=ZuriStay%20reservation%20${encodeURIComponent(order.order_reference)}`} className="rounded-lg bg-emerald-800 px-4 py-2 text-sm font-semibold text-white">Email guest</a>
                <a href={`tel:${order.guest_phone}`} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold">Call guest</a>
              </div>
            </article>
          ))}
          {orders.length === 0 && !error && (
            <p className="rounded-xl bg-white p-8 text-center text-slate-500">No independent property reservations yet.</p>
          )}
        </div>
      </div>
    </main>
  );
}
