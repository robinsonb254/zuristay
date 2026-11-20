"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, Clock3, CreditCard, ShieldCheck, XCircle } from "lucide-react";

type BookingStatus = {
  success: boolean;
  booking_reference?: string;
  booking_status?: string;
  payment_status?: string;
  card_status?: string | null;
  card_reference?: string | null;
  total_amount?: number;
  currency?: string;
  error?: string;
};

export default function CardPaymentReturnPage() {
  const [bookingId, setBookingId] = useState("");
  const [reference, setReference] = useState("");
  const [status, setStatus] = useState<BookingStatus | null>(null);
  const [message, setMessage] = useState("Checking your booking payment...");
  const [loading, setLoading] = useState(true);

  const checkStatus = useCallback(async (id: string, bookingReference: string) => {
    if (!id) {
      setMessage("The booking reference is missing. Please contact ZuriStay support.");
      setLoading(false);
      return;
    }

    let accessToken = "";
    try {
      accessToken = sessionStorage.getItem(`zuristay:booking-access:${id}`) || "";
    } catch {
      accessToken = "";
    }

    if (!accessToken) {
      setMessage("For security, this browser session no longer has the booking access token. Open the original booking session or contact ZuriStay support with your booking reference.");
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`/api/bookings/status?booking_id=${encodeURIComponent(id)}`, {
        cache: "no-store",
        headers: { "x-booking-access-token": accessToken },
      });
      const result = (await response.json()) as BookingStatus;
      if (!response.ok || !result.success) throw new Error(result.error || "Unable to check payment status.");
      setStatus(result);
      setReference(result.booking_reference || bookingReference);
      setMessage(
        result.payment_status === "paid" && result.booking_status === "confirmed"
          ? "Your card payment has been verified and your booking is confirmed."
          : result.card_status === "failed"
            ? "The card payment was not completed. Your booking has not been confirmed."
            : "We have returned from the card checkout. The provider has not yet confirmed payment; check again shortly."
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Payment status is temporarily unavailable.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get("booking_id") || "";
    const bookingReference = params.get("reference") || "";
    setBookingId(id);
    setReference(bookingReference);
    void checkStatus(id, bookingReference);
  }, [checkStatus]);

  const paid = status?.payment_status === "paid" && status.booking_status === "confirmed";
  const failed = status?.card_status === "failed";

  return (
    <main className="mx-auto flex min-h-[70vh] max-w-2xl items-center px-4 py-12">
      <section className="w-full rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="mb-6 flex items-center justify-between">
          <p className="text-xl font-black tracking-tight text-[#102b52]">Zuri<span className="text-orange-500">Stay</span></p>
          <span className="flex items-center gap-2 rounded-full bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-700">
            <ShieldCheck size={15} /> Secure payment return
          </span>
        </div>

        <div className="flex items-start gap-4">
          <div className={`rounded-2xl p-3 ${paid ? "bg-green-100 text-green-700" : failed ? "bg-red-100 text-red-700" : "bg-blue-100 text-blue-700"}`}>
            {paid ? <CheckCircle2 size={28} /> : failed ? <XCircle size={28} /> : loading ? <Clock3 size={28} /> : <CreditCard size={28} />}
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-black text-[#102b52] sm:text-2xl">
              {paid ? "Booking confirmed" : failed ? "Payment not completed" : "Payment status"}
            </h1>
            <p className="mt-2 text-sm leading-6 text-slate-600">{message}</p>
          </div>
        </div>

        {reference && (
          <div className="mt-6 rounded-xl bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Booking reference</p>
            <p className="mt-1 font-bold tracking-wide text-[#102b52]">{reference}</p>
            {status?.total_amount !== undefined && (
              <p className="mt-2 text-sm font-semibold text-slate-700">
                {status.currency} {Number(status.total_amount).toLocaleString("en-KE", { maximumFractionDigits: 2 })}
              </p>
            )}
            {status?.card_reference && (
              <p className="mt-2 text-xs text-slate-500">Payment reference: {status.card_reference}</p>
            )}
          </div>
        )}

        {!paid && (
          <button
            type="button"
            onClick={() => void checkStatus(bookingId, reference)}
            disabled={loading}
            className="mt-6 w-full rounded-xl bg-[#102b52] px-5 py-3.5 font-bold text-white transition hover:bg-[#173b6d] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Checking payment..." : "Check payment status again"}
          </button>
        )}

        <div className="mt-6 border-t border-slate-100 pt-5 text-sm text-slate-600">
          {paid
            ? "Thank you for booking with ZuriStay. Keep your booking reference for future enquiries."
            : "Do not make another payment while the previous card transaction is still being checked. A booking is confirmed only after ZuriStay receives verified payment confirmation."}
        </div>

        <Link href="/" className="mt-6 inline-flex text-sm font-bold text-[#102b52] underline underline-offset-4">
          Return to ZuriStay
        </Link>
      </section>
    </main>
  );
}
