
"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Eye,
  EyeOff,
  LogIn,
  CheckCircle2,
} from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);

    try {
      const supabase = createSupabaseBrowserClient();

      const { data, error: loginError } =
        await supabase.auth.signInWithPassword({
          email: email.trim().toLowerCase(),
          password,
        });

      if (loginError) {
        throw loginError;
      }

      if (!data.session?.user) {
        throw new Error("Sign-in did not establish a session. Please try again.");
      }

      setSuccess("Login successful. Redirecting...");

      // Return guests to their account by default, or to the safe page
      // they originally requested.
      const requestedPath = new URLSearchParams(window.location.search).get("next");
      const safeNextPath =
        requestedPath && requestedPath.startsWith("/") && !requestedPath.startsWith("//")
          ? requestedPath
          : "/account";

      // A full navigation lets the next page initialise from the saved
      // Supabase session instead of relying on stale client-side state.
      window.location.replace(safeNextPath);
    } catch (err) {
      console.error("Login error:", err);

      setError(
        err instanceof Error
          ? err.message
          : "Unable to sign in. Please check your details and try again."
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
            href="/register"
            className="text-sm font-semibold text-gray-600 hover:text-[#c49a52]"
          >
            Create account
          </Link>
        </div>
      </header>

      <section className="container flex justify-center px-4 py-12 md:py-20">
        <div className="w-full max-w-xl rounded-3xl border border-gray-100 bg-white p-7 shadow-sm md:p-10">
          <div className="mb-8 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-[#f1eadc] text-[#a77e3e]">
              <LogIn size={30} />
            </div>

            <p className="mt-6 text-xs font-bold tracking-[0.2em] text-[#c49a52]">
              WELCOME BACK
            </p>

            <h1 className="mt-3 text-3xl font-bold">
              Sign in to ZuriStay Worldwide
            </h1>

            <p className="mt-3 text-sm leading-6 text-gray-500">
              Access your account and continue your stay journey.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
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
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
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

            <div className="-mt-2 text-right">
              <Link
                href="/forgot-password"
                className="text-sm font-semibold text-[#a77e3e] hover:underline"
              >
                Forgot password?
              </Link>
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
              <p
                role="status"
                className="flex items-center gap-2 rounded-xl bg-green-50 px-4 py-3 text-sm text-green-800"
              >
                <CheckCircle2 size={18} />
                {success}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-3 rounded-full bg-[#173b30] px-7 py-4 font-bold text-white transition hover:bg-[#245545] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? "Signing in..." : "Sign in"}
              {!loading && <ArrowRight size={18} />}
            </button>
          </form>

          <div className="mt-8 border-t border-gray-100 pt-6 text-center text-sm text-gray-600">
            Don&apos;t have an account?{" "}
            <Link
              href="/register"
              className="font-bold text-[#a77e3e] hover:underline"
            >
              Create one
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
