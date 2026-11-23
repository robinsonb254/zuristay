"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type Item = {
  id: string; booking_id: string; partner_room_secured_at: string | null;
  partner_guest_arrived_at: string | null; guest_room_access_confirmed_at: string | null;
  bookings: { booking_reference: string; guest_name: string; guest_email: string; check_in: string; check_out: string; payment_status: string; booking_status: string };
};

export default function PartnerConfirmationsPage() {
  const [items,setItems]=useState<Item[]>([]);
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState("");
  const [error,setError]=useState("");
  const [message,setMessage]=useState("");

  async function load() {
    setLoading(true); setError("");
    try {
      const supabase=createSupabaseBrowserClient();
      const {data:{session}}=await supabase.auth.getSession();
      if(!session) throw new Error("Please sign in to continue.");
      const response=await fetch("/api/partner/confirmations",{headers:{Authorization:"Bearer "+session.access_token},cache:"no-store"});
      const result=await response.json();
      if(!response.ok||!result.success) throw new Error(result.error||"Unable to load confirmations.");
      setItems(result.items||[]);
    } catch(e) { setError(e instanceof Error?e.message:"Unable to load confirmations."); }
    finally { setLoading(false); }
  }
  useEffect(()=>{void load();},[]);

  async function confirm(item:Item,action:"room_secured"|"guest_arrived") {
    setBusy(item.id+action); setError(""); setMessage("");
    try {
      const supabase=createSupabaseBrowserClient();
      const {data:{session}}=await supabase.auth.getSession();
      if(!session) throw new Error("Please sign in again.");
      const response=await fetch("/api/partner/confirmations",{method:"POST",headers:{"Content-Type":"application/json",Authorization:"Bearer "+session.access_token},body:JSON.stringify({booking_item_id:item.id,action})});
      const result=await response.json();
      if(!response.ok||!result.success) throw new Error(result.error||"Confirmation could not be saved.");
      setMessage(result.message); await load();
    } catch(e) {setError(e instanceof Error?e.message:"Confirmation could not be saved.");}
    finally {setBusy("");}
  }

  return <main className="min-h-screen bg-slate-50"><header className="border-b bg-white"><div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-4"><Link href="/" className="text-2xl font-bold text-blue-900">ZuriStay<span className="text-amber-500">.</span></Link><Link href="/partner/dashboard" className="text-sm font-semibold text-slate-600">Partner dashboard</Link></div></header><div className="mx-auto max-w-5xl px-5 py-8"><h1 className="text-3xl font-black text-blue-950">Guest arrival confirmations</h1><p className="mt-2 text-sm text-slate-600">Confirm the room is ready first, then confirm when the guest arrives.</p>{error&&<p role="alert" className="mt-5 rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</p>}{message&&<p role="status" className="mt-5 rounded-xl bg-green-50 p-4 text-sm text-green-700">{message}</p>}{loading?<p className="mt-8 rounded-xl bg-white p-8 text-center text-slate-500">Loading paid bookings...</p>:items.length===0?<p className="mt-8 rounded-xl bg-white p-8 text-center text-slate-500">There are no paid bookings awaiting partner confirmation.</p>:<div className="mt-7 grid gap-4">{items.map(item=><article key={item.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex flex-wrap justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-wide text-orange-600">{item.bookings.booking_reference}</p><h2 className="mt-1 text-lg font-bold text-blue-950">{item.bookings.guest_name}</h2><p className="mt-1 text-sm text-slate-500">{item.bookings.check_in} – {item.bookings.check_out}</p></div><span className="h-fit rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-800">Payment verified</span></div><div className="mt-5 flex flex-wrap gap-3"><button disabled={!!item.partner_room_secured_at||!!busy} onClick={()=>confirm(item,"room_secured")} className="rounded-xl bg-blue-950 px-4 py-3 text-sm font-bold text-white disabled:opacity-50">{item.partner_room_secured_at?"Room secured ✓":busy===item.id+"room_secured"?"Saving...":"Confirm room secured"}</button><button disabled={!item.partner_room_secured_at||!!item.partner_guest_arrived_at||!!busy} onClick={()=>confirm(item,"guest_arrived")} className="rounded-xl bg-orange-500 px-4 py-3 text-sm font-bold text-white disabled:opacity-50">{item.partner_guest_arrived_at?"Guest arrival confirmed ✓":busy===item.id+"guest_arrived"?"Saving...":"Confirm guest has arrived"}</button></div><p className="mt-4 text-xs text-slate-500">Guest room-access confirmation: {item.guest_room_access_confirmed_at?"Received":"Waiting for guest"}</p></article>)}</div>}</div></main>;
}
