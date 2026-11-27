
"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
  UserPlus,
} from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export default function RegisterPage() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const isPartnerFlow = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("mode") === "partner";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (password.length < 8) {
      setError("Your password must contain at least 8 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Your passwords do not match.");
      return;
    }

    setLoading(true);

    try {
      const supabase = createSupabaseBrowserClient();

      if (isPartnerFlow) {
        const response = await fetch("/api/partner/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fullName: fullName.trim(),
            email: email.trim().toLowerCase(),
            phone: phone.trim(),
            password,
          }),
        });
        const result = await response.json();
        if (!response.ok || !result.success) {
          throw new Error(result.message || "Partner registration could not be completed.");
        }
        const { error: loginError } = await supabase.auth.signInWithPassword({
          email: email.trim().toLowerCase(),
          password,
        });
        if (loginError) throw loginError;
        window.location.replace("/partner/dashboard");
        return;
      }

      const { data, error: signUpError } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password,
        options: {
          data: { full_name: fullName.trim(), phone: phone.trim() },
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      if (signUpError) throw signUpError;
      if (data.session) {
        window.location.replace("/account");
        return;
      }
      setSuccess("Your account registration was received. Please check your email for a confirmation link before signing in.");
    } catch (err) {
      console.error("Registration error:", err);
      setError(
        err instanceof Error
          ? err.message
          : "We could not create your account. Please try again."
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

          <Link
            href={isPartnerFlow ? "/login?mode=partner&next=%2Fpartner%2Fdashboard" : "/login"}
            className="text-sm font-semibold text-gray-600 hover:text-[#c49a52]"
          >
            Already have an account? Sign in
          </Link>
        </div>
      </header>

      <section className="container flex justify-center px-4 py-12 md:py-20">
        <div className="w-full max-w-xl rounded-3xl border border-gray-100 bg-white p-7 shadow-sm md:p-10">
          <div className="mb-8 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-[#f1eadc] text-[#a77e3e]">
              <UserPlus size={30} />
            </div>

            <p className="mt-6 text-xs font-bold tracking-[0.2em] text-[#c49a52]">
              JOIN ZURISTAY WORLDWIDE
            </p>

            <h1 className="mt-3 text-3xl font-bold">
              Create your account
            </h1>

            <p className="mt-3 text-sm leading-6 text-gray-500">
              {isPartnerFlow ? "Create your partner account and choose your password. After registration, use the Sign in option below to access your partner dashboard." : "Create your ZuriStay account to manage your stays and bookings."}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label
                htmlFor="fullName"
                className="mb-2 block text-sm font-semibold"
              >
                Full name *
              </label>
              <input
                id="fullName"
                type="text"
                required
                maxLength={120}
                autoComplete="name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Enter your full name"
                className="w-full rounded-xl border border-gray-200 px-4 py-3.5 text-sm outline-none focus:border-[#c49a52] focus:ring-2 focus:ring-[#c49a52]/15"
              />
            </div>

            <div>
              <label
                htmlFor="email"
                className="mb-2 block text-sm font-semibold"
              >
                Email address *
              </label>
              <input
                id="email"
                type="email"
                required
                maxLength={254}
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full rounded-xl border border-gray-200 px-4 py-3.5 text-sm outline-none focus:border-[#c49a52] focus:ring-2 focus:ring-[#c49a52]/15"
              />
            </div>

            <div>
              <label
                htmlFor="phone"
                className="mb-2 block text-sm font-semibold"
              >
                Phone number
              </label>
              <input
                id="phone"
                type="tel"
                maxLength={30}
                autoComplete="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+254 7XX XXX XXX"
                className="w-full rounded-xl border border-gray-200 px-4 py-3.5 text-sm outline-none focus:border-[#c49a52] focus:ring-2 focus:ring-[#c49a52]/15"
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="mb-2 block text-sm font-semibold"
              >
                Password *
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  required
                  minLength={8}
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 8 characters"
                  className="w-full rounded-xl border border-gray-200 px-4 py-3.5 pr-12 text-sm outline-none focus:border-[#c49a52] focus:ring-2 focus:ring-[#c49a52]/15"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500"
                >
                  {showPassword ? <EyeOff size={19} /> : <Eye size={19} />}
                </button>
              </div>
            </div>

            <div>
              <label
                htmlFor="confirmPassword"
                className="mb-2 block text-sm font-semibold"
              >
                Confirm password *
              </label>
              <input
                id="confirmPassword"
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Enter your password again"
                className="w-full rounded-xl border border-gray-200 px-4 py-3.5 text-sm outline-none focus:border-[#c49a52] focus:ring-2 focus:ring-[#c49a52]/15"
              />
            </div>

            {error && (
              <p
                role="alert"
                className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700"
              >
                {error}
              </p>
            )}

            {success && (
              <div
                role="status"
                className="rounded-xl bg-green-50 p-4 text-sm leading-6 text-green-800"
              >
                <div className="mb-2 flex items-center gap-2 font-bold">
                  <CheckCircle2 size={19} />
                  Registration received
                </div>
                {success}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-3 rounded-full bg-[#173b30] px-7 py-4 font-bold text-white transition hover:bg-[#245545] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? "Creating account..." : "Create account"}
              {!loading && <ArrowRight size={18} />}
            </button>

            <p className="text-center text-xs leading-6 text-gray-500">
              By creating an account, you agree to use ZuriStay Worldwide
              responsibly and provide accurate information.
            </p>
          </form>

          <div className="mt-8 border-t border-gray-100 pt-6 text-center text-sm text-gray-600">
            Already registered?{" "}
            <Link
              href="/login?next=%2Fpartner%2Fdashboard"
              className="font-bold text-[#a77e3e] hover:underline"
            >
              Sign in
            </Link>
          </div>
        </div>
      </section>

      <footer className="py-8 text-center text-sm text-gray-400">
        © {new Date().getFullYear()} ZuriStay Worldwide. Your World. Your Stay.
      </footer>
    </main>
  );
}
