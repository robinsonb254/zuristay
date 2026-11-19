
"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Building2,
  Plus,
  RefreshCw,
  LogOut,
  MapPin,
  CalendarDays,
  ShieldCheck,
  AlertCircle,
  Hotel,
} from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type Property = {
  id: string;
  name: string;
  property_type: string;
  city: string;
  county: string | null;
  country: string;
  status: string;
  is_active: boolean;
  created_at: string;
};

type Partner = {
  business_name: string;
  contact_person: string;
  email: string;
  phone: string | null;
  status: string;
};

function statusStyle(status: string) {
  switch (status) {
    case "approved":
      return "bg-green-100 text-green-800";
    case "pending":
      return "bg-amber-100 text-amber-800";
    case "rejected":
      return "bg-red-100 text-red-800";
    case "suspended":
      return "bg-gray-200 text-gray-700";
    default:
      return "bg-gray-100 text-gray-700";
  }
}

export default function PartnerDashboardPage() {
  const router = useRouter();
  const [partner, setPartner] = useState<Partner | null>(null);
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [signingOut, setSigningOut] = useState(false);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const supabase = createSupabaseBrowserClient();
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError || !session) {
        router.replace("/login?next=%2Fpartner%2Fdashboard");
        return;
      }

      const response = await fetch("/api/partner/properties", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
        cache: "no-store",
      });

      const result = await response.json();

      if (response.status === 401) {
        router.replace("/login?next=%2Fpartner%2Fdashboard");
        return;
      }

      if (!response.ok || !result.success) {
        throw new Error(
          result.error || "Unable to load your partner dashboard."
        );
      }

      setPartner(result.partner);
      setProperties(result.properties || []);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  async function handleSignOut() {
    setSigningOut(true);

    try {
      const supabase = createSupabaseBrowserClient();
      await supabase.auth.signOut();
      router.replace("/login?next=%2Fpartner%2Fdashboard");
      router.refresh();
    } catch {
      setError("Unable to sign out. Please try again.");
      setSigningOut(false);
    }
  }

  const approvedCount = properties.filter(
    (property) => property.status === "approved" && property.is_active
  ).length;

  const pendingCount = properties.filter(
    (property) => property.status === "pending"
  ).length;

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin text-blue-700 mx-auto mb-3" />
          <p className="text-slate-600">Loading your partner dashboard...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-5 py-4 flex items-center justify-between gap-4">
          <Link href="/" className="text-2xl font-bold tracking-tight text-blue-900">
            ZuriStay<span className="text-amber-500">.</span>
          </Link>

          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="hidden sm:inline text-sm text-slate-600 hover:text-blue-800"
            >
              Visit website
            </Link>
            <button
              onClick={handleSignOut}
              disabled={signingOut}
              className="flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              <LogOut size={16} />
              {signingOut ? "Signing out..." : "Sign out"}
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-5 py-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-5 mb-8">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wider text-blue-700">
              Partner portal
            </p>
            <h1 className="text-3xl font-bold text-slate-900 mt-2">
              Welcome{partner?.contact_person ? `, ${partner.contact_person}` : ""}
            </h1>
            <p className="text-slate-600 mt-2">
              Manage your accommodation listings and property information.
            </p>
          </div>

          <Link
            href="/partner/properties/new"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-900 px-5 py-3 font-semibold text-white hover:bg-blue-800"
          >
            <Plus size={19} />
            Add a property
          </Link>
        </div>

        {error && (
          <div className="mb-6 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-red-800">
            <AlertCircle className="mt-0.5 shrink-0" size={20} />
            <div>
              <p className="font-semibold">Unable to load dashboard</p>
              <p className="text-sm mt-1">{error}</p>
              <button
                onClick={loadDashboard}
                className="mt-3 text-sm font-semibold underline"
              >
                Try again
              </button>
            </div>
          </div>
        )}

        {partner && (
          <section className="mb-7 rounded-2xl border border-blue-100 bg-white p-5 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-blue-50 flex items-center justify-center text-blue-900">
                <Building2 size={25} />
              </div>
              <div className="flex-1">
                <h2 className="text-lg font-bold text-slate-900">
                  {partner.business_name}
                </h2>
                <p className="text-sm text-slate-500 mt-1">
                  {partner.email}
                  {partner.phone ? ` · ${partner.phone}` : ""}
                </p>
              </div>
              <span className="inline-flex items-center gap-2 rounded-full bg-green-100 px-3 py-1.5 text-sm font-semibold text-green-800">
                <ShieldCheck size={16} />
                Partner approved
              </span>
            </div>
          </section>
        )}

        <section className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <div className="rounded-2xl bg-white border border-slate-200 p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-sm text-slate-500">My properties</p>
              <Building2 className="text-blue-700" size={21} />
            </div>
            <p className="text-3xl font-bold text-slate-900 mt-3">
              {properties.length}
            </p>
            <p className="text-xs text-slate-500 mt-1">Total submitted listings</p>
          </div>

          <div className="rounded-2xl bg-white border border-slate-200 p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-sm text-slate-500">Published</p>
              <ShieldCheck className="text-green-700" size={21} />
            </div>
            <p className="text-3xl font-bold text-slate-900 mt-3">
              {approvedCount}
            </p>
            <p className="text-xs text-slate-500 mt-1">Approved and active</p>
          </div>

          <div className="rounded-2xl bg-white border border-slate-200 p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-sm text-slate-500">Awaiting review</p>
              <CalendarDays className="text-amber-600" size={21} />
            </div>
            <p className="text-3xl font-bold text-slate-900 mt-3">
              {pendingCount}
            </p>
            <p className="text-xs text-slate-500 mt-1">Pending approval</p>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-200 p-5">
            <div>
              <h2 className="text-xl font-bold text-slate-900">
                My property listings
              </h2>
              <p className="text-sm text-slate-500 mt-1">
                Properties submitted under your partner account.
              </p>
            </div>
            <button
              onClick={loadDashboard}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              <RefreshCw size={15} />
              Refresh
            </button>
          </div>

          {properties.length === 0 ? (
            <div className="px-6 py-14 text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-50 text-blue-800">
                <Hotel size={30} />
              </div>
              <h3 className="text-lg font-bold text-slate-900">
                No properties added yet
              </h3>
              <p className="max-w-md mx-auto text-sm text-slate-500 mt-2">
                Add your hotel, apartment, villa, lodge or other accommodation
                to start the ZuriStay listing review process.
              </p>
              <Link
                href="/partner/properties/new"
                className="inline-flex items-center gap-2 mt-6 rounded-xl bg-blue-900 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-800"
              >
                <Plus size={17} />
                Add your first property
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {properties.map((property) => (
                <article
                  key={property.id}
                  className="p-5 flex flex-col md:flex-row md:items-center gap-4"
                >
                  <div className="h-12 w-12 shrink-0 rounded-xl bg-slate-100 flex items-center justify-center text-slate-600">
                    <Building2 size={23} />
                  </div>

                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-slate-900">
                      {property.name}
                    </h3>
                    <p className="text-sm text-slate-500 capitalize mt-1">
                      {property.property_type.replaceAll("_", " ")}
                    </p>
                    <p className="text-sm text-slate-500 flex items-center gap-1 mt-1">
                      <MapPin size={14} />
                      {[property.city, property.county, property.country]
                        .filter(Boolean)
                        .join(", ")}
                    </p>
                    <p className="text-xs text-slate-400 mt-2">
                      Submitted{" "}
                      {new Date(property.created_at).toLocaleDateString()}
                    </p>
                  </div>

                  <div className="flex items-center gap-3">
                    <span
                      className={`rounded-full px-3 py-1.5 text-xs font-semibold capitalize ${statusStyle(
                        property.status
                      )}`}
                    >
                      {property.status}
                    </span>
                    {property.is_active && (
                      <span className="text-xs font-semibold text-green-700">
                        Live
                      </span>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        <p className="text-center text-xs text-slate-400 mt-8">
          ZuriStay Partner Portal · Your World. Your Stay.
        </p>
      </div>
    </main>
  );
}
