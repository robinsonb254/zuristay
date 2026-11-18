
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CalendarDays,
  MapPin,
  BedDouble,
  Clock,
  CheckCircle2,
  XCircle,
  CreditCard,
  LogOut,
  Search,
  UserRound,
  RefreshCw,
  Hotel,
} from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type Booking = {
  id: string;
  booking_reference: string;
  customer_user_id: string | null;
  guest_name: string;
  guest_email: string;
  guest_phone: string;
  check_in: string;
  check_out: string;
  guests: number;
  rooms: number;
  currency: string;
  subtotal: number;
  total_amount: number;
  booking_status: string;
  payment_status: string;
  special_requests: string | null;
  created_at: string;
};

type BookingItem = {
  booking_id: string;
  property_id: string;
  unit_id: string;
  quantity: number;
  guest_rate: number;
  line_total: number;
  currency: string;
};

type Property = {
  id: string;
  name: string;
  city: string;
  county: string | null;
};

type Unit = {
  id: string;
  name: string;
};

type BookingDetails = {
  propertyNames: string[];
  unitNames: string[];
};

const bookingLabels: Record<string, string> = {
  pending: "Awaiting confirmation",
  confirmed: "Confirmed",
  checked_in: "Checked in",
  completed: "Completed",
  cancelled: "Cancelled",
  refunded: "Refunded",
};

const paymentLabels: Record<string, string> = {
  unpaid: "Unpaid",
  pending: "Payment pending",
  paid: "Paid",
  partially_refunded: "Partially refunded",
  refunded: "Refunded",
  failed: "Payment failed",
};

function formatMoney(amount: number, currency: string) {
  return `${currency} ${Number(amount || 0).toLocaleString("en-KE", {
    maximumFractionDigits: 2,
  })}`;
}

function formatDate(date: string) {
  if (!date) return "Not available";

  return new Date(`${date}T00:00:00`).toLocaleDateString("en-KE", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function statusStyle(status: string) {
  switch (status) {
    case "confirmed":
    case "completed":
    case "paid":
      return "bg-green-50 text-green-700";

    case "pending":
    case "checked_in":
      return "bg-amber-50 text-amber-700";

    case "cancelled":
    case "refunded":
    case "failed":
      return "bg-red-50 text-red-700";

    default:
      return "bg-slate-100 text-slate-600";
  }
}

export default function AccountPage() {
  const router = useRouter();

  const [userEmail, setUserEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [bookingDetails, setBookingDetails] = useState<
    Record<string, BookingDetails>
  >({});
  const [loading, setLoading] = useState(true);
  const [signingOut, setSigningOut] = useState(false);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState("all");

  useEffect(() => {
    let mounted = true;

    async function loadAccount() {
      try {
        const supabase = createSupabaseBrowserClient();

        const {
          data: { user },
          error: authError,
        } = await supabase.auth.getUser();

        if (authError || !user) {
          router.replace("/login");
          return;
        }

        if (!mounted) return;

        setUserEmail(user.email || "");

        const { data: profile } = await supabase
          .from("profiles")
          .select("full_name")
          .eq("id", user.id)
          .maybeSingle();

        if (!mounted) return;

        setFullName(
          profile?.full_name ||
            user.user_metadata?.full_name ||
            user.email?.split("@")[0] ||
            "Customer"
        );

        const { data: bookingData, error: bookingError } = await supabase
          .from("bookings")
          .select(
            "id, booking_reference, customer_user_id, guest_name, guest_email, guest_phone, check_in, check_out, guests, rooms, currency, subtotal, total_amount, booking_status, payment_status, special_requests, created_at"
          )
          .eq("customer_user_id", user.id)
          .order("created_at", { ascending: false });

        if (bookingError) throw bookingError;

        const customerBookings = (bookingData || []) as Booking[];

        if (!mounted) return;

        setBookings(customerBookings);

        if (customerBookings.length > 0) {
          const bookingIds = customerBookings.map((booking) => booking.id);

          const { data: itemData, error: itemError } = await supabase
            .from("booking_items")
            .select(
              "booking_id, property_id, unit_id, quantity, guest_rate, line_total, currency"
            )
            .in("booking_id", bookingIds);

          if (itemError) throw itemError;

          const items = (itemData || []) as BookingItem[];
          const propertyIds = [...new Set(items.map((item) => item.property_id))];
          const unitIds = [...new Set(items.map((item) => item.unit_id))];

          const [propertyResult, unitResult] = await Promise.all([
            propertyIds.length
              ? supabase
                  .from("properties")
                  .select("id, name, city, county")
                  .in("id", propertyIds)
              : Promise.resolve({ data: [], error: null }),

            unitIds.length
              ? supabase
                  .from("property_units")
                  .select("id, name")
                  .in("id", unitIds)
              : Promise.resolve({ data: [], error: null }),
          ]);

          if (propertyResult.error) throw propertyResult.error;
          if (unitResult.error) throw unitResult.error;

          const properties = (propertyResult.data || []) as Property[];
          const units = (unitResult.data || []) as Unit[];

          const propertyMap = new Map(
            properties.map((property) => [
              property.id,
              `${property.name} · ${[property.city, property.county]
                .filter(Boolean)
                .join(", ")}`,
            ])
          );

          const unitMap = new Map(
            units.map((unit) => [unit.id, unit.name])
          );

          const details: Record<string, BookingDetails> = {};

          for (const booking of customerBookings) {
            const bookingItems = items.filter(
              (item) => item.booking_id === booking.id
            );

            details[booking.id] = {
              propertyNames: [
                ...new Set(
                  bookingItems
                    .map((item) => propertyMap.get(item.property_id))
                    .filter((name): name is string => Boolean(name))
                ),
              ],
              unitNames: [
                ...new Set(
                  bookingItems
                    .map((item) => unitMap.get(item.unit_id))
                    .filter((name): name is string => Boolean(name))
                ),
              ],
            };
          }

          if (!mounted) return;

          setBookingDetails(details);
        }
      } catch (err) {
        console.error("Account loading error:", err);

        if (mounted) {
          setError(
            err instanceof Error
              ? err.message
              : "Unable to load your account. Please try again."
          );
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadAccount();

    return () => {
      mounted = false;
    };
  }, [router]);

  const today = new Date().toISOString().slice(0, 10);

  const upcomingBookings = useMemo(
    () =>
      bookings.filter(
        (booking) =>
          booking.check_in >= today &&
          ["pending", "confirmed"].includes(booking.booking_status)
      ),
    [bookings, today]
  );

  const completedBookings = useMemo(
    () =>
      bookings.filter(
        (booking) =>
          ["completed", "cancelled", "refunded"].includes(
            booking.booking_status
          )
      ),
    [bookings]
  );

  const displayedBookings = useMemo(() => {
    if (activeTab === "upcoming") return upcomingBookings;
    if (activeTab === "completed") return completedBookings;
    return bookings;
  }, [activeTab, bookings, upcomingBookings, completedBookings]);

  async function handleSignOut() {
    setSigningOut(true);

    try {
      const supabase = createSupabaseBrowserClient();
      await supabase.auth.signOut();
      router.replace("/login");
      router.refresh();
    } catch (err) {
      console.error("Sign out error:", err);
      setError("Unable to sign out. Please try again.");
      setSigningOut(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#f8fafc] text-slate-800">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-5 lg:px-8">
          <Link href="/" className="text-2xl font-black text-blue-950">
            Zuri<span className="text-orange-500">Stay</span>
          </Link>

          <button
            onClick={handleSignOut}
            disabled={signingOut}
            className="flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
          >
            <LogOut size={17} />
            {signingOut ? "Signing out..." : "Sign out"}
          </button>
        </div>
      </header>

      <section className="bg-blue-950 px-5 py-10 text-white lg:px-8">
        <div className="mx-auto max-w-7xl">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-orange-400">
            CUSTOMER ACCOUNT
          </p>

          <h1 className="mt-3 text-3xl font-black md:text-4xl">
            Welcome, {fullName || "traveller"}!
          </h1>

          <p className="mt-3 text-sm text-blue-100">
            Manage your reservations and keep track of your stays.
          </p>

          <p className="mt-2 text-sm text-blue-200">{userEmail}</p>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-9 lg:px-8">
        <div className="grid gap-5 sm:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-slate-500">
                Total bookings
              </p>
              <CalendarDays className="text-orange-500" size={23} />
            </div>
            <p className="mt-4 text-3xl font-black text-blue-950">
              {loading ? "—" : bookings.length}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-slate-500">
                Upcoming stays
              </p>
              <Clock className="text-orange-500" size={23} />
            </div>
            <p className="mt-4 text-3xl font-black text-blue-950">
              {loading ? "—" : upcomingBookings.length}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-slate-500">
                Completed or closed
              </p>
              <CheckCircle2 className="text-orange-500" size={23} />
            </div>
            <p className="mt-4 text-3xl font-black text-blue-950">
              {loading ? "—" : completedBookings.length}
            </p>
          </div>
        </div>

        <div className="mt-9 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h2 className="text-2xl font-black text-blue-950">
              My reservations
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              View your accommodation bookings and payment information.
            </p>
          </div>

          <Link
            href="/search"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-orange-500 px-5 py-3 text-sm font-bold text-white hover:bg-orange-600"
          >
            <Search size={18} />
            Find accommodation
          </Link>
        </div>

        <div className="mt-6 flex flex-wrap gap-2 border-b border-slate-200 pb-4">
          {[
            { id: "all", label: "All bookings" },
            { id: "upcoming", label: "Upcoming" },
            { id: "completed", label: "Completed / closed" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`rounded-full px-5 py-2.5 text-sm font-semibold transition ${
                activeTab === tab.id
                  ? "bg-blue-950 text-white"
                  : "bg-white text-slate-600 hover:bg-slate-100"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {error && (
          <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
            <button
              onClick={() => window.location.reload()}
              className="ml-2 font-bold underline"
            >
              Try again
            </button>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center gap-3 py-20 text-slate-500">
            <RefreshCw size={20} className="animate-spin" />
            Loading your reservations...
          </div>
        ) : displayedBookings.length === 0 ? (
          <div className="mt-7 rounded-3xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-orange-50 text-orange-500">
              <Hotel size={30} />
            </div>

            <h3 className="mt-5 text-xl font-black text-blue-950">
              {activeTab === "all"
                ? "Your journey starts here"
                : "No reservations in this section"}
            </h3>

            <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-slate-500">
              {activeTab === "all"
                ? "You haven't made any bookings through your account yet. Explore accommodation and discover your next destination."
                : "When you have reservations in this category, they will appear here."}
            </p>

            <Link
              href="/search"
              className="mt-7 inline-flex items-center gap-2 rounded-xl bg-orange-500 px-6 py-3.5 font-bold text-white hover:bg-orange-600"
            >
              <Search size={18} />
              Explore stays
            </Link>
          </div>
        ) : (
          <div className="mt-7 space-y-5">
            {displayedBookings.map((booking) => {
              const details = bookingDetails[booking.id];

              return (
                <article
                  key={booking.id}
                  className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
                >
                  <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                        Booking reference
                      </p>

                      <h3 className="mt-1 text-xl font-black text-blue-950">
                        {booking.booking_reference}
                      </h3>

                      <p className="mt-2 text-xs text-slate-400">
                        Booked on {formatDate(booking.created_at.slice(0, 10))}
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <span
                        className={`rounded-full px-3 py-2 text-xs font-bold ${statusStyle(
                          booking.booking_status
                        )}`}
                      >
                        {bookingLabels[booking.booking_status] ||
                          booking.booking_status}
                      </span>

                      <span
                        className={`rounded-full px-3 py-2 text-xs font-bold ${statusStyle(
                          booking.payment_status
                        )}`}
                      >
                        {paymentLabels[booking.payment_status] ||
                          booking.payment_status}
                      </span>
                    </div>
                  </div>

                  <div className="my-5 border-t border-slate-100" />

                  <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
                    <div>
                      <p className="text-xs font-semibold text-slate-400">
                        Check-in
                      </p>
                      <p className="mt-2 font-bold text-blue-950">
                        {formatDate(booking.check_in)}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs font-semibold text-slate-400">
                        Check-out
                      </p>
                      <p className="mt-2 font-bold text-blue-950">
                        {formatDate(booking.check_out)}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs font-semibold text-slate-400">
                        Guests and rooms
                      </p>
                      <p className="mt-2 font-bold text-blue-950">
                        {booking.guests} guests · {booking.rooms} rooms
                      </p>
                    </div>

                    <div>
                      <p className="text-xs font-semibold text-slate-400">
                        Total amount
                      </p>
                      <p className="mt-2 text-lg font-black text-orange-500">
                        {formatMoney(
                          Number(booking.total_amount),
                          booking.currency
                        )}
                      </p>
                    </div>
                  </div>

                  <div className="mt-5 rounded-xl bg-slate-50 p-4">
                    <div className="flex items-start gap-3">
                      <MapPin
                        size={19}
                        className="mt-0.5 shrink-0 text-orange-500"
                      />
                      <div>
                        <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                          Accommodation
                        </p>

                        {details?.propertyNames.length ? (
                          <p className="mt-1 text-sm font-bold text-blue-950">
                            {details.propertyNames.join(", ")}
                          </p>
                        ) : (
                          <p className="mt-1 text-sm text-slate-500">
                            Property details unavailable
                          </p>
                        )}

                        {details?.unitNames.length ? (
                          <p className="mt-1 text-sm text-slate-500">
                            {details.unitNames.join(", ")}
                          </p>
                        ) : null}
                      </div>
                    </div>
                  </div>

                  <div className="mt-5 flex flex-wrap items-center gap-3 text-xs text-slate-500">
                    <span className="flex items-center gap-2">
                      <CreditCard size={16} />
                      Payment:{" "}
                      {paymentLabels[booking.payment_status] ||
                        booking.payment_status}
                    </span>

                    {booking.booking_status === "cancelled" && (
                      <span className="flex items-center gap-1 text-red-600">
                        <XCircle size={15} />
                        This reservation is cancelled.
                      </span>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}

        <div className="mt-10 rounded-2xl bg-blue-950 p-6 text-white md:flex md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <UserRound size={25} className="text-orange-400" />
            <div>
              <h3 className="font-bold">Need help with your account?</h3>
              <p className="mt-1 text-sm text-blue-200">
                Contact the ZuriStay team for assistance with your reservations.
              </p>
            </div>
          </div>

          <Link
            href="/"
            className="mt-5 inline-flex rounded-xl bg-white px-5 py-3 text-sm font-bold text-blue-950 hover:bg-blue-50 md:mt-0"
          >
            Back to homepage
          </Link>
        </div>
      </section>

      <footer className="bg-white px-5 py-7 text-center text-sm text-slate-400">
        © {new Date().getFullYear()} ZuriStay. Your World. Your Stay.
      </footer>
    </main>
  );
}
