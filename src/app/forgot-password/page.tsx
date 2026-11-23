"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { ArrowLeft, Mail, Send } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    setError("");

    try {
      const supabase = createSupabaseBrowserClient();
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(
        email.trim().toLowerCase(),
        { redirectTo: `${window.location.origin}/reset-password` }
      );

      if (resetError) throw resetError;

      setMessage(
        "If an account exists for that email address, a password reset link has been sent. Check your inbox and spam folder."
      );
    } catch (err) {
      console.error("Password reset request error:", err);
      setError(
        err instanceof Error
          ? err.message
          : "We could not send the reset email. Please try again."
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
              <Mail size={30} />
            </div>
            <p className="mt-6 text-xs font-bold tracking-[0.2em] text-[#c49a52]">
              ACCOUNT RECOVERY
            </p>
            <h1 className="mt-3 text-3xl font-bold">Forgot your password?</h1>
            <p className="mt-3 text-sm leading-6 text-gray-500">
              Enter the email address linked to your ZuriStay Worldwide account. We’ll send you a secure link to choose a new password.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="email" className="mb-2 block text-sm font-semibold">
                Email address *
              </label>
              <input
                id="email"
                type="email"
                required
                maxLength={254}
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
                className="w-full rounded-xl border border-gray-200 px-4 py-3.5 text-sm outline-none focus:border-[#c49a52] focus:ring-2 focus:ring-[#c49a52]/15"
              />
            </div>

            {error && (
              <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </p>
            )}
            {message && (
              <p role="status" className="rounded-xl bg-green-50 px-4 py-3 text-sm leading-6 text-green-800">
                {message}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-3 rounded-full bg-[#173b30] px-7 py-4 font-bold text-white transition hover:bg-[#245545] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? "Sending link..." : "Send reset link"}
              {!loading && <Send size={18} />}
            </button>
          </form>

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
