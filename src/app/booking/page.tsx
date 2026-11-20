
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

const featuredProperties: Property[] = [
  {
    id: "1",
    name: "Ocean View Resort",
    location: "Diani Beach, Kwale",
    price: 12500,
    currency: "KSh",
    image:
      "https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=1000",
    units: [],
    isLive: false,
  },
  {
    id: "2",
    name: "The City Garden Hotel",
    location: "Nairobi, Kenya",
    price: 8500,
    currency: "KSh",
    image:
      "https://images.unsplash.com/photo-1566073771259-6a8506099945?w=1000",
    units: [],
    isLive: false,
  },
  {
    id: "3",
    name: "Palm Breeze Villas",
    location: "Watamu, Kilifi",
    price: 18000,
    currency: "KSh",
    image:
      "https://images.unsplash.com/photo-1613490493576-7fde63acd811?w=1000",
    units: [],
    isLive: false,
  },
];

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
  const [propertyId, setPropertyId] = useState("1");
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
  const [paymentPhone, setPaymentPhone] = useState("");
  const [startingPayment, setStartingPayment] = useState(false);
  const [paymentMessage, setPaymentMessage] = useState("");
  const [paymentError, setPaymentError] = useState("");

  const idempotencyRef = useRef<{
    fingerprint: string;
    key: string;
  } | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const selectedId = params.get("propertyId");

    if (selectedId) {
      setPropertyId(selectedId);
    }

    async function loadProperties() {
      try {
        const response = await fetch("/api/properties");
        const result = await response.json();

        if (!response.ok || !result.success) {
          throw new Error("Unable to load accommodation listings.");
        }

        const listings: Property[] = (result.properties ?? [])
          .filter(
            (item: any) =>
              Array.isArray(item.units) && item.units.length > 0
          )
          .map((item: any) => ({
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
              item.images?.find((image: any) => image.is_cover)
                ?.image_url ||
              item.images?.[0]?.image_url ||
              "",
            units: item.units.map((unit: any) => ({
              ...unit,
              customer_rate: Number(unit.customer_rate),
              capacity: Number(unit.capacity),
              total_units: Number(unit.total_units),
            })),
            isLive: true,
          }));

        setLiveProperties(listings);
      } catch (loadError) {
        console.error("Property loading error:", loadError);
        setError("Unable to load live accommodation listings.");
      } finally {
        setLoadingProperties(false);
      }
    }

    loadProperties();
  }, []);

  const allProperties = [...featuredProperties, ...liveProperties];

  const property =
    allProperties.find((item) => item.id === propertyId) ||
    featuredProperties[0];

  const selectedUnit =
    property.units.find((unit) => unit.id === unitId) ||
    property.units[0] ||
    null;

  const price = selectedUnit
    ? selectedUnit.customer_rate
    : property.price;

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

  const estimatedTotal = price * Math.max(0, nights) * Number(rooms || 1);

  useEffect(() => {
    setUnitId(property.units[0]?.id || "");
  }, [propertyId, liveProperties]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (!property.isLive || !selectedUnit) {
      setError(
        "This property is not connected to live room inventory yet. Please select an approved live accommodation listing."
      );
      return;
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

  async function startMpesaPayment() {
    if (!booking) return;
    setStartingPayment(true);
    setPaymentError("");
    setPaymentMessage("");
    try {
      const response = await fetch("/api/payments/mpesa/stk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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
    } catch (paymentStartError) {
      setPaymentError(paymentStartError instanceof Error ? paymentStartError.message : "M-Pesa payment could not be started.");
    } finally {
      setStartingPayment(false);
    }
  }

  if (booking) {
    const expiry = new Date(booking.hold_expires_at);

    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f8fafc] px-5 py-12">
        <div className="w-full max-w-xl rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-green-100">
            <CheckCircle2 size={42} className="text-green-600" />
          </div>

          <h1 className="mt-6 text-3xl font-black text-blue-950">
            Reservation held successfully!
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
                <strong>Booking status:</strong> {booking.booking_status}
              </p>
              <p>
                <strong>Payment status:</strong> {booking.payment_status}
              </p>
              <p>
                <strong>Hold expires:</strong> {expiry.toLocaleString()}
              </p>
            </div>
          </div>

          <div className="mt-6 rounded-2xl border border-slate-200 p-5 text-left">
            <h2 className="font-bold text-blue-950">Pay securely with M-Pesa</h2>
            <p className="mt-2 text-sm text-slate-500">
              We will send an STK Push to the guest phone number entered for this booking.
            </p>
            <label className="mt-4 block text-sm font-semibold text-slate-700">
              M-Pesa phone number
              <input
                type="tel"
                value={paymentPhone}
                onChange={(event) => setPaymentPhone(event.target.value)}
                placeholder="+254 7XX XXX XXX"
                className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 font-normal outline-none focus:border-orange-500"
              />
            </label>
            {paymentError && <p role="alert" className="mt-3 text-sm font-semibold text-red-700">{paymentError}</p>}
            {paymentMessage && <p role="status" className="mt-3 rounded-xl bg-green-50 p-3 text-sm font-semibold text-green-800">{paymentMessage}</p>}
            <button
              type="button"
              onClick={startMpesaPayment}
              disabled={startingPayment}
              className="mt-4 w-full rounded-xl bg-green-600 px-5 py-4 font-bold text-white transition hover:bg-green-700 disabled:opacity-60"
            >
              {startingPayment ? "Sending M-Pesa prompt..." : "Pay with M-Pesa"}
            </button>
          </div>

          <p className="mt-5 text-xs text-slate-500">
            Your room hold expires after 15 minutes unless payment is
            successfully verified. Your reservation is not yet confirmed.
          </p>

          <Link
            href="/account"
            className="mt-7 inline-flex rounded-xl bg-blue-950 px-7 py-4 font-bold text-white transition hover:bg-blue-900"
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
              className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-4 text-sm outline-none focus:border-orange-500"
            >
              {allProperties.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                  {item.isLive ? " — Live listing" : " — Not bookable yet"}
                </option>
              ))}
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
            disabled={submitting || loadingProperties}
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

            <p className="mt-3 text-xs leading-5 text-slate-400">
              The final price is calculated from the live nightly rates and
              confirmed inventory in ZuriStay.
            </p>

            <div className="mt-6 flex items-center gap-3 rounded-xl bg-green-50 p-4 text-sm text-green-800">
              <ShieldCheck size={23} className="shrink-0" />
              Your reservation is processed through the secure booking
              service.
            </div>

            <div className="mt-5 flex items-center gap-3 text-xs text-slate-400">
              <CreditCard size={17} />
              Payment integration will follow in the next development phase.
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
