"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { ArrowLeft, LockKeyhole, CheckCircle2 } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export default function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [partnerActivation, setPartnerActivation] = useState(false);
  const [confirmPassword, setConfirmPassword] = useState("");
  const [recoveryReady, setRecoveryReady] = useState(false);
  const [checkingLink, setCheckingLink] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    setPartnerActivation(new URLSearchParams(window.location.search).get("partner") === "activation");
    const supabase = createSupabaseBrowserClient();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" && session) {
        setRecoveryReady(true);
        setCheckingLink(false);
      }
    });

    supabase.auth.getSession().then(({ data, error: sessionError }) => {
      if (sessionError) {
        setError("This password reset link could not be verified. Request a new link.");
      }
      setRecoveryReady(Boolean(data.session));
      setCheckingLink(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (password.length < 8) {
      setError("Choose a password with at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("The passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;

      setPassword("");
      setConfirmPassword("");

      if (partnerActivation) {
        window.location.assign("/partner/dashboard");
        return;
      }

      await supabase.auth.signOut();
      setSuccess("Your password has been updated. You can now sign in with your new password.");
    } catch (err) {
      console.error("Password update error:", err);
      setError(
        err instanceof Error
          ? err.message
          : "We could not update your password. Request a new reset link and try again."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#faf9f6] text-[#173b30]">
      <header className="border-b border-gray-100 bg-white">
        <div className="container flex h-20 items-center justify-between">
          <Link href="/" className="text-3xl font-bold tracking-tight">
            Zuri<span className="text-[#c49a52]">Stay</span>
          </Link>
          <Link href="/login" className="text-sm font-semibold text-gray-600 hover:text-[#c49a52]">
            Sign in
          </Link>
        </div>
      </header>

      <section className="container flex justify-center px-4 py-12 md:py-20">
        <div className="w-full max-w-xl rounded-3xl border border-gray-100 bg-white p-7 shadow-sm md:p-10">
          <div className="mb-8 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-[#f1eadc] text-[#a77e3e]">
              <LockKeyhole size={30} />
            </div>
            <p className="mt-6 text-xs font-bold tracking-[0.2em] text-[#c49a52]">
              {partnerActivation ? "PARTNER ACCOUNT ACTIVATION" : "SECURE ACCOUNT ACCESS"}
            </p>
            <h1 className="mt-3 text-3xl font-bold">{partnerActivation ? "Activate your partner account" : "Create a new password"}</h1>
            <p className="mt-3 text-sm leading-6 text-gray-500">
              {partnerActivation
                ? "Your ZuriStay Worldwide partner application has been approved. Set your personal password to activate your account and access the Partner Dashboard."
                : "Choose a new password for your ZuriStay Worldwide account."}
            </p>
          </div>

          {checkingLink ? (
            <p className="py-5 text-center text-sm text-gray-500">Verifying your reset link...</p>
          ) : success ? (
            <div className="space-y-5">
              <p role="status" className="flex items-start gap-2 rounded-xl bg-green-50 px-4 py-3 text-sm leading-6 text-green-800">
                <CheckCircle2 className="mt-0.5 shrink-0" size={18} />
                {success}
              </p>
              <Link href="/login" className="flex w-full items-center justify-center rounded-full bg-[#173b30] px-7 py-4 font-bold text-white transition hover:bg-[#245545]">
                Continue to sign in
              </Link>
            </div>
          ) : !recoveryReady ? (
            <div className="space-y-5">
              <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm leading-6 text-red-700">
                {error || "This reset link is invalid or has expired. Request a new password reset link to continue."}
              </p>
              <Link href="/forgot-password" className="flex w-full items-center justify-center rounded-full bg-[#173b30] px-7 py-4 font-bold text-white transition hover:bg-[#245545]">
                Request a new reset link
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label htmlFor="password" className="mb-2 block text-sm font-semibold">
                  New password *
                </label>
                <input
                  id="password"
                  type="password"
                  required
                  minLength={8}
                  autoComplete="new-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="At least 8 characters"
                  className="w-full rounded-xl border border-gray-200 px-4 py-3.5 text-sm outline-none focus:border-[#c49a52] focus:ring-2 focus:ring-[#c49a52]/15"
                />
              </div>

              <div>
                <label htmlFor="confirmPassword" className="mb-2 block text-sm font-semibold">
                  Confirm new password *
                </label>
                <input
                  id="confirmPassword"
                  type="password"
                  required
                  minLength={8}
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  placeholder="Enter the new password again"
                  className="w-full rounded-xl border border-gray-200 px-4 py-3.5 text-sm outline-none focus:border-[#c49a52] focus:ring-2 focus:ring-[#c49a52]/15"
                />
              </div>

              {error && (
                <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="flex w-full items-center justify-center gap-3 rounded-full bg-[#173b30] px-7 py-4 font-bold text-white transition hover:bg-[#245545] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? "Saving password..." : partnerActivation ? "Create account & open dashboard" : "Update password"}
              </button>
            </form>
          )}

          <div className="mt-8 border-t border-gray-100 pt-6 text-center">
            <Link href="/login" className="inline-flex items-center gap-2 text-sm font-bold text-[#a77e3e] hover:underline">
              <ArrowLeft size={16} /> Back to sign in
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
