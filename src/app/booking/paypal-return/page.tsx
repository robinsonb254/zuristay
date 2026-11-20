"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

export default function PayPalReturnPage() {
  const started = useRef(false);
  const [status, setStatus] = useState<"checking" | "paid" | "cancelled" | "error">("checking");
  const [message, setMessage] = useState("Verifying your PayPal payment securely…");
  const [reference, setReference] = useState("");

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const params = new URLSearchParams(window.location.search);
    const orderId = params.get("token");
    let bookingId = "";
    try { bookingId = sessionStorage.getItem("zuristay:paypal-booking-id") || ""; } catch {}
    let accessToken = "";
    try { accessToken = bookingId ? sessionStorage.getItem(`zuristay:booking-access:${bookingId}`) || "" : ""; } catch {}
    if (!orderId || !bookingId || !accessToken) {
      setStatus("error");
      setMessage("We could not recover the secure booking session. Do not make another payment; contact ZuriStay support with your booking reference.");
      return;
    }
    void (async () => {
      try {
        if (params.get("cancelled") === "1") {
          const cancelledResponse = await fetch("/api/payments/paypal/cancel-order", {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-booking-access-token": accessToken },
            body: JSON.stringify({ order_id: orderId }),
          });
          const cancelledResult = await cancelledResponse.json();
          if (!cancelledResponse.ok || !cancelledResult.success) throw new Error("We could not verify the cancellation status. Do not start another payment yet.");
          setStatus("cancelled");
          setMessage(cancelledResult.cancelled
            ? "You cancelled PayPal checkout. No payment was captured. Your room hold remains subject to its expiry time."
            : "PayPal reports that this order may already have been approved. It has been left open for secure reconciliation; do not pay again.");
          return;
        }
        const response = await fetch("/api/payments/paypal/capture-order", {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-booking-access-token": accessToken },
          body: JSON.stringify({ order_id: orderId }),
        });
        const result = await response.json();
        if (!response.ok || !result.success) throw new Error(result.error || "PayPal payment is still being verified.");
        setReference(result.capture_id || "");
        setStatus("paid");
        setMessage(`Payment confirmed. Your reservation is confirmed. PayPal charged USD ${Number(result.paypal_amount_usd).toFixed(2)} for a booking total of KES ${Number(result.booking_amount_kes).toLocaleString("en-KE", { maximumFractionDigits: 2 })}.`);
      } catch (error) {
        setStatus("error");
        setMessage(error instanceof Error ? error.message : "Payment verification is pending. Do not pay again.");
      }
    })();
  }, []);

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-5 py-12">
      <section className="w-full max-w-xl rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <div className={`mx-auto flex h-16 w-16 items-center justify-center rounded-full ${status === "paid" ? "bg-green-100 text-green-700" : status === "error" ? "bg-amber-100 text-amber-700" : "bg-blue-100 text-blue-800"}`}>
          <span className="text-2xl font-black">{status === "paid" ? "✓" : status === "error" ? "!" : "…"}</span>
        </div>
        <p className="mt-6 text-sm font-black uppercase tracking-[0.18em] text-orange-500">ZuriStay</p>
        <h1 className="mt-2 text-2xl font-black text-blue-950">
          {status === "paid" ? "Reservation confirmed" : status === "cancelled" ? "Checkout cancelled" : status === "error" ? "Payment verification pending" : "Confirming payment"}
        </h1>
        <p role="status" className="mt-4 text-sm leading-6 text-slate-600">{message}</p>
        {reference && <p className="mt-4 break-all text-xs text-slate-400">PayPal capture reference: {reference}</p>}
        {status === "error" && <p className="mt-4 rounded-xl bg-amber-50 p-4 text-sm font-semibold text-amber-900">Please do not submit another payment while this transaction is being checked.</p>}
        <Link href="/" className="mt-7 inline-flex rounded-xl bg-blue-950 px-6 py-3 font-bold text-white">Return to ZuriStay</Link>
      </section>
    </main>
  );
}
