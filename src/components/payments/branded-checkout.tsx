"use client";

import { useState } from "react";
import {
  CheckCircle2,
  CreditCard,
  LockKeyhole,
  ShieldCheck,
  Smartphone,
} from "lucide-react";

type PaymentState = "idle" | "waiting" | "paid" | "failed" | "expired" | "timeout";

type BrandedCheckoutProps = {
  bookingReference: string;
  amount: number;
  currency: string;
  paymentState: PaymentState;
  paymentPhone: string;
  onPaymentPhoneChange: (value: string) => void;
  onStartMpesaPayment: () => void;
  onCheckStatus: () => void;
  startingPayment: boolean;
  paymentError: string;
  paymentMessage: string;
  paymentReference: string;
};

function formatMoney(amount: number, currency: string) {
  return new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(amount);
}

export default function BrandedCheckout({
  bookingReference,
  amount,
  currency,
  paymentState,
  paymentPhone,
  onPaymentPhoneChange,
  onStartMpesaPayment,
  onCheckStatus,
  startingPayment,
  paymentError,
  paymentMessage,
  paymentReference,
}: BrandedCheckoutProps) {
  const [selectedMethod, setSelectedMethod] = useState<"mpesa" | "card">("mpesa");
  const paid = paymentState === "paid";

  return (
    <section className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white text-left shadow-sm print:hidden">
      <div className="bg-[#102b52] px-5 py-5 text-white sm:px-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-lg font-black tracking-tight">
              Zuri<span className="text-orange-400">Stay</span>
            </p>
            <p className="mt-1 text-xs font-medium text-blue-100">
              Secure booking checkout
            </p>
          </div>
          <div className="flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-2 text-xs font-semibold text-blue-50">
            <LockKeyhole size={14} />
            Secure checkout
          </div>
        </div>
        <div className="mt-5 flex items-end justify-between gap-4 border-t border-white/15 pt-4">
          <div>
            <p className="text-xs font-medium text-blue-100">Booking reference</p>
            <p className="mt-1 text-sm font-bold tracking-wide">{bookingReference}</p>
          </div>
          <div className="text-right">
            <p className="text-xs font-medium text-blue-100">Total to pay</p>
            <p className="mt-1 text-2xl font-black">{formatMoney(amount, currency)}</p>
          </div>
        </div>
      </div>

      <div className="p-5 sm:p-6">
        {paid ? (
          <div className="rounded-xl border border-green-200 bg-green-50 p-4">
            <div className="flex items-center gap-2 font-bold text-green-800">
              <CheckCircle2 size={19} />
              Payment received and verified
            </div>
            <p className="mt-2 text-sm text-green-800">
              Your booking is confirmed. {paymentReference ? `Payment reference: ${paymentReference}` : ""}
            </p>
          </div>
        ) : (
          <>
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="font-black text-[#102b52]">Choose payment method</h2>
              <span className="text-xs font-semibold text-slate-500">Select how to pay</span>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setSelectedMethod("mpesa")}
                aria-pressed={selectedMethod === "mpesa"}
                className={`rounded-xl border p-4 text-left transition ${selectedMethod === "mpesa" ? "border-green-600 bg-green-50 ring-2 ring-green-100" : "border-slate-200 bg-white hover:border-slate-300"}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2 font-bold text-slate-900">
                    <Smartphone size={19} className="text-green-700" />
                    M-Pesa
                  </span>
                  <span className="rounded-md bg-green-100 px-2 py-1 text-[10px] font-black uppercase text-green-800">
                    Available
                  </span>
                </div>
                <p className="mt-2 text-xs leading-5 text-slate-600">
                  Receive a payment prompt on your Kenyan mobile number.
                </p>
              </button>

              <button
                type="button"
                onClick={() => setSelectedMethod("card")}
                aria-pressed={selectedMethod === "card"}
                className={`rounded-xl border p-4 text-left transition ${selectedMethod === "card" ? "border-amber-500 bg-amber-50 ring-2 ring-amber-100" : "border-slate-200 bg-slate-50 hover:border-slate-300"}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2 font-bold text-slate-700">
                    <CreditCard size={19} />
                    Visa / Mastercard
                  </span>
                  <span className="rounded-md bg-amber-100 px-2 py-1 text-[10px] font-black uppercase text-amber-800">
                    In setup
                  </span>
                </div>
                <p className="mt-2 text-xs leading-5 text-slate-500">
                  Card checkout will be activated after ZuriStay's acquiring partner enables live card processing.
                </p>
              </button>
            </div>

            {selectedMethod === "mpesa" && (
              <div className="mt-5 rounded-xl border border-slate-200 p-4 sm:p-5">
                <div className="flex items-start gap-3">
                  <div className="rounded-lg bg-green-100 p-2 text-green-800">
                    <Smartphone size={20} />
                  </div>
                  <div>
                    <h3 className="font-bold text-[#102b52]">Pay with M-Pesa</h3>
                    <p className="mt-1 text-sm leading-6 text-slate-600">
                      Enter the guest's M-Pesa number. ZuriStay will request payment and confirm the booking only after the payment is verified.
                    </p>
                  </div>
                </div>

                <label className="mt-4 block text-sm font-semibold text-slate-700">
                  M-Pesa phone number
                  <input
                    type="tel"
                    value={paymentPhone}
                    onChange={(event) => onPaymentPhoneChange(event.target.value)}
                    placeholder="+254 7XX XXX XXX"
                    disabled={paymentState === "waiting"}
                    className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 font-normal outline-none transition focus:border-green-600 disabled:bg-slate-50"
                  />
                </label>

                {paymentError && (
                  <p role="alert" className="mt-3 rounded-lg bg-red-50 p-3 text-sm font-semibold text-red-700">
                    {paymentError}
                  </p>
                )}
                {paymentMessage && (
                  <p role="status" className="mt-3 rounded-lg bg-blue-50 p-3 text-sm font-semibold text-blue-900">
                    {paymentMessage}
                  </p>
                )}

                {(paymentState === "idle" || paymentState === "failed") && (
                  <button
                    type="button"
                    onClick={onStartMpesaPayment}
                    disabled={startingPayment}
                    className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-green-600 px-5 py-4 font-bold text-white transition hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <LockKeyhole size={17} />
                    {startingPayment ? "Sending secure payment request..." : paymentState === "failed" ? "Try M-Pesa again" : "Continue to M-Pesa"}
                  </button>
                )}

                {(paymentState === "waiting" || paymentState === "timeout") && (
                  <div className="mt-4 rounded-xl bg-blue-50 p-4">
                    <p className="text-sm font-semibold text-blue-950">
                      {paymentState === "waiting" ? "Waiting for payment confirmation…" : "Payment confirmation is taking longer than expected."}
                    </p>
                    {paymentState === "timeout" && (
                      <button
                        type="button"
                        onClick={onCheckStatus}
                        className="mt-3 w-full rounded-xl border border-blue-900 px-4 py-3 text-sm font-bold text-blue-950 transition hover:bg-white"
                      >
                        Check payment status again
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}

            {selectedMethod === "card" && (
              <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4">
                <div className="flex items-center gap-2 font-bold text-amber-900">
                  <CreditCard size={18} />
                  Card payments are being prepared
                </div>
                <p className="mt-2 text-sm leading-6 text-amber-900">
                  Visa and Mastercard checkout will appear here once ZuriStay's acquiring partner has enabled live processing. This page does not collect or store card numbers or security codes.
                </p>
              </div>
            )}
          </>
        )}

        <div className="mt-5 flex items-start gap-2 border-t border-slate-100 pt-4 text-xs leading-5 text-slate-500">
          <ShieldCheck size={16} className="mt-0.5 shrink-0 text-green-700" />
          <p>
            Payments are confirmed from verified provider responses. ZuriStay never asks you to send your card details through chat, email or phone.
          </p>
        </div>
      </div>
    </section>
  );
}
