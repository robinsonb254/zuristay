"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, CheckCircle2, Loader2, RefreshCw, ShieldCheck } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type Refund = { id: string; payment_method: "mpesa" | "paypal"; amount: number; currency: string; status: string; provider_reference: string | null };
type Cancellation = {
  id: string; booking_id: string; reason: string; status: string; requested_at: string;
  refund_amount: number | null; retained_amount: number | null; decision_notes: string | null;
  bookings: { booking_reference: string; guest_name: string; guest_email: string; guest_phone: string; check_in: string; check_out: string; total_amount: number; currency: string; payment_status: string; booking_status: string };
  booking_refund_transactions: Refund[];
  partner_settlements: { id: string; status: string; amount_due: number; currency: string; paid_at: string | null; payment_reference: string | null }[];
};
type Draft = { refundAmount: string; notes: string; providerReference: string; result: "succeeded" | "failed" };
const blank: Draft = { refundAmount: "", notes: "", providerReference: "", result: "succeeded" };
function money(amount: number, currency: string) {
  return new Intl.NumberFormat("en-KE", { style: "currency", currency, maximumFractionDigits: 2 }).format(Number(amount || 0));
}
export default function AdminCancellationsPage() {
  const router = useRouter();
  const [token, setToken] = useState("");
  const [requests, setRequests] = useState<Cancellation[]>([]);
  const [drafts, setDrafts] = useState<Record<string,Draft>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async (accessToken: string) => {
    setLoading(true); setError("");
    try {
      const response = await fetch("/api/admin/cancellations", { headers: { Authorization: `Bearer ${accessToken}` }, cache: "no-store" });
      const result = await response.json();
      if (response.status === 401) { router.replace("/login?next=%2Fadmin%2Fcancellations"); return; }
      if (!response.ok || !result.success) throw new Error(result.error || "Unable to load cancellation requests.");
      setRequests(result.requests || []);
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to load requests."); }
    finally { setLoading(false); }
  }, [router]);

  useEffect(() => {
    let active = true;
    async function start() {
      const supabase = createSupabaseBrowserClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.replace("/login?next=%2Fadmin%2Fcancellations"); return; }
      if (!active) return;
      setToken(session.access_token);
      await load(session.access_token);
    }
    void start();
    return () => { active = false; };
  }, [load, router]);

  function patch(id: string, value: Partial<Draft>) {
    setDrafts(current => ({ ...current, [id]: { ...blank, ...current[id], ...value } }));
  }
  async function action(id: string, payload: Record<string,unknown>) {
    setBusy(id); setError(""); setNotice("");
    try {
      const response = await fetch("/api/admin/cancellations", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || "Unable to record this action.");
      setNotice("The cancellation or refund action has been recorded.");
      await load(token);
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to process action."); }
    finally { setBusy(""); }
  }
  function review(event: FormEvent<HTMLFormElement>, item: Cancellation, decision: "approve" | "deny") {
    event.preventDefault();
    const draft = drafts[item.id] || blank;
    void action(item.id, { action: "review", requestId: item.id, decision, refundAmount: decision === "approve" ? Number(draft.refundAmount) : null, notes: draft.notes });
  }
  function recordRefund(event: FormEvent<HTMLFormElement>, item: Cancellation, refund: Refund) {
    event.preventDefault();
    const draft = drafts[refund.id] || blank;
    void action(refund.id, { action: "record_refund", refundId: refund.id, result: draft.result, providerReference: draft.providerReference, notes: draft.notes });
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-800">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
          <Link href="/" className="text-2xl font-black text-blue-950">ZuriStay<span className="text-orange-500">.</span></Link>
          <Link href="/admin" className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600"><ArrowLeft size={16}/> Admin dashboard</Link>
        </div>
      </header>
      <div className="mx-auto max-w-6xl px-5 py-9">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-bold uppercase tracking-wider text-orange-600">Guest services · Finance control</p>
            <h1 className="mt-2 text-3xl font-black text-blue-950">Cancellations and refunds</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">Review guest cancellation requests, record the approved refund amount under the single platform policy, and reconcile the actual provider refund reference.</p>
          </div>
          <button onClick={() => load(token)} disabled={loading || !token} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold disabled:opacity-50"><RefreshCw size={16} className={loading ? "animate-spin" : ""}/> Refresh</button>
        </div>
        <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <div className="flex items-start gap-3"><ShieldCheck size={20} className="mt-0.5 shrink-0"/><p><strong>Refunds are not sent from this screen.</strong> First complete the refund through the original M-Pesa or PayPal provider, then record its genuine provider reference here. Partner settlements remain held for reconciliation after any refund.</p></div>
        </div>
        {error && <p role="alert" className="mt-5 rounded-xl bg-red-50 p-4 text-sm text-red-800">{error}</p>}
        {notice && <p role="status" className="mt-5 rounded-xl bg-green-50 p-4 text-sm text-green-800">{notice}</p>}
        {loading ? <div className="flex justify-center py-24"><Loader2 className="animate-spin text-blue-900" size={28}/></div> :
          requests.length === 0 ? <div className="mt-8 rounded-2xl border border-slate-200 bg-white px-6 py-16 text-center"><CheckCircle2 className="mx-auto text-green-600" size={36}/><h2 className="mt-4 text-xl font-black text-blue-950">No cancellation requests</h2><p className="mt-2 text-sm text-slate-500">New guest requests will appear here.</p></div> :
          <div className="mt-8 space-y-5">{requests.map(item => {
            const draft = drafts[item.id] || blank;
            const busyNow = busy === item.id;
            return <article key={item.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div><p className="text-xs font-bold uppercase tracking-wider text-orange-600">Booking {item.bookings.booking_reference}</p><h2 className="mt-1 text-xl font-black text-blue-950">{item.bookings.guest_name}</h2><p className="mt-1 text-sm text-slate-500">{item.bookings.guest_email} · {item.bookings.guest_phone}</p></div>
                <span className="rounded-full bg-amber-100 px-3 py-1.5 text-xs font-bold text-amber-800">{item.status.replaceAll("_"," ")}</span>
              </div>
              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl bg-slate-50 p-3"><p className="text-xs text-slate-500">Booking total</p><p className="mt-1 font-black text-blue-950">{money(item.bookings.total_amount,item.bookings.currency)}</p></div>
                <div className="rounded-xl bg-slate-50 p-3"><p className="text-xs text-slate-500">Travel dates</p><p className="mt-1 text-sm font-bold">{item.bookings.check_in} – {item.bookings.check_out}</p></div>
                <div className="rounded-xl bg-slate-50 p-3"><p className="text-xs text-slate-500">Payment / booking</p><p className="mt-1 text-sm font-bold">{item.bookings.payment_status} / {item.bookings.booking_status}</p></div>
              </div>
              <div className="mt-4 rounded-xl border border-slate-100 p-4"><p className="text-xs font-bold uppercase text-slate-500">Guest reason</p><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">{item.reason}</p></div>
              {item.partner_settlements?.length > 0 && <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4"><p className="text-xs font-bold uppercase text-amber-800">Partner settlement reconciliation</p>{item.partner_settlements.map(settlement => <p key={settlement.id} className="mt-2 text-sm text-amber-950">{money(settlement.amount_due,settlement.currency)} · {settlement.status}{settlement.payment_reference ? ` · Ref ${settlement.payment_reference}` : ""}</p>)}<p className="mt-2 text-xs text-amber-800">If any settlement was already paid to a partner, resolve that amount separately before closing the refund case.</p></div>}
              {item.status === "pending_review" && <form onSubmit={e => review(e,item,"approve")} className="mt-5 border-t border-slate-100 pt-5">
                <h3 className="font-bold text-blue-950">Review under the standard platform policy</h3>
                <label className="mt-3 block text-sm font-semibold">Approved refund amount ({item.bookings.currency})
                  <input type="number" min="0" max={item.bookings.total_amount} step="0.01" required value={draft.refundAmount} onChange={e => patch(item.id,{refundAmount:e.target.value})} className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-3" placeholder="Enter amount payable back to guest"/>
                </label>
                <label className="mt-3 block text-sm font-semibold">Decision notes
                  <textarea required minLength={10} maxLength={4000} rows={3} value={draft.notes} onChange={e => patch(item.id,{notes:e.target.value})} className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-3" placeholder="Record cancellation timing, policy calculation and decision."/>
                </label>
                <div className="mt-4 flex flex-wrap gap-3">
                  <button type="submit" disabled={busyNow} className="rounded-xl bg-blue-950 px-5 py-3 text-sm font-bold text-white disabled:opacity-50">{busyNow ? "Saving…" : "Approve cancellation"}</button>
                  <button type="button" disabled={busyNow} onClick={() => { const d=drafts[item.id]||blank; if(d.notes.trim().length<10){setError("Enter decision notes before denying.");return;} void action(item.id,{action:"review",requestId:item.id,decision:"deny",notes:d.notes}); }} className="rounded-xl border border-slate-300 px-5 py-3 text-sm font-bold text-slate-700 disabled:opacity-50">Deny request</button>
                </div>
              </form>}
              {item.status === "refund_pending" && item.booking_refund_transactions?.map(refund => refund.status === "pending" ? <form key={refund.id} onSubmit={e => recordRefund(e,item,refund)} className="mt-5 border-t border-slate-100 pt-5">
                <h3 className="font-bold text-blue-950">Refund awaiting provider reconciliation</h3>
                <p className="mt-2 text-sm text-slate-600">{refund.payment_method.toUpperCase()} · {money(refund.amount,refund.currency)}. Complete this refund with the provider before recording success.</p>
                <label className="mt-3 block text-sm font-semibold">Provider result
                  <select value={(drafts[refund.id]||blank).result} onChange={e => patch(refund.id,{result:e.target.value as Draft["result"]})} className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-3"><option value="succeeded">Refund completed successfully</option><option value="failed">Refund failed / needs follow-up</option></select>
                </label>
                {(drafts[refund.id]||blank).result === "succeeded" && <label className="mt-3 block text-sm font-semibold">Actual provider refund reference
                  <input required minLength={3} maxLength={160} value={(drafts[refund.id]||blank).providerReference} onChange={e => patch(refund.id,{providerReference:e.target.value})} className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-3"/>
                </label>}
                <label className="mt-3 block text-sm font-semibold">Reconciliation notes
                  <textarea required minLength={10} maxLength={4000} rows={2} value={(drafts[refund.id]||blank).notes} onChange={e => patch(refund.id,{notes:e.target.value})} className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-3"/>
                </label>
                <button type="submit" disabled={busy===refund.id} className="mt-4 rounded-xl bg-blue-950 px-5 py-3 text-sm font-bold text-white disabled:opacity-50">{busy===refund.id ? "Recording…" : "Record provider result"}</button>
              </form> : <div key={refund.id} className="mt-4 rounded-xl bg-slate-50 p-4 text-sm">Refund {refund.status}: {money(refund.amount,refund.currency)} · Ref: {refund.provider_reference || "Not supplied"}</div>)}
              {(item.status === "approved" || item.status === "refunded" || item.status === "denied") && <p className="mt-4 text-sm text-slate-600">Decision: {item.status}. {item.decision_notes || ""}</p>}
            </article>;
          })}</div>}
      </div>
    </main>
  );
}
