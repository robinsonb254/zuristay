"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, AlertTriangle, CheckCircle2, Clock3, Loader2, RefreshCw, ShieldCheck } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type Dispute = {
  id: string;
  settlement_id: string;
  booking_id: string;
  reason: string;
  check_in_deadline_at: string;
  created_at: string;
  bookings: { booking_reference: string; guest_name: string; guest_email: string | null; guest_phone: string | null; check_in: string };
  property_partners: { business_name: string };
  partner_settlements: { amount_due: number; currency: string; status: string };
};

type Draft = { resolution: "partner_paid" | "guest_refunded"; notes: string; externalReference: string };

function dateTime(value: string) {
  return new Date(value).toLocaleString("en-KE", { dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Nairobi" });
}

function money(amount: number, currency: string) {
  return new Intl.NumberFormat("en-KE", { style: "currency", currency, maximumFractionDigits: 2 }).format(Number(amount || 0));
}

export default function AdminSettlementDisputesPage() {
  const router = useRouter();
  const [token, setToken] = useState("");
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async (accessToken: string) => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/admin/settlement-disputes", {
        headers: { Authorization: `Bearer ${accessToken}` },
        cache: "no-store",
      });
      const result = await response.json();
      if (response.status === 401) {
        router.replace("/login?next=%2Fadmin%2Fdisputes");
        return;
      }
      if (!response.ok || !result.success) throw new Error(result.error || "Unable to load disputes.");
      setDisputes(result.disputes || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to load disputes.");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    let active = true;
    async function start() {
      const supabase = createSupabaseBrowserClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.replace("/login?next=%2Fadmin%2Fdisputes");
        return;
      }
      if (!active) return;
      setToken(session.access_token);
      await load(session.access_token);
    }
    start();
    return () => { active = false; };
  }, [load, router]);

  function updateDraft(id: string, patch: Partial<Draft>) {
    setDrafts(current => ({
      ...current,
      [id]: {
        ...{ resolution: "partner_paid" as const, notes: "", externalReference: "" },
        ...current[id],
        ...patch,
      },
    }));
  }

  async function resolve(event: FormEvent<HTMLFormElement>, dispute: Dispute) {
    event.preventDefault();
    const draft = drafts[dispute.id] || { resolution: "partner_paid", notes: "", externalReference: "" };
    setBusyId(dispute.id);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/admin/settlement-disputes", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          disputeId: dispute.id,
          resolution: draft.resolution,
          notes: draft.notes,
          externalReference: draft.externalReference,
        }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || "Unable to record resolution.");
      setNotice(`Dispute ${dispute.bookings.booking_reference} was recorded as resolved.`);
      await load(token);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to record resolution.");
    } finally {
      setBusyId("");
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-800">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
          <Link href="/" className="text-2xl font-black tracking-tight text-blue-950">ZuriStay<span className="text-orange-500">.</span></Link>
          <Link href="/admin" className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-blue-950"><ArrowLeft size={16}/> Admin dashboard</Link>
        </div>
      </header>
      <div className="mx-auto max-w-6xl px-5 py-9">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-bold uppercase tracking-wider text-orange-600">Finance control</p>
            <h1 className="mt-2 text-3xl font-black text-blue-950">Arrival disputes</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
              Paid bookings with missing arrival confirmations after 24 hours are held here for manual investigation.
              The deadline is 2:00 PM East Africa Time on the scheduled check-in date plus 24 hours.
            </p>
          </div>
          <button onClick={() => load(token)} disabled={loading || !token} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-100 disabled:opacity-50">
            <RefreshCw size={16} className={loading ? "animate-spin" : ""}/> Refresh
          </button>
        </div>

        <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <div className="flex items-start gap-3"><ShieldCheck size={20} className="mt-0.5 shrink-0"/><p><strong>Funds remain held by ZuriStay.</strong> This dashboard records an external manual payment or refund after the investigation. It does not move money or initiate a transfer.</p></div>
        </div>

        {error && <div role="alert" className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</div>}
        {notice && <div role="status" className="mt-5 flex items-center gap-2 rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-800"><CheckCircle2 size={18}/>{notice}</div>}

        {loading ? (
          <div className="flex items-center justify-center py-24 text-blue-900"><Loader2 className="animate-spin" size={28}/></div>
        ) : disputes.length === 0 ? (
          <div className="mt-8 rounded-2xl border border-slate-200 bg-white px-6 py-16 text-center">
            <CheckCircle2 className="mx-auto text-green-600" size={36}/>
            <h2 className="mt-4 text-xl font-black text-blue-950">No arrival disputes</h2>
            <p className="mt-2 text-sm text-slate-500">There are no overdue paid bookings awaiting manual review.</p>
          </div>
        ) : (
          <div className="mt-8 space-y-5">
            {disputes.map(dispute => {
              const draft = drafts[dispute.id] || { resolution: "partner_paid" as const, notes: "", externalReference: "" };
              return (
                <article key={dispute.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wider text-orange-600">Booking {dispute.bookings.booking_reference}</p>
                      <h2 className="mt-1 text-xl font-black text-blue-950">{dispute.bookings.guest_name}</h2>
                      <p className="mt-1 text-sm text-slate-600">{dispute.property_partners.business_name}</p>
                    </div>
                    <span className="inline-flex items-center gap-2 rounded-full bg-amber-100 px-3 py-1.5 text-xs font-bold text-amber-800"><AlertTriangle size={14}/> Funds held for review</span>
                  </div>

                  <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <div className="rounded-xl bg-slate-50 p-3"><p className="text-xs text-slate-500">Partner settlement</p><p className="mt-1 font-black text-blue-950">{money(dispute.partner_settlements.amount_due, dispute.partner_settlements.currency)}</p></div>
                    <div className="rounded-xl bg-slate-50 p-3"><p className="text-xs text-slate-500">Scheduled check-in</p><p className="mt-1 text-sm font-bold text-slate-800">{dispute.bookings.check_in}</p></div>
                    <div className="rounded-xl bg-slate-50 p-3"><p className="text-xs text-slate-500">24-hour deadline</p><p className="mt-1 flex items-center gap-1 text-sm font-bold text-slate-800"><Clock3 size={14}/>{dateTime(dispute.check_in_deadline_at)}</p></div>
                    <div className="rounded-xl bg-slate-50 p-3"><p className="text-xs text-slate-500">Guest contact</p><p className="mt-1 break-all text-sm font-bold text-slate-800">{dispute.bookings.guest_phone || dispute.bookings.guest_email || "Not provided"}</p></div>
                  </div>

                  <form onSubmit={event => resolve(event, dispute)} className="mt-6 border-t border-slate-100 pt-5">
                    <h3 className="font-bold text-blue-950">Record manual investigation outcome</h3>
                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      <label className="text-sm font-semibold text-slate-700">Decision
                        <select value={draft.resolution} onChange={e => updateDraft(dispute.id, { resolution: e.target.value as Draft["resolution"] })} className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-slate-900">
                          <option value="partner_paid">Partner was paid after agreement</option>
                          <option value="guest_refunded">Guest was refunded after agreement</option>
                        </select>
                      </label>
                      <label className="text-sm font-semibold text-slate-700">External payment / refund reference
                        <input value={draft.externalReference} onChange={e => updateDraft(dispute.id, { externalReference: e.target.value })} required minLength={3} maxLength={160} className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-slate-900" placeholder="Bank, M-Pesa or refund reference"/>
                      </label>
                    </div>
                    <label className="mt-3 block text-sm font-semibold text-slate-700">Investigation notes
                      <textarea value={draft.notes} onChange={e => updateDraft(dispute.id, { notes: e.target.value })} required minLength={10} maxLength={4000} rows={3} className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-slate-900" placeholder="Record the agreement, evidence reviewed and reason for the decision."/>
                    </label>
                    <p className="mt-2 text-xs leading-5 text-slate-500">Only submit after the agreed external payment or refund has actually been completed. ZuriStay records the reference and closes the held settlement; it does not send funds from this screen.</p>
                    <button type="submit" disabled={busyId === dispute.id} className="mt-4 inline-flex items-center gap-2 rounded-xl bg-blue-950 px-5 py-3 text-sm font-bold text-white hover:bg-blue-900 disabled:opacity-50">
                      {busyId === dispute.id ? <Loader2 size={16} className="animate-spin"/> : <CheckCircle2 size={16}/>} Record completed resolution
                    </button>
                  </form>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
