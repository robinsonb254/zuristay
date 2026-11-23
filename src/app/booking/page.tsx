
"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  ArrowLeft,
  CalendarDays,
  Users,
  BedDouble,
  MapPin,
  ShieldCheck,
  CheckCircle2,
  CreditCard,
} from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type Unit = {
  id: string;
  name: string;
  unit_type?: string | null;
  capacity: number;
  total_units: number;
  customer_rate: number;
  currency: string;
};

type Property = {
  id: string;
  name: string;
  location: string;
  price: number;
  currency: string;
  image: string;
  units: Unit[];
  isLive: boolean;
};

type PropertyImage = { image_url?: string | null; is_cover?: boolean };
type ApiUnit = {
  id: string;
  name: string;
  unit_type?: string | null;
  capacity: number | string;
  total_units: number | string;
  customer_rate: number | string;
  currency?: string | null;
};
type ApiProperty = {
  id: string;
  name: string;
  address?: string | null;
  city?: string | null;
  county?: string | null;
  country?: string | null;
  starting_rate?: number | string | null;
  currency?: string | null;
  images?: PropertyImage[] | null;
  units?: ApiUnit[] | null;
};
type PropertiesApiResponse = {
  success: boolean;
  properties?: ApiProperty[];
  error?: string;
};

type BookingResult = {
  booking_id: string;
  booking_reference: string;
  hold_expires_at: string;
  currency: string;
  subtotal: number;
  commission: number;
  total_amount: number;
  booking_status: string;
  payment_status: string;
  idempotent_replay?: boolean;
};

function getToday() {
  const date = new Date();

  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function formatMoney(amount: number, currency: string) {
  return `${currency} ${amount.toLocaleString("en-KE", {
    maximumFractionDigits: 2,
  })}`;
}

export default function BookingPage() {
  const [liveProperties, setLiveProperties] = useState<Property[]>([]);
  const [dateQuotes, setDateQuotes] = useState<Record<string, { nightlyRate: number; stayTotal: number }>>({});
  const [availabilityChecking, setAvailabilityChecking] = useState(false);
  const [availabilityChecked, setAvailabilityChecked] = useState(false);
  const [availabilityError, setAvailabilityError] = useState("");
  const [propertyId, setPropertyId] = useState("");
  const [unitId, setUnitId] = useState("");
  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");
  const [guests, setGuests] = useState("2");
  const [rooms, setRooms] = useState("1");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [specialRequests, setSpecialRequests] = useState("");
  const [error, setError] = useState("");
  const [loadingProperties, setLoadingProperties] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [booking, setBooking] = useState<BookingResult | null>(null);
  const [bookingAccessToken, setBookingAccessToken] = useState("");
  const [paymentPhone, setPaymentPhone] = useState("");
  const [startingPayment, setStartingPayment] = useState(false);
  const [startingPaypal, setStartingPaypal] = useState(false);
  const [paymentMessage, setPaymentMessage] = useState("");
  const [paymentError, setPaymentError] = useState("");
  const [paymentState, setPaymentState] = useState<"idle" | "waiting" | "paid" | "failed" | "expired" | "timeout">("idle");
  const [paymentReference, setPaymentReference] = useState("");
  const [guestAccessConfirmed, setGuestAccessConfirmed] = useState(false);
  const [confirmingGuestAccess, setConfirmingGuestAccess] = useState(false);

  const idempotencyRef = useRef<{
    fingerprint: string;
    key: string;
  } | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const selectedId = params.get("propertyId");
    const queryCheckIn = params.get("checkIn");
    const queryCheckOut = params.get("checkOut");
    const queryGuests = params.get("guests");
    const queryRooms = params.get("rooms");

    if (queryCheckIn) setCheckIn(queryCheckIn);
    if (queryCheckOut) setCheckOut(queryCheckOut);
    if (queryGuests && /^\d+$/.test(queryGuests)) setGuests(queryGuests);
    if (queryRooms && /^\d+$/.test(queryRooms)) setRooms(queryRooms);

    async function loadProperties() {
      try {
        const response = await fetch("/api/properties");
        const result = (await response.json()) as PropertiesApiResponse;

        if (!response.ok || !result.success) {
          throw new Error(result.error || "Unable to load accommodation listings.");
        }

        const listings: Property[] = (result.properties ?? [])
          .filter((item) => Array.isArray(item.units) && item.units.length > 0)
          .map((item) => {
            const images = item.images ?? [];
            const units = item.units ?? [];
            return {
              id: item.id,
              name: item.name,
              location: [
                item.address,
                item.city,
                item.county,
                item.country,
              ]
                .filter(Boolean)
                .join(", "),
              price: Number(item.starting_rate ?? 0),
              currency: item.currency || "KES",
              image:
                images.find((image) => image.is_cover)?.image_url ||
                images[0]?.image_url ||
                "",
              units: units.map((unit) => ({
                ...unit,
                customer_rate: Number(unit.customer_rate),
                capacity: Number(unit.capacity),
                total_units: Number(unit.total_units),
                currency: unit.currency || item.currency || "KES",
              })),
              isLive: true,
            };
          });

        setLiveProperties(listings);
        const preferred = listings.find((item) => item.id === selectedId) || listings[0];
        setPropertyId(preferred?.id || "");
      } catch (loadError) {
        console.error("Property loading error:", loadError);
        setError("Unable to load live accommodation listings.");
      } finally {
        setLoadingProperties(false);
      }
    }

    loadProperties();
  }, []);

  const allProperties = liveProperties;

  const property =
    allProperties.find((item) => item.id === propertyId) ||
    allProperties[0] || {
      id: "",
      name: "No live accommodation available",
      location: "Approved partner listings will appear here",
      price: 0,
      currency: "KES",
      image: "",
      units: [],
      isLive: false,
    };

  const selectedUnit =
    property.units.find((unit) => unit.id === unitId) ||
    property.units[0] ||
    null;

  const selectedDateQuote = selectedUnit ? dateQuotes[selectedUnit.id] : undefined;
  const price = selectedDateQuote?.nightlyRate ?? (selectedUnit
    ? selectedUnit.customer_rate
    : property.price);

  const currency = selectedUnit
    ? selectedUnit.currency || property.currency
    : property.currency;

  const nights =
    checkIn && checkOut
      ? Math.round(
          (new Date(`${checkOut}T00:00:00`).getTime() -
            new Date(`${checkIn}T00:00:00`).getTime()) /
            86400000
        )
      : 0;

  const estimatedTotal = selectedDateQuote?.stayTotal ?? price * Math.max(0, nights) * Number(rooms || 1);

  useEffect(() => {
    if (!checkIn || !checkOut || checkOut <= checkIn) {
      setDateQuotes({});
      setAvailabilityChecked(false);
      setAvailabilityError("");
      setAvailabilityChecking(false);
      return;
    }

    let cancelled = false;
    setDateQuotes({});
    setAvailabilityChecked(false);
    setAvailabilityError("");
    setAvailabilityChecking(true);

    const params = new URLSearchParams({
      checkIn,
      checkOut,
      guests,
      rooms,
    });

    async function checkDateAvailability() {
      try {
        const response = await fetch(`/api/properties?${params.toString()}`, { cache: "no-store" });
        const result = await response.json();
        if (!response.ok || !result.success) {
          throw new Error(result.error || "Unable to verify availability for these dates.");
        }

        const quotes: Record<string, { nightlyRate: number; stayTotal: number }> = {};
        for (const item of result.properties ?? []) {
          for (const unit of item.units ?? []) {
            if (typeof unit.quoted_stay_total === "number" && Number.isFinite(Number(unit.customer_rate))) {
              quotes[unit.id] = {
                nightlyRate: Number(unit.customer_rate),
                stayTotal: Number(unit.quoted_stay_total),
              };
            }
          }
        }

        if (!cancelled) {
          setDateQuotes(quotes);
          setAvailabilityChecked(true);
        }
      } catch (availabilityCheckError) {
        if (!cancelled) {
          setDateQuotes({});
          setAvailabilityError(
            availabilityCheckError instanceof Error
              ? availabilityCheckError.message
              : "Unable to verify availability for these dates."
          );
        }
      } finally {
        if (!cancelled) setAvailabilityChecking(false);
      }
    }

    void checkDateAvailability();
    return () => {
      cancelled = true;
    };
  }, [checkIn, checkOut, guests, rooms, liveProperties.length]);

  useEffect(() => {
    const selectedProperty =
      allProperties.find((item) => item.id === propertyId) || allProperties[0];
    setUnitId(selectedProperty?.units[0]?.id || "");
  }, [propertyId, allProperties]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (!property.isLive || !selectedUnit) {
      setError(
        "This property is not connected to live room inventory yet. Please select an approved live accommodation listing."
      );
      return;
    }

    if (checkIn && checkOut) {
      if (availabilityChecking) {
        setError("Please wait while ZuriStay checks availability for your dates.");
        return;
      }
      if (availabilityError) {
        setError(availabilityError);
        return;
      }
      if (!availabilityChecked || !selectedDateQuote) {
        setError("This room category does not have enough available rooms for the selected dates and guest count.");
        return;
      }
    }

    if (!checkIn || !checkOut) {
      setError("Please select your check-in and check-out dates.");
      return;
    }

    if (checkIn < getToday()) {
      setError("Check-in cannot be in the past.");
      return;
    }

    if (nights < 1 || nights > 30) {
      setError("Stays must be between 1 and 30 nights.");
      return;
    }

    if (Number(guests) < 1 || Number(guests) > 20) {
      setError("Please enter between 1 and 20 guests.");
      return;
    }

    if (Number(rooms) < 1 || Number(rooms) > 10) {
      setError("Please select between 1 and 10 rooms.");
      return;
    }

    if (Number(rooms) > selectedUnit.total_units) {
      setError("The selected room quantity exceeds the listed room inventory.");
      return;
    }

    if (Number(guests) > selectedUnit.capacity * Number(rooms)) {
      setError(
        `This accommodation supports up to ${
          selectedUnit.capacity * Number(rooms)
        } guest(s) for the selected number of rooms.`
      );
      return;
    }

    if (!fullName.trim() || !email.trim() || !phone.trim()) {
      setError("Please complete all required contact details.");
      return;
    }

    if (specialRequests.length > 2000) {
      setError("Special requests cannot exceed 2000 characters.");
      return;
    }

    setSubmitting(true);

    try {
      const supabase = createSupabaseBrowserClient();
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw new Error("Unable to verify your account session. Please try again.");

      const payload = {
        unit_id: selectedUnit.id,
        check_in: checkIn,
        check_out: checkOut,
        quantity: Number(rooms),
        guests: Number(guests),
        guest_name: fullName.trim(),
        guest_email: email.trim().toLowerCase(),
        guest_phone: phone.trim(),
        special_requests: specialRequests.trim() || null,
      };

      const fingerprint = JSON.stringify(payload);

      if (idempotencyRef.current?.fingerprint !== fingerprint) {
        idempotencyRef.current = {
          fingerprint,
          key: crypto.randomUUID(),
        };
      }

      const response = await fetch("/api/bookings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({
          ...payload,
          idempotency_key: idempotencyRef.current.key,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success || !result.booking) {
        throw new Error(
          result.error || "Unable to create your reservation."
        );
      }

      const createdBooking = result.booking as BookingResult;

      const holdExpiry = new Date(createdBooking.hold_expires_at);

      if (
        createdBooking.booking_status !== "pending" ||
        createdBooking.payment_status !== "unpaid" ||
        Number.isNaN(holdExpiry.getTime()) ||
        holdExpiry.getTime() <= Date.now()
      ) {
        idempotencyRef.current = null;

        throw new Error(
          "This booking request has expired or is no longer active. Please submit a fresh reservation."
        );
      }

      if (typeof result.booking_access_token !== "string" || !/^[a-f0-9]{64}$/i.test(result.booking_access_token)) {
        throw new Error("Secure booking access could not be established. Please contact support.");
      }
      setBookingAccessToken(result.booking_access_token);
      try {
        sessionStorage.setItem(`zuristay:booking-access:${createdBooking.booking_id}`, result.booking_access_token);
        sessionStorage.setItem("zuristay:paypal-booking-id", createdBooking.booking_id);
      } catch { /* Session storage may be unavailable; in-memory access remains active. */ }
      setBooking(createdBooking);
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "An unexpected booking error occurred."
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function confirmGuestRoomAccess() {
    if (!booking) return;
    setConfirmingGuestAccess(true); setPaymentError(""); setPaymentMessage("");
    try {
      const token = bookingAccessToken || (() => { try { return sessionStorage.getItem(`zuristay:booking-access:${booking.booking_id}`) || ""; } catch { return ""; } })();
      const response = await fetch("/api/bookings/confirm-access", { method: "POST", headers: { "Content-Type": "application/json", "x-booking-access-token": token }, body: JSON.stringify({ booking_id: booking.booking_id }) });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || "Room access confirmation could not be saved.");
      setGuestAccessConfirmed(true); setPaymentMessage(result.message || "Room access confirmed.");
    } catch (err) { setPaymentError(err instanceof Error ? err.message : "Room access confirmation could not be saved."); }
    finally { setConfirmingGuestAccess(false); }
  }

  const activeBookingId = booking?.booking_id;

  useEffect(() => {
    const pollingBookingId = activeBookingId;
    if (!pollingBookingId || paymentState !== "waiting") return;

    let attempts = 0;
    let cancelled = false;

    async function checkStatus() {
      attempts += 1;
      try {
        const response = await fetch(
          `/api/bookings/status?booking_id=${encodeURIComponent(pollingBookingId!)}`,
          { cache: "no-store", headers: { "x-booking-access-token": bookingAccessToken || (() => { try { return sessionStorage.getItem(`zuristay:booking-access:${pollingBookingId!}`) || ""; } catch { return ""; } })() } }
        );
        const result = await response.json();
        if (cancelled || !response.ok || !result.success) return;

        if (result.payment_status === "paid" && result.booking_status === "confirmed") {
          setPaymentState("paid");
          setPaymentReference(result.payment_reference || "");
          setPaymentMessage("Payment received and verified. Your reservation is confirmed.");
          return;
        }

        if (result.mpesa_status === "failed") {
          setPaymentState("failed");
          setPaymentError("The M-Pesa request was not completed. You can try again while your room hold is active.");
          return;
        }

        if (!result.hold_active) {
          setPaymentState("expired");
          setPaymentError("Your 15-minute room hold has expired before payment was confirmed. Please contact ZuriStay support before making another payment.");
          return;
        }
      } catch (statusError) {
        console.error("Payment status check failed:", statusError);
      }

      if (attempts >= 18 && !cancelled) {
        setPaymentState("timeout");
        setPaymentMessage("We are still waiting for M-Pesa confirmation. Check the status again before leaving this page.");
      }
    }

    void checkStatus();
    const timer = window.setInterval(() => {
      if (attempts < 18 && !cancelled) void checkStatus();
    }, 4000);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [activeBookingId, bookingAccessToken, paymentState]);

  async function startMpesaPayment() {
    if (!booking) return;
    setStartingPayment(true);
    setPaymentError("");
    setPaymentMessage("");
    try {
      const response = await fetch("/api/payments/mpesa/stk", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-booking-access-token": bookingAccessToken || (() => { try { return sessionStorage.getItem(`zuristay:booking-access:${booking.booking_id}`) || ""; } catch { return ""; } })() },
        body: JSON.stringify({
          booking_id: booking.booking_id,
          phone: paymentPhone.trim() || phone.trim(),
        }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.error || "Unable to start M-Pesa payment.");
      }
      setPaymentMessage(result.message || "M-Pesa prompt sent. Check your phone and enter your PIN.");
      setPaymentState("waiting");
    } catch (paymentStartError) {
      setPaymentError(paymentStartError instanceof Error ? paymentStartError.message : "M-Pesa payment could not be started.");
    } finally {
      setStartingPayment(false);
    }
  }

  async function startPaypalPayment() {
    if (!booking) return;
    setStartingPaypal(true);
    setPaymentError("");
    setPaymentMessage("");
    try {
      try { sessionStorage.setItem("zuristay:paypal-booking-id", booking.booking_id); } catch {}
      const accessToken = bookingAccessToken || (() => {
        try { return sessionStorage.getItem(`zuristay:booking-access:${booking.booking_id}`) || ""; } catch { return ""; }
      })();
      const response = await fetch("/api/payments/paypal/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-booking-access-token": accessToken },
        body: JSON.stringify({ booking_id: booking.booking_id }),
      });
      const result = await response.json();
      if (!response.ok || !result.success || typeof result.approval_url !== "string") {
        throw new Error(result.error || "Unable to start PayPal checkout.");
      }
      setPaymentMessage(`PayPal will charge USD ${result.quote.paypal_amount_usd}. Your booking total is KES ${Number(result.quote.booking_amount_kes).toLocaleString("en-KE")}. Exchange rate locked for this checkout.`);
      window.location.assign(result.approval_url);
    } catch (paypalError) {
      setPaymentError(paypalError instanceof Error ? paypalError.message : "PayPal checkout could not be started.");
      setStartingPaypal(false);
    }
  }

  if (booking) {
    const expiry = new Date(booking.hold_expires_at);

    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f8fafc] px-5 py-12 print:bg-white print:py-0">
        <div className="w-full max-w-xl rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm print:max-w-none print:border-0 print:p-0 print:shadow-none">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-green-100">
            <CheckCircle2 size={42} className="text-green-600" />
          </div>

          <h1 className="mt-6 text-3xl font-black text-blue-950">
            {paymentState === "paid" ? "Booking confirmed!" : "Reservation held successfully!"}
          </h1>

          <p className="mt-3 text-slate-500">
            Your booking has been recorded. Your selected inventory is
            temporarily held while payment is arranged.
          </p>

          <div className="mt-7 rounded-2xl bg-slate-50 p-6 text-left">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Booking reference
            </p>

            <p className="mt-2 text-2xl font-black text-orange-500">
              {booking.booking_reference}
            </p>

            <div className="mt-5 space-y-3 text-sm text-slate-600">
              <p><strong>Property:</strong> {property.name}</p>
              <p><strong>Accommodation:</strong> {selectedUnit?.name}</p>
              <p><strong>Guest:</strong> {fullName}</p>
              <p><strong>Check-in:</strong> {checkIn}</p>
              <p><strong>Check-out:</strong> {checkOut}</p>
              <p><strong>Nights:</strong> {nights}</p>
              <p><strong>Guests:</strong> {guests}</p>
              <p><strong>Rooms:</strong> {rooms}</p>
              <p>
                <strong>Total payable:</strong>{" "}
                {formatMoney(Number(booking.total_amount), booking.currency)}
              </p>
              <p>
                <strong>Booking status:</strong> {paymentState === "paid" ? "confirmed" : booking.booking_status}
              </p>
              <p>
                <strong>Payment status:</strong> {paymentState === "paid" ? "paid" : booking.payment_status}
              </p>
              <p>
                <strong>Hold expires:</strong> {expiry.toLocaleString()}
              </p>
            </div>
          </div>

          {paymentState === "paid" && (
            <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-left">
              <h2 className="font-bold text-emerald-900">Confirm your room access</h2>
              <p className="mt-2 text-sm leading-6 text-emerald-800">After arriving, checking the room and confirming that it is secured, confirm your access here. ZuriStay will only release the partner’s payable amount after both partner confirmations and your confirmation.</p>
              <button type="button" onClick={confirmGuestRoomAccess} disabled={guestAccessConfirmed || confirmingGuestAccess} className="mt-4 rounded-xl bg-emerald-800 px-5 py-3 text-sm font-bold text-white disabled:opacity-60">{guestAccessConfirmed ? "Room access confirmed ✓" : confirmingGuestAccess ? "Saving confirmation..." : "I have accessed and secured the room"}</button>
            </div>
          )}
          {paymentState === "paid" && (
            <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 text-left print:break-inside-avoid">
              <div className="flex items-start justify-between gap-4 border-b border-dashed border-slate-300 pb-5">
                <div>
                  <p className="text-sm font-black uppercase tracking-[0.18em] text-orange-500">ZuriStay</p>
                  <h2 className="mt-2 text-xl font-black text-blue-950">Payment receipt</h2>
                  <p className="mt-1 text-xs text-slate-500">Your World. Your Stay.</p>
                </div>
                <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-bold uppercase text-green-800">Paid</span>
              </div>
              <div className="mt-5 grid grid-cols-2 gap-4 text-sm">
                <div><p className="text-xs text-slate-500">Booking reference</p><p className="mt-1 font-bold text-blue-950">{booking.booking_reference}</p></div>
                <div><p className="text-xs text-slate-500">M-Pesa receipt</p><p className="mt-1 break-all font-bold text-blue-950">{paymentReference || "Verified by ZuriStay"}</p></div>
                <div><p className="text-xs text-slate-500">Guest</p><p className="mt-1 font-semibold text-slate-800">{fullName}</p></div>
                <div><p className="text-xs text-slate-500">Property</p><p className="mt-1 font-semibold text-slate-800">{property.name}</p></div>
                <div><p className="text-xs text-slate-500">Accommodation</p><p className="mt-1 font-semibold text-slate-800">{selectedUnit?.name}</p></div>
                <div><p className="text-xs text-slate-500">Travel dates</p><p className="mt-1 font-semibold text-slate-800">{checkIn} – {checkOut}</p></div>
                <div><p className="text-xs text-slate-500">Guests / rooms</p><p className="mt-1 font-semibold text-slate-800">{guests} guests · {rooms} room(s)</p></div>
                <div><p className="text-xs text-slate-500">Payment method</p><p className="mt-1 font-semibold text-slate-800">M-Pesa</p></div>
              </div>
              <div className="mt-5 flex items-center justify-between border-t border-dashed border-slate-300 pt-5">
                <span className="font-bold text-blue-950">Amount paid</span>
                <span className="text-xl font-black text-green-700">{formatMoney(Number(booking.total_amount), booking.currency)}</span>
              </div>
              <p className="mt-4 text-center text-xs text-slate-500">Thank you for booking with ZuriStay.</p>
              <button type="button" onClick={() => window.print()} className="mt-5 w-full rounded-xl bg-blue-950 px-5 py-3 font-bold text-white hover:bg-blue-900 print:hidden">
                Print / Save receipt
              </button>
            </section>
          )}

          <div className="mt-6 rounded-2xl border border-slate-200 p-5 text-left print:hidden">
            <h2 className="font-bold text-blue-950">
              {paymentState === "paid" ? "M-Pesa payment confirmed" : "Pay securely with M-Pesa"}
            </h2>
            <p className="mt-2 text-sm text-slate-500">
              {paymentState === "paid"
                ? "Your payment was received and verified by ZuriStay."
                : "We will send an STK Push to the guest phone number entered for this booking."}
            </p>
            {paymentState !== "paid" && <label className="mt-4 block text-sm font-semibold text-slate-700">
              M-Pesa phone number
              <input
                type="tel"
                value={paymentPhone}
                onChange={(event) => setPaymentPhone(event.target.value)}
                placeholder="+254 7XX XXX XXX"
                className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 font-normal outline-none focus:border-orange-500"
              />
            </label>}
            {paymentError && <p role="alert" className="mt-3 text-sm font-semibold text-red-700">{paymentError}</p>}
            {paymentMessage && <p role="status" className="mt-3 rounded-xl bg-green-50 p-3 text-sm font-semibold text-green-800">{paymentMessage}</p>}
            {(paymentState === "idle" || paymentState === "failed") && (
              <button
                type="button"
                onClick={startMpesaPayment}
                disabled={startingPayment}
                className="mt-4 w-full rounded-xl bg-green-600 px-5 py-4 font-bold text-white transition hover:bg-green-700 disabled:opacity-60"
              >
                {startingPayment ? "Sending M-Pesa prompt..." : paymentState === "failed" ? "Try M-Pesa again" : "Pay with M-Pesa"}
              </button>
            )}
            {(paymentState === "idle" || paymentState === "failed") && (
              <button
                type="button"
                onClick={startPaypalPayment}
                disabled={startingPaypal || startingPayment}
                className="mt-3 w-full rounded-xl border border-blue-950 px-5 py-4 font-bold text-blue-950 transition hover:bg-blue-50 disabled:opacity-60"
              >
                {startingPaypal ? "Opening PayPal…" : "Pay with PayPal"}
              </button>
            )}
            {paymentState === "waiting" && (
              <p className="mt-4 text-sm font-semibold text-blue-900">Waiting for secure payment confirmation…</p>
            )}
            {paymentState === "timeout" && (
              <button
                type="button"
                onClick={() => setPaymentState("waiting")}
                className="mt-4 w-full rounded-xl border border-blue-900 px-5 py-3 font-bold text-blue-950"
              >
                Check payment status again
              </button>
            )}
          </div>

          {paymentState !== "paid" && (
            <p className="mt-5 text-xs text-slate-500">
              Your room hold expires after 15 minutes unless payment is
              successfully verified. Your reservation is not yet confirmed.
            </p>
          )}

          <Link
            href="/account"
            className="mt-7 inline-flex rounded-xl bg-blue-950 px-7 py-4 font-bold text-white transition hover:bg-blue-900 print:hidden"
          >
            View my account
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f8fafc] text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-5 lg:px-8">
          <Link href="/" className="text-2xl font-black text-blue-950">
            Zuri<span className="text-orange-500">Stay</span>
          </Link>

          <Link
            href="/search"
            className="flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-orange-500"
          >
            <ArrowLeft size={17} />
            Back to search
          </Link>
        </div>
      </header>

      <section className="bg-blue-950 px-5 py-10 text-white lg:px-8">
        <div className="mx-auto max-w-7xl">
          <p className="text-sm font-bold uppercase tracking-[0.2em] text-orange-400">
            ZURISTAY RESERVATIONS
          </p>

          <h1 className="mt-3 text-3xl font-black md:text-4xl">
            Reserve your perfect stay
          </h1>

          <p className="mt-3 text-sm text-blue-100">
            Choose your accommodation, travel dates and guest details.
          </p>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-8 px-5 py-10 lg:grid-cols-[1fr_380px] lg:px-8">
        <form onSubmit={handleSubmit} className="space-y-7">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-black text-blue-950">
              1. Select accommodation
            </h2>

            <label className="mt-5 block text-sm font-bold text-slate-700">
              Choose property
            </label>

            <select
              value={propertyId}
              onChange={(event) => setPropertyId(event.target.value)}
              disabled={allProperties.length === 0}
              className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-4 text-sm outline-none focus:border-orange-500 disabled:bg-slate-100"
            >
              {allProperties.length === 0 ? (
                <option value="">No approved live listings yet</option>
              ) : (
                allProperties.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name} — Live listing
                  </option>
                ))
              )}
            </select>

            {property.isLive && property.units.length > 0 && (
              <>
                <label className="mt-5 block text-sm font-bold text-slate-700">
                  Choose room or accommodation type
                </label>

                <select
                  value={selectedUnit?.id || ""}
                  onChange={(event) => setUnitId(event.target.value)}
                  className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-4 text-sm outline-none focus:border-orange-500"
                >
                  {property.units.map((unit) => (
                    <option key={unit.id} value={unit.id}>
                      {unit.name} — {formatMoney(unit.customer_rate, unit.currency)} / night
                    </option>
                  ))}
                </select>

                {selectedUnit && (
                  <p className="mt-3 text-xs text-slate-500">
                    Capacity: {selectedUnit.capacity} guest(s) per room ·
                    Listed units: {selectedUnit.total_units}
                  </p>
                )}
              </>
            )}

            <div className="mt-5 flex gap-4">
              <div
                className="h-24 w-28 shrink-0 rounded-xl bg-cover bg-center"
                style={{
                  backgroundImage: property.image
                    ? `url("${property.image}")`
                    : undefined,
                }}
              />

              <div>
                <h3 className="font-bold text-blue-950">
                  {property.name}
                </h3>

                <p className="mt-2 flex items-center gap-1 text-sm text-slate-500">
                  <MapPin size={15} />
                  {property.location}
                </p>

                <p className="mt-2 font-bold text-orange-500">
                  {formatMoney(price, currency)} / night
                </p>
              </div>
            </div>

            {!property.isLive && (
              <p className="mt-4 rounded-xl bg-amber-50 p-4 text-sm text-amber-800">
                This featured property is not yet connected to live room
                inventory. Select an approved live listing to make a
                reservation.
              </p>
            )}

            {loadingProperties && (
              <p className="mt-4 text-xs text-slate-400">
                Checking for additional approved accommodation listings...
              </p>
            )}

            {!loadingProperties && liveProperties.length === 0 && (
              <p className="mt-4 text-sm text-slate-500">
                No approved properties with room inventory are currently
                available for live booking.
              </p>
            )}
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-black text-blue-950">
              2. Travel information
            </h2>

            <div className="mt-5 grid gap-5 sm:grid-cols-2">
              <label className="block text-sm font-bold text-slate-700">
                Check-in date
                <span className="mt-2 flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-3">
                  <CalendarDays size={18} className="text-orange-500" />
                  <input
                    type="date"
                    min={getToday()}
                    value={checkIn}
                    onChange={(event) => setCheckIn(event.target.value)}
                    required
                    className="w-full min-w-0 outline-none"
                  />
                </span>
              </label>

              <label className="block text-sm font-bold text-slate-700">
                Check-out date
                <span className="mt-2 flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-3">
                  <CalendarDays size={18} className="text-orange-500" />
                  <input
                    type="date"
                    min={checkIn || getToday()}
                    value={checkOut}
                    onChange={(event) => setCheckOut(event.target.value)}
                    required
                    className="w-full min-w-0 outline-none"
                  />
                </span>
              </label>

              <label className="block text-sm font-bold text-slate-700">
                Number of guests
                <span className="mt-2 flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-3">
                  <Users size={18} className="text-orange-500" />
                  <input
                    type="number"
                    min="1"
                    max="20"
                    value={guests}
                    onChange={(event) => setGuests(event.target.value)}
                    required
                    className="w-full outline-none"
                  />
                </span>
              </label>

              <label className="block text-sm font-bold text-slate-700">
                Number of rooms
                <span className="mt-2 flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-3">
                  <BedDouble size={18} className="text-orange-500" />
                  <input
                    type="number"
                    min="1"
                    max="10"
                    value={rooms}
                    onChange={(event) => setRooms(event.target.value)}
                    required
                    className="w-full outline-none"
                  />
                </span>
              </label>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-black text-blue-950">
              3. Guest contact details
            </h2>

            <div className="mt-5 space-y-5">
              <label className="block text-sm font-bold text-slate-700">
                Full name
                <input
                  type="text"
                  value={fullName}
                  onChange={(event) => setFullName(event.target.value)}
                  placeholder="Enter your full name"
                  required
                  autoComplete="name"
                  className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-4 font-normal outline-none focus:border-orange-500"
                />
              </label>

              <label className="block text-sm font-bold text-slate-700">
                Email address
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@example.com"
                  required
                  autoComplete="email"
                  className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-4 font-normal outline-none focus:border-orange-500"
                />
              </label>

              <label className="block text-sm font-bold text-slate-700">
                Phone number
                <input
                  type="tel"
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  placeholder="+254 7XX XXX XXX"
                  required
                  autoComplete="tel"
                  className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-4 font-normal outline-none focus:border-orange-500"
                />
              </label>

              <label className="block text-sm font-bold text-slate-700">
                Special requests (optional)
                <textarea
                  value={specialRequests}
                  onChange={(event) => setSpecialRequests(event.target.value)}
                  rows={3}
                  placeholder="Any additional information for your stay?"
                  className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-4 font-normal outline-none focus:border-orange-500"
                />
              </label>
            </div>
          </div>

          {error && (
            <p
              role="alert"
              className="rounded-xl bg-red-50 p-4 text-sm font-semibold text-red-700"
            >
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting || loadingProperties || availabilityChecking}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-orange-500 px-6 py-5 font-bold text-white transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <CheckCircle2 size={20} />
            {submitting ? "Creating reservation..." : "Reserve accommodation"}
          </button>
        </form>

        <aside>
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm lg:sticky lg:top-6">
            <h2 className="text-xl font-black text-blue-950">
              Reservation summary
            </h2>

            <div
              className="mt-5 h-44 rounded-xl bg-cover bg-center"
              style={{
                backgroundImage: property.image
                  ? `url("${property.image}")`
                  : undefined,
              }}
            />

            <h3 className="mt-4 font-bold text-blue-950">
              {property.name}
            </h3>

            <p className="mt-2 flex items-center gap-2 text-sm text-slate-500">
              <MapPin size={15} />
              {property.location}
            </p>

            {selectedUnit && (
              <p className="mt-2 text-sm text-slate-500">
                Accommodation: {selectedUnit.name}
              </p>
            )}

            <div className="my-6 border-t border-slate-200" />

            <div className="space-y-4 text-sm">
              <div className="flex justify-between gap-3">
                <span className="text-slate-500">Price per night</span>
                <strong>{formatMoney(price, currency)}</strong>
              </div>

              <div className="flex justify-between gap-3">
                <span className="text-slate-500">Number of nights</span>
                <strong>{Math.max(0, nights)}</strong>
              </div>

              <div className="flex justify-between gap-3">
                <span className="text-slate-500">Rooms</span>
                <strong>{rooms || "1"}</strong>
              </div>
            </div>

            <div className="my-6 border-t border-slate-200" />

            <div className="flex items-center justify-between gap-3">
              <span className="font-bold text-blue-950">Estimated total</span>
              <span className="text-2xl font-black text-orange-500">
                {formatMoney(estimatedTotal, currency)}
              </span>
            </div>

            {checkIn && checkOut && availabilityChecking && (
              <p className="mt-3 text-xs text-blue-700">Checking live room availability and date-specific rates…</p>
            )}
            {availabilityError && (
              <p role="alert" className="mt-3 text-xs text-red-700">{availabilityError}</p>
            )}
            {availabilityChecked && !selectedDateQuote && (
              <p className="mt-3 text-xs text-amber-700">No matching room inventory is available for these dates, rooms and guests.</p>
            )}
            <p className="mt-3 text-xs leading-5 text-slate-400">
              {selectedDateQuote
                ? "This estimate uses the live nightly rates for your selected dates. The final amount is locked when your reservation is created."
                : "Indicative estimate only. Select travel dates to check live availability and date-specific rates; the final amount is confirmed when your reservation is created."}
            </p>

            <div className="mt-6 flex items-center gap-3 rounded-xl bg-green-50 p-4 text-sm text-green-800">
              <ShieldCheck size={23} className="shrink-0" />
              Your reservation is processed through the secure booking
              service.
            </div>

            <div className="mt-5 flex items-center gap-3 text-xs text-slate-400">
              <CreditCard size={17} />
              Payment is arranged securely after your room inventory is held.
            </div>
          </div>
        </aside>
      </section>

      <footer className="bg-blue-950 px-5 py-8 text-center text-sm text-blue-100">
        © {new Date().getFullYear()} ZuriStay. Your World. Your Stay.
      </footer>
    </main>
  );
}
