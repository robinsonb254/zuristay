
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Building2,
  Users,
  CalendarDays,
  ClipboardList,
  RefreshCw,
  LogOut,
  ExternalLink,
  ShieldCheck,
  AlertCircle,
  CheckCircle2,
  Clock3,
  MapPin,
  CreditCard,
} from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import AdminAnalytics from "./analytics";

type AdminProfile = {
  id: string;
  full_name: string | null;
  role: string;
};

type Application = {
  id: string;
  business_name: string;
  contact_person: string;
  location: string;
  property_type: string | null;
  status: string;
  created_at: string;
};

type Property = {
  id: string;
  name: string;
  city: string;
  county?: string | null;
  sub_county?: string | null;
  country: string;
  status: string;
  is_active: boolean;
  created_at: string;
};

type Partner = {
  id: string;
  business_name: string;
  status: string;
  created_at: string;
};

type Booking = {
  id: string;
  booking_reference: string;
  guest_name: string;
  total_amount: number;
  currency: string;
  booking_status: string;
  payment_status: string;
  created_at: string;
};

type DashboardStats = {
  applications: number;
  pendingApplications: number;
  properties: number;
  approvedProperties: number;
  partners: number;
  bookings: number;
  confirmedBookings: number;
};

const emptyStats: DashboardStats = {
  applications: 0,
  pendingApplications: 0,
  properties: 0,
  approvedProperties: 0,
  partners: 0,
  bookings: 0,
  confirmedBookings: 0,
};

function formatDate(value: string) {
  if (!value) return "Not available";

  return new Date(value).toLocaleDateString("en-KE", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatMoney(amount: number, currency: string) {
  return `${currency} ${Number(amount || 0).toLocaleString("en-KE", {
    maximumFractionDigits: 2,
  })}`;
}

function statusClass(status: string) {
  switch (status?.toLowerCase()) {
    case "approved":
    case "active":
    case "confirmed":
    case "completed":
    case "paid":
      return "bg-green-50 text-green-700";

    case "pending":
    case "checked_in":
      return "bg-amber-50 text-amber-700";

    case "rejected":
    case "cancelled":
    case "refunded":
    case "failed":
      return "bg-red-50 text-red-700";

    default:
      return "bg-slate-100 text-slate-600";
  }
}

export default function AdminPage() {
  const router = useRouter();

  const [profile, setProfile] = useState<AdminProfile | null>(null);
  const [stats, setStats] = useState<DashboardStats>(emptyStats);
  const [applications, setApplications] = useState<Application[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [signingOut, setSigningOut] = useState(false);
  const [error, setError] = useState("");
  const [accessDenied, setAccessDenied] = useState(false);

  async function loadDashboard() {
    setLoading(true);
    setError("");
    setAccessDenied(false);

    try {
      const supabase = createSupabaseBrowserClient();

      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !user) {
        router.replace("/admin/login");
        return;
      }

      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("id, full_name, role")
        .eq("id", user.id)
        .maybeSingle();

      if (profileError) throw profileError;

      const adminProfile = profileData as AdminProfile | null;

      if (!adminProfile || adminProfile.role !== "admin") {
        await supabase.auth.signOut();
        router.replace("/admin/login?reason=access");
        return;
      }

      setProfile(adminProfile);

      const [
        applicationsCount,
        pendingApplicationsCount,
        propertiesCount,
        approvedPropertiesCount,
        partnersCount,
        bookingsCount,
        confirmedBookingsCount,
        applicationsResult,
        propertiesResult,
        partnersResult,
        bookingsResult,
      ] = await Promise.all([
        supabase
          .from("partner_applications")
          .select("id", { count: "exact", head: true }),

        supabase
          .from("partner_applications")
          .select("id", { count: "exact", head: true })
          .eq("status", "pending"),

        supabase
          .from("properties")
          .select("id", { count: "exact", head: true }),

        supabase
          .from("properties")
          .select("id", { count: "exact", head: true })
          .eq("status", "approved")
          .eq("is_active", true),

        supabase
          .from("property_partners")
          .select("id", { count: "exact", head: true }),

        supabase
          .from("bookings")
          .select("id", { count: "exact", head: true }),

        supabase
          .from("bookings")
          .select("id", { count: "exact", head: true })
          .eq("booking_status", "confirmed"),

        supabase
          .from("partner_applications")
          .select(
            "id, business_name, contact_person, location, property_type, status, created_at"
          )
          .order("created_at", { ascending: false })
          .limit(6),

        supabase
          .from("properties")
          .select(
            "id, name, city, county, sub_county, country, status, is_active, created_at"
          )
          .order("created_at", { ascending: false })
          .limit(6),

        supabase
          .from("property_partners")
          .select("id, business_name, status, created_at")
          .order("created_at", { ascending: false })
          .limit(5),

        supabase
          .from("bookings")
          .select(
            "id, booking_reference, guest_name, total_amount, currency, booking_status, payment_status, created_at"
          )
          .order("created_at", { ascending: false })
          .limit(6),
      ]);

      const results = [
        applicationsCount,
        pendingApplicationsCount,
        propertiesCount,
        approvedPropertiesCount,
        partnersCount,
        bookingsCount,
        confirmedBookingsCount,
        applicationsResult,
        propertiesResult,
        partnersResult,
        bookingsResult,
      ];

      const failedQuery = results.find((result) => result.error);

      if (failedQuery?.error) {
        throw failedQuery.error;
      }

      setStats({
        applications: applicationsCount.count || 0,
        pendingApplications: pendingApplicationsCount.count || 0,
        properties: propertiesCount.count || 0,
        approvedProperties: approvedPropertiesCount.count || 0,
        partners: partnersCount.count || 0,
        bookings: bookingsCount.count || 0,
        confirmedBookings: confirmedBookingsCount.count || 0,
      });

      setApplications((applicationsResult.data || []) as Application[]);
      setProperties((propertiesResult.data || []) as Property[]);
      setPartners((partnersResult.data || []) as Partner[]);
      setBookings((bookingsResult.data || []) as Booking[]);
    } catch (err) {
      console.error("Admin dashboard error:", err);

      setError(
        err instanceof Error
          ? err.message
          : "Unable to load the administrator dashboard."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDashboard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSignOut() {
    setSigningOut(true);

    try {
      const supabase = createSupabaseBrowserClient();
      await supabase.auth.signOut();
      router.replace("/login?next=%2Fadmin");
      router.refresh();
    } catch (err) {
      console.error("Admin sign-out error:", err);
      setError("Unable to sign out. Please try again.");
      setSigningOut(false);
    }
  }

  const statCards = [
    {
      label: "Partner applications",
      value: stats.applications,
      detail: `${stats.pendingApplications} awaiting review`,
      icon: ClipboardList,
      color: "text-orange-600 bg-orange-50",
      href: "#applications",
    },
    {
      label: "Properties",
      value: stats.properties,
      detail: `${stats.approvedProperties} approved and active`,
      icon: Building2,
      color: "text-blue-700 bg-blue-50",
      href: "#properties",
    },
    {
      label: "Accommodation partners",
      value: stats.partners,
      detail: "Registered partner accounts",
      icon: Users,
      color: "text-purple-700 bg-purple-50",
      href: "#partners",
    },
    {
      label: "Bookings",
      value: stats.bookings,
      detail: `${stats.confirmedBookings} confirmed`,
      icon: CalendarDays,
      color: "text-green-700 bg-green-50",
      href: "#bookings",
    },
  ];

  if (accessDenied) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 px-5">
        <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-red-50 text-red-600">
            <ShieldCheck size={30} />
          </div>

          <h1 className="mt-6 text-2xl font-black text-blue-950">
            Administrator access required
          </h1>

          <p className="mt-3 text-sm leading-6 text-slate-500">
            This account does not have permission to access the ZuriStay Worldwide
            administration dashboard.
          </p>

          <Link
            href="/"
            className="mt-7 inline-flex rounded-xl bg-blue-950 px-6 py-3 font-bold text-white hover:bg-blue-900"
          >
            Return to homepage
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-800">
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-64 flex-col bg-blue-950 text-white lg:flex">
        <div className="border-b border-white/10 px-6 py-7">
          <Link href="/" className="text-2xl font-black tracking-tight">
            Zuri<span className="text-orange-400">Stay</span>
          </Link>
          <p className="mt-2 text-xs font-semibold uppercase tracking-[0.2em] text-blue-200">
            Administration
          </p>
        </div>

        <nav className="flex-1 space-y-2 px-4 py-6">
          <a
            href="#overview"
            className="flex items-center gap-3 rounded-xl bg-white/10 px-4 py-3 text-sm font-bold"
          >
            <LayoutDashboard size={18} />
            Overview
          </a>

          <a
            href="#business-analytics"
            className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold text-blue-100 hover:bg-white/10"
          >
            <CreditCard size={18} />
            Business analytics
          </a>

          <a
            href="#applications"
            className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold text-blue-100 hover:bg-white/10"
          >
            <ClipboardList size={18} />
            Partner applications
          </a>

          <a
            href="#properties"
            className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold text-blue-100 hover:bg-white/10"
          >
            <Building2 size={18} />
            Properties
          </a>

          <a
            href="#partners"
            className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold text-blue-100 hover:bg-white/10"
          >
            <Users size={18} />
            Partners
          </a>

          <a
            href="#bookings"
            className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold text-blue-100 hover:bg-white/10"
          >
            <CalendarDays size={18} />
            Bookings
          </a>

          <Link
            href="/admin/disputes"
            className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold text-blue-100 hover:bg-white/10"
          >
            <AlertCircle size={18} />
            Arrival disputes
          </Link>

          <Link
            href="/admin/cancellations"
            className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold text-blue-100 hover:bg-white/10"
          >
            <ShieldCheck size={18} />
            Cancellations & refunds
          </Link>
        </nav>

        <div className="border-t border-white/10 p-5">
          <p className="truncate text-sm font-bold">
            {profile?.full_name || "Administrator"}
          </p>
          <p className="mt-1 text-xs text-blue-200">Super Administrator</p>
          <Link
            href="/"
            className="mt-4 inline-flex items-center gap-2 text-xs font-semibold text-blue-200 hover:text-white"
          >
            View public website
            <ExternalLink size={13} />
          </Link>
        </div>
      </aside>

      <div className="lg:pl-64">
        <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 backdrop-blur">
          <div className="flex flex-wrap items-center justify-between gap-4 px-5 py-4 sm:px-8">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-orange-600">
                ZURISTAY WORLDWIDE CONTROL CENTRE
              </p>
              <h1 className="mt-1 text-xl font-black text-blue-950">
                Super Admin Dashboard
              </h1>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={loadDashboard}
                disabled={loading}
                className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
              >
                <RefreshCw
                  size={16}
                  className={loading ? "animate-spin" : ""}
                />
                <span className="hidden sm:inline">Refresh</span>
              </button>

              <button
                onClick={handleSignOut}
                disabled={signingOut}
                className="flex items-center gap-2 rounded-xl bg-blue-950 px-3 py-2.5 text-sm font-bold text-white hover:bg-blue-900 disabled:opacity-50"
              >
                <LogOut size={16} />
                <span className="hidden sm:inline">
                  {signingOut ? "Signing out..." : "Sign out"}
                </span>
              </button>
            </div>
          </div>

          <div className="flex gap-2 overflow-x-auto px-5 pb-3 lg:hidden">
            {[
              ["Overview", "#overview"],
              ["Analytics", "#business-analytics"],
              ["Applications", "#applications"],
              ["Properties", "#properties"],
              ["Partners", "#partners"],
              ["Bookings", "#bookings"],
              ["Arrival disputes", "/admin/disputes"],
            ].map(([label, href]) => (
              <a
                key={href}
                href={href}
                className="shrink-0 rounded-full bg-slate-100 px-4 py-2 text-xs font-bold text-slate-600"
              >
                {label}
              </a>
            ))}
          </div>
        </header>

        <div className="mx-auto max-w-7xl px-5 py-8 sm:px-8">
          <section id="overview" className="scroll-mt-28">
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
              <div>
                <p className="text-sm font-semibold text-orange-600">
                  ADMINISTRATION OVERVIEW
                </p>
                <h2 className="mt-2 text-2xl font-black text-blue-950 sm:text-3xl">
                  Welcome, {profile?.full_name || "Administrator"}
                </h2>
                <p className="mt-2 text-sm text-slate-500">
                  Monitor ZuriStay Worldwide operations and manage the accommodation
                  marketplace.
                </p>
              </div>

              <div className="flex items-center gap-2 text-xs font-semibold text-green-700">
                <span className="h-2 w-2 rounded-full bg-green-500" />
                Administrator account verified
              </div>
            </div>

            {error && (
              <div
                role="alert"
                className="mt-6 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
              >
                <AlertCircle size={19} className="mt-0.5 shrink-0" />
                <div>
                  <p className="font-bold">Dashboard data could not be loaded</p>
                  <p className="mt-1">{error}</p>
                  <button
                    onClick={loadDashboard}
                    className="mt-2 font-bold underline"
                  >
                    Try again
                  </button>
                </div>
              </div>
            )}

            <div className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {statCards.map((card) => {
                const Icon = card.icon;

                return (
                  <a
                    key={card.label}
                    href={card.href}
                    className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                  >
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold text-slate-500">
                        {card.label}
                      </p>
                      <span
                        className={`flex h-11 w-11 items-center justify-center rounded-xl ${card.color}`}
                      >
                        <Icon size={21} />
                      </span>
                    </div>

                    <p className="mt-5 text-3xl font-black text-blue-950">
                      {loading ? "—" : card.value.toLocaleString("en-KE")}
                    </p>

                    <p className="mt-2 text-xs text-slate-500">
                      {card.detail}
                    </p>
                  </a>
                );
              })}
            </div>
          </section>

          <AdminAnalytics enabled={!!profile} />

          <section
            id="applications"
            className="mt-10 scroll-mt-28 rounded-2xl border border-slate-200 bg-white shadow-sm"
          >
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-5 sm:px-6">
              <div>
                <div className="flex items-center gap-2">
                  <ClipboardList className="text-orange-500" size={20} />
                  <h3 className="text-lg font-black text-blue-950">
                    Partner applications
                  </h3>
                </div>
                <p className="mt-1 text-sm text-slate-500">
                  Recent accommodation partner applications.
                </p>
              </div>

              <span className="rounded-full bg-orange-50 px-3 py-2 text-xs font-bold text-orange-700">
                {stats.pendingApplications} pending
              </span>
            </div>

            {loading ? (
              <div className="p-8 text-center text-sm text-slate-500">
                Loading applications...
              </div>
            ) : applications.length === 0 ? (
              <div className="p-9 text-center">
                <ClipboardList
                  size={30}
                  className="mx-auto text-slate-300"
                />
                <p className="mt-3 font-bold text-slate-700">
                  No partner applications found
                </p>
                <p className="mt-1 text-sm text-slate-500">
                  New applications will appear here when submitted.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {applications.map((application) => (
                  <div
                    key={application.id}
                    className="flex flex-col justify-between gap-3 px-5 py-4 sm:flex-row sm:items-center sm:px-6"
                  >
                    <div>
                      <p className="font-bold text-blue-950">
                        {application.business_name}
                      </p>
                      <p className="mt-1 text-sm text-slate-500">
                        {application.contact_person}
                        {application.property_type
                          ? ` · ${application.property_type}`
                          : ""}
                      </p>
                      <p className="mt-1 flex items-center gap-1 text-xs text-slate-400">
                        <MapPin size={13} />
                        {application.location}
                      </p>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="text-xs text-slate-400">
                        {formatDate(application.created_at)}
                      </span>
                      <span
                        className={`rounded-full px-3 py-1.5 text-xs font-bold ${statusClass(
                          application.status
                        )}`}
                      >
                        {application.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section
            id="properties"
            className="mt-8 scroll-mt-28 rounded-2xl border border-slate-200 bg-white shadow-sm"
          >
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-5 sm:px-6">
              <div>
                <div className="flex items-center gap-2">
                  <Building2 className="text-orange-500" size={20} />
                  <h3 className="text-lg font-black text-blue-950">
                    Accommodation properties
                  </h3>
                </div>
                <p className="mt-1 text-sm text-slate-500">
                  Recently added properties and their publication status.
                </p>
              </div>
              <Link
                href="/admin/properties"
                className="inline-flex items-center gap-2 rounded-xl bg-blue-950 px-4 py-2.5 text-sm font-bold text-white hover:bg-blue-900"
              >
                <Building2 size={16} />
                Manage property submissions
              </Link>
            </div>

            {loading ? (
              <div className="p-8 text-center text-sm text-slate-500">
                Loading properties...
              </div>
            ) : properties.length === 0 ? (
              <div className="p-9 text-center">
                <Building2 size={30} className="mx-auto text-slate-300" />
                <p className="mt-3 font-bold text-slate-700">
                  No property records yet
                </p>
                <p className="mt-1 text-sm text-slate-500">
                  Approved and pending properties will appear here.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {properties.map((property) => (
                  <div
                    key={property.id}
                    className="flex flex-col justify-between gap-3 px-5 py-4 sm:flex-row sm:items-center sm:px-6"
                  >
                    <div>
                      <p className="font-bold text-blue-950">
                        {property.name}
                      </p>
                      <p className="mt-1 text-sm text-slate-500">
                        {[property.city, property.sub_county, property.county, property.country].filter(Boolean).join(", ")}
                      </p>
                      <p className="mt-1 text-xs text-slate-400">
                        Added {formatDate(property.created_at)}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <span
                        className={`rounded-full px-3 py-1.5 text-xs font-bold ${statusClass(
                          property.status
                        )}`}
                      >
                        {property.status}
                      </span>
                      <span
                        className={`rounded-full px-3 py-1.5 text-xs font-bold ${
                          property.is_active
                            ? "bg-green-50 text-green-700"
                            : "bg-slate-100 text-slate-500"
                        }`}
                      >
                        {property.is_active ? "Active" : "Inactive"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section
            id="partners"
            className="mt-8 scroll-mt-28 rounded-2xl border border-slate-200 bg-white shadow-sm"
          >
            <div className="border-b border-slate-100 px-5 py-5 sm:px-6">
              <div className="flex items-center gap-2">
                <Users className="text-orange-500" size={20} />
                <h3 className="text-lg font-black text-blue-950">
                  Accommodation partners
                </h3>
              </div>
              <p className="mt-1 text-sm text-slate-500">
                Partner accounts registered on the platform.
              </p>
            </div>

            {loading ? (
              <div className="p-8 text-center text-sm text-slate-500">
                Loading partners...
              </div>
            ) : partners.length === 0 ? (
              <div className="p-9 text-center">
                <Users size={30} className="mx-auto text-slate-300" />
                <p className="mt-3 font-bold text-slate-700">
                  No partner accounts yet
                </p>
                <p className="mt-1 text-sm text-slate-500">
                  Approved partner accounts will appear here.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {partners.map((partner) => (
                  <div
                    key={partner.id}
                    className="flex flex-col justify-between gap-3 px-5 py-4 sm:flex-row sm:items-center sm:px-6"
                  >
                    <div>
                      <p className="font-bold text-blue-950">
                        {partner.business_name}
                      </p>
                      <p className="mt-1 text-xs text-slate-400">
                        Registered {formatDate(partner.created_at)}
                      </p>
                    </div>

                    <span
                      className={`w-fit rounded-full px-3 py-1.5 text-xs font-bold ${statusClass(
                        partner.status
                      )}`}
                    >
                      {partner.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section
            id="bookings"
            className="mt-8 scroll-mt-28 rounded-2xl border border-slate-200 bg-white shadow-sm"
          >
            <div className="border-b border-slate-100 px-5 py-5 sm:px-6">
              <div className="flex items-center gap-2">
                <CalendarDays className="text-orange-500" size={20} />
                <h3 className="text-lg font-black text-blue-950">
                  Recent bookings
                </h3>
              </div>
              <p className="mt-1 text-sm text-slate-500">
                Monitor guest reservations and payment statuses.
              </p>
            </div>

            {loading ? (
              <div className="p-8 text-center text-sm text-slate-500">
                Loading bookings...
              </div>
            ) : bookings.length === 0 ? (
              <div className="p-9 text-center">
                <CalendarDays size={30} className="mx-auto text-slate-300" />
                <p className="mt-3 font-bold text-slate-700">
                  No bookings recorded yet
                </p>
                <p className="mt-1 text-sm text-slate-500">
                  Guest reservations will appear here when created.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {bookings.map((booking) => (
                  <div
                    key={booking.id}
                    className="flex flex-col justify-between gap-3 px-5 py-4 sm:flex-row sm:items-center sm:px-6"
                  >
                    <div>
                      <p className="font-bold text-blue-950">
                        {booking.booking_reference}
                      </p>
                      <p className="mt-1 text-sm text-slate-500">
                        {booking.guest_name}
                      </p>
                      <p className="mt-1 text-xs text-slate-400">
                        {formatDate(booking.created_at)}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <span className="mr-1 text-sm font-bold text-blue-950">
                        {formatMoney(
                          Number(booking.total_amount),
                          booking.currency
                        )}
                      </span>
                      <span
                        className={`rounded-full px-3 py-1.5 text-xs font-bold ${statusClass(
                          booking.booking_status
                        )}`}
                      >
                        {booking.booking_status}
                      </span>
                      <span
                        className={`rounded-full px-3 py-1.5 text-xs font-bold ${statusClass(
                          booking.payment_status
                        )}`}
                      >
                        {booking.payment_status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="mt-8 grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-orange-50 text-orange-600">
                  <Clock3 size={21} />
                </span>
                <div>
                  <h3 className="font-bold text-blue-950">
                    Partner settlements
                  </h3>
                  <p className="mt-1 text-xs text-slate-500">
                    Settlements are scheduled after guest checkout.
                  </p>
                </div>
              </div>
              <p className="mt-4 text-sm leading-6 text-slate-500">
                Settlement management will be enabled after payment
                verification and reconciliation workflows are connected.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-green-50 text-green-700">
                  <CreditCard size={21} />
                </span>
                <div>
                  <h3 className="font-bold text-blue-950">
                    Payment operations
                  </h3>
                  <p className="mt-1 text-xs text-slate-500">
                    Payment provider integration is not yet enabled.
                  </p>
                </div>
              </div>
              <p className="mt-4 text-sm leading-6 text-slate-500">
                M-Pesa, Visa, Mastercard and PayPal transactions must be
                verified before bookings can be marked as paid.
              </p>
            </div>
          </section>

          <section className="mt-8 rounded-2xl border border-blue-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
              <div className="flex items-start gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-800">
                  <ShieldCheck size={21} />
                </span>
                <div>
                  <h3 className="font-bold text-blue-950">Second administrator approval</h3>
                  <p className="mt-1 text-sm text-slate-500">
                    Independent review of administrator personal-account dispute releases.
                  </p>
                  <p className="mt-2 text-xs font-semibold text-slate-600">robinsonbarasa44@yahoo.com</p>
                </div>
              </div>
              <Link
                href="/admin/disputes"
                className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-blue-950 px-5 py-3 text-sm font-bold text-white transition hover:bg-blue-900"
              >
                Open approval centre
                <ExternalLink size={15} />
              </Link>
            </div>
          </section>

          <footer className="mt-10 flex flex-col justify-between gap-3 border-t border-slate-200 py-6 text-xs text-slate-400 sm:flex-row">
            <p>
              © {new Date().getFullYear()} ZuriStay Worldwide. Your World. Your Stay.
            </p>
            <div className="flex items-center gap-2">
              <CheckCircle2 size={14} className="text-green-600" />
              Administrator session verified
            </div>
          </footer>
        </div>
      </div>
    </main>
  );
}
