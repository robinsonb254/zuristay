
"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  RefreshCw,
  ClipboardList,
  MapPin,
  Mail,
  Phone,
  CalendarDays,
  CheckCircle2,
  XCircle,
  AlertCircle,
  ShieldCheck,
  Building2,
  Clock3,
} from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type Application = {
  id: string;
  business_name: string;
  contact_person: string;
  email: string;
  phone: string;
  property_type: string | null;
  location: string;
  message: string | null;
  has_conference_rooms: boolean;
  status: string;
  applicant_user_id: string | null;
  created_at: string;
};

type Filter = "all" | "pending" | "approved" | "rejected";
type AdminProfile = { role: string };

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
    default:
      return "bg-amber-50 text-amber-700";
  }
}

export default function AdminApplicationsPage() {
  const router = useRouter();

  const [applications, setApplications] = useState<Application[]>([]);
  const [filter, setFilter] = useState<Filter>("all");
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [accessDenied, setAccessDenied] = useState(false);

  const loadApplications = useCallback(async () => {
    setLoading(true);
    setError("");
    setSuccess("");
    setAccessDenied(false);

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

      const {
        data: profileData,
        error: profileError,
      } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();

      if (profileError) throw profileError;

      const profile = profileData as unknown as AdminProfile | null;

      if (!profile || profile.role !== "admin") {
        setAccessDenied(true);
        return;
      }

      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError || !session?.access_token) {
        router.replace("/login");
        return;
      }

      const response = await fetch(
        "/api/admin/applications/list",
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
          cache: "no-store",
        }
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(
          result.error || "Unable to retrieve applications."
        );
      }

      setApplications(result.applications || []);
    } catch (err) {
      console.error("Application management error:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load applications."
      );
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    loadApplications();
  }, [loadApplications]);

  async function reviewApplication(
    application: Application,
    action: "approve" | "reject"
  ) {
    const actionLabel = action === "approve" ? "approve" : "reject";

    const confirmed = window.confirm(
      `Are you sure you want to ${actionLabel} the application from ${application.business_name}?`
    );

    if (!confirmed) return;

    setProcessingId(application.id);
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

      const response = await fetch("/api/admin/applications", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          applicationId: application.id,
          action,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(
          result.message || "The application could not be processed."
        );
      }

      setSuccess(result.message);
      await loadApplications();
    } catch (err) {
      console.error("Application review error:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Unable to process this application."
      );
    } finally {
      setProcessingId("");
    }
  }

  const filteredApplications =
    filter === "all"
      ? applications
      : applications.filter(
          (application) => application.status === filter
        );

  const pendingCount = applications.filter(
    (application) => application.status === "pending"
  ).length;

  if (accessDenied) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 px-5">
        <div className="max-w-md rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <ShieldCheck size={36} className="mx-auto text-red-600" />
          <h1 className="mt-5 text-2xl font-black text-blue-950">
            Administrator access required
          </h1>
          <p className="mt-3 text-sm text-slate-500">
            Your account does not have permission to manage partner
            applications.
          </p>
          <Link
            href="/"
            className="mt-6 inline-flex rounded-xl bg-blue-950 px-5 py-3 font-bold text-white"
          >
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
            <Link
              href="/admin"
              className="text-sm font-semibold text-blue-200 hover:text-white"
            >
              <span className="inline-flex items-center gap-2">
                <ArrowLeft size={16} />
                Back to dashboard
              </span>
            </Link>
            <h1 className="mt-3 text-2xl font-black">
              Partner Application Management
            </h1>
            <p className="mt-1 text-sm text-blue-200">
              Review accommodation partner applications.
            </p>
          </div>

          <button
            onClick={loadApplications}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-xl bg-white/10 px-4 py-3 text-sm font-bold hover:bg-white/20 disabled:opacity-50"
          >
            <RefreshCw
              size={16}
              className={loading ? "animate-spin" : ""}
            />
            Refresh
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-5 py-8 sm:px-8">
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <ClipboardList className="text-blue-700" size={23} />
            <p className="mt-4 text-sm font-semibold text-slate-500">
              Applications loaded
            </p>
            <p className="mt-1 text-3xl font-black text-blue-950">
              {applications.length}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <Clock3 className="text-amber-600" size={23} />
            <p className="mt-4 text-sm font-semibold text-slate-500">
              Awaiting review
            </p>
            <p className="mt-1 text-3xl font-black text-blue-950">
              {pendingCount}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <CheckCircle2 className="text-green-600" size={23} />
            <p className="mt-4 text-sm font-semibold text-slate-500">
              Approved applications
            </p>
            <p className="mt-1 text-3xl font-black text-blue-950">
              {
                applications.filter(
                  (application) => application.status === "approved"
                ).length
              }
            </p>
          </div>
        </div>

        {error && (
          <div
            role="alert"
            className="mt-6 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
          >
            <AlertCircle size={19} className="mt-0.5 shrink-0" />
            <p>{error}</p>
          </div>
        )}

        {success && (
          <div
            role="status"
            className="mt-6 flex items-start gap-3 rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-700"
          >
            <CheckCircle2 size={19} className="mt-0.5 shrink-0" />
            <p>{success}</p>
          </div>
        )}

        <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-black text-blue-950">
                Application records
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Open each application to inspect its details before making a decision.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              {(["all", "pending", "approved", "rejected"] as Filter[]).map(
                (value) => (
                  <button
                    key={value}
                    onClick={() => setFilter(value)}
                    className={`rounded-full px-4 py-2 text-xs font-bold capitalize ${
                      filter === value
                        ? "bg-blue-950 text-white"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    {value}
                  </button>
                )
              )}
            </div>
          </div>

          {loading ? (
            <div className="py-16 text-center text-sm text-slate-500">
              Loading application records...
            </div>
          ) : filteredApplications.length === 0 ? (
            <div className="py-16 text-center">
              <ClipboardList
                size={36}
                className="mx-auto text-slate-300"
              />
              <p className="mt-4 font-bold text-slate-700">
                No applications in this category
              </p>
              <p className="mt-1 text-sm text-slate-500">
                Applications will appear here when submitted.
              </p>
            </div>
          ) : (
            <div className="mt-6 space-y-4">
              {filteredApplications.map((application) => (
                <article
                  key={application.id}
                  className="rounded-2xl border border-slate-200 p-5"
                >
                  <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Building2
                          size={19}
                          className="text-orange-500"
                        />
                        <h3 className="text-lg font-black text-blue-950">
                          {application.business_name}
                        </h3>
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-bold capitalize ${statusStyle(
                            application.status
                          )}`}
                        >
                          {application.status}
                        </span>
                      </div>

                      <p className="mt-2 text-sm text-slate-600">
                        {application.contact_person}
                        {application.property_type
                          ? ` · ${application.property_type}`
                          : ""}
                      </p>

                      <p className="mt-2 flex items-center gap-2 text-xs text-slate-500">
                        <MapPin size={14} />
                        {application.location}
                      </p>

                      <p className="mt-2 flex items-center gap-2 text-xs text-slate-400">
                        <CalendarDays size={14} />
                        Submitted {formatDate(application.created_at)}
                      </p>
                    </div>

                    {application.status === "pending" && (
                      <div className="flex flex-wrap gap-2">
                        <button
                          onClick={() =>
                            reviewApplication(application, "approve")
                          }
                          disabled={processingId === application.id}
                          className="inline-flex items-center gap-2 rounded-xl bg-green-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-green-700 disabled:opacity-50"
                        >
                          <CheckCircle2 size={16} />
                          {processingId === application.id
                            ? "Processing..."
                            : "Approve"}
                        </button>

                        <button
                          onClick={() =>
                            reviewApplication(application, "reject")
                          }
                          disabled={processingId === application.id}
                          className="inline-flex items-center gap-2 rounded-xl bg-red-50 px-4 py-2.5 text-sm font-bold text-red-700 hover:bg-red-100 disabled:opacity-50"
                        >
                          <XCircle size={16} />
                          Reject
                        </button>
                      </div>
                    )}
                  </div>

                  <details className="mt-5 border-t border-slate-100 pt-4">
                    <summary className="cursor-pointer text-sm font-bold text-blue-800 hover:text-orange-600">
                      View full application details
                    </summary>

                    <div className="mt-4 grid gap-4 sm:grid-cols-2">
                      <div>
                        <p className="text-xs font-semibold uppercase text-slate-400">
                          Contact email
                        </p>
                        <p className="mt-1 flex items-center gap-2 break-all text-sm font-semibold text-slate-700">
                          <Mail size={15} />
                          {application.email}
                        </p>
                      </div>

                      <div>
                        <p className="text-xs font-semibold uppercase text-slate-400">
                          Phone number
                        </p>
                        <p className="mt-1 flex items-center gap-2 text-sm font-semibold text-slate-700">
                          <Phone size={15} />
                          {application.phone}
                        </p>
                      </div>

                      <div>
                        <p className="text-xs font-semibold uppercase text-slate-400">
                          Property type
                        </p>
                        <p className="mt-1 text-sm text-slate-700">
                          {application.property_type || "Not specified"}
                        </p>
                      </div>

                      <div>
                        <p className="text-xs font-semibold uppercase text-slate-400">Conference rooms</p>
                        <p className="mt-1 text-sm font-semibold text-slate-700">{application.has_conference_rooms ? "Available at this property" : "Not available"}</p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold uppercase text-slate-400">
                          Registered applicant account
                        </p>
                        <p className="mt-1 break-all text-sm text-slate-700">
                          {application.applicant_user_id
                            ? "Linked to a registered account"
                            : "Not linked yet"}
                        </p>
                      </div>
                    </div>

                    <div className="mt-4">
                      <p className="text-xs font-semibold uppercase text-slate-400">
                        Applicant message
                      </p>
                      <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-slate-600">
                        {application.message || "No additional message provided."}
                      </p>
                    </div>

                    <p className="mt-4 break-all text-xs text-slate-400">
                      Application ID: {application.id}
                    </p>
                  </details>
                </article>
              ))}
            </div>
          )}
        </section>

        <div className="mt-6 rounded-2xl border border-blue-100 bg-blue-50 p-5">
          <div className="flex items-start gap-3">
            <ShieldCheck
              size={21}
              className="mt-0.5 shrink-0 text-blue-700"
            />
            <div>
              <h3 className="font-bold text-blue-950">
                Approval and property publication are separate
              </h3>
              <p className="mt-1 text-sm leading-6 text-blue-900/75">
                Approving an application creates a partner account linked to
                the applicant&apos;s verified ZuriStay login. It does not create,
                approve or publish a property listing. Property details,
                ownership and accommodation information must be reviewed
                separately.
              </p>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
