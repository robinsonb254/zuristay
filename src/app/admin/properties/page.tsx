"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  RefreshCw,
  Building2,
  MapPin,
  Mail,
  Phone,
  CalendarDays,
  CheckCircle2,
  XCircle,
  AlertCircle,
  ShieldCheck,
  Clock3,
} from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type Partner = {
  business_name: string;
  contact_person: string | null;
  email: string | null;
  phone: string | null;
};

type Property = {
  id: string;
  name: string;
  property_type: string;
  description: string | null;
  address: string | null;
  city: string;
  county: string | null;
  sub_county: string | null;
  country: string;
  currency: string;
  contact_phone: string | null;
  contact_email: string | null;
  status: string;
  is_active: boolean;
  publication_status: string;
  publication_submitted_at?: string | null;
  is_archived?: boolean;
  created_at: string;
  partner: Partner | Partner[] | null;
};

type Filter = "all" | "pending" | "approved" | "rejected" | "suspended";

function formatDate(value: string) {
  return new Date(value).toLocaleString("en-KE", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function statusStyle(status: string) {
  switch (status.toLowerCase()) {
    case "approved":
      return "bg-green-50 text-green-700";
    case "rejected":
      return "bg-red-50 text-red-700";
    case "suspended":
      return "bg-slate-100 text-slate-600";
    default:
      return "bg-amber-50 text-amber-700";
  }
}

function partnerDetails(value: Property["partner"]): Partner | null {
  if (Array.isArray(value)) return value[0] || null;
  return value;
}

export default function AdminPropertiesPage() {
  const router = useRouter();
  const [properties, setProperties] = useState<Property[]>([]);
  const [filter, setFilter] = useState<Filter>("all");
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [accessDenied, setAccessDenied] = useState(false);

  const loadProperties = useCallback(async () => {
    setLoading(true);
    setError("");
    setSuccess("");
    setAccessDenied(false);

    try {
      const supabase = createSupabaseBrowserClient();
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError || !session?.access_token) {
        router.replace("/login?next=%2Fadmin%2Fproperties");
        return;
      }

      const response = await fetch("/api/admin/properties", {
        method: "GET",
        headers: { Authorization: `Bearer ${session.access_token}` },
        cache: "no-store",
      });
      const result = await response.json();

      if (response.status === 401) {
        router.replace("/login?next=%2Fadmin%2Fproperties");
        return;
      }
      if (response.status === 403) {
        setAccessDenied(true);
        return;
      }
      if (!response.ok || !result.success) {
        throw new Error(result.error || "Unable to retrieve properties.");
      }

      setProperties(result.properties || []);
    } catch (err) {
      console.error("Admin property management error:", err);
      setError(err instanceof Error ? err.message : "Unable to load property submissions.");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    loadProperties();
  }, [loadProperties]);

  async function archiveProperty(property: Property) {
    if (!window.confirm(`Archive "${property.name}"? It will disappear from guest search. Booking and payment history will be retained.`)) return;
    setProcessingId(property.id); setError(""); setSuccess("");
    try {
      const supabase = createSupabaseBrowserClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Your session has expired. Please sign in again.");
      const response = await fetch("/api/admin/properties", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` }, body: JSON.stringify({ propertyId: property.id, action: "archive" }) });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || "Unable to archive property.");
      setSuccess(result.message); await loadProperties();
    } catch (err) { setError(err instanceof Error ? err.message : "Unable to archive this property."); }
    finally { setProcessingId(""); }
  }

  async function reviewProperty(property: Property, action: "approve" | "reject" | "publish_approve" | "publish_reject") {
    const actionLabels = { approve: "approve", reject: "reject", publish_approve: "give final publication approval to", publish_reject: "return for changes" };
    const actionLabel = actionLabels[action];
    const confirmed = window.confirm(
      `Are you sure you want to ${actionLabel} "${property.name}"?`
    );
    if (!confirmed) return;

    setProcessingId(property.id);
    setError("");
    setSuccess("");

    try {
      const supabase = createSupabaseBrowserClient();
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError || !session?.access_token) {
        throw new Error("Your session has expired. Please sign in again.");
      }

      const response = await fetch("/api/admin/properties", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ propertyId: property.id, action }),
      });
      const result = await response.json();

      if (response.status === 401) {
        router.replace("/login?next=%2Fadmin%2Fproperties");
        return;
      }
      if (!response.ok || !result.success) {
        throw new Error(result.error || "The property could not be reviewed.");
      }

      const reviewNotice = [result.message, result.emailNotice].filter(Boolean).join(" ");
      await loadProperties();
      setSuccess(reviewNotice);
    } catch (err) {
      console.error("Property review action failed:", err);
      setError(err instanceof Error ? err.message : "Unable to review this property.");
    } finally {
      setProcessingId("");
    }
  }

  const visibleProperties =
    filter === "all"
      ? properties
      : properties.filter((property) => property.status === filter);
  const pendingCount = properties.filter((property) => property.status === "pending").length;
  const approvedCount = properties.filter((property) => property.status === "approved").length;

  if (accessDenied) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 px-5">
        <div className="max-w-md rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <ShieldCheck size={36} className="mx-auto text-red-600" />
          <h1 className="mt-5 text-2xl font-black text-blue-950">Administrator access required</h1>
          <p className="mt-3 text-sm text-slate-500">
            Your account does not have permission to manage property listings.
          </p>
          <Link href="/" className="mt-6 inline-flex rounded-xl bg-blue-950 px-5 py-3 font-bold text-white">
            Return home
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-800">
      <header className="border-b border-slate-200 bg-blue-950 text-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-5 py-6 sm:px-8">
          <div>
            <Link href="/admin" className="inline-flex items-center gap-2 text-sm font-semibold text-blue-200 hover:text-white">
              <ArrowLeft size={16} /> Back to dashboard
            </Link>
            <h1 className="mt-3 text-2xl font-black">Property Management</h1>
            <p className="mt-1 text-sm text-blue-200">Review partner property submissions before publication.</p>
          </div>
          <button
            onClick={loadProperties}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-xl bg-white/10 px-4 py-3 text-sm font-bold hover:bg-white/20 disabled:opacity-50"
          >
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} /> Refresh
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-5 py-8 sm:px-8">
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <Building2 className="text-blue-700" size={23} />
            <p className="mt-4 text-sm font-semibold text-slate-500">Total submissions</p>
            <p className="mt-1 text-3xl font-black text-blue-950">{properties.length}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <Clock3 className="text-amber-600" size={23} />
            <p className="mt-4 text-sm font-semibold text-slate-500">Awaiting review</p>
            <p className="mt-1 text-3xl font-black text-blue-950">{pendingCount}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <CheckCircle2 className="text-green-600" size={23} />
            <p className="mt-4 text-sm font-semibold text-slate-500">Approved (not necessarily live)</p>
            <p className="mt-1 text-3xl font-black text-blue-950">{approvedCount}</p>
          </div>
        </div>

        {error && (
          <div role="alert" className="mt-6 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            <AlertCircle size={19} className="mt-0.5 shrink-0" />
            <p>{error}</p>
          </div>
        )}
        {success && (
          <div role="status" className="mt-6 flex items-start gap-3 rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-700">
            <CheckCircle2 size={19} className="mt-0.5 shrink-0" />
            <p>{success}</p>
          </div>
        )}

        <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-black text-blue-950">Property submissions</h2>
              <p className="mt-1 text-sm text-slate-500">Inspect the partner, location and listing details before approving.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {(["all", "pending", "approved", "rejected", "suspended"] as Filter[]).map((value) => (
                <button
                  key={value}
                  onClick={() => setFilter(value)}
                  className={`rounded-full px-4 py-2 text-xs font-bold capitalize ${filter === value ? "bg-blue-950 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
                >
                  {value}
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <div className="py-16 text-center text-sm text-slate-500">Loading property submissions...</div>
          ) : visibleProperties.length === 0 ? (
            <div className="py-16 text-center">
              <Building2 size={36} className="mx-auto text-slate-300" />
              <p className="mt-4 font-bold text-slate-700">No properties in this category</p>
              <p className="mt-1 text-sm text-slate-500">New partner submissions will appear here.</p>
            </div>
          ) : (
            <div className="mt-6 space-y-4">
              {visibleProperties.map((property) => {
                const partner = partnerDetails(property.partner);
                return (
                  <article key={property.id} className="rounded-2xl border border-slate-200 p-5">
                    <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <Building2 size={19} className="text-orange-500" />
                          <h3 className="text-lg font-black text-blue-950">{property.name}</h3>
                          <span className={`rounded-full px-3 py-1 text-xs font-bold capitalize ${statusStyle(property.status)}`}>
                            {property.status}
                          </span>
                          {property.status === "approved" && <span className={`rounded-full px-3 py-1 text-xs font-bold capitalize ${property.publication_status === "pending_review" ? "bg-amber-100 text-amber-800" : property.publication_status === "published" ? "bg-green-100 text-green-800" : "bg-slate-100 text-slate-600"}`}>{property.publication_status.replaceAll("_", " ")}</span>}
                          {property.is_archived ? <span className="rounded-full bg-slate-200 px-3 py-1 text-xs font-bold text-slate-700">Archived</span> : property.is_active && <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-bold text-green-800">Live</span>}
                        </div>
                        <p className="mt-2 text-sm capitalize text-slate-600">{property.property_type.replaceAll("_", " ")}</p>
                        <p className="mt-2 flex items-center gap-2 text-xs text-slate-500">
                          <MapPin size={14} /> {[property.address, property.city, property.sub_county, property.county, property.country].filter(Boolean).join(", ")}
                        </p>
                        <p className="mt-2 flex items-center gap-2 text-xs text-slate-400">
                          <CalendarDays size={14} /> Submitted {formatDate(property.created_at)}
                        </p>
                        <div className="mt-4 rounded-xl bg-slate-50 p-4">
                          <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Submitting partner</p>
                          <p className="mt-1 font-bold text-slate-800">{partner?.business_name || "Partner record unavailable"}</p>
                          {partner?.contact_person && <p className="mt-1 text-sm text-slate-600">{partner.contact_person}</p>}
                          <div className="mt-2 flex flex-wrap gap-x-5 gap-y-2 text-xs text-slate-500">
                            {partner?.email && <span className="inline-flex items-center gap-1"><Mail size={13} />{partner.email}</span>}
                            {partner?.phone && <span className="inline-flex items-center gap-1"><Phone size={13} />{partner.phone}</span>}
                          </div>
                        </div>
                        <details className="mt-4 border-t border-slate-100 pt-4">
                          <summary className="cursor-pointer text-sm font-bold text-blue-800 hover:text-orange-600">View full property details</summary>
                          <div className="mt-3 grid gap-3 sm:grid-cols-2">
                            <div>
                              <p className="text-xs font-semibold uppercase text-slate-400">Description</p>
                              <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-slate-600">{property.description || "No description provided."}</p>
                            </div>
                            <div>
                              <p className="text-xs font-semibold uppercase text-slate-400">Property contact</p>
                              <p className="mt-1 break-all text-sm text-slate-600">{property.contact_email || "No email"} · {property.contact_phone || "No phone"}</p>
                              <p className="mt-3 text-xs font-semibold uppercase text-slate-400">Currency</p>
                              <p className="mt-1 text-sm text-slate-600">{property.currency}</p>
                            </div>
                          </div>
                          <p className="mt-3 break-all text-xs text-slate-400">Property ID: {property.id}</p>
                        </details>
                      </div>
                      <div className="flex shrink-0 flex-wrap gap-2">
                      {property.status === "pending" && (
                        <>
                          <button
                            onClick={() => reviewProperty(property, "approve")}
                            disabled={processingId === property.id}
                            className="inline-flex items-center gap-2 rounded-xl bg-green-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-green-700 disabled:opacity-50"
                          >
                            <CheckCircle2 size={16} /> {processingId === property.id ? "Processing..." : "Approve"}
                          </button>
                          <button
                            onClick={() => reviewProperty(property, "reject")}
                            disabled={processingId === property.id}
                            className="inline-flex items-center gap-2 rounded-xl bg-red-50 px-4 py-2.5 text-sm font-bold text-red-700 hover:bg-red-100 disabled:opacity-50"
                          >
                            <XCircle size={16} /> Reject
                          </button>
                        </>
                      )}
                      {property.status === "approved" && property.publication_status === "pending_review" && (
                        <>
                          <button
                            onClick={() => reviewProperty(property, "publish_approve")}
                            disabled={processingId === property.id}
                            className="inline-flex items-center gap-2 rounded-xl bg-green-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-green-700 disabled:opacity-50"
                          >
                            <CheckCircle2 size={16} /> {processingId === property.id ? "Processing..." : "Approve & publish"}
                          </button>
                          <button
                            onClick={() => reviewProperty(property, "publish_reject")}
                            disabled={processingId === property.id}
                            className="inline-flex items-center gap-2 rounded-xl bg-amber-50 px-4 py-2.5 text-sm font-bold text-amber-800 hover:bg-amber-100 disabled:opacity-50"
                          >
                            <XCircle size={16} /> Request changes
                          </button>
                        </>
                      )}
                      {!property.is_archived && (
                        <button onClick={() => archiveProperty(property)} disabled={processingId === property.id} className="inline-flex items-center rounded-xl border border-red-200 px-4 py-2.5 text-sm font-bold text-red-700 hover:bg-red-50 disabled:opacity-50">
                          {processingId === property.id ? "Processing..." : "Archive property"}
                        </button>
                      )}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        <div className="mt-6 rounded-2xl border border-blue-100 bg-blue-50 p-5">
          <div className="flex items-start gap-3">
            <ShieldCheck size={21} className="mt-0.5 shrink-0 text-blue-700" />
            <div>
              <h3 className="font-bold text-blue-950">Final publication requires a second review</h3>
              <p className="mt-1 text-sm leading-6 text-blue-900/75">
                Approved listings remain inactive until room types, prices, photos and availability are configured. This prevents incomplete properties from appearing as bookable stays. We will build the partner inventory tools and a separate publishing control next.
              </p>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
